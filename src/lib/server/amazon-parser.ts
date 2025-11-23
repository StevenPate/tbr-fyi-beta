// src/lib/server/amazon-parser.ts

import { toISBN13, InvalidISBNError } from './metadata/types';
import { fetchGoogleBooksMetadata } from './metadata/google-books';
import { supabase } from './supabase';

/**
 * Extract URL from text (users often send "Here: https://...")
 */
function extractURL(text: string): string | null {
  const urlPattern = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlPattern);
  return match ? match[1] : null;
}

/**
 * Validate that URL is from an allowed Amazon domain (whitelist)
 * Prevents open redirect abuse and cross-domain attacks
 */
function isAmazonDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // Strict whitelist of allowed Amazon domains
    const allowedHosts = [
      'amazon.com',
      'www.amazon.com',
      'smile.amazon.com',
      'm.amazon.com',
      'a.co',
      'www.a.co'
    ];

    return allowedHosts.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Extract ASIN from Amazon URL
 *
 * Handles formats:
 * - https://www.amazon.com/dp/0140449132
 * - https://www.amazon.com/Title/dp/0140449132/
 * - https://www.amazon.com/gp/product/0140449132
 * - https://smile.amazon.com/dp/0140449132
 * - https://m.amazon.com/dp/0140449132
 *
 * Note: Removed overly broad pattern to avoid false matches
 */
function extractASIN(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Follow redirect for a.co short links with timeout
 *
 * Note: HEAD requests often fail on a.co, so we use GET with redirect: 'follow'
 * and validate the final destination is an Amazon domain.
 */
async function followRedirect(url: string): Promise<string | null> {
  // Only follow redirects for a.co domains
  if (!url.includes('a.co')) {
    return url;
  }

  try {
    // Set up 5-second timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow', // Let fetch follow redirects automatically
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TBR-Delta/1.0)',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    clearTimeout(timeoutId);

    // response.url contains the final URL after redirects
    const finalUrl = response.url;

    // Validate final destination is Amazon domain (prevent open redirect abuse)
    if (!isAmazonDomain(finalUrl)) {
      console.error('Redirect did not lead to Amazon domain:', finalUrl);
      return null;
    }

    return finalUrl;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Redirect timeout after 5s');
    } else {
      console.error('Error following redirect:', error);
    }
    return null;
  }
}

/**
 * Try using ASIN as ISBN-10 and validate with Google Books
 *
 * For physical books, Amazon often uses ISBN-10 as the ASIN.
 * This succeeds ~80% of the time with zero scraping.
 */
async function tryASINasISBN(asin: string): Promise<string | null> {
  try {
    // Attempt to convert ASIN (as ISBN-10) to ISBN-13
    const isbn13 = toISBN13(asin);

    // Validate by checking Google Books
    const metadata = await fetchGoogleBooksMetadata(isbn13);

    return metadata ? isbn13 : null;
  } catch (error) {
    // Invalid ISBN format or lookup failed
    if (error instanceof InvalidISBNError) {
      return null;
    }
    throw error;
  }
}

/**
 * Scrape ISBN from Amazon product page with timeout
 *
 * Falls back to this when ASIN ≠ ISBN (Kindle editions, special editions)
 */
async function scrapeISBNFromAmazon(asin: string): Promise<string | null> {
  try {
    // Set up 5-second timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://www.amazon.com/dp/${asin}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TBR-Delta/1.0)',
        'Accept-Language': 'en-US,en;q=0.9' // Stabilize English text matching
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Amazon returned ${response.status} for ASIN ${asin}`);
      return null;
    }

    const html = await response.text();

    // Strategy 1: Look for ISBN-13 in id attribute (note: use underscores, not hyphens)
    // Amazon uses id="rpi-attribute-book_details_isbn13" (with underscores)
    const idMatch = html.match(/id="rpi-attribute-book_details_isbn13"[^>]*>.*?(\d{13})/s);
    if (idMatch) {
      return idMatch[1];
    }

    // Strategy 2: "ISBN-13" label with flexible separator (most reliable)
    const isbn13LabelMatch = html.match(/ISBN-13[^0-9]*(\d{13})/i);
    if (isbn13LabelMatch) {
      return isbn13LabelMatch[1];
    }

    // Strategy 3: "ISBN-10" label with X support + conversion to ISBN-13
    // Matches: ISBN-10: 0451524934 or ISBN-10 : 034532397X
    const isbn10LabelMatch = html.match(/ISBN-10[^0-9X]*(\d{9}[0-9X])/i);
    if (isbn10LabelMatch) {
      return toISBN13(isbn10LabelMatch[1]);
    }

    // Strategy 4: Embedded JSON data (sometimes present in structured data)
    // Handles both "isbn":"..." and "isbn" : "..."
    const jsonMatch = html.match(/"isbn"[:\s]*"(\d{10,13})"/i);
    if (jsonMatch) {
      const isbn = jsonMatch[1];
      return isbn.length === 10 ? toISBN13(isbn) : isbn;
    }

    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Scraping timeout after 5s for ASIN:', asin);
    } else {
      console.error('Error scraping Amazon page:', error);
    }
    return null;
  }
}

/**
 * Log failed ISBN extraction to Supabase for tracking and improvement
 *
 * @param url - Original URL from SMS
 * @param asin - Extracted ASIN (if any)
 * @param errorType - Type of error (no_asin, isbn_lookup_failed, etc.)
 * @param errorMessage - Detailed error message
 * @param statusCode - Optional HTTP status code
 * @param finalUrl - Optional final URL after redirects
 * @param notes - Optional additional context as JSON
 */
async function logFailure(
  url: string,
  asin: string | null,
  errorType: string,
  errorMessage: string,
  statusCode?: number,
  finalUrl?: string,
  notes?: Record<string, unknown>,
  source: 'sms' | 'web' = 'sms'
): Promise<void> {
  try {
    const { error } = await supabase
      .from('failed_book_imports')
      .insert({
        url,
        asin,
        error_type: errorType,
        error_message: errorMessage,
        status_code: statusCode,
        final_url: finalUrl,
        source: source,
        notes: notes ? notes : null
      });

    if (error) {
      console.error('Failed to log failure to Supabase:', error);
    }
  } catch (error) {
    console.error('Error logging failure:', error);
    // Don't throw - logging failures shouldn't break the main flow
  }
}

/**
 * Extract ISBN-13 from Amazon URL or text containing URL
 *
 * Main entry point for SMS endpoint. Supports both full Amazon URLs and a.co short links.
 * Uses a two-stage approach:
 * 1. Try ASIN as ISBN-10 (fast, succeeds ~80% for physical books)
 * 2. Scrape Amazon product page (fallback for Kindle, special editions)
 *
 * Processing steps:
 * 1. URL extraction from text (e.g., "Here: https://...")
 * 2. Amazon domain validation (prevents open redirects)
 * 3. Short link redirects (a.co) with domain re-validation
 * 4. ASIN extraction from URL
 * 5. ASIN-as-ISBN validation via Google Books
 * 6. Amazon page scraping using multiple fallback patterns
 * 7. Failure logging to Supabase for tracking
 *
 * Security features:
 * - Host whitelisting (6 allowed Amazon domains)
 * - Pre and post-redirect domain validation
 * - 5-second timeout protection on all external requests
 *
 * Failed attempts are logged to Supabase for tracking and improvement.
 *
 * @param textOrUrl - Amazon product URL or text containing URL (e.g., "https://amazon.com/dp/0451524934" or "Here: https://a.co/d/abc123")
 * @returns ISBN-13 if found, null if extraction failed
 *
 * @example
 * // With full URL
 * const isbn = await extractISBNFromAmazon('https://www.amazon.com/dp/0451524934');
 * // Returns: "9780451524935"
 *
 * @example
 * // With short link
 * const isbn = await extractISBNFromAmazon('https://a.co/d/example123');
 * // Returns: ISBN-13 string or null
 *
 * @example
 * // With text containing URL
 * const isbn = await extractISBNFromAmazon('Here: https://amazon.com/dp/0451524934');
 * // Returns: "9780451524935"
 */
export async function extractISBNFromAmazon(
  textOrUrl: string,
  source: 'sms' | 'web' = 'sms'
): Promise<string | null> {
  try {
    // Step 1: Extract URL from text
    const url = extractURL(textOrUrl) || textOrUrl;

    // Step 2: Validate it's an Amazon URL
    if (!isAmazonDomain(url)) {
      await logFailure(url, null, 'not_amazon', 'URL is not from Amazon domain', undefined, undefined, undefined, source);
      return null;
    }

    // Step 3: Handle short links and re-validate domain
    const fullUrl = await followRedirect(url);
    if (!fullUrl) {
      await logFailure(
        url,
        null,
        'redirect_failed',
        'Failed to follow redirect or invalid destination',
        undefined, // no status code
        undefined, // no final URL since redirect failed
        { originalUrl: url },
        source
      );
      return null;
    }

    // Step 4: Extract ASIN
    const asin = extractASIN(fullUrl);
    if (!asin) {
      await logFailure(
        url,
        null,
        'no_asin',
        'Could not extract ASIN from URL',
        undefined,
        fullUrl,
        { fullUrl },
        source
      );
      return null;
    }

    // Step 5: Try ASIN as ISBN-10 (fast path)
    const isbnFromASIN = await tryASINasISBN(asin);
    if (isbnFromASIN) {
      return isbnFromASIN;
    }

    // Step 6: Scrape Amazon page (fallback)
    const isbnFromScrape = await scrapeISBNFromAmazon(asin);
    if (isbnFromScrape) {
      return isbnFromScrape;
    }

    // Step 7: Both methods failed - log it
    await logFailure(
      url,
      asin,
      'isbn_lookup_failed',
      'ASIN-as-ISBN validation failed and scraping found no ISBN',
      undefined,
      fullUrl,
      undefined,
      source
    );

    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error in extractISBNFromAmazon:', errorMessage);

    await logFailure(
      textOrUrl,
      null,
      'unexpected_error',
      errorMessage,
      undefined,
      undefined,
      undefined,
      source
    );

    return null;
  }
}