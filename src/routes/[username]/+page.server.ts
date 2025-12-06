/**
 * Shelf Page Loader
 *
 * Loads books and shelves for the given user from Supabase.
 */

import { supabase } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const { username } = params;

	// For MVP, username is the phone number (e.g., +13123756327)
	const userId = username;

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

	// Get user's information including auth status
	const { data: user } = await supabase
		.from('users')
		.select('default_shelf_id, auth_id, username')
		.eq('phone_number', userId)
		.single();

	// Determine which shelf to display
	let selectedShelfId: string | null = null;

	if (viewParam === 'all') {
		// User explicitly clicked "All Books" - don't use default shelf
		selectedShelfId = null;
	} else if (requestedShelfId) {
		// Validate requested shelf belongs to user
		const shelfExists = shelves?.some(s => s.id === requestedShelfId);
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
	const shelfIds = shelves?.map(s => s.id) || [];
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
			.filter(bs => bs.shelf_id === selectedShelfId)
			.map(bs => bs.book_id);
		filteredBooks = books?.filter(book => bookIdsOnShelf.includes(book.id)) || [];
	}

	// Check if this is a phone-based shelf (no auth account)
	const isPhoneBased = userId.startsWith('+') && !user?.auth_id;
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
		userHasAuth: !!user?.auth_id
	};
};
