/**
 * Shelf Page Loader
 *
 * Loads books and shelves for the given user from Supabase.
 * Supports multiple URL formats:
 * - /@username (claimed usernames)
 * - /+phone (phone numbers)
 * - /email_user_{uuid} (email-only users)
 */

import { supabase } from '$lib/server/supabase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const { identifier } = params;

	// Determine userId (phone_number) based on identifier format
	let userId: string;
	let user: any;

	if (identifier.startsWith('@')) {
		// Username lookup
		const username = identifier.slice(1);
		const { data } = await supabase
			.from('users')
			.select('*')
			.eq('username', username)
			.single();

		if (!data) {
			throw error(404, 'User not found');
		}

		user = data;
		userId = data.phone_number;
	} else if (identifier.startsWith('+')) {
		// Phone number lookup (backward compatible)
		userId = identifier;

		const { data } = await supabase
			.from('users')
			.select('*')
			.eq('phone_number', userId)
			.single();

		user = data;
	} else if (identifier.startsWith('email_user_')) {
		// Email user lookup (synthetic phone number)
		userId = identifier;

		const { data } = await supabase
			.from('users')
			.select('*')
			.eq('phone_number', userId)
			.single();

		user = data;
	} else {
		throw error(404, 'Invalid user identifier');
	}

	// Get requested shelf from URL query parameter
	const requestedShelfId = url.searchParams.get('shelf');
	const viewParam = url.searchParams.get('view');

	// Fetch shelves for this user (newest first)
	const { data: shelves, error: shelvesError } = await supabase
		.from('shelves')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });

	if (shelvesError) {
		console.error('Error loading shelves:', shelvesError);
	}

	// Determine which shelf to display
	let selectedShelfId: string | null = null;

	if (viewParam === 'all') {
		// User explicitly clicked "All Books" - don't use default shelf
		selectedShelfId = null;
	} else if (requestedShelfId) {
		// Validate requested shelf belongs to user
		const shelfExists = shelves?.some((s) => s.id === requestedShelfId);
		if (shelfExists) {
			selectedShelfId = requestedShelfId;
		}
		// else: ignore hand-edited URL, fall through to default
	}

	if (!selectedShelfId && !viewParam && user?.default_shelf_id) {
		// No explicit view param, no valid shelf param - use default shelf
		selectedShelfId = user.default_shelf_id;
	}
	// else: null = "All Books"

	// Fetch books for this user
	const { data: books, error: booksError } = await supabase
		.from('books')
		.select('*')
		.eq('user_id', userId)
		.order('added_at', { ascending: false });

	if (booksError) {
		console.error('Error loading books:', booksError);
		return {
			books: [],
			allBooks: [],
			shelves: shelves || [],
			bookShelves: [],
			selectedShelfId,
			userId,
			error: booksError.message
		};
	}

	// Fetch book_shelves filtered by user's shelves (security + performance)
	const shelfIds = shelves?.map((s) => s.id) || [];
	let bookShelves: any[] = [];

	if (shelfIds.length > 0) {
		const { data, error: bookShelvesError } = await supabase
			.from('book_shelves')
			.select('*')
			.in('shelf_id', shelfIds);

		if (bookShelvesError) {
			console.error('Error loading book-shelves:', bookShelvesError);
		} else {
			bookShelves = data || [];
		}
	}

	// Filter books by selected shelf
	let filteredBooks = books || [];
	if (selectedShelfId) {
		const bookIdsOnShelf = bookShelves
			.filter((bs) => bs.shelf_id === selectedShelfId)
			.map((bs) => bs.book_id);
		filteredBooks = books?.filter((book) => bookIdsOnShelf.includes(book.id)) || [];
	}

	// Check if this is a phone-based shelf (no username)
	const isPhoneBased = userId.startsWith('+') && !user?.username;
	const hasUsername = !!user?.username;

	return {
		books: filteredBooks,
		allBooks: books || [],
		shelves: shelves || [],
		bookShelves: bookShelves,
		selectedShelfId,
		defaultShelfId: user?.default_shelf_id || null,
		userId,
		isPhoneBased,
		hasUsername,
		username: user?.username || null
	};
};
