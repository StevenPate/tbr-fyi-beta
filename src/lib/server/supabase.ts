/**
 * Supabase Client
 *
 * Server-side Supabase client for database operations.
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from '$env/static/private';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
	throw new Error('Missing Supabase environment variables. Check .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Database Types
 */
export interface Book {
	id: string;
	user_id: string;
	isbn13: string;
	title: string;
	author: string[];
	publisher?: string;
	publication_date?: string;
	description?: string;
	cover_url?: string;
	note?: string;
	is_read: boolean;
	is_owned: boolean;
	added_at: string;
}

export interface Shelf {
	id: string;
	user_id: string;
	name: string;
	created_at: string;
}

export interface BookShelf {
	book_id: string;
	shelf_id: string;
	added_at: string;
}
