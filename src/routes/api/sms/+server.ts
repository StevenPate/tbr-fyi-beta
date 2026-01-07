/**
 * SMS Webhook - Twilio Endpoint
 *
 * Handles incoming SMS messages with ISBN, photo, or Amazon link.
 * Supports multi-user with phone number as user_id.
 * New users must send START before adding books.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { fetchBookMetadata, toISBN13, InvalidISBNError, searchBooks } from '$lib/server/metadata';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '$env/static/private';
import { extractISBNFromAmazon } from '$lib/server/amazon-parser';
import { detectBarcodes } from '$lib/server/vision';
import { SMS_MESSAGES, detectCommand, getShelfUrl, getClaimUrl } from '$lib/server/sms-messages';
import { logger, logBookAddition, logUserEvent, logError, startTimer } from '$lib/server/logger';
import { upsertBookForUser } from '$lib/server/book-operations';

/**
 * User status from users table
 */
interface UserStatus {
	exists: boolean;
	hasStarted: boolean;
	optedOut: boolean;
}

/**
 * Get or create user record, return their status
 */
async function getUserStatus(phoneNumber: string): Promise<UserStatus> {
	// Try to get existing user
	const { data: existingUser, error: fetchError } = await supabase
		.from('users')
		.select('has_started, opted_out')
		.eq('phone_number', phoneNumber)
		.maybeSingle();

	if (fetchError && fetchError.code !== 'PGRST116') {
		console.error('Error fetching user:', fetchError);
		// Default to safe state (treat as new user)
		return { exists: false, hasStarted: false, optedOut: false };
	}

	// User exists
	if (existingUser) {
		return {
			exists: true,
			hasStarted: existingUser.has_started,
			optedOut: existingUser.opted_out
		};
	}

	// User doesn't exist, create them
	const { error: insertError } = await supabase
		.from('users')
		.insert({
			phone_number: phoneNumber,
			has_started: false,
			opted_out: false
		});

	if (insertError) {
		console.error('Error creating user:', insertError);
	}

	return { exists: false, hasStarted: false, optedOut: false };
}

/**
 * Check if we should show account creation prompt
 * Strategy: Show after 5+ books, but only once per week, max 5 times
 */
async function shouldShowAccountPrompt(phoneNumber: string): Promise<boolean> {
	const { data: user } = await supabase
		.from('users')
		.select('verified_at, account_prompt_count, last_account_prompt_at')
		.eq('phone_number', phoneNumber)
		.single();

	if (!user) return false;

	// Don't prompt if already claimed account
	if (user.verified_at) return false;

	// Don't prompt if we've shown it 5 times already
	if (user.account_prompt_count && user.account_prompt_count >= 5) return false;

	// Check if we've shown it recently (within last 7 days)
	if (user.last_account_prompt_at) {
		const lastPrompt = new Date(user.last_account_prompt_at);
		const daysSincePrompt = (Date.now() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24);
		if (daysSincePrompt < 7) return false;
	}

	// Count books for this user
	const { count } = await supabase
		.from('books')
		.select('*', { count: 'exact' })
		.eq('user_id', phoneNumber);

	// Only show if they have 5+ books
	return (count ?? 0) >= 5;
}

/**
 * Record that we showed the account prompt
 */
async function recordAccountPrompt(phoneNumber: string): Promise<void> {
	const { data: user } = await supabase
		.from('users')
		.select('account_prompt_count')
		.eq('phone_number', phoneNumber)
		.single();

	const currentCount = user?.account_prompt_count || 0;

	await supabase
		.from('users')
		.update({
			account_prompt_count: currentCount + 1,
			last_account_prompt_at: new Date().toISOString()
		})
		.eq('phone_number', phoneNumber);
}

/**
 * Potentially add account prompt to success message
 */
async function maybeAddAccountPrompt(baseMessage: string, phoneNumber: string): Promise<string> {
	if (await shouldShowAccountPrompt(phoneNumber)) {
		await recordAccountPrompt(phoneNumber);
		return baseMessage + '\n\n' + SMS_MESSAGES.accountPromptBasic(phoneNumber);
	}
	return baseMessage;
}

/**
 * Check if we should show the feedback opt-in prompt
 * Only show on first book add, and only once
 */
async function shouldShowFeedbackPrompt(phoneNumber: string): Promise<boolean> {
	const { data: user } = await supabase
		.from('users')
		.select('feedback_opt_in, feedback_prompted_at')
		.eq('phone_number', phoneNumber)
		.single();

	if (!user) return false;

	// Don't prompt if already opted in
	if (user.feedback_opt_in) return false;

	// Don't prompt if we've already shown it
	if (user.feedback_prompted_at) return false;

	// Check if this is their first book (count should be 1 after adding)
	const { count } = await supabase
		.from('books')
		.select('*', { count: 'exact' })
		.eq('user_id', phoneNumber);

	// Show prompt only if they just added their first book
	return count === 1;
}

/**
 * Record that we showed the feedback prompt
 */
async function recordFeedbackPrompt(phoneNumber: string): Promise<void> {
	await supabase
		.from('users')
		.update({ feedback_prompted_at: new Date().toISOString() })
		.eq('phone_number', phoneNumber);
}

/**
 * Potentially add feedback prompt to first book success message
 */
async function maybeAddFeedbackPrompt(baseMessage: string, phoneNumber: string): Promise<string> {
	if (await shouldShowFeedbackPrompt(phoneNumber)) {
		await recordFeedbackPrompt(phoneNumber);
		return baseMessage + SMS_MESSAGES.FEEDBACK_PROMPT;
	}
	return baseMessage;
}

/**
 * Handle incoming SMS from Twilio
 */
export const POST: RequestHandler = async ({ request }) => {
	const requestTimer = startTimer();
	let userId: string = '';
	try {
		const reqId = Math.random().toString(36).slice(2, 10);
		// Parse Twilio form data
		const formData = await request.formData();
		const from = formData.get('From') as string;
		const body = formData.get('Body') as string;
		const numMedia = parseInt(formData.get('NumMedia') as string) || 0;

		logger.debug({ reqId, from, numMedia, bodyLength: body?.length || 0 }, 'Received SMS');

		// Use sender's phone number as user_id
		userId = from;

		// Get user status (auto-creates user record if needed)
		const userStatus = await getUserStatus(userId);

		// Check for commands (START, STOP, HELP)
		const command = detectCommand(body);

	// Parse common text upfront for simple commands like ADD
	const rawBody = (body || '').trim();

	// Handle STOP command (opt-out)
		if (command === 'STOP') {
			logger.debug({ reqId, from }, 'STOP command received');

			if (userStatus.optedOut) {
				return twimlResponse(SMS_MESSAGES.STOP_ALREADY_OPTED_OUT);
			}

			// Set opted_out flag and clear feedback_opt_in
			await supabase
				.from('users')
				.update({
					opted_out: true,
					opted_out_at: new Date().toISOString(),
					feedback_opt_in: false
				})
				.eq('phone_number', userId);

			logUserEvent({
				event: 'user_event',
				user_id: userId,
				action: 'opt_out',
				source: 'sms'
			});

			return twimlResponse(SMS_MESSAGES.STOP_CONFIRMATION);
		}

	// Handle START command (opt-in / resubscribe)
		if (command === 'START') {
			logger.debug({ reqId, from, isNewUser: !userStatus.exists }, 'START command received');

			// Update user record: set has_started=true, opted_out=false
			await supabase
				.from('users')
				.update({
					has_started: true,
					opted_out: false,
					started_at: new Date().toISOString()
				})
				.eq('phone_number', userId);

			// Only create TBR shelf for truly new users
			if (!userStatus.exists) {
				try {
					// Create TBR shelf (idempotent via unique constraint)
					const { data: tbrShelf, error: shelfError } = await supabase
						.from('shelves')
						.upsert(
							{
								user_id: userId,
								name: 'TBR'
							},
							{ onConflict: 'user_id,name' }
						)
						.select('id')
						.single();

					// Set as default shelf
					if (tbrShelf && !shelfError) {
						await supabase
							.from('users')
							.update({ default_shelf_id: tbrShelf.id })
							.eq('phone_number', userId);
					}
				} catch (error) {
					logError({
						event: 'error',
						error_type: 'tbr_shelf_creation',
						message: error instanceof Error ? error.message : 'Unknown error',
						user_id: userId
					});
					// Continue - graceful degradation
				}
			}

			logUserEvent({
				event: 'user_event',
				user_id: userId,
				action: 'signup',
				source: 'sms'
			});

			return twimlResponse(SMS_MESSAGES.welcomeActivated(userId));
		}

		// Handle HELP command
		if (command === 'HELP') {
			return twimlResponse(SMS_MESSAGES.HELP);
		}

		// Handle FEEDBACK command (opt-in for feedback messages)
		if (command === 'FEEDBACK') {
			logger.debug({ reqId, from }, 'FEEDBACK command received');

			// Check if already opted in
			const { data: user } = await supabase
				.from('users')
				.select('feedback_opt_in')
				.eq('phone_number', userId)
				.single();

			if (user?.feedback_opt_in) {
				return twimlResponse(SMS_MESSAGES.FEEDBACK_ALREADY_OPTED_IN);
			}

			// Set feedback_opt_in flag
			await supabase
				.from('users')
				.update({
					feedback_opt_in: true,
					feedback_opt_in_at: new Date().toISOString()
				})
				.eq('phone_number', userId);

			logUserEvent({
				event: 'user_event',
				user_id: userId,
				action: 'feedback_opt_in',
				source: 'sms'
			});

			return twimlResponse(SMS_MESSAGES.FEEDBACK_OPT_IN_CONFIRMATION);
		}

		// Handle ADD command (either "ADD" or "ADD 978...")
		if (/^ADD(\b|\s|!|\.)/i.test(rawBody)) {
			const addTimer = startTimer();
			// Try to extract ISBN after ADD
			const isbnPart = rawBody.replace(/^ADD\s*/i, '').trim();
			let targetIsbn: string | null = null;
			if (isbnPart) {
				const digits = isbnPart.replace(/[^0-9Xx]/g, '');
				if (digits.length === 10 || digits.length === 13) {
					targetIsbn = digits;
				} else {
					return twimlResponse(SMS_MESSAGES.ADD_INVALID_ISBN);
				}
			} else {
				// No explicit ISBN – try last suggested for this user
				const { data: ctx, error: ctxErr } = await supabase
					.from('sms_context')
					.select('last_isbn13, last_title')
					.eq('phone_number', userId)
					.maybeSingle();
				if (!ctx || ctxErr) {
					return twimlResponse(SMS_MESSAGES.ADD_NO_CONTEXT);
				}
				targetIsbn = ctx.last_isbn13;
			}

			// Normalize to ISBN-13
			let isbn13ToAdd: string;
			try {
				isbn13ToAdd = toISBN13(targetIsbn!);
			} catch (e) {
				if (e instanceof InvalidISBNError) {
					logBookAddition({
						event: 'book_addition',
						user_id: userId,
						source: 'sms',
						method: 'isbn',
						success: false,
						error: 'Invalid ISBN',
						duration_ms: addTimer()
					});
					return twimlResponse(SMS_MESSAGES.invalidIsbn(e.message));
				}
				throw e;
			}

			// Fetch metadata and add to shelf (reuse existing logic)
			const metadata = await fetchBookMetadata(isbn13ToAdd);
			if (!metadata) {
				logBookAddition({
					event: 'book_addition',
					user_id: userId,
					source: 'sms',
					method: 'isbn',
					isbn13: isbn13ToAdd,
					success: false,
					error: 'Book not found',
					duration_ms: addTimer()
				});
				return twimlResponse(SMS_MESSAGES.bookNotFound(isbn13ToAdd));
			}

			// Use shared book upsert logic
			const result = await upsertBookForUser(userId, metadata);

			if (!result.success) {
				logBookAddition({
					event: 'book_addition',
					user_id: userId,
					source: 'sms',
					method: 'isbn',
					isbn13: metadata.isbn,
					title: metadata.title,
					success: false,
					error: result.error || 'Unknown error',
					duration_ms: addTimer()
				});
				logger.error({ error: result.error }, 'Error upserting book');
				return twimlResponse(result.isDuplicate
					? SMS_MESSAGES.bookAlreadyExists(metadata.title)
					: SMS_MESSAGES.bookNotFound(metadata.isbn));
			}

			logBookAddition({
				event: 'book_addition',
				user_id: userId,
				source: 'sms',
				method: 'isbn',
				isbn13: metadata.isbn,
				title: metadata.title,
				success: true,
				duration_ms: addTimer()
			});

			const authorText = metadata.author.length > 0 ? metadata.author[0] : undefined;
			let message = SMS_MESSAGES.bookAdded(metadata.title, userId, authorText);
			message = await maybeAddFeedbackPrompt(message, userId);
			message = await maybeAddAccountPrompt(message, userId);
			return twimlResponse(message);
		}

		// Check if user is opted out
		if (userStatus.optedOut) {
			console.log('Message from opted-out user:', { reqId, from });
			return twimlResponse(SMS_MESSAGES.OPTED_OUT_MESSAGE);
		}

		// Check if user has started (sent START command)
		if (!userStatus.hasStarted) {
			console.log('Message from user who hasnt started:', { reqId, from });
			return twimlResponse(SMS_MESSAGES.WELCOME_NEW_USER);
		}

		let isbn: string | null = null;
		let responseMessage = '';
		const bookTimer = startTimer();
		let detectionMethod: 'isbn' | 'amazon_link' | 'search' | 'image' = 'isbn';

		// 1. Check if it's a photo (MMS)
		if (numMedia > 0) {
			const processingStart = Date.now();
			try {
				if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
					console.error('MMS processing error: Missing TWILIO credentials');
					return twimlResponse(SMS_MESSAGES.MMS_UNAVAILABLE);
				}
				const mediaUrl = formData.get('MediaUrl0') as string | null;
				if (!mediaUrl) {
					const keys = Array.from(formData.keys());
					console.error('MMS processing error: MediaUrl0 missing', { reqId, keys });
					return twimlResponse(SMS_MESSAGES.MMS_NO_IMAGE_FOUND);
				}

				// Fetch image from Twilio with Basic auth
				const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
				let imageResponse: Response;
				try {
					imageResponse = await fetch(mediaUrl, {
						headers: { Authorization: `Basic ${auth}` },
						signal: controller.signal
					});
				} finally {
					clearTimeout(timeoutId);
				}

				if (!imageResponse.ok) {
					// Extra diagnostics for 401/403
					try {
						const u = new URL(mediaUrl);
						const accountMatch = u.pathname.match(/\/Accounts\/(AC[0-9a-fA-F]{32})\//);
						const accountInUrl = accountMatch ? accountMatch[1] : 'unknown';
						const sidTail = TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.slice(0, 6)}…${TWILIO_ACCOUNT_SID.slice(-4)}` : 'unset';
						console.error('MMS image download failed', {
							reqId,
							status: imageResponse.status,
							statusText: imageResponse.statusText,
							host: u.host,
							accountInUrl,
							accountFromEnv: sidTail
						});
					} catch {}

					return twimlResponse(SMS_MESSAGES.MMS_DOWNLOAD_FAILED);
				}

				const contentType = imageResponse.headers.get('content-type') || '';
				if (!contentType.startsWith('image/')) {
					console.error('MMS invalid content-type', { reqId, contentType });
					return twimlResponse(SMS_MESSAGES.MMS_INVALID_FILE_TYPE);
				}

				const arrayBuf = await imageResponse.arrayBuffer();
				const imageBuffer = Buffer.from(arrayBuf);

				// Detect barcodes/ISBN-like strings (single Vision attempt, 5s timeout, cap 5)
				const { isbns } = await detectBarcodes(imageBuffer, { timeoutMs: 5000, maxResults: 5 });
				console.log('MMS detectBarcodes result', { reqId, count: isbns.length });

				if (isbns.length === 0) {
					return twimlResponse(SMS_MESSAGES.MMS_NO_ISBN_DETECTED);
				}

				// Validate with metadata services (Google Books + Open Library fallback) and add to shelf
				const uniqueIsbns = Array.from(new Set(isbns)).slice(0, 5);
				const results = await Promise.all(
					uniqueIsbns.map(async (isbn13) => {
						const metadata = await fetchBookMetadata(isbn13);
						return { isbn13, metadata } as const;
					})
				);

				const addedTitles: string[] = [];
				const existedTitles: string[] = [];

				// Process each detected book
				for (const { isbn13, metadata } of results) {
					if (!metadata) {
						logBookAddition({
							event: 'book_addition',
							user_id: userId,
							source: 'sms',
							method: 'image',
							isbn13,
							success: false,
							error: 'Metadata not found',
							duration_ms: Date.now() - processingStart
						});
						continue;
					}

					// Use shared book upsert logic
					const result = await upsertBookForUser(userId, metadata);

					if (!result.success) {
						logger.error({ error: result.error, reqId }, 'Book upsert failed (MMS)');
						logBookAddition({
							event: 'book_addition',
							user_id: userId,
							source: 'sms',
							method: 'image',
							isbn13: metadata.isbn,
							title: metadata.title,
							success: false,
							error: result.error || 'Unknown error',
							duration_ms: Date.now() - processingStart
						});
						// Track duplicates separately (don't show as errors to user)
						if (result.isDuplicate) {
							existedTitles.push(metadata.title);
						}
						continue;
					}

					logBookAddition({
						event: 'book_addition',
						user_id: userId,
						source: 'sms',
						method: 'image',
						isbn13: metadata.isbn,
						title: metadata.title,
						success: true,
						duration_ms: Date.now() - processingStart
					});

					addedTitles.push(metadata.title);
				}

				const totalMs = Date.now() - processingStart;
				console.log('MMS processing complete', { reqId, totalMs, added: addedTitles.length, existed: existedTitles.length });
				if (addedTitles.length > 0) {
					responseMessage = SMS_MESSAGES.mmsMultipleAdded(uniqueIsbns.length, addedTitles, existedTitles, userId);
					// Add feedback prompt for first book
					responseMessage = await maybeAddFeedbackPrompt(responseMessage, userId);
				} else if (existedTitles.length > 0) {
					responseMessage = SMS_MESSAGES.mmsAllExisted(existedTitles.length);
				} else {
					responseMessage = SMS_MESSAGES.MMS_NO_ISBN_DETECTED;
				}

			} catch (err: unknown) {
				if (err instanceof Error && err.name === 'AbortError') {
					return twimlResponse(SMS_MESSAGES.MMS_TIMEOUT);
				} else {
					console.error('MMS processing error:', err);
					return twimlResponse(SMS_MESSAGES.MMS_PROCESSING_ERROR);
				}
			}

			return twimlResponse(responseMessage);
		}

		// 2. Check if it's an Amazon link
		// extractISBNFromAmazon now handles URL extraction from text,
		// so we can pass the body directly (supports "Here: https://..." format)
		if (body && (body.includes('amazon.com') || body.includes('a.co'))) {
			try {
				console.log('Processing Amazon text/URL:', body);
				isbn = await extractISBNFromAmazon(body); // Handles URL extraction internally

				if (!isbn) {
					return twimlResponse(SMS_MESSAGES.AMAZON_NO_ISBN);
				}

				console.log('Successfully extracted ISBN from Amazon:', isbn);
			} catch (error) {
				console.error('Amazon parser error:', error);
				return twimlResponse(SMS_MESSAGES.AMAZON_PARSE_ERROR);
			}
		}

		// 3. Check if it's a plain ISBN (10 or 13 digits)
		if (!isbn && body) {
			const cleaned = body.replace(/[^0-9Xx]/g, '');
			if (cleaned.length === 10 || cleaned.length === 13) {
				isbn = cleaned;
			}
		}

		// If no ISBN found, try title/author search (stateless)
		if (!isbn) {
			const raw = (body || '').trim();
			if (!raw) {
				return twimlResponse(SMS_MESSAGES.NO_ISBN_FOUND);
			}

			// Heuristic: split on " by " when present
			const byMatch = /\s+by\s+/i;
			let title: string | undefined;
			let author: string | undefined;
			if (byMatch.test(raw)) {
				const [t, a] = raw.split(byMatch);
				title = t?.trim() || undefined;
				author = a?.trim() || undefined;
			}
			const q = title || author ? undefined : raw.replace(/["\[\]()]/g, '').slice(0, 200);

			try {
				const candidates = await searchBooks({ q, title, author, max: 8 });
				if (candidates && candidates.length > 0) {
					const top = candidates[0];
					// Persist last suggestion for quick ADD
					await supabase
						.from('sms_context')
						.upsert({
							phone_number: userId,
							last_isbn13: top.isbn13,
							last_title: top.title,
							updated_at: new Date().toISOString()
						});
					const msg = SMS_MESSAGES.searchBestMatch(top.title, top.authors, top.isbn13, userId, raw);
					return twimlResponse(msg);
				}
				return twimlResponse(SMS_MESSAGES.searchNoMatch(raw, userId));
			} catch (e) {
				console.error('Search error:', e);
				return twimlResponse(SMS_MESSAGES.NO_ISBN_FOUND);
			}
		}

		// Normalize ISBN to ISBN-13
		let isbn13: string;
		try {
			isbn13 = toISBN13(isbn);
		} catch (error) {
			if (error instanceof InvalidISBNError) {
				return twimlResponse(SMS_MESSAGES.invalidIsbn(error.message));
			}
			throw error;
		}

		// Fetch metadata from Google Books (with Open Library fallback)
		const metadata = await fetchBookMetadata(isbn13);

		if (!metadata) {
			logBookAddition({
				event: 'book_addition',
				user_id: userId,
				source: 'sms',
				method: detectionMethod,
				isbn13,
				success: false,
				error: 'Book not found',
				duration_ms: bookTimer()
			});
			return twimlResponse(SMS_MESSAGES.bookNotFound(isbn13));
		}

		// Use shared book upsert logic
		const result = await upsertBookForUser(userId, metadata);

		if (!result.success) {
			logger.error({ error: result.error }, 'Book upsert failed');
			logBookAddition({
				event: 'book_addition',
				user_id: userId,
				source: 'sms',
				method: detectionMethod,
				isbn13: metadata.isbn,
				title: metadata.title,
				success: false,
				error: result.error || 'Unknown error',
				duration_ms: bookTimer()
			});
			return twimlResponse(result.isDuplicate
				? SMS_MESSAGES.bookAlreadyExists(metadata.title)
				: SMS_MESSAGES.bookNotFound(metadata.isbn));
		}

		logBookAddition({
			event: 'book_addition',
			user_id: userId,
			source: 'sms',
			method: detectionMethod,
			isbn13: metadata.isbn,
			title: metadata.title,
			success: true,
			duration_ms: bookTimer()
		});

		// Success!
		const authorText = metadata.author.length > 0 ? metadata.author[0] : undefined;
		let message = SMS_MESSAGES.bookAdded(metadata.title, userId, authorText);
		message = await maybeAddFeedbackPrompt(message, userId);
		message = await maybeAddAccountPrompt(message, userId);
		return twimlResponse(message);
	} catch (error) {
		logError({
			event: 'error',
			error_type: 'sms_webhook',
			message: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined,
			user_id: userId || undefined
		});
		return twimlResponse(SMS_MESSAGES.GENERIC_ERROR);
	} finally {
		logger.info({ duration_ms: requestTimer(), endpoint: 'sms', user_id: userId || undefined }, 'SMS request completed');
	}
};

/**
 * Generate TwiML response
 */
function twimlResponse(message: string) {
	const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${escapeXml(message)}</Message>
</Response>`;

	return new Response(twiml, {
		headers: {
			'Content-Type': 'text/xml'
		}
	});
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

