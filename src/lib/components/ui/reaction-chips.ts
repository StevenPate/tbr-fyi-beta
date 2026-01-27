/**
 * Reaction Chips Constants
 *
 * Tappable reaction chips for quick intent capture.
 * Chips append text to the note field - no schema change needed.
 */

export interface ReactionChip {
	id: string;
	emoji: string;
	label: string;
	noteText: string;
	category: 'source' | 'mood' | 'urgency';
}

export const REACTION_CHIPS: readonly ReactionChip[] = [
	{ id: 'friend', emoji: '👥', label: 'Friend', noteText: 'Friend rec', category: 'source' },
	{ id: 'podcast', emoji: '🎙️', label: 'Podcast', noteText: 'Podcast', category: 'source' },
	{ id: 'newsletter', emoji: '📰', label: 'Newsletter', noteText: 'Newsletter', category: 'source' },
	{ id: 'social', emoji: '📱', label: 'Social', noteText: 'Social media', category: 'source' },
	{ id: 'bookstore', emoji: '📚', label: 'Bookstore', noteText: 'Saw at bookstore', category: 'source' },
	{ id: 'cozy', emoji: '🛋️', label: 'Cozy', noteText: 'Cozy read', category: 'mood' },
	{ id: 'learn', emoji: '🧠', label: 'Learn', noteText: 'Want to learn', category: 'mood' },
	{ id: 'must', emoji: '⭐', label: 'Must read', noteText: 'Must read', category: 'urgency' },
	{ id: 'gift', emoji: '🎁', label: 'Gift', noteText: 'Gift idea', category: 'urgency' },
] as const;

/**
 * Compose a note from selected chips and custom text
 * Selected chips are joined with " · " and prepended to custom text
 */
export function composeNote(selectedIds: Set<string>, customText: string): string {
	const chipTexts = REACTION_CHIPS
		.filter(c => selectedIds.has(c.id))
		.map(c => c.noteText);

	const parts = [...chipTexts];
	if (customText.trim()) {
		parts.push(customText.trim());
	}

	return parts.join(' · ');
}

/**
 * SMS chip shortcuts - maps emoji/keywords to note text
 * Used for parsing SMS replies
 */
export const SMS_CHIP_SHORTCUTS: Record<string, string> = {
	// Emoji shortcuts
	'👥': 'Friend rec',
	'🎙️': 'Podcast',
	'🎙': 'Podcast', // Without variation selector
	'📚': 'Saw at bookstore',
	// Keyword shortcuts (case-insensitive matching done by caller)
	'friend': 'Friend rec',
	'pod': 'Podcast',
	'podcast': 'Podcast',
	'store': 'Saw at bookstore',
	'bookstore': 'Saw at bookstore',
	'in store': 'Saw at bookstore',
};

/**
 * Check if a message matches a chip shortcut
 * Returns the note text if matched, null otherwise
 */
export function matchChipShortcut(message: string): string | null {
	const trimmed = message.trim();
	const normalized = trimmed.toLowerCase();

	// Try exact emoji match first
	if (SMS_CHIP_SHORTCUTS[trimmed]) {
		return SMS_CHIP_SHORTCUTS[trimmed];
	}

	// Try lowercase keyword match
	if (SMS_CHIP_SHORTCUTS[normalized]) {
		return SMS_CHIP_SHORTCUTS[normalized];
	}

	return null;
}
