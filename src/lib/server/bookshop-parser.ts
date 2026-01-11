import { toISBN13 } from '$lib/server/metadata/types';

/**
 * Retailer domains that use EAN query parameter for ISBN
 */
const RETAILER_DOMAINS: Record<string, string> = {
	'bookshop.org': 'Bookshop.org',
	'www.bookshop.org': 'Bookshop.org',
	'barnesandnoble.com': 'Barnes & Noble',
	'www.barnesandnoble.com': 'Barnes & Noble'
};

function extractURL(text: string): string | null {
	const match = text.match(/(https?:\/\/[^\s]+)/i);
	return match ? match[1] : null;
}

function getRetailerName(url: URL): string | null {
	return RETAILER_DOMAINS[url.hostname.toLowerCase()] || null;
}

export type RetailerResult = {
	isbn: string;
	retailer: string;
} | null;

/**
 * Extract ISBN from retailer URLs that use EAN query parameter
 * Supports: Bookshop.org, Barnes & Noble
 */
export async function extractISBNFromRetailer(
	textOrUrl: string,
	source: 'sms' | 'web' = 'sms'
): Promise<RetailerResult> {
	// Extract URL from text (handles "check this out: https://...")
	const urlStr = extractURL(textOrUrl) || textOrUrl;

	let url: URL;
	try {
		url = new URL(urlStr);
	} catch {
		return null; // Not a valid URL
	}

	// Validate domain and get retailer name
	const retailer = getRetailerName(url);
	if (!retailer) {
		return null;
	}

	// Extract EAN from query parameter
	const ean = url.searchParams.get('ean');

	if (!ean) {
		console.log(`[retailer-parser] No EAN parameter in ${retailer} URL (source: ${source}):`, urlStr);
		return null;
	}

	// Validate and normalize to ISBN-13
	try {
		const isbn13 = toISBN13(ean);
		console.log(`[retailer-parser] Extracted ISBN ${isbn13} from ${retailer}: ${urlStr}`);
		return { isbn: isbn13, retailer };
	} catch (error) {
		console.log(`[retailer-parser] Invalid EAN "${ean}" from ${retailer} (source: ${source}):`, error);
		return null;
	}
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use extractISBNFromRetailer instead
 */
export async function extractISBNFromBookshop(
	textOrUrl: string,
	source: 'sms' | 'web' = 'sms'
): Promise<string | null> {
	const result = await extractISBNFromRetailer(textOrUrl, source);
	return result?.isbn || null;
}

/**
 * Check if text contains a supported retailer URL
 */
export function containsRetailerUrl(text: string): boolean {
	const domains = Object.keys(RETAILER_DOMAINS);
	const lowerText = text.toLowerCase();
	return domains.some((domain) => lowerText.includes(domain));
}

/**
 * Extract ISBN from Indiecommerce-style URLs: /book/{ISBN13}
 * Example: https://www.thirdplacebooks.com/book/9780593717929
 */
export async function extractISBNFromIndiecommerce(
	textOrUrl: string,
	source: 'sms' | 'web' = 'sms'
): Promise<RetailerResult> {
	const urlStr = extractURL(textOrUrl) || textOrUrl;

	let url: URL;
	try {
		url = new URL(urlStr);
	} catch {
		return null;
	}

	// Match /book/{isbn} pattern
	const match = url.pathname.match(/\/book\/(\d{10}|\d{13})(?:\/|$)/);
	if (!match) {
		return null;
	}

	const isbnCandidate = match[1];

	// Validate and normalize to ISBN-13
	try {
		const isbn13 = toISBN13(isbnCandidate);
		console.log(`[indiecommerce-parser] Extracted ISBN ${isbn13} from ${url.hostname}: ${urlStr}`);
		return { isbn: isbn13, retailer: 'indie bookstore' };
	} catch (error) {
		console.log(
			`[indiecommerce-parser] Invalid ISBN "${isbnCandidate}" (source: ${source}):`,
			error
		);
		return null;
	}
}

/**
 * Check if URL has Indiecommerce /book/{ISBN} pattern
 */
export function isIndiecommerceUrl(text: string): boolean {
	const urlStr = extractURL(text) || text;

	try {
		const url = new URL(urlStr);
		return /\/book\/(\d{10}|\d{13})(?:\/|$)/.test(url.pathname);
	} catch {
		return false;
	}
}

/**
 * Bookstore sites that use dynamic JS rendering (can't extract ISBN)
 * These get a helpful error message instead of falling through to title search
 */
const UNSUPPORTED_BOOKSTORE_PATTERNS = [
	// Bookmanager-powered indie bookstores (use /item/ path pattern)
	/^[a-z0-9.-]+\.(com|org|net|ca|co\.uk)\/item\//i
];

/**
 * Check if URL is from a bookstore we recognize but can't extract ISBN from
 */
export function isUnsupportedBookstoreUrl(text: string): boolean {
	const urlStr = extractURL(text) || text;

	try {
		const url = new URL(urlStr);
		const fullPath = url.hostname + url.pathname;

		return UNSUPPORTED_BOOKSTORE_PATTERNS.some((pattern) => pattern.test(fullPath));
	} catch {
		return false;
	}
}
