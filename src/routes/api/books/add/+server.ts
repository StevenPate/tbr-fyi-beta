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
import { supabase } from '$lib/server/supabase';

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

		// Derive userId from referer (the [identifier] route parameter)
		// This prevents client-side userId spoofing
		const referer = request.headers.get('referer');
		if (!referer) {
			return json({ error: 'Invalid request origin' }, { status: 400 });
		}

		// Extract identifier from referer URL (e.g., /stevenpate or /+15551234567)
		const refererUrl = new URL(referer);
		const pathSegments = refererUrl.pathname.split('/').filter(Boolean);
		const identifier = pathSegments[0];

		if (!identifier) {
			return json({ error: 'User ID could not be determined' }, { status: 400 });
		}

		// Decode URL encoding (e.g., %2B -> +)
		const decodedIdentifier = decodeURIComponent(identifier);

		// Resolve identifier to phone_number (the actual user_id in books table)
		// Supports: +phone, email_user_*, or username
		if (decodedIdentifier.startsWith('+') || decodedIdentifier.startsWith('email_user_')) {
			// Phone number or email user - use directly
			userId = decodedIdentifier;
		} else {
			// Username - look up phone_number
			const { data: user } = await supabase
				.from('users')
				.select('phone_number')
				.eq('username', decodedIdentifier)
				.single();

			if (!user) {
				return json({ error: 'User not found' }, { status: 404 });
			}
			userId = user.phone_number;
		}

		logger.debug({
			referer,
			pathname: refererUrl.pathname,
			identifier: decodedIdentifier,
			userId
		}, 'Web book addition - userId resolution');

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

