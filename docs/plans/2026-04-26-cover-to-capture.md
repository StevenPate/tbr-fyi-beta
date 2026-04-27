# Cover-to-Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a photo of a book cover fails barcode detection, use Gemini Flash to identify the book by sight and feed results into the existing search flow — for both SMS and web channels.

**Architecture:** Photo → barcode detection (existing, fast) → on failure, Gemini Flash vision returns `{title, author}` → Google Books search validates → existing candidate UI. SMS reuses the search→ADD flow. Web detect endpoint already handles image uploads with camera capture UI in the modal — only the server-side fallback is missing.

**Tech Stack:** `@google/generative-ai` (Gemini 2.5 Flash), existing SvelteKit endpoints, existing Google Books search, existing SMS context pattern.

**Supersedes:** `docs/plans/cover-photo-recognition.md` (January 2025 OCR + heuristic parsing approach).

---

## Task 1: Add Gemini SDK and Environment Config

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

**Step 1: Install the Gemini SDK**

Run:
```bash
npm install @google/generative-ai
```

**Step 2: Add GEMINI_API_KEY to `.env.example`**

In `.env.example`, add under the optional variables section:

```env
GEMINI_API_KEY=your-gemini-api-key      # For cover photo recognition (https://aistudio.google.com/apikey)
```

**Step 3: Add GEMINI_API_KEY to your local `.env`**

Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey) and add it to `.env`:

```env
GEMINI_API_KEY=AIza...
```

**Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: add @google/generative-ai SDK for cover recognition"
```

---

## Task 2: Create Cover Recognition Module

**Files:**
- Create: `src/lib/server/cover-recognition.ts`

**Step 1: Write the cover recognition module**

Create `src/lib/server/cover-recognition.ts`:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '$env/static/private';

export interface CoverIdentification {
	title: string | null;
	author: string | null;
	confidence: 'high' | 'medium' | 'low' | 'none';
}

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

const MIN_IMAGE_BYTES = 30_000; // Skip tiny images (likely thumbnails)
const TIMEOUT_MS = 8_000;

const NONE: CoverIdentification = { title: null, author: null, confidence: 'none' };

/**
 * Use Gemini Flash vision to identify a book from a cover photo.
 * Returns structured identification with confidence level.
 * Never throws — returns confidence "none" on any failure.
 */
export async function identifyBookFromCover(
	imageBuffer: Buffer,
	mimeType: string = 'image/jpeg'
): Promise<CoverIdentification> {
	if (!GEMINI_API_KEY) {
		console.warn('cover-recognition: GEMINI_API_KEY not set');
		return NONE;
	}

	if (imageBuffer.length < MIN_IMAGE_BYTES) {
		return NONE;
	}

	try {
		const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
		const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

		const resultPromise = model.generateContent({
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

		// Race against timeout
		const timeoutPromise = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
		);

		const result = await Promise.race([resultPromise, timeoutPromise]);
		const text = result.response.text().trim();

		// Strip markdown code fences if model wraps response
		const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
		const parsed = JSON.parse(cleaned);

		// Validate response shape
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			['high', 'medium', 'low', 'none'].includes(parsed.confidence)
		) {
			return {
				title: typeof parsed.title === 'string' ? parsed.title : null,
				author: typeof parsed.author === 'string' ? parsed.author : null,
				confidence: parsed.confidence
			};
		}

		console.warn('cover-recognition: unexpected response shape', { text });
		return NONE;
	} catch (err) {
		if (err instanceof Error && err.message === 'Timeout') {
			console.warn('cover-recognition: timeout');
		} else {
			console.error('cover-recognition: error', err);
		}
		return NONE;
	}
}
```

**Step 2: Verify the module compiles**

Run:
```bash
npm run check
```

Expected: No type errors related to `cover-recognition.ts`.

**Step 3: Commit**

```bash
git add src/lib/server/cover-recognition.ts
git commit -m "feat: add cover recognition module using Gemini Flash vision"
```

---

## Task 3: Create Validation Script

**Files:**
- Create: `scripts/test-cover-recognition.ts`

This script tests the Gemini prompt against real book cover photos to validate accuracy before wiring it into the app.

**Step 1: Write the validation script**

Create `scripts/test-cover-recognition.ts`:

```typescript
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
```

**Step 2: Install tsx if not already available**

Run:
```bash
npx tsx --version
```

If not installed:
```bash
npm install -D tsx dotenv
```

**Step 3: Commit**

```bash
git add scripts/test-cover-recognition.ts
git commit -m "feat: add cover recognition validation script"
```

---

## Task 4: Run Validation — Go/No-Go Gate

**This task blocks all remaining tasks. If validation fails (<70%), stop and revisit the approach.**

**Step 1: Create test directory and collect cover photos**

```bash
mkdir -p test-covers/covers
```

Collect 15-20 book cover photos. Good sources:
- Take photos of physical books on your shelf (varied lighting, angles)
- Screenshot covers from bookshop.org or Amazon
- Include diversity: fiction, non-fiction, stylized typography, foreign language, blurry, dark

**Step 2: Create the expected results file**

Create `test-covers/expected.json` mapping each photo to the correct title and author:

```json
[
  { "file": "goldfinch.jpg", "title": "The Goldfinch", "author": "Donna Tartt" },
  { "file": "sapiens.jpg", "title": "Sapiens", "author": "Yuval Noah Harari" },
  { "file": "bluets.jpg", "title": "Bluets", "author": "Maggie Nelson" }
]
```

**Step 3: Run the validation**

```bash
npx tsx scripts/test-cover-recognition.ts ./test-covers/
```

Expected output: GO at 70%+ accuracy.

**Step 4: Review and decide**

- 70%+: proceed to Task 5
- 50-70%: try tuning the prompt in the script, retest
- <50%: stop, revisit approach

**Step 5: Add test-covers to .gitignore (do not commit photos)**

```bash
echo "test-covers/" >> .gitignore
git add .gitignore
git commit -m "chore: add test-covers to gitignore"
```

---

## Task 5: Add Cover Recognition SMS Messages

**Files:**
- Modify: `src/lib/server/sms-messages.ts` (after line 141, the `MMS_UNAVAILABLE` entry)

**Step 1: Add cover recognition messages**

Add these entries inside the `SMS_MESSAGES` object, after the `MMS_UNAVAILABLE` line:

```typescript
	// === Cover Photo Recognition ===
	coverNoMatch: (title: string) =>
		`I read "${title}" from the cover but couldn't find a match. Try texting the title and author directly.`,

	coverSearchFailed: () =>
		"I could see text on the cover but couldn't match it to a book. Try texting the title and author directly.",
```

**Step 2: Verify types compile**

```bash
npm run check
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/server/sms-messages.ts
git commit -m "feat: add cover recognition SMS messages"
```

---

## Task 6: Integrate Cover Recognition into SMS MMS Flow

**Files:**
- Modify: `src/routes/api/sms/+server.ts`

**Context:** The MMS photo flow starts at line 670. When `detectBarcodes` returns 0 ISBNs (line 732), it currently returns `MMS_NO_ISBN_DETECTED` immediately. We insert cover recognition between barcode failure and that fallback.

**Step 1: Add import at top of file**

Add alongside the existing imports in `src/routes/api/sms/+server.ts`:

```typescript
import { identifyBookFromCover } from '$lib/server/cover-recognition';
```

**Step 2: Replace the barcode-failure early return**

Find this block (lines 732-734):

```typescript
			if (isbns.length === 0) {
				return twimlResponse(SMS_MESSAGES.MMS_NO_ISBN_DETECTED);
			}
```

Replace with:

```typescript
			if (isbns.length === 0) {
				// Barcode detection failed — try cover recognition via Gemini Flash
				const coverResult = await identifyBookFromCover(imageBuffer, contentType);
				console.log('MMS cover recognition result', {
					reqId,
					confidence: coverResult.confidence,
					title: coverResult.title
				});

				if (coverResult.title && coverResult.confidence !== 'none') {
					// Search Google Books to validate the identification
					try {
						const candidates = await searchBooks({
							title: coverResult.title,
							author: coverResult.author || undefined,
							max: 8
						});

						if (candidates && candidates.length > 0) {
							const top = candidates[0];
							// Reuse existing search -> ADD flow via sms_context
							await supabase.from('sms_context').upsert({
								phone_number: userId,
								last_isbn13: top.isbn13,
								last_title: top.title,
								updated_at: new Date().toISOString()
							});

							const query = coverResult.author
								? `${coverResult.title} ${coverResult.author}`
								: coverResult.title;

							const msg = SMS_MESSAGES.searchBestMatch(
								top.title,
								top.authors,
								top.isbn13,
								userId,
								query
							);
							return twimlResponse(msg);
						}

						// Search returned no results
						return twimlResponse(SMS_MESSAGES.coverNoMatch(coverResult.title));
					} catch (e) {
						console.error('Cover search error:', e);
						return twimlResponse(SMS_MESSAGES.coverSearchFailed());
					}
				}

				// Cover recognition also failed — original fallback
				return twimlResponse(SMS_MESSAGES.MMS_NO_ISBN_DETECTED);
			}
```

**Step 3: Verify `searchBooks` and `supabase` are already imported**

These should already be imported in the file — `searchBooks` is used at line 910 for text search, and `supabase` is used throughout for database operations. Confirm both are present in the imports. If `searchBooks` is missing, add:

```typescript
import { searchBooks } from '$lib/server/metadata';
```

**Step 4: Verify types compile**

```bash
npm run check
```

Expected: No errors.

**Step 5: Manual test with SMS**

```bash
npm run dev:tunnel
```

1. Send a photo of a book cover (front cover only, no barcode visible) to the Twilio number
2. Expected response: `Found: "[title]" by [author] (ISBN: ...). Reply ADD to add, or click here...`
3. Reply `ADD` — book should be added to shelf
4. Send a photo of a non-book image — expected: `Photo received, no valid ISBN detected.`

**Step 6: Commit**

```bash
git add src/routes/api/sms/+server.ts
git commit -m "feat: add cover recognition fallback to SMS photo flow"
```

---

## Task 7: Integrate Cover Recognition into Web Detect Endpoint

**Files:**
- Modify: `src/routes/api/books/detect/+server.ts`

**Context:** The `type === 'image'` branch (lines 179-199) currently returns `{ error: 'No barcodes found in image' }` when barcode detection fails. The web UI already has a camera capture button (`src/routes/[identifier]/+page.svelte:1946`) and routes image files through `detectInputType() -> fileToBase64() -> POST /api/books/detect`. Once this endpoint gains a cover fallback, camera captures will work end-to-end — no UI changes needed.

**Step 1: Add import at top of file**

Add alongside the existing imports in `src/routes/api/books/detect/+server.ts`:

```typescript
import { identifyBookFromCover } from '$lib/server/cover-recognition';
```

**Step 2: Replace the image handling branch**

Find the `else if (type === 'image')` block (lines 179-199). Replace it entirely with:

```typescript
		else if (type === 'image') {
			// Validate decoded bytes (base64 inflates by ~33%)
			const sizeEstimate = (content as string).length * 0.75;
			if (sizeEstimate > MAX_DECODED_IMAGE_BYTES) {
				return json({ error: 'Image too large (max 3.5MB)' }, { status: 413 });
			}

			// Convert base64 to buffer
			const imageBuffer = Buffer.from(content as string, 'base64');

			// Try barcode detection first (fast, reliable)
			const { isbns: detectedISBNs } = await detectBarcodes(imageBuffer, {
				timeoutMs: 5000,
				maxResults: 5
			});

			if (detectedISBNs.length > 0) {
				isbns = detectedISBNs;
			} else {
				// Barcode failed — try cover recognition via Gemini Flash
				const coverResult = await identifyBookFromCover(imageBuffer);

				if (coverResult.title && coverResult.confidence !== 'none') {
					// Search Google Books with identified title/author
					const candidates = await searchBooks({
						title: coverResult.title,
						author: coverResult.author || undefined,
						max: 8
					});

					if (candidates && candidates.length > 0) {
						// Deduplicate and return as detected books (same shape as text search results)
						const seen = new Set<string>();
						const detected = candidates
							.filter((c) => {
								if (seen.has(c.isbn13)) return false;
								seen.add(c.isbn13);
								return true;
							})
							.map((c) => ({
								isbn13: c.isbn13,
								title: c.title,
								author: c.authors,
								publisher: c.publisher,
								publicationDate: c.publicationDate,
								coverUrl: c.coverUrl
							}));
						return json({ success: true, detected });
					}

					return json(
						{
							error: `Couldn't find a match for "${coverResult.title}". Try entering the title manually.`
						},
						{ status: 404 }
					);
				}

				return json(
					{ error: 'No books detected in image. Try a clearer photo or enter the ISBN manually.' },
					{ status: 400 }
				);
			}
		}
```

**Step 3: Verify types compile**

```bash
npm run check
```

Expected: No errors.

**Step 4: Manual test with web UI**

1. Start dev server: `npm run dev`
2. Open your shelf page, click the "+" button
3. Click the "Take/Upload Photo or CSV" button and select a photo of a book cover
4. Expected: Loading spinner → candidate results appear with cover thumbnails
5. Select a result and click "Add" — book should be added

**Step 5: Commit**

```bash
git add src/routes/api/books/detect/+server.ts
git commit -m "feat: add cover recognition fallback to web detect endpoint"
```

---

## Task 8: Update Docs and Clean Up

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/plans/cover-photo-recognition.md` (mark superseded)
- Modify: `.env.example` (if not already done in Task 1)
- Remove: `scripts/test-cover-ocr.ts` (superseded)

**Step 1: Mark the original plan as superseded**

Add this line at the very top of `docs/plans/cover-photo-recognition.md`, before the `# Cover Photo Recognition` heading:

```markdown
> **Status: Superseded** — replaced by LLM-based approach. See `docs/plans/2026-04-26-cover-to-capture.md`.

```

**Step 2: Add cover recognition to CLAUDE.md**

In the **Environment Setup** section's "Optional variables" block, add:

```
GEMINI_API_KEY=your-gemini-api-key  # Cover photo recognition via Gemini Flash
```

In the **Architecture & Key Patterns** section, after the "Metadata Fetching Strategy" subsection, add:

```markdown
### Cover Photo Recognition

When a photo fails barcode detection, the system falls back to Gemini Flash vision to identify the book by its cover:

1. `detectBarcodes()` returns 0 ISBNs
2. `identifyBookFromCover()` sends the image to Gemini Flash with a structured prompt
3. Returns `{title, author, confidence}` — never throws
4. `searchBooks({title, author})` validates against Google Books
5. Results feed into existing candidate flow (SMS: search→ADD pattern, web: detect→modal UI)

The module is at `src/lib/server/cover-recognition.ts`. It gracefully degrades to the original "no ISBN detected" message when `GEMINI_API_KEY` is not set.
```

**Step 3: Remove the superseded OCR test script**

```bash
git rm scripts/test-cover-ocr.ts
```

**Step 4: Commit**

```bash
git add CLAUDE.md docs/plans/cover-photo-recognition.md
git commit -m "docs: add cover recognition to architecture docs, mark old plan as superseded"
```

---

## Design Decisions Log

These decisions were made during plan design and should not be revisited during implementation:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM provider | Gemini Flash via `@google/generative-ai` | Already in Google Cloud ecosystem, cheapest multimodal option (~$0.01/image), fast enough for SMS |
| OCR pipeline | Eliminated entirely | LLM reads visual context directly — no need for `documentTextDetection` + heuristic block parsing |
| New database table | None | Cover recognition feeds into existing `searchBooks()` → `sms_context` → ADD flow |
| Web UI changes | None needed | Camera capture button already exists (`+page.svelte:1946`), `detectInputType` already routes images |
| SMS flow pattern | Reuse search→ADD | Cover photo → title/author → `searchBooks()` → `sms_context` upsert → `searchBestMatch` response → user replies ADD |
| Auto-add on high confidence | Deferred to Phase 3 | Start with always-confirm to collect accuracy data |
| Validation threshold | 70% title accuracy | Higher than original 40% because LLM should substantially outperform OCR heuristics |
| Timeout | 8 seconds | LLM call is slower than Vision API; 8s is acceptable within SMS response window |

## Future Work (not in scope)

- **Phase 3: Auto-add on high confidence** — When accuracy data confirms reliability, change SMS flow to auto-add when `confidence === 'high'` and top search result is a strong match. Small change to Task 6's cover recognition block.
- **Multi-cover photos** — Identifying multiple books in a single photo (e.g., a bookshelf). Defer to v2.
- **Cost monitoring** — Add logging of Gemini API calls for spend tracking. Currently overkill at ~$0.01/call.
