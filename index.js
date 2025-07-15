import fs from "fs/promises";
import { processDocument } from "./processDocument.js";
import { configDotenv } from "dotenv";
import express from "express";
import multer from "multer";

configDotenv();

const PORT = process.env.PORT || 9027;
const API_KEY = process.env.API_KEY;
const REQUIRE_API_KEY = process.env.REQUIRE_API_KEY === "true";

// Utility to get file buffer
async function getFileBuffer(input) {
	if (input.startsWith("http://") || input.startsWith("https://")) {
		const response = await fetch(input);
		if (!response.ok) {
			throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		return new Uint8Array(arrayBuffer);
	} else {
		const buffer = await fs.readFile(input);
		return new Uint8Array(buffer);
	}
}

// Handle CLI input
const inputs = process.argv.slice(2);

if (inputs.length > 0) {
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
			process.exit(1);
		}
	}
}

// HTTP server setup
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// Middleware for API key check
app.use((req, res, next) => {
	if (REQUIRE_API_KEY && req.headers["x-api-key"] !== API_KEY) {
		return res.status(401).json({ error: "Unauthorized: Invalid API key" });
	}
	next();
});

app.post("/process", upload.single("file"), async (req, res) => {
	try {
		if (!req.file || !req.file.buffer) {
			return res.status(400).json({ error: "No file uploaded" });
		}

		const start = Date.now();
		const result = await processDocument(new Uint8Array(req.file.buffer));
		const end = Date.now();

		res.json({
			pages: result,
			duration_ms: end - start
		});
	} catch (err) {
		res.status(500).json({ error: `Failed to process document: ${err.message}` });
	}
});

// Prevent timeouts for long processing
app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
