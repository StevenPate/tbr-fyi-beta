import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';

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
	if (!env.GEMINI_API_KEY) {
		console.warn('cover-recognition: GEMINI_API_KEY not set');
		return NONE;
	}

	if (imageBuffer.length < MIN_IMAGE_BYTES) {
		return NONE;
	}

	try {
		const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY!);
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
