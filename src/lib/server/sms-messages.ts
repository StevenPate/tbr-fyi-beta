/**
 * SMS Messages and Commands
 *
 * Centralized location for all SMS workflows, commands, and responses.
 * Makes it easy to see and maintain all user-facing messaging.
 */

import { PUBLIC_BASE_URL } from '$env/static/public';

/**
 * Format shelf URL for a phone number
 * Handles URL encoding for special characters (+ becomes %2B)
 */
export function getShelfUrl(phoneNumber: string): string {
	const encodedPhone = encodeURIComponent(phoneNumber);
	return `${PUBLIC_BASE_URL}/${encodedPhone}`;
}

/**
 * Format claim URL for a phone number
 * Used for prompting users to create accounts
 */
export function getClaimUrl(phoneNumber: string): string {
	const encodedPhone = encodeURIComponent(phoneNumber);
	return `${PUBLIC_BASE_URL}/auth/claim?p=${encodedPhone}`;
}

export const SMS_COMMANDS = {
	START: 'START',
	STOP: 'STOP',
	HELP: 'HELP'
} as const;

export const SMS_MESSAGES = {
	// === Onboarding Flow ===
	WELCOME_NEW_USER:
		'Welcome to TBR! Reply START to begin adding books to your shelf.',

	welcomeActivated: (phoneNumber: string) =>
		`Great! Text me an ISBN, Amazon link, or photo of a barcode to add your first book.\n\nView your shelf: ${getShelfUrl(phoneNumber)}`,

	// === Opt-out Flow ===
	STOP_CONFIRMATION:
		"You're unsubscribed from TBR. Reply START anytime to resubscribe.",

	STOP_ALREADY_OPTED_OUT:
		"You're already unsubscribed. Reply START to resubscribe.",

	OPTED_OUT_MESSAGE:
		"You're currently unsubscribed. Reply START to resubscribe and add books.",

	// === Help & Instructions ===
	HELP:
		'Send me an ISBN (10 or 13 digits), Title by Author, photo of a barcode, or Amazon link!',

	NO_ISBN_FOUND:
		'Send me an ISBN (10 or 13 digits), Title by Author, photo of a barcode, or Amazon link!',

	// === Title/Author Search (stateless MVP) ===
	searchBestMatch: (title: string, authors: string[], isbn13: string, phoneNumber: string, query: string) => {
		const authorText = authors && authors.length > 0 ? ` by ${authors[0]}` : '';
		const url = `${getShelfUrl(phoneNumber)}?q=${encodeURIComponent(query)}`;
		return `Found: "${title}"${authorText} (ISBN: ${isbn13}).\nReply with that ISBN or reply ADD to add, or open to pick another: ${url}`;
	},

	searchNoMatch: (query: string, phoneNumber: string) => {
		const url = `${getShelfUrl(phoneNumber)}?q=${encodeURIComponent(query)}`;
		return `Couldn't find a match. Try 'Title by Author' or open: ${url}`;
	},

	// === ADD command ===
	ADD_NO_CONTEXT:
		"I don't have a recent book to add. Reply with an ISBN (10 or 13 digits) or send a title like 'Title by Author' first.",

	ADD_INVALID_ISBN:
		'ADD usage: reply ADD 978... or just ADD after a search result message.',

	// === Success States ===
	bookAdded: (title: string, phoneNumber: string, author?: string) =>
		`✓ Added "${title}"${author ? ` by ${author}` : ''} to your shelf!\n\nView: ${getShelfUrl(phoneNumber)}`,

	bookAlreadyExists: (title: string) =>
		`"${title}" is already on your shelf!`,

	mmsMultipleAdded: (count: number, addedTitles: string[], existedTitles: string[], phoneNumber: string) => {
		let msg = `Found ${count} ISBN${count > 1 ? 's' : ''}, added ${addedTitles.length} to your shelf:\n` +
			addedTitles.map(t => `- ${t}`).join('\n');

		if (existedTitles.length > 0) {
			msg += `\n\nAlready on shelf: ${existedTitles.join(', ')}`;
		}

		msg += `\n\nView: ${getShelfUrl(phoneNumber)}`;

		return msg;
	},

	mmsAllExisted: (count: number) =>
		`${count > 1 ? 'All ' + count + ' books are' : 'That book is'} already on your shelf.`,

	// === Photo/MMS Processing ===
	MMS_NO_ISBN_DETECTED:
		'Photo received, no valid ISBN detected.',

	MMS_PROCESSING_ERROR:
		'Error processing photo. Please try again later.',

	MMS_TIMEOUT:
		'Photo processing timed out. Please try again.',

	MMS_NO_IMAGE_FOUND:
		'No image found in message. Please try again.',

	MMS_DOWNLOAD_FAILED:
		'Could not download the photo. Please try again.',

	MMS_INVALID_FILE_TYPE:
		"That doesn't look like an image. Please send a photo of a barcode.",

	MMS_UNAVAILABLE:
		'Photo processing temporarily unavailable.',

	// === Amazon Link Processing ===
	AMAZON_NO_ISBN:
		"Couldn't find ISBN from that Amazon link. Try texting the ISBN directly!",

	AMAZON_PARSE_ERROR:
		'Had trouble reading that Amazon link. Try the ISBN directly?',

	// === ISBN Validation Errors ===
	invalidIsbn: (reason: string) =>
		`Invalid ISBN: ${reason}`,

	bookNotFound: (isbn: string) =>
		`Couldn't find book info for ISBN ${isbn}. Try a different ISBN?`,

	// === Database Errors ===
	SAVE_ERROR:
		'Oops, had trouble saving. Try again?',

	// === Generic Error ===
	GENERIC_ERROR:
		'Sorry, something went wrong. Try again?',

	// === Account Upgrade Prompts ===
	// Shown after certain book count milestones
	accountPromptBasic: (phoneNumber: string) =>
		`📚 You've been adding books! Secure your shelf with a free account:\n${getClaimUrl(phoneNumber)}\n\nGet a custom username and make shelves private.`,

	accountPromptAfterMultiple: (phoneNumber: string) =>
		`🔒 Your reading list is growing! Create an account to get a custom username and privacy controls:\n${getClaimUrl(phoneNumber)}`,

	accountPromptWeekly: (phoneNumber: string) =>
		`💫 Build your reading community. Create an account for a custom username and more features:\n${getClaimUrl(phoneNumber)}`
} as const;

/**
 * Detect command from message text
 * Commands are case-insensitive and trimmed
 */
export function detectCommand(text: string | null): keyof typeof SMS_COMMANDS | null {
	if (!text) return null;

	const cleaned = text.trim().toUpperCase();

	// Exact matches
	if (cleaned === 'START') return 'START';
	if (cleaned === 'STOP') return 'STOP';
	if (cleaned === 'HELP' || cleaned === '?') return 'HELP';

	return null;
}

/**
 * Check if message contains a command (even with extra text)
 * More lenient than detectCommand for cases like "START please" or "HELP me"
 */
export function containsCommand(text: string | null): keyof typeof SMS_COMMANDS | null {
	if (!text) return null;

	const cleaned = text.trim().toUpperCase();

	if (cleaned.includes('START')) return 'START';
	if (cleaned.includes('STOP')) return 'STOP';
	if (cleaned.includes('HELP')) return 'HELP';

	return null;
}
