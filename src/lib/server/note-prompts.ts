/**
 * Note Prompts for Book Additions
 *
 * Shared prompt system for both SMS and web flows.
 * Prompts are selected based on user context to encourage note-taking.
 */

export const NOTE_PROMPTS = {
	DEFAULT: {
		id: 'default',
		text: "Who recommended it? What caught your attention?",
		subtext: "(Your note helps you remember later)"
	},
	CASUAL: {
		id: 'casual',
		text: "Jot down who mentioned this—future you will thank you."
	},
	MOOD: {
		id: 'mood',
		text: "What were you in the mood for when you saved this?",
		subtext: "(Fiction escape? Learn something? Comfort read?)"
	},
	DIRECT: {
		id: 'direct',
		text: "Why this book? Future you will want to know."
	},
	SKIP: {
		id: 'skip',
		text: "Add a note for later—or reply 'skip' to move on."
	}
} as const;

export type NotePrompt = (typeof NOTE_PROMPTS)[keyof typeof NOTE_PROMPTS];
export type NotePromptId = NotePrompt['id'];

export interface PromptContext {
	sourceType: 'sms_isbn' | 'sms_photo' | 'sms_search' | 'sms_link' | 'web';
	booksAddedToday: number;
	totalBooks: number;
	timeOfDay: number; // 0-23
	lastPromptId?: NotePromptId;
}

/**
 * Select the most appropriate note prompt based on user context
 */
export function selectNotePrompt(context: PromptContext): NotePrompt {
	// First book -> teach the pattern
	if (context.totalBooks === 1) {
		return NOTE_PROMPTS.DEFAULT;
	}

	// Photo -> casual (they're likely in a bookstore)
	if (context.sourceType === 'sms_photo') {
		return NOTE_PROMPTS.CASUAL;
	}

	// Power user -> offer skip option
	if (context.totalBooks > 20 || context.booksAddedToday >= 5) {
		return NOTE_PROMPTS.SKIP;
	}

	// Default rotation
	const defaults = [NOTE_PROMPTS.DEFAULT, NOTE_PROMPTS.MOOD, NOTE_PROMPTS.DIRECT];

	// Avoid repeating last prompt
	const available = defaults.filter((p) => p.id !== context.lastPromptId);
	return available[Math.floor(Math.random() * available.length)];
}

/**
 * Format prompt for SMS (includes subtext on new line)
 */
export function formatNotePromptForSMS(prompt: NotePrompt): string {
	if ('subtext' in prompt && prompt.subtext) {
		return `${prompt.text}\n${prompt.subtext}`;
	}
	return prompt.text;
}

/**
 * Get prompt text for web UI (main text only)
 */
export function getPromptText(prompt: NotePrompt): string {
	return prompt.text;
}

/**
 * Get prompt subtext for web UI (optional helper text)
 */
export function getPromptSubtext(prompt: NotePrompt): string | undefined {
	return 'subtext' in prompt ? prompt.subtext : undefined;
}
