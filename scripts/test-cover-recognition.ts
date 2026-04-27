/**
 * Cover Recognition Validation Script
 *
 * Tests Gemini Flash vision against a set of book cover photos.
 *
 * Usage: npx tsx scripts/test-cover-recognition.ts ./test-covers/
 *
 * Directory structure:
 *   test-covers/
 *     covers/          <- book cover images (jpg, png, webp)
 *     expected.json    <- ground truth: [{ "file": "cover1.jpg", "title": "...", "author": "..." }]
 *
 * Go/no-go threshold: 70% correct title identification.
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
	console.error('Error: GEMINI_API_KEY not set in .env');
	process.exit(1);
}

// Keep in sync with src/lib/server/cover-recognition.ts
const PROMPT = `You are looking at a photo. If it shows a book cover, identify the book.

Return ONLY valid JSON, no markdown fences:
{"title": "exact book title", "author": "author full name", "confidence": "high"|"medium"|"low"|"none"}

Rules:
- "title" = the book's actual title as published (not a subtitle, series name, or tagline)
- "author" = the author's full name as credited on the cover
- "high" = you can clearly read or confidently recognize the book
- "medium" = you can mostly read it but there is some ambiguity
- "low" = partial text visible, best guess
- "none" = not a book cover, or completely unreadable
- If this is not a book cover, return {"title": null, "author": null, "confidence": "none"}`;

interface Expected {
	file: string;
	title: string;
	author: string;
}

interface Result {
	file: string;
	expected: { title: string; author: string };
	got: { title: string | null; author: string | null; confidence: string };
	titleMatch: boolean;
	authorMatch: boolean;
	correct: boolean;
	durationMs: number;
}

function fuzzyMatch(expected: string, got: string | null): boolean {
	if (!got) return false;
	const norm = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	const e = norm(expected);
	const g = norm(got);
	return e === g || g.includes(e) || e.includes(g);
}

function getMimeType(file: string): string {
	const ext = path.extname(file).toLowerCase();
	const types: Record<string, string> = {
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.webp': 'image/webp'
	};
	return types[ext] || 'image/jpeg';
}

async function identifyCover(
	imageBuffer: Buffer,
	mimeType: string
): Promise<{ title: string | null; author: string | null; confidence: string }> {
	const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
	const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

	const result = await model.generateContent({
		contents: [
			{
				role: 'user',
				parts: [
					{ text: PROMPT },
					{ inlineData: { data: imageBuffer.toString('base64'), mimeType } }
				]
			}
		]
	});

	const text = result.response.text().trim();
	const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
	return JSON.parse(cleaned);
}

async function main() {
	const dir = process.argv[2];
	if (!dir) {
		console.error('Usage: npx tsx scripts/test-cover-recognition.ts <test-directory>');
		console.error('');
		console.error('Directory should contain:');
		console.error('  covers/       <- book cover images');
		console.error('  expected.json <- [{ "file": "name.jpg", "title": "...", "author": "..." }]');
		process.exit(1);
	}

	const expectedPath = path.join(dir, 'expected.json');
	if (!fs.existsSync(expectedPath)) {
		console.error(`Error: ${expectedPath} not found`);
		process.exit(1);
	}

	const expectedList: Expected[] = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
	console.log(`\nTesting ${expectedList.length} cover images...\n`);

	const results: Result[] = [];

	for (const exp of expectedList) {
		const imgPath = path.join(dir, 'covers', exp.file);
		if (!fs.existsSync(imgPath)) {
			console.error(`  SKIP: ${exp.file} not found`);
			continue;
		}

		const start = Date.now();
		try {
			const imageBuffer = fs.readFileSync(imgPath);
			const got = await identifyCover(imageBuffer, getMimeType(exp.file));
			const durationMs = Date.now() - start;

			const titleMatch = fuzzyMatch(exp.title, got.title);
			const authorMatch = fuzzyMatch(exp.author, got.author);
			const correct = titleMatch; // Title match is the primary success criterion

			const icon = correct ? 'PASS' : 'FAIL';
			console.log(`  ${icon} ${exp.file} (${durationMs}ms)`);
			console.log(`    Expected: "${exp.title}" by ${exp.author}`);
			console.log(`    Got:      "${got.title}" by ${got.author} [${got.confidence}]`);
			if (!correct) {
				console.log(`    Title: ${titleMatch ? 'match' : 'MISMATCH'}, Author: ${authorMatch ? 'match' : 'MISMATCH'}`);
			}
			console.log('');

			results.push({ file: exp.file, expected: { title: exp.title, author: exp.author }, got, titleMatch, authorMatch, correct, durationMs });

			// Small delay to respect rate limits
			await new Promise((r) => setTimeout(r, 500));
		} catch (err) {
			const durationMs = Date.now() - start;
			console.error(`  ERROR ${exp.file} (${durationMs}ms): ${err}`);
			results.push({
				file: exp.file,
				expected: { title: exp.title, author: exp.author },
				got: { title: null, author: null, confidence: 'error' },
				titleMatch: false,
				authorMatch: false,
				correct: false,
				durationMs
			});
		}
	}

	// Summary
	const total = results.length;
	const correct = results.filter((r) => r.correct).length;
	const rate = total > 0 ? ((correct / total) * 100).toFixed(1) : '0';
	const avgMs = total > 0 ? Math.round(results.reduce((s, r) => s + r.durationMs, 0) / total) : 0;

	console.log('='.repeat(50));
	console.log(`\nResults: ${correct}/${total} correct (${rate}%)`);
	console.log(`Average latency: ${avgMs}ms\n`);

	const byConfidence: Record<string, Result[]> = {};
	for (const r of results) {
		const c = r.got.confidence;
		(byConfidence[c] ||= []).push(r);
	}
	for (const [level, items] of Object.entries(byConfidence)) {
		const acc = items.filter((i) => i.correct).length;
		console.log(`  ${level}: ${acc}/${items.length} correct`);
	}

	console.log('');
	const GO_THRESHOLD = 70;
	if (parseFloat(rate) >= GO_THRESHOLD) {
		console.log(`GO -- ${rate}% meets/exceeds ${GO_THRESHOLD}% threshold. Proceed with implementation.`);
	} else {
		console.log(`NO-GO -- ${rate}% below ${GO_THRESHOLD}% threshold.`);
		console.log('  Review failures above. Consider prompt tuning or different model.');
	}

	// Save detailed results
	const outputPath = path.join(dir, 'results.json');
	fs.writeFileSync(
		outputPath,
		JSON.stringify({ results, summary: { total, correct, rate: parseFloat(rate), avgMs } }, null, 2)
	);
	console.log(`\nDetailed results saved to ${outputPath}`);
}

main().catch(console.error);
