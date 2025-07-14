import fs from "fs/promises";
import { processDocument } from "./processDocument.js";

async function getFileBuffer(input) {
	if (input.startsWith("http://") || input.startsWith("https://")) {
		const response = await fetch(input);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch file: ${response.status} ${response.statusText}`
			);
		}
		const arrayBuffer = await response.arrayBuffer();
		return new Uint8Array(arrayBuffer);
	} else {
		const buffer = await fs.readFile(input);
		return new Uint8Array(buffer);
	}
}

const inputs = process.argv.slice(2);

if (inputs.length === 0) {
	console.error("Usage: node index.js <file1.pdf|url1> [file2.pdf|url2] ...");
	process.exit(1);
}

for (const input of inputs) {
	console.log(`Processing file: ${input}`);
	try {
		const start = Date.now();
		const fileBuffer = await getFileBuffer(input);
		const result = await processDocument(fileBuffer);
		const end = Date.now();

		result.forEach((pageText, i) => {
			console.log(`\n--- Page ${i + 1} ---\n${pageText}`);
		});
		console.log(`Processing completed in ${end - start} ms\n`);
		process.exit(0);
	} catch (err) {
		console.error(`Failed to process file ${input}: ${err.message}`);
	}
}
