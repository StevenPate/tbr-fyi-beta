import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireSessionUserId } from '$lib/server/auth';

type BulkOperation = 'delete' | 'update' | 'move_to_shelf';

interface BulkRequest {
	book_ids: string[];
	operation: BulkOperation;
	updates?: {
		is_read?: boolean;
		is_owned?: boolean;
	};
	shelf_id?: string;
}

export const POST: RequestHandler = async (event) => {
	try {
		const userId = requireSessionUserId(event);
		const body: BulkRequest = await event.request.json();

		if (!body.book_ids || body.book_ids.length === 0) {
			return json({ error: 'No books selected' }, { status: 400 });
		}
		if (body.book_ids.length > 500) {
			return json({ error: 'Maximum 500 books per operation' }, { status: 400 });
		}

		// Verify all books belong to the user
		const { data: ownedBooks, error: verifyError } = await supabase
			.from('books')
			.select('id')
			.eq('user_id', userId)
			.in('id', body.book_ids);

		if (verifyError) {
			return json({ error: 'Failed to verify book ownership' }, { status: 500 });
		}

		const ownedBookIds = new Set(ownedBooks?.map((b) => b.id) || []);
		const unauthorizedCount = body.book_ids.filter((id) => !ownedBookIds.has(id)).length;
		if (unauthorizedCount > 0) {
			return json(
				{ error: `Access denied to ${unauthorizedCount} book(s)` },
				{ status: 403 }
			);
		}

		let processed = 0;

		switch (body.operation) {
			case 'delete': {
				const { error } = await supabase
					.from('books')
					.delete()
					.in('id', body.book_ids)
					.eq('user_id', userId);
				if (error) return json({ error: 'Failed to delete books' }, { status: 500 });
				processed = body.book_ids.length;
				break;
			}
			case 'update': {
				if (!body.updates || Object.keys(body.updates).length === 0) {
					return json({ error: 'No updates provided' }, { status: 400 });
				}
				const { error } = await supabase
					.from('books')
					.update(body.updates)
					.in('id', body.book_ids)
					.eq('user_id', userId);
				if (error) return json({ error: 'Failed to update books' }, { status: 500 });
				processed = body.book_ids.length;
				break;
			}
			case 'move_to_shelf': {
				if (!body.shelf_id) {
					return json({ error: 'Shelf ID required' }, { status: 400 });
				}
				const { data: shelf, error: shelfError } = await supabase
					.from('shelves')
					.select('id')
					.eq('id', body.shelf_id)
					.eq('user_id', userId)
					.maybeSingle();
				if (shelfError || !shelf) {
					return json({ error: 'Shelf not found or access denied' }, { status: 404 });
				}
				const bookShelfRelations = body.book_ids.map((book_id) => ({
					book_id,
					shelf_id: body.shelf_id!
				}));
				const { error } = await supabase
					.from('book_shelves')
					.upsert(bookShelfRelations, {
						onConflict: 'book_id,shelf_id',
						ignoreDuplicates: true
					});
				if (error)
					return json({ error: 'Failed to move books to shelf' }, { status: 500 });
				processed = body.book_ids.length;
				break;
			}
			default:
				return json({ error: 'Invalid operation' }, { status: 400 });
		}

		return json({ success: true, processed });
	} catch (error) {
		if (error instanceof Error && error.message.includes('Authentication')) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}
		console.error('Bulk operation error:', error);
		return json({ error: 'Something went wrong' }, { status: 500 });
	}
};
