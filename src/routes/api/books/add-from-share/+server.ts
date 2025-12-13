/**
 * Add Book from Share API
 *
 * Allows authenticated users to add a book to their shelf from a share link.
 * Uses existing metadata fetching and book operations infrastructure.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchBookMetadata, toISBN13, InvalidISBNError } from '$lib/server/metadata';
import { upsertBookForUser } from '$lib/server/book-operations';

export const POST: RequestHandler = async ({ request, locals }) => {
	// 1. Check authentication
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const userId = locals.user.phone_number;

	// 2. Parse request body
	let isbn13: string;
	try {
		const body = await request.json();
		isbn13 = body.isbn13;
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	// 3. Validate ISBN format (13 digits)
	if (!isbn13 || !/^\d{13}$/.test(isbn13)) {
		return json({ error: 'Invalid ISBN format' }, { status: 400 });
	}

	// 4. Fetch book metadata
	let metadata;
	try {
		// Normalize ISBN (handles validation)
		const normalizedIsbn = toISBN13(isbn13);
		metadata = await fetchBookMetadata(normalizedIsbn);
	} catch (e) {
		if (e instanceof InvalidISBNError) {
			return json({ error: 'Invalid ISBN' }, { status: 400 });
		}
		console.error('Error fetching metadata:', e);
		return json({ error: 'Failed to fetch book metadata' }, { status: 500 });
	}

	// 5. Check if metadata was found
	if (!metadata) {
		return json({ error: 'Book not found' }, { status: 404 });
	}

	// 6. Upsert book for user (handles default shelf assignment)
	const result = await upsertBookForUser(userId, metadata);

	// 7. Handle duplicate
	if (result.isDuplicate) {
		return json({ error: 'Already on your shelf', duplicate: true }, { status: 409 });
	}

	// 8. Handle other errors
	if (!result.success) {
		console.error('Error upserting book:', result.error);
		return json({ error: result.error || 'Failed to add book' }, { status: 500 });
	}

	// 9. Success
	return json({
		success: true,
		book: {
			id: result.bookId,
			isbn13: metadata.isbn,
			title: metadata.title,
			author: metadata.author
		}
	});
};
