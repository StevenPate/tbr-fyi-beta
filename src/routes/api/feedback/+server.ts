import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	TRELLO_API_KEY,
	TRELLO_TOKEN,
	TRELLO_LIST_ID
} from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const question1 = formData.get('question1') as string;
		const question2 = formData.get('question2') as string;
		const userId = formData.get('userId') as string | null;
		const screenshot = formData.get('screenshot') as File | null;

		// Validate required fields
		if (!question1?.trim() || !question2?.trim()) {
			return json({ error: 'Both questions are required' }, { status: 400 });
		}

		// Create Trello card
		const cardName = `Feedback: ${question1.slice(0, 50)}${question1.length > 50 ? '...' : ''}`;
		let cardDesc = '';

		if (userId) {
			cardDesc += `**User:** ${userId}\n\n`;
		}

		cardDesc += `**What were you trying to do?**\n${question1}\n\n**What happened? Or didn't happen?**\n${question2}`;

		const createCardResponse = await fetch(
			`https://api.trello.com/1/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					idList: TRELLO_LIST_ID,
					name: cardName,
					desc: cardDesc
				})
			}
		);

		if (!createCardResponse.ok) {
			const errorText = await createCardResponse.text();
			console.error('Trello card creation failed:', errorText);
			return json({ error: 'Failed to submit feedback' }, { status: 500 });
		}

		const card = await createCardResponse.json();
		let warning: string | null = null;

		// Upload screenshot as attachment if provided
		if (screenshot && screenshot.size > 0) {
			const attachmentFormData = new FormData();
			attachmentFormData.append('file', screenshot);
			attachmentFormData.append('key', TRELLO_API_KEY);
			attachmentFormData.append('token', TRELLO_TOKEN);

			try {
				const attachResponse = await fetch(
					`https://api.trello.com/1/cards/${card.id}/attachments`,
					{
						method: 'POST',
						body: attachmentFormData
					}
				);

				if (!attachResponse.ok) {
					const attachError = await attachResponse.text();
					console.error('Trello attachment upload failed:', attachError);
					warning = 'Screenshot upload failed, but your feedback was saved.';
				}
			} catch (attachError) {
				console.error('Attachment upload exception:', attachError);
				warning = 'Screenshot upload failed, but your feedback was saved.';
			}
		}

		return json({
			success: true,
			...(warning && { warning })
		});
	} catch (error) {
		console.error('Feedback submission error:', error);
		return json(
			{ error: 'Failed to send feedback. Please try again.' },
			{ status: 500 }
		);
	}
};
