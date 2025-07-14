import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";
import { pdfToPng } from "pdf-to-png-converter";

function cloneBuffer(buffer) {
	return Buffer.from(buffer);
}

const concurrency = 4;
const workers = [];

await initWorkers();

export async function initWorkers() {
	for (let i = 0; i < concurrency; i++) {
		const worker = await createWorker("lit+eng", 1, {
			langPath: "./tessdata",
		});
		workers.push(worker);
	}
}

export async function terminateWorkers() {
	await Promise.all(workers.map((w) => w.terminate()));
	workers.length = 0;
}

export async function processDocument(buffer) {
	if (workers.length !== concurrency) {
		throw new Error("Workers not initialized. Call initWorkers() first.");
	}

	const pdfjsDoc = await getDocument({
		data: new Uint8Array(cloneBuffer(buffer)),
	}).promise;
	const numPages = pdfjsDoc.numPages;

	const results = new Array(numPages);
	const pagesNeedingOCR = [];

	// Step 1: Sequential text extraction
	for (let i = 1; i <= numPages; i++) {
		try {
			const page = await pdfjsDoc.getPage(i);
			const content = await page.getTextContent();

			const text = content.items
				.map((item) => item.str)
				.join(" ")
				.trim();

			if (text.length >= 32) {
				results[i - 1] = text;
			} else {
				pagesNeedingOCR.push(i);
			}
		} catch (err) {
			console.error(`Failed to extract text from page ${i}:`, err);
			results[i - 1] = "";
		}
	}

	// Step 2: Parallel OCR on pages needing it
	let running = 0;
	let currentIndex = 0;

	return new Promise((resolve) => {
		const next = () => {
			if (currentIndex >= pagesNeedingOCR.length && running === 0) {
				resolve(results);
				return;
			}

			while (running < concurrency && currentIndex < pagesNeedingOCR.length) {
				const pageNum = pagesNeedingOCR[currentIndex++];
				running++;

				(async () => {
					try {
						const pngPages = await pdfToPng(cloneBuffer(buffer), {
							pagesToProcess: [pageNum],
							disableFontFace: false,
							viewportScale: 2,
							quality: 100,
						});

						if (!pngPages || pngPages.length === 0) {
							throw new Error(`Could not convert page ${pageNum} to PNG`);
						}

						const imageBuffer = pngPages[0].content;

						// Round-robin worker
						const worker = workers[pageNum % concurrency];
						const {
							data: { text: ocrText },
						} = await worker.recognize(imageBuffer, {
							tessedit_pageseg_mode: "6", // single block of text
							tessedit_ocr_engine_mode: "0", // legacy engine (faster)
							tessedit_do_invert: "0"
						});

						results[pageNum - 1] = ocrText.trim();
					} catch (err) {
						console.error(`Failed OCR on page ${pageNum}:`, err);
						results[pageNum - 1] = "";
					} finally {
						running--;
						next();
					}
				})();
			}
		};

		next();
	});
}
