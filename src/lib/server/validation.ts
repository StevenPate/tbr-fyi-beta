/**
 * Server-side Input Validation
 *
 * Provides validation helpers for user inputs to catch errors early
 * and provide better error messages.
 */

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validate ISBN format before passing to toISBN13().
 *
 * Checks that the input contains only valid ISBN characters and
 * is the correct length (10 or 13 digits/characters).
 *
 * @param isbn - Raw ISBN string from user input
 * @returns Validation result with error message if invalid
 */
export function validateISBNFormat(isbn: string): ValidationResult {
	if (!isbn || typeof isbn !== 'string') {
		return {
			valid: false,
			error: 'ISBN is required'
		};
	}

	const trimmed = isbn.trim();
	if (trimmed.length === 0) {
		return {
			valid: false,
			error: 'ISBN cannot be empty'
		};
	}

	// Remove hyphens and spaces for length check
	const cleaned = trimmed.replace(/[\s\-]/g, '');

	// Check for invalid characters (only digits, X, hyphens, spaces allowed)
	if (!/^[\dXx\s\-]+$/.test(trimmed)) {
		return {
			valid: false,
			error: 'ISBN must contain only digits, X, hyphens, and spaces'
		};
	}

	// Check length (ISBN-10 or ISBN-13)
	if (cleaned.length !== 10 && cleaned.length !== 13) {
		return {
			valid: false,
			error: `ISBN must be 10 or 13 characters (got ${cleaned.length})`
		};
	}

	// ISBN-10 can only have X as the last character
	if (cleaned.length === 10) {
		const hasX = cleaned.toUpperCase().includes('X');
		if (hasX && cleaned.toUpperCase().lastIndexOf('X') !== 9) {
			return {
				valid: false,
				error: 'X can only appear as the last digit in ISBN-10'
			};
		}
	}

	// ISBN-13 cannot have X at all
	if (cleaned.length === 13 && cleaned.toUpperCase().includes('X')) {
		return {
			valid: false,
			error: 'ISBN-13 cannot contain X'
		};
	}

	return { valid: true };
}

/**
 * Validate phone number format.
 *
 * Checks for E.164 format: + followed by 10-15 digits.
 *
 * @param phoneNumber - Phone number string
 * @returns Validation result with error message if invalid
 */
export function validatePhoneNumber(phoneNumber: string): ValidationResult {
	if (!phoneNumber || typeof phoneNumber !== 'string') {
		return {
			valid: false,
			error: 'Phone number is required'
		};
	}

	const trimmed = phoneNumber.trim();

	// E.164 format: +[country code][number] (10-15 digits total)
	if (!/^\+\d{10,15}$/.test(trimmed)) {
		return {
			valid: false,
			error: 'Phone number must be in E.164 format (+1234567890)'
		};
	}

	return { valid: true };
}
