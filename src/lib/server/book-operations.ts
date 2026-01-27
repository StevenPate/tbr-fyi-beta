/**
 * Shared Book Operations
 *
 * Centralized book upsert logic to eliminate duplication across
 * SMS handler, manual addition, and bulk operations.
 */

import type { BookMetadata } from './metadata/types';
import { supabase } from './supabase';

export interface UpsertBookResult {
	success: boolean;
	bookId?: string;
	error?: string;
	isDuplicate?: boolean;
}

/**
 * Upsert a book for a user and auto-assign to their default shelf.
 *
 * This function handles:
 * - Book insertion/update with conflict resolution
 * - Auto-assignment to user's default shelf (if configured)
 * - Consistent error handling and messaging
 *
 * @param userId - Phone number or user identifier
 * @param metadata - Book metadata from fetchBookMetadata()
 * @param sourceType - How the book was added (sms_isbn, sms_photo, sms_link, sms_title, web)
 * @returns Result object with success status and book ID or error
 */
export async function upsertBookForUser(
	userId: string,
	metadata: BookMetadata,
	sourceType?: string
): Promise<UpsertBookResult> {
	try {
		// Upsert book to books table
		const { data: book, error: bookError } = await supabase
			.from('books')
			.upsert(
				{
					user_id: userId,
					isbn13: metadata.isbn,
					title: metadata.title,
					author: metadata.author,
					publisher: metadata.publisher,
					publication_date: metadata.publicationDate,
					description: metadata.description,
					cover_url: metadata.coverUrl,
					is_read: false,
					is_owned: false,
					source_type: sourceType
				},
				{ onConflict: 'user_id,isbn13' }
			)
			.select('id')
			.single();

		// Handle upsert errors
		if (bookError || !book) {
			// Check if it's a duplicate key error
			if (
				bookError?.code === 'PGRST116' ||
				bookError?.code === '23505' ||
				bookError?.message?.includes('duplicate')
			) {
				return {
					success: false,
					error: `"${metadata.title}" is already on your shelf`,
					isDuplicate: true
				};
			}

			// Generic database error
			return {
				success: false,
				error: bookError?.message || 'Database error'
			};
		}

		// Auto-assign to default shelf if user has one configured
		try {
			const { data: user } = await supabase
				.from('users')
				.select('default_shelf_id')
				.eq('phone_number', userId)
				.maybeSingle();

			if (user?.default_shelf_id) {
				await supabase
					.from('book_shelves')
					.upsert(
						{
							book_id: book.id,
							shelf_id: user.default_shelf_id
						},
						{ onConflict: 'book_id,shelf_id', ignoreDuplicates: true }
					);
			}
		} catch (shelfError) {
			// Non-blocking error - book is already added, shelf assignment is optional
			console.error('Failed to assign book to default shelf:', shelfError);
		}

		return {
			success: true,
			bookId: book.id
		};
	} catch (error) {
		console.error('Unexpected error in upsertBookForUser:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}
