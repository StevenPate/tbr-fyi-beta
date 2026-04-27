/**
 * Note Prompts for Book Additions
 *
 * Shared prompt system for both SMS and web flows.
 * Prompts are selected based on user context to encourage note-taking.
 * Uses pattern-anchored prompts that map to common intent types.
 */

export const NOTE_PROMPTS = {
	// Source-based prompts (who/where did this come from?)
	SOURCE_DEFAULT: {
		id: 'source_default',
		text: "Who told you about this one?",
		subtext: "(friend, podcast, article, etc.)"
	},
	SOURCE_WHERE: {
		id: 'source_where',
		text: "Where did you hear about this?",
		subtext: "(bookstore, recommendation, etc.)"
	},
	SOURCE_REC: {
		id: 'source_rec',
		text: "Did someone recommend this?",
		subtext: "(who and why?)"
	},

	// Use-case prompts (when or why would I read this?)
	USE_CASE: {
		id: 'use_case',
		text: "What's this for?",
		subtext: "(vacation, book club, mood, etc.)"
	},
	TIMING: {
		id: 'timing',
		text: "When do you imagine reading this?",
		subtext: "(soon, winter, when I need comfort, etc.)"
	},
	MOMENT: {
		id: 'moment',
		text: "Is this for a specific moment?",
		subtext: "(travel, break-up, learning, etc.)"
	},

	// Vibe/feeling prompts (what kind of experience is this?)
	VIBE: {
		id: 'vibe',
		text: "What kind of mood is this?",
		subtext: "(cozy, intense, thoughtful, etc.)"
	},
	ATTENTION: {
		id: 'attention',
		text: "What about it caught your attention?",
		subtext: "(the cover, the premise, the author, etc.)"
	},
	EXPERIENCE: {
		id: 'experience',
		text: "What kind of experience is this?",
		subtext: "(escape, learning, reflection, etc.)"
	},

	// Topic hook prompts (what is it about?)
	TOPIC: {
		id: 'topic',
		text: "What's it about that grabbed you?",
		subtext: "(the story, the ideas, the style, etc.)"
	},
	HOOK: {
		id: 'hook',
		text: "What's the hook?",
		subtext: "(what makes it interesting?)"
	},
	INTERESTING: {
		id: 'interesting',
		text: "What's interesting about this one?",
		subtext: "(to you personally)"
	},

	// Personal trigger prompts (why did this matter to me?)
	PERSONAL: {
		id: 'personal',
		text: "Why this one, right now?",
		subtext: "(what made you stop on this?)"
	},
	TRIGGER: {
		id: 'trigger',
		text: "What made you stop on this?",
		subtext: "(something specific?)"
	},
	CONNECTION: {
		id: 'connection',
		text: "What made this stick?",
		subtext: "(personal connection?)"
	},

	// Fallback prompts
	SKIP: {
		id: 'skip',
		text: "Add a note for later—or reply 'skip' to move on."
	},
	WHY: {
		id: 'why',
		text: "Why did you save this?",
		subtext: "(any reason at all)"
	}
} as const;

export type NotePrompt = (typeof NOTE_PROMPTS)[keyof typeof NOTE_PROMPTS];
export type NotePromptId = NotePrompt['id'];

export interface PromptContext {
	sourceType: 'sms_isbn' | 'sms_photo' | 'sms_search' | 'sms_link' | 'web';
	bookId: string;
	booksAddedToday: number;
	totalBooks: number;
	timeOfDay: number; // 0-23
}

/**
 * Simple deterministic hash from a string to a positive integer.
 * Used to anchor prompt selection to a specific book ID so the same
 * book always gets the same prompt across page loads.
 */
function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

/**
 * Select the most appropriate note prompt based on user context
 * Uses pattern-anchored prompts that map to common intent types
 */
export function selectNotePrompt(context: PromptContext): NotePrompt {
	// First book -> teach the pattern with source-based prompt
	if (context.totalBooks === 1) {
		return NOTE_PROMPTS.SOURCE_DEFAULT;
	}

	// Photo additions -> source-based (they're likely in a bookstore/store)
	if (context.sourceType === 'sms_photo') {
		return NOTE_PROMPTS.SOURCE_WHERE;
	}

	// Anchor all selection to the book ID for stability across page loads
	const bookHash = hashString(context.bookId);

	// Power users -> offer skip option for ~30% of books (deterministic per book)
	if (context.totalBooks > 20 || context.booksAddedToday >= 5) {
		if (bookHash % 10 < 3) {
			return NOTE_PROMPTS.SKIP;
		}
	}

	// Define prompt categories for rotation
	const promptCategories = {
		source: [NOTE_PROMPTS.SOURCE_DEFAULT, NOTE_PROMPTS.SOURCE_WHERE, NOTE_PROMPTS.SOURCE_REC],
		useCase: [NOTE_PROMPTS.USE_CASE, NOTE_PROMPTS.TIMING, NOTE_PROMPTS.MOMENT],
		vibe: [NOTE_PROMPTS.VIBE, NOTE_PROMPTS.ATTENTION, NOTE_PROMPTS.EXPERIENCE],
		topic: [NOTE_PROMPTS.TOPIC, NOTE_PROMPTS.HOOK, NOTE_PROMPTS.INTERESTING],
		personal: [NOTE_PROMPTS.PERSONAL, NOTE_PROMPTS.TRIGGER, NOTE_PROMPTS.CONNECTION]
	};

	// Rotation order: source → use-case → vibe → topic → personal → repeat
	const rotationOrder = ['source', 'useCase', 'vibe', 'topic', 'personal'] as const;

	// Category selected by book ID — each book "owns" its prompt category
	const rotationIndex = bookHash % rotationOrder.length;
	const currentCategory = rotationOrder[rotationIndex];

	// Get prompts for current category
	const categoryPrompts = promptCategories[currentCategory];

	// Deterministic selection within category, also anchored to book
	const withinIndex = Math.floor(bookHash / rotationOrder.length) % categoryPrompts.length;
	return categoryPrompts[withinIndex];
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
