// src/lib/server/vision.ts

import { ImageAnnotatorClient } from '@google-cloud/vision';
import { env as dynamicEnv } from '$env/dynamic/private';
import { toISBN13, InvalidISBNError } from '$lib/server/metadata/types';
import path from 'node:path';

// Minimal types to avoid implicit any when using Vision responses
interface TextAnnotation {
	description?: string;
}
interface VisionTextResult {
	textAnnotations?: TextAnnotation[];
}

let client: ImageAnnotatorClient | null = null;
let lastInitError: Error | null = null;
let lastInitAttempt = 0;
const REINIT_DELAY_MS = 60000; // Wait 1 minute before retrying after failure

/**
 * Get or initialize the Vision API client with error recovery.
 *
 * If initialization fails, the error is cached and the function will
 * retry after REINIT_DELAY_MS milliseconds. This prevents permanent
 * failure states while avoiding rapid retry loops.
 */
function getVisionClient(): ImageAnnotatorClient {
	// Return existing client if initialized successfully
	if (client) return client;

	// Check if we should retry after a previous failure
	const now = Date.now();
	if (lastInitError && (now - lastInitAttempt) < REINIT_DELAY_MS) {
		// Too soon to retry - throw the cached error
		throw new Error(
			`Vision client initialization failed. Retry in ${Math.ceil((REINIT_DELAY_MS - (now - lastInitAttempt)) / 1000)}s. ` +
			`Original error: ${lastInitError.message}`
		);
	}

	// Attempt (re)initialization
	lastInitAttempt = now;

	try {
		// Prefer explicit credentials via env vars; fallback to ADC/GOOGLE_APPLICATION_CREDENTIALS
		const clientEmail = dynamicEnv.GOOGLE_CLIENT_EMAIL;
		const privateKeyRaw = dynamicEnv.GOOGLE_PRIVATE_KEY;
		const projectId = dynamicEnv.GOOGLE_PROJECT_ID || dynamicEnv.GCP_PROJECT_ID;
		const keyFile = dynamicEnv.GOOGLE_APPLICATION_CREDENTIALS;

		if (clientEmail && privateKeyRaw) {
			const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
			client = new ImageAnnotatorClient({
				credentials: { client_email: clientEmail, private_key: privateKey },
				projectId
			});
		} else if (keyFile) {
			// Support GOOGLE_APPLICATION_CREDENTIALS path explicitly via keyFilename
			const keyFilename = path.isAbsolute(keyFile) ? keyFile : path.resolve(process.cwd(), keyFile);
			client = new ImageAnnotatorClient({
				keyFilename,
				projectId
			});
		} else {
			client = new ImageAnnotatorClient();
		}

		// Clear error state on successful initialization
		lastInitError = null;

		return client;
	} catch (error) {
		// Cache the error and reset client to null
		lastInitError = error instanceof Error ? error : new Error(String(error));
		client = null;

		console.error('Failed to initialize Vision API client:', lastInitError);
		throw lastInitError;
	}
}

export interface DetectBarcodesOptions {
	timeoutMs?: number; // default 5000
	maxResults?: number; // default 5
	correlationId?: string;
}

export interface BarcodeDetectionResult {
	candidates: string[]; // raw ISBN-like strings (normalized, deduped)
	isbns: string[]; // validated ISBN-13 strings (deduped, maxResults applied)
	durationMs: number;
	correlationId?: string;
}

/**
 * Detect ISBN-like strings from an image buffer using Google Vision OCR.
 * - Uses TEXT_DETECTION for robustness
 * - Normalizes/filters to ISBN-10/13 shapes
 * - Validates via checksum by converting to ISBN-13
 */
export async function detectBarcodes(
	imageBuffer: Buffer,
	options: DetectBarcodesOptions = {}
): Promise<BarcodeDetectionResult> {
	const start = Date.now();
	const timeoutMs = options.timeoutMs ?? 5000;
	const maxResults = options.maxResults ?? 5;

	const vc = getVisionClient();

	const visionPromise: Promise<VisionTextResult> = vc
		.textDetection({ image: { content: imageBuffer } })
		.then(([res]: any) => res as VisionTextResult)
		.catch((err: unknown) => {
			throw err;
		});

	const timeoutPromise = new Promise<never>((_, reject) =>
		setTimeout(() => reject(new Error('Vision API timeout')), timeoutMs)
	);

	let result: VisionTextResult;
	try {
		result = await Promise.race([visionPromise, timeoutPromise]);
	} catch (error) {
		throw error;
	}

	// Aggregate text
	const allText = (result.textAnnotations || [])
		.map((a: TextAnnotation) => a.description || '')
		.join(' ');

	// Extract candidate sequences (allow digits, X, hyphens, spaces; 10-17 chars)
	const rawMatches = allText.match(/[0-9Xx][0-9Xx\-\s]{8,16}[0-9Xx]/g) || [];

	// Normalize, filter to 10/13 digit shapes, and dedupe
	const candidateSet = new Set<string>();
	for (const m of rawMatches) {
		const cleaned = m.replace(/[^0-9Xx]/g, '').toUpperCase();
		if (/^\d{13}$/.test(cleaned) || /^\d{9}[0-9X]$/.test(cleaned)) {
			candidateSet.add(cleaned);
		}
	}
	const candidates = Array.from(candidateSet);

	// Validate to ISBN-13 and dedupe; cap results
	const isbnSet = new Set<string>();
	for (const c of candidates) {
		try {
			const isbn13 = toISBN13(c);
			isbnSet.add(isbn13);
			if (isbnSet.size >= maxResults) break;
		} catch (e) {
			if (e instanceof InvalidISBNError) {
				// ignore invalid checksum
				continue;
			}
			throw e;
		}
	}

	return {
		candidates,
		isbns: Array.from(isbnSet),
		durationMs: Date.now() - start,
		correlationId: options.correlationId
	};
}
