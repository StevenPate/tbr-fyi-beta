/**
 * Shared Book Page Loader
 *
 * Loads book data for the share page, supporting multiple URL formats:
 * - /{username}/book/[isbn13] (canonical)
 * - /+phone/book/[isbn13] (legacy)
 * - /email_user_{uuid}/book/[isbn13] (email users without username)
 *
 * Redirects to canonical /{username} URL when available.
 */

import { supabase } from '$lib/server/supabase';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fetchBookMetadata } from '$lib/server/metadata';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { identifier, isbn13 } = params;

	// 1. Validate isbn13 param (13 digits)
	if (!isbn13 || !/^\d{13}$/.test(isbn13)) {
		console.warn('Invalid ISBN in share link:', isbn13, identifier);
		throw error(404, 'Invalid ISBN');
	}

	// 2. Parse identifier and look up user
	let userId: string;
	let user: {
		phone_number: string;
		username: string | null;
		display_name: string | null;
	} | null = null;

	if (identifier.startsWith('+')) {
		// Phone number lookup
		userId = identifier;

		const { data } = await supabase
			.from('users')
			.select('phone_number, username, display_name')
			.eq('phone_number', userId)
			.single();

		user = data;
	} else if (identifier.startsWith('email_user_')) {
		// Email user lookup (synthetic phone number)
		userId = identifier;

		const { data } = await supabase
			.from('users')
			.select('phone_number, username, display_name')
			.eq('phone_number', userId)
			.single();

		user = data;
	} else {
		// Username lookup (default case)
		const { data } = await supabase
			.from('users')
			.select('phone_number, username, display_name')
			.eq('username', identifier)
			.single();

		if (!data) {
			throw error(404, 'User not found');
		}

		user = data;
		userId = data.phone_number;
	}

	// User must exist
	if (!user) {
		throw error(404, 'User not found');
	}

	// 3. Canonical redirect: If user has username and incoming identifier is not the username
	if (user.username && identifier !== user.username) {
		throw redirect(301, `/${user.username}/book/${isbn13}`);
	}

	// 4. Look up book in user's library
	const { data: book } = await supabase
		.from('books')
		.select('*')
		.eq('user_id', userId)
		.eq('isbn13', isbn13)
		.single();

	let bookData: {
		isbn13: string;
		title: string;
		author: string[] | null;
		publisher: string | null;
		publication_date: string | null;
		description: string | null;
		cover_url: string | null;
	} | null = null;
	let inLibrary = false;

	if (book) {
		// Book is in user's library
		inLibrary = true;
		bookData = {
			isbn13: book.isbn13,
			title: book.title,
			author: book.author,
			publisher: book.publisher,
			publication_date: book.publication_date,
			description: book.description,
			cover_url: book.cover_url
		};
	} else {
		// 5. Book not in library, try fetching metadata
		try {
			const metadata = await fetchBookMetadata(isbn13);
			if (metadata) {
				bookData = {
					isbn13: metadata.isbn,
					title: metadata.title,
					author: metadata.author,
					publisher: metadata.publisher || null,
					publication_date: metadata.publicationDate || null,
					description: metadata.description || null,
					cover_url: metadata.coverUrl || null
				};
			}
		} catch (e) {
			console.warn('Failed to fetch metadata for shared book:', isbn13, e);
		}
	}

	// 6. If no book data at all, return error state
	if (!bookData) {
		return {
			book: null,
			error: 'Book not found',
			sharer: {
				username: user.username,
				displayName: user.display_name,
				identifier: user.username ? `@${user.username}` : identifier
			},
			inLibrary: false,
			currentUser: locals.user || null
		};
	}

	// 7. Return book data with sharer info
	return {
		book: bookData,
		error: null,
		sharer: {
			username: user.username,
			displayName: user.display_name,
			identifier: user.username || identifier
		},
		inLibrary,
		currentUser: locals.user || null
	};
};
