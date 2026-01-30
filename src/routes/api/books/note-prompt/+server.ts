/**
 * Note Prompt API
 *
 * POST: Returns the appropriate note prompt for a book based on user context.
 *       Also records that the prompt was shown for analytics.
 * PUT:  Records that the user responded to a prompt (or skipped).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireSessionUserId } from '$lib/server/auth';
import {
	selectNotePrompt,
	getPromptText,
	getPromptSubtext,
	type PromptContext
} from '$lib/server/note-prompts';

/**
 * Get the appropriate note prompt for a book
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = requireSessionUserId(event);
		const { bookId } = await event.request.json();

		if (!bookId) {
			return json({ error: 'bookId required' }, { status: 400 });
		}

		// Get prompt context
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		const [totalResult, todayResult, lastPromptResult] = await Promise.all([
			supabase.from('books').select('id', { count: 'exact', head: true }).eq('user_id', userId),
			supabase
				.from('books')
				.select('id', { count: 'exact', head: true })
				.eq('user_id', userId)
				.gte('added_at', todayStart.toISOString()),
			supabase
				.from('prompt_responses')
				.select('prompt_id')
				.eq('user_id', userId)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle()
		]);

		const context: PromptContext = {
			sourceType: 'web',
			totalBooks: totalResult.count || 0,
			booksAddedToday: todayResult.count || 0,
			timeOfDay: now.getHours(),
			lastPromptId: lastPromptResult.data?.prompt_id as PromptContext['lastPromptId']
		};

		const prompt = selectNotePrompt(context);

		// Record that we showed this prompt
		await supabase.from('prompt_responses').insert({
			user_id: userId,
			book_id: bookId,
			prompt_id: prompt.id,
			responded: false,
			note_length: 0,
			source: 'web'
		});

		return json({
			promptId: prompt.id,
			text: getPromptText(prompt),
			subtext: getPromptSubtext(prompt)
		});
	} catch (error) {
		if (error instanceof Error && error.message.includes('Authentication')) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}
		console.error('Note prompt error:', error);
		return json({ error: 'Failed to get prompt' }, { status: 500 });
	}
};

/**
 * Record that the user responded to a prompt (or skipped)
 */
export const PUT: RequestHandler = async (event) => {
	try {
		const userId = requireSessionUserId(event);
		const { bookId, responded, noteLength } = await event.request.json();

		if (!bookId) {
			return json({ error: 'bookId required' }, { status: 400 });
		}

		// Update the most recent prompt response for this book
		const { error } = await supabase
			.from('prompt_responses')
			.update({
				responded: responded ?? false,
				note_length: noteLength ?? 0
			})
			.eq('user_id', userId)
			.eq('book_id', bookId)
			.order('created_at', { ascending: false })
			.limit(1);

		if (error) {
			console.error('Failed to update prompt response:', error);
			// Don't fail the request - this is analytics, not critical
		}

		return json({ success: true });
	} catch (error) {
		if (error instanceof Error && error.message.includes('Authentication')) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}
		console.error('Note prompt update error:', error);
		return json({ error: 'Failed to update prompt' }, { status: 500 });
	}
};
