/**
 * Manual Book Addition API Endpoint
 *
 * Accepts ISBN from web UI and adds book to user's shelf
 *
 * SECURITY NOTE: Uses SvelteKit's built-in CSRF protection (enabled by default for same-origin POST requests).
 * Consider adding rate limiting for production if abuse becomes an issue.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchBookMetadata, toISBN13, InvalidISBNError } from '$lib/server/metadata';
import { logger, logBookAddition, logError, startTimer } from '$lib/server/logger';
import { validateISBNFormat } from '$lib/server/validation';
import { upsertBookForUser } from '$lib/server/book-operations';

export const POST: RequestHandler = async ({ request, url }) => {
	const requestTimer = startTimer();
	let userId = '';
	let method: 'isbn' | 'search' | 'image' | 'amazon_link' = 'isbn';

	try {
		const { isbn } = await request.json();

		// Validate ISBN format before attempting normalization
		const validation = validateISBNFormat(isbn);
		if (!validation.valid) {
			return json({ error: validation.error }, { status: 400 });
		}

		// Derive userId from referer (the [username] route parameter)
		// This prevents client-side userId spoofing
		const referer = request.headers.get('referer');
		if (!referer) {
			return json({ error: 'Invalid request origin' }, { status: 400 });
		}

		// Extract username from referer URL (e.g., /+13123756327)
		const refererUrl = new URL(referer);
		const pathSegments = refererUrl.pathname.split('/').filter(Boolean);
		const userIdRaw = pathSegments[0]; // First segment is the username/phone

		if (!userIdRaw) {
			return json({ error: 'User ID could not be determined' }, { status: 400 });
		}

		// Decode URL encoding (e.g., %2B -> +)
		userId = decodeURIComponent(userIdRaw);

		logger.debug({
			referer,
			pathname: refererUrl.pathname,
			userIdRaw,
			userId
		}, 'Web book addition - userId extraction');

		// Normalize ISBN to ISBN-13
		let isbn13: string;
		try {
			isbn13 = toISBN13(isbn);
		} catch (error) {
			if (error instanceof InvalidISBNError) {
				return json({ error: `Invalid ISBN: ${error.message}` }, { status: 400 });
			}
			throw error;
		}

		// Fetch metadata from Google Books (with Open Library fallback)
		const metadata = await fetchBookMetadata(isbn13);

		if (!metadata) {
			logBookAddition({
				event: 'book_addition',
				user_id: userId,
				source: 'web',
				method,
				isbn13,
				success: false,
				error: 'Book not found',
				duration_ms: requestTimer()
			});
			return json(
				{ error: `Book not found for ISBN ${isbn13}. Try a different ISBN?` },
				{ status: 404 }
			);
		}

		// Save book to database and auto-assign to default shelf
		const result = await upsertBookForUser(userId, metadata);

		if (!result.success) {
			logger.error({ error: result.error, userId, isbn13: metadata.isbn }, 'Book upsert failed');

			logBookAddition({
				event: 'book_addition',
				user_id: userId,
				source: 'web',
				method,
				isbn13: metadata.isbn,
				title: metadata.title,
				success: false,
				error: result.error || 'Unknown error',
				duration_ms: requestTimer()
			});

			// Return appropriate status code for duplicates vs errors
			if (result.isDuplicate) {
				return json({ error: result.error || 'Book already on shelf' }, { status: 409 });
			}

			return json({ error: 'Failed to save book. Try again?' }, { status: 500 });
		}

		logBookAddition({
			event: 'book_addition',
			user_id: userId,
			source: 'web',
			method,
			isbn13: metadata.isbn,
			title: metadata.title,
			success: true,
			duration_ms: requestTimer()
		});

		// Success!
		return json({
			success: true,
			book: { id: result.bookId }
		});
	} catch (error) {
		logError({
			event: 'error',
			error_type: 'web_book_addition',
			message: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined,
			user_id: userId || undefined
		});
		return json({ error: 'Something went wrong. Try again?' }, { status: 500 });
	} finally {
		logger.info({ duration_ms: requestTimer(), endpoint: 'books/add', user_id: userId || undefined }, 'Web book addition completed');
	}
};

