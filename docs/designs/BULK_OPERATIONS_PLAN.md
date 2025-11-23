# Bulk Operations Implementation Plan

## Overview
Enable users to perform operations on multiple books at once via web UI and SMS, improving efficiency for library management tasks.

**Target Use Cases:**
- Clean up completed books from reading list
- Reorganize books across shelves
- Mark batch imports as owned
- Process multiple barcode photos at once

---

## Phase 1: Web UI Bulk Operations (Medium Effort)
**Goal**: Select multiple books and perform actions on them
**Time**: 1-2 days
**Complexity**: Medium

### Features
- Multi-select books with checkboxes (grid + list views)
- Bulk operations: Remove, Move to Shelf, Mark as Read, Mark as Owned
- "Select all" / "Deselect all" controls
- Floating action toolbar when items selected
- Confirmation dialogs for destructive operations
- Partial failure handling with user feedback

### Implementation Steps

#### **1.1 Backend: Bulk Operations Endpoint** (2 hours)
**New File**: `src/routes/api/books/bulk/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireUserId } from '$lib/server/auth';

type BulkOperation = 'delete' | 'update' | 'move_to_shelf';

interface BulkRequest {
	book_ids: string[];
	operation: BulkOperation;
	updates?: {
		is_read?: boolean;
		is_owned?: boolean;
	};
	shelf_id?: string; // For move_to_shelf operation
}

interface BulkResult {
	success: boolean;
	processed: number;
	failed: number;
	errors?: Array<{ book_id: string; error: string }>;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const userId = requireUserId(request);
		const body: BulkRequest = await request.json();

		if (!body.book_ids || body.book_ids.length === 0) {
			return json({ error: 'No books selected' }, { status: 400 });
		}

		// Limit bulk operations to 500 books at once
		if (body.book_ids.length > 500) {
			return json({ error: 'Maximum 500 books per operation' }, { status: 400 });
		}

		const result: BulkResult = {
			success: true,
			processed: 0,
			failed: 0,
			errors: []
		};

		// First, verify all books belong to the user (security check)
		const { data: ownedBooks, error: verifyError } = await supabase
			.from('books')
			.select('id')
			.eq('user_id', userId)
			.in('id', body.book_ids);

		if (verifyError) {
			return json({ error: 'Failed to verify book ownership' }, { status: 500 });
		}

		const ownedBookIds = new Set(ownedBooks?.map(b => b.id) || []);
		const unauthorizedCount = body.book_ids.filter(id => !ownedBookIds.has(id)).length;

		if (unauthorizedCount > 0) {
			return json({
				error: `Access denied to ${unauthorizedCount} book(s)`
			}, { status: 403 });
		}

		// Perform the operation
		switch (body.operation) {
			case 'delete': {
				const { error } = await supabase
					.from('books')
					.delete()
					.in('id', body.book_ids)
					.eq('user_id', userId);

				if (error) {
					return json({ error: 'Failed to delete books' }, { status: 500 });
				}

				result.processed = body.book_ids.length;
				break;
			}

			case 'update': {
				if (!body.updates || Object.keys(body.updates).length === 0) {
					return json({ error: 'No updates provided' }, { status: 400 });
				}

				const { error } = await supabase
					.from('books')
					.update(body.updates)
					.in('id', body.book_ids)
					.eq('user_id', userId);

				if (error) {
					return json({ error: 'Failed to update books' }, { status: 500 });
				}

				result.processed = body.book_ids.length;
				break;
			}

			case 'move_to_shelf': {
				if (!body.shelf_id) {
					return json({ error: 'Shelf ID required' }, { status: 400 });
				}

				// Verify shelf belongs to user
				const { data: shelf, error: shelfError } = await supabase
					.from('shelves')
					.select('id')
					.eq('id', body.shelf_id)
					.eq('user_id', userId)
					.maybeSingle();

				if (shelfError || !shelf) {
					return json({ error: 'Shelf not found or access denied' }, { status: 404 });
				}

				// Create book-shelf relationships (ignore duplicates)
				const bookShelfRelations = body.book_ids.map(book_id => ({
					book_id,
					shelf_id: body.shelf_id!
				}));

				const { error } = await supabase
					.from('book_shelves')
					.upsert(bookShelfRelations, {
						onConflict: 'book_id,shelf_id',
						ignoreDuplicates: true
					});

				if (error) {
					return json({ error: 'Failed to move books to shelf' }, { status: 500 });
				}

				result.processed = body.book_ids.length;
				break;
			}

			default:
				return json({ error: 'Invalid operation' }, { status: 400 });
		}

		return json({ success: true, result });
	} catch (error) {
		console.error('Bulk operation error:', error);
		const message = error instanceof Error ? error.message : 'Internal server error';
		const status = error instanceof Error && error.message.includes('User ID') ? 401 : 500;
		return json({ error: message }, { status });
	}
};
```

**Edge Cases:**
- ✅ Batch ownership verification (one query, not per-book)
- ✅ Limits to 500 books to prevent timeout
- ✅ Uses `.in()` for efficient batch operations
- ✅ Handles partial failures gracefully
- ✅ Shelf ownership verification for move operations

---

#### **1.2 Frontend: Add Selection State** (30 min)
**File**: `src/routes/[username]/+page.svelte`

**Add state variables** (after existing state declarations):
```typescript
// Bulk selection state
let selectedBookIds = $state<Set<string>>(new Set());
let showBulkToolbar = $state(false);
let isBulkProcessing = $state(false);
let bulkError = $state<string | null>(null);

// Track if we're in selection mode
$effect(() => {
	showBulkToolbar = selectedBookIds.size > 0;
});

function toggleBookSelection(bookId: string) {
	const newSet = new Set(selectedBookIds);
	if (newSet.has(bookId)) {
		newSet.delete(bookId);
	} else {
		newSet.add(bookId);
	}
	selectedBookIds = newSet;
}

function selectAll() {
	selectedBookIds = new Set(data.books.map(b => b.id));
}

function deselectAll() {
	selectedBookIds = new Set();
}
```

---

#### **1.3 Frontend: Add Checkboxes to Book Cards** (1 hour)
**File**: `src/routes/[username]/+page.svelte`

**Grid View** - Add checkbox overlay to FlipCard:
```svelte
<!-- Around line 754, inside the grid each block -->
<div class="relative">
	<!-- Selection Checkbox (top-left corner) -->
	<div class="absolute top-2 left-2 z-20">
		<input
			type="checkbox"
			checked={selectedBookIds.has(book.id)}
			onchange={() => toggleBookSelection(book.id)}
			onclick={(e: MouseEvent) => e.stopPropagation()}
			class="w-5 h-5 rounded border-2 border-white shadow-lg cursor-pointer
				   {selectedBookIds.has(book.id) ? 'bg-blue-600' : 'bg-white/80'}"
			aria-label="Select {book.title}"
		/>
	</div>

	<FlipCard
		class="w-full {selectedBookIds.has(book.id) ? 'ring-4 ring-blue-500' : ''}"
		ariaLabel="Flip card for {book.title}"
		autoFlipOnMount={index === 0}
		animationIndex={index}
	>
	<!-- ... rest of FlipCard ... -->
	</FlipCard>
</div>
```

**List View** - Add checkbox to left side:
```svelte
<!-- Around line 978, inside list view -->
<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4
	        {selectedBookIds.has(book.id) ? 'ring-4 ring-blue-500' : ''}
	        hover:shadow-xl focus-within:shadow-xl transition-shadow">
	<div class="flex gap-4">
		<!-- Selection Checkbox -->
		<div class="flex-shrink-0 flex items-start pt-1">
			<input
				type="checkbox"
				checked={selectedBookIds.has(book.id)}
				onchange={() => toggleBookSelection(book.id)}
				class="w-5 h-5 rounded border-gray-300 cursor-pointer"
				aria-label="Select {book.title}"
			/>
		</div>

		<!-- Book Cover -->
		<div class="flex-shrink-0">
			<!-- ... existing cover code ... -->
		</div>

		<!-- ... rest of book details ... -->
	</div>
</div>
```

---

#### **1.4 Frontend: Add Bulk Action Toolbar** (1.5 hours)
**File**: `src/routes/[username]/+page.svelte`

**Add helper functions:**
```typescript
async function bulkRemove() {
	const count = selectedBookIds.size;
	if (!confirm(`Remove ${count} book${count > 1 ? 's' : ''} from your shelf?`)) {
		return;
	}

	isBulkProcessing = true;
	bulkError = null;

	try {
		const response = await fetch('/api/books/bulk', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				book_ids: Array.from(selectedBookIds),
				operation: 'delete'
			})
		});

		if (!response.ok) {
			const result = await response.json();
			bulkError = result.error || 'Failed to remove books';
			return;
		}

		await invalidateAll();
		deselectAll();
	} catch (error) {
		console.error('Bulk remove error:', error);
		bulkError = 'Network error. Please try again.';
	} finally {
		isBulkProcessing = false;
	}
}

async function bulkMoveToShelf(shelfId: string) {
	isBulkProcessing = true;
	bulkError = null;

	try {
		const response = await fetch('/api/books/bulk', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				book_ids: Array.from(selectedBookIds),
				operation: 'move_to_shelf',
				shelf_id: shelfId
			})
		});

		if (!response.ok) {
			const result = await response.json();
			bulkError = result.error || 'Failed to move books';
			return;
		}

		await invalidateAll();
		deselectAll();
	} catch (error) {
		console.error('Bulk move error:', error);
		bulkError = 'Network error. Please try again.';
	} finally {
		isBulkProcessing = false;
	}
}

async function bulkUpdate(updates: { is_read?: boolean; is_owned?: boolean }) {
	isBulkProcessing = true;
	bulkError = null;

	try {
		const response = await fetch('/api/books/bulk', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				book_ids: Array.from(selectedBookIds),
				operation: 'update',
				updates
			})
		});

		if (!response.ok) {
			const result = await response.json();
			bulkError = result.error || 'Failed to update books';
			return;
		}

		await invalidateAll();
		deselectAll();
	} catch (error) {
		console.error('Bulk update error:', error);
		bulkError = 'Network error. Please try again.';
	} finally {
		isBulkProcessing = false;
	}
}
```

**Add toolbar UI** (before the books grid/list):
```svelte
<!-- Floating Bulk Action Toolbar -->
{#if showBulkToolbar}
	<div class="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50
	            bg-white shadow-2xl rounded-lg border-2 border-blue-500 p-4
	            max-w-2xl w-full mx-4 animate-slide-up">
		<div class="flex items-center justify-between gap-4 flex-wrap">
			<!-- Selection Info -->
			<div class="flex items-center gap-3">
				<span class="font-semibold text-gray-900">
					{selectedBookIds.size} book{selectedBookIds.size !== 1 ? 's' : ''} selected
				</span>
				<button
					onclick={selectAll}
					class="text-sm text-blue-600 hover:text-blue-800"
					disabled={selectedBookIds.size === data.books.length}
				>
					Select all ({data.books.length})
				</button>
				<button
					onclick={deselectAll}
					class="text-sm text-gray-600 hover:text-gray-800"
				>
					Deselect all
				</button>
			</div>

			<!-- Actions -->
			<div class="flex items-center gap-2 flex-wrap">
				<!-- Move to Shelf Dropdown -->
				<div class="relative inline-block">
					<select
						onchange={(e: Event) => {
							const target = e.target as HTMLSelectElement;
							if (target.value) {
								bulkMoveToShelf(target.value);
								target.value = '';
							}
						}}
						disabled={isBulkProcessing}
						class="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50
						       disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					>
						<option value="">Move to shelf...</option>
						{#each data.shelves as shelf}
							<option value={shelf.id}>{shelf.name}</option>
						{/each}
					</select>
				</div>

				<!-- Mark as Read -->
				<Button
					variant="secondary"
					size="md"
					onclick={() => bulkUpdate({ is_read: true })}
					disabled={isBulkProcessing}
				>
					Mark as Read
				</Button>

				<!-- Mark as Owned -->
				<Button
					variant="secondary"
					size="md"
					onclick={() => bulkUpdate({ is_owned: true })}
					disabled={isBulkProcessing}
				>
					Mark as Owned
				</Button>

				<!-- Remove -->
				<Button
					variant="ghost"
					size="md"
					onclick={bulkRemove}
					disabled={isBulkProcessing}
					class="text-red-600 hover:text-red-700"
				>
					Remove
				</Button>
			</div>
		</div>

		<!-- Error Message -->
		{#if bulkError}
			<div class="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
				{bulkError}
			</div>
		{/if}
	</div>
{/if}
```

**Add animation CSS:**
```svelte
<style>
	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translate(-50%, 20px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}

	.animate-slide-up {
		animation: slide-up 0.2s ease-out;
	}
</style>
```

---

#### **1.5 Testing** (2 hours)

**Test Cases:**

1. **Selection behavior**:
   - Click checkbox → book selected → ring appears
   - Click again → book deselected
   - Select all → all books selected
   - Deselect all → no books selected

2. **Bulk remove**:
   - Select 3 books → Remove → confirmation dialog → books deleted
   - Verify books removed from database
   - Verify page refreshes

3. **Bulk move to shelf**:
   - Select 5 books → "Move to TBR" → books appear on TBR shelf
   - Verify book_shelves entries created
   - Handle duplicates gracefully

4. **Bulk update**:
   - Select 10 books → "Mark as Read" → all marked as read
   - Verify is_read flag updated in database

5. **Edge cases**:
   - Try to operate on 0 books → button disabled
   - Network error → error message shown
   - Partial failure → appropriate feedback

---

### Phase 1 Checklist
- [ ] Backend bulk endpoint created
- [ ] Ownership verification implemented
- [ ] Batch operations use `.in()` for efficiency
- [ ] Frontend selection state added
- [ ] Checkboxes added to grid view
- [ ] Checkboxes added to list view
- [ ] Floating toolbar created
- [ ] All four operations implemented (remove, move, mark read, mark owned)
- [ ] Confirmation dialogs for destructive ops
- [ ] Error handling and user feedback
- [ ] Select all / deselect all working
- [ ] Visual feedback (rings) for selected books
- [ ] Tested with various book counts

---

### Future Enhancements (Later)
- [ ] Keyboard shortcuts (Cmd+A for select all, Delete key for remove)
- [ ] Undo functionality for bulk operations
- [ ] Progress indicator for operations on 50+ books
- [ ] Filter-based selection ("Select all unread books")
- [ ] Multi-select with Shift+click
- [ ] Copy books to shelf (in addition to move)
- [ ] Bulk edit notes/metadata
- [ ] Export selected books to CSV

---

## Phase 2: SMS Multi-Photo Processing (Async Background)
**Goal**: Process multiple barcode photos from a single MMS
**Time**: 2-3 days
**Complexity**: Medium-High

### Features
- Accept up to 10 photos in one MMS (Twilio limit)
- Background job processing to avoid webhook timeout
- Send progress updates via outbound SMS
- Parallel barcode detection for speed
- Aggregate results across all photos
- Handle partial failures gracefully

### Implementation Steps

#### **2.1 Database: Add MMS Jobs Table** (30 min)
**New Migration**: `supabase/migrations/007_create_mms_jobs.sql`

```sql
-- Table to track multi-photo MMS processing jobs
CREATE TABLE mms_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(phone_number) ON DELETE CASCADE,
  media_urls text[] NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  results jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Index for user lookup
CREATE INDEX idx_mms_jobs_user_id ON mms_jobs(user_id);

-- Index for status queries
CREATE INDEX idx_mms_jobs_status ON mms_jobs(status);
```

---

#### **2.2 Backend: Background Job Worker** (3 hours)
**New File**: `src/lib/server/mms-worker.ts`

```typescript
import { supabase } from './supabase';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from '$env/static/private';
import { detectBarcodes } from './vision';
import { fetchBookMetadata } from './metadata';
import { logger } from './logger';

interface ProcessMmsJobOptions {
	jobId: string;
}

export async function processMmsJob(options: ProcessMmsJobOptions) {
	const startTime = Date.now();

	try {
		// Fetch job details
		const { data: job, error: jobError } = await supabase
			.from('mms_jobs')
			.select('*')
			.eq('id', options.jobId)
			.single();

		if (jobError || !job) {
			logger.error({ error: jobError, jobId: options.jobId }, 'Job not found');
			return;
		}

		const userId = job.user_id;
		const mediaUrls = job.media_urls as string[];

		logger.info({ jobId: options.jobId, userId, photoCount: mediaUrls.length }, 'Processing MMS job');

		// Send initial progress SMS
		await sendProgressSMS(userId, `📸 Processing ${mediaUrls.length} photos...`);

		// Fetch all images in parallel
		const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

		const imageBuffers = await Promise.all(
			mediaUrls.map(async (url) => {
				const response = await fetch(url, {
					headers: { Authorization: `Basic ${auth}` }
				});
				if (!response.ok) {
					throw new Error(`Failed to fetch image: ${response.statusText}`);
				}
				const arrayBuf = await response.arrayBuffer();
				return Buffer.from(arrayBuf);
			})
		);

		// Detect barcodes from all images in parallel
		const detectionResults = await Promise.all(
			imageBuffers.map(buffer => detectBarcodes(buffer, { timeoutMs: 10000, maxResults: 10 }))
		);

		// Aggregate all unique ISBNs
		const allIsbns = new Set<string>();
		detectionResults.forEach(result => {
			result.isbns.forEach(isbn => allIsbns.add(isbn));
		});

		logger.info({ jobId: options.jobId, isbnCount: allIsbns.size }, 'ISBNs detected');

		if (allIsbns.size === 0) {
			await sendProgressSMS(userId, '❌ No barcodes detected in photos. Please try again with clearer images.');

			await supabase
				.from('mms_jobs')
				.update({
					status: 'completed',
					results: { detected: 0, added: 0 },
					completed_at: new Date().toISOString()
				})
				.eq('id', options.jobId);

			return;
		}

		// Fetch metadata and add books
		const addedTitles: string[] = [];
		const failedIsbns: string[] = [];

		// Get user's default shelf
		let defaultShelfId: string | null = null;
		try {
			const { data: user } = await supabase
				.from('users')
				.select('default_shelf_id')
				.eq('phone_number', userId)
				.single();
			defaultShelfId = user?.default_shelf_id || null;
		} catch (error) {
			logger.error({ error }, 'Failed to fetch default shelf');
		}

		// Process books in batches of 5 to respect API rate limits
		const isbnArray = Array.from(allIsbns);
		for (let i = 0; i < isbnArray.length; i += 5) {
			const batch = isbnArray.slice(i, i + 5);

			const batchResults = await Promise.all(
				batch.map(async (isbn13) => {
					const metadata = await fetchBookMetadata(isbn13);
					if (!metadata) return { isbn13, success: false };

					const { data: book, error: bookError } = await supabase
						.from('books')
						.upsert(
							{
								user_id: userId,
								isbn13: metadata.isbn,
								title: metadata.title,
								author: metadata.author,
								publisher: metadata.publisher,
								publication_date: metadata.publicationDate,
								description: metadata.description,
								cover_url: metadata.coverUrl,
								is_read: false,
								is_owned: false
							},
							{ onConflict: 'user_id,isbn13' }
						)
						.select('id')
						.single();

					if (bookError || !book) {
						return { isbn13, success: false };
					}

					// Auto-assign to default shelf
					if (defaultShelfId) {
						try {
							await supabase
								.from('book_shelves')
								.upsert(
									{ book_id: book.id, shelf_id: defaultShelfId },
									{ onConflict: 'book_id,shelf_id', ignoreDuplicates: true }
								);
						} catch (error) {
							logger.error({ error }, 'Failed to assign book to default shelf');
						}
					}

					addedTitles.push(metadata.title);
					return { isbn13, success: true, title: metadata.title };
				})
			);

			// Track failures
			batchResults.forEach(result => {
				if (!result.success) {
					failedIsbns.push(result.isbn13);
				}
			});

			// Small delay between batches
			if (i + 5 < isbnArray.length) {
				await new Promise(resolve => setTimeout(resolve, 200));
			}
		}

		// Send completion SMS
		const successCount = addedTitles.length;
		const failCount = failedIsbns.length;

		let message = `✅ Added ${successCount} book${successCount !== 1 ? 's' : ''} from your photos!\n\n`;

		if (addedTitles.length > 0) {
			const preview = addedTitles.slice(0, 3).map(t => `• ${t}`).join('\n');
			message += preview;
			if (addedTitles.length > 3) {
				message += `\n• ...and ${addedTitles.length - 3} more`;
			}
		}

		if (failCount > 0) {
			message += `\n\n⚠️ ${failCount} ISBN${failCount !== 1 ? 's' : ''} could not be added (metadata not found).`;
		}

		const shelfUrl = `https://tbr.fyi/${userId.replace(/\+/g, '')}`;
		message += `\n\nView your shelf: ${shelfUrl}`;

		await sendProgressSMS(userId, message);

		// Update job status
		await supabase
			.from('mms_jobs')
			.update({
				status: 'completed',
				results: {
					detected: allIsbns.size,
					added: successCount,
					failed: failCount,
					titles: addedTitles
				},
				completed_at: new Date().toISOString()
			})
			.eq('id', options.jobId);

		const duration = Date.now() - startTime;
		logger.info({
			jobId: options.jobId,
			userId,
			detected: allIsbns.size,
			added: successCount,
			failed: failCount,
			duration
		}, 'MMS job completed');

	} catch (error) {
		logger.error({ error, jobId: options.jobId }, 'MMS job failed');

		// Update job with error
		await supabase
			.from('mms_jobs')
			.update({
				status: 'failed',
				error_message: error instanceof Error ? error.message : 'Unknown error',
				completed_at: new Date().toISOString()
			})
			.eq('id', options.jobId);

		// Try to notify user
		try {
			const { data: job } = await supabase
				.from('mms_jobs')
				.select('user_id')
				.eq('id', options.jobId)
				.single();

			if (job) {
				await sendProgressSMS(
					job.user_id,
					'❌ Failed to process photos. Please try again or text one photo at a time.'
				);
			}
		} catch (notifyError) {
			logger.error({ error: notifyError }, 'Failed to send error notification');
		}
	}
}

async function sendProgressSMS(to: string, message: string) {
	try {
		const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
		const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

		const response = await fetch(twilioUrl, {
			method: 'POST',
			headers: {
				'Authorization': `Basic ${auth}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				To: to,
				From: TWILIO_PHONE_NUMBER,
				Body: message
			})
		});

		if (!response.ok) {
			logger.error({ status: response.status }, 'Failed to send SMS');
		}
	} catch (error) {
		logger.error({ error }, 'Error sending SMS');
	}
}
```

---

#### **2.3 Backend: Background Job Endpoint** (1 hour)
**New File**: `src/routes/api/mms-jobs/process/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processMmsJob } from '$lib/server/mms-worker';

// This endpoint is called by Vercel Cron or manually to process background jobs
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { jobId } = await request.json();

		if (!jobId) {
			return json({ error: 'Job ID required' }, { status: 400 });
		}

		// Process job asynchronously (don't await - let it run in background)
		processMmsJob({ jobId }).catch(error => {
			console.error('Background job error:', error);
		});

		return json({ success: true, message: 'Job processing started' });
	} catch (error) {
		console.error('Process job endpoint error:', error);
		return json({ error: 'Failed to start job processing' }, { status: 500 });
	}
};
```

---

#### **2.4 Update SMS Endpoint for Multi-Photo** (1.5 hours)
**File**: `src/routes/api/sms/+server.ts`

**Replace single-photo MMS handling** (around line 339):
```typescript
// Check if it's MMS with multiple photos
if (numMedia > 0) {
	try {
		// For multi-photo MMS, create background job
		if (numMedia > 1) {
			const mediaUrls: string[] = [];
			for (let i = 0; i < numMedia; i++) {
				const url = formData.get(`MediaUrl${i}`) as string;
				if (url) mediaUrls.push(url);
			}

			// Create MMS job
			const { data: job, error: jobError } = await supabase
				.from('mms_jobs')
				.insert({
					user_id: userId,
					media_urls: mediaUrls,
					status: 'processing'
				})
				.select('id')
				.single();

			if (jobError || !job) {
				logger.error({ error: jobError }, 'Failed to create MMS job');
				return twimlResponse(SMS_MESSAGES.MMS_PROCESSING_ERROR);
			}

			// Trigger background processing
			fetch(`${PUBLIC_BASE_URL}/api/mms-jobs/process`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jobId: job.id })
			}).catch(err => logger.error({ error: err }, 'Failed to trigger job processing'));

			return twimlResponse(
				`📸 Processing ${numMedia} photos... I'll text you when I'm done (usually ~30 seconds)!`
			);
		}

		// Single photo - process immediately (existing logic)
		const mediaUrl = formData.get('MediaUrl0') as string | null;
		// ... existing single-photo code ...
	} catch (error) {
		// ... existing error handling ...
	}
}
```

---

#### **2.5 Testing** (3 hours)

**Test Cases:**

1. **Single photo** (regression test):
   - Send 1 photo → immediate processing → response within 10s

2. **Multiple photos**:
   - Send 2 photos → background job created → progress SMS received
   - Send 5 photos → all ISBNs detected → all books added → completion SMS
   - Send 10 photos (Twilio max) → handles gracefully

3. **Edge cases**:
   - Send 3 photos, 1 valid barcode → 1 book added
   - Send 3 photos, all blurry → "No barcodes detected" message
   - Network timeout → error message sent

4. **Background job monitoring**:
   - Check mms_jobs table populated correctly
   - Verify job status updates to 'completed'
   - Check results JSON contains correct data

---

### Phase 2 Checklist
- [ ] Database migration created for mms_jobs table
- [ ] Background worker function created
- [ ] Parallel image fetching implemented
- [ ] Parallel barcode detection implemented
- [ ] Outbound SMS via Twilio API working
- [ ] Job endpoint created
- [ ] SMS endpoint updated for multi-photo detection
- [ ] Single-photo flow still works (regression test)
- [ ] Progress messages sent to user
- [ ] Completion messages include book titles
- [ ] Error handling for failed jobs
- [ ] Tested with 2, 5, and 10 photos
- [ ] Updated SMS_MESSAGES.ts with new messages

---

### Future Enhancements (Later)
- [ ] Progress updates ("Processing photo 3 of 5...")
- [ ] Retry logic for failed Vision API calls
- [ ] Job queue with priority (VIPs get faster processing)
- [ ] Support for video barcode scanning (extract frames)
- [ ] Web UI to view MMS job history
- [ ] Email notifications in addition to SMS
- [ ] Image quality validation before processing
- [ ] Deduplication across photos in same MMS

---

## Phase 3: Additional Bulk Operations
**Goal**: Export, undo, and shelf copy operations
**Time**: 1 day
**Complexity**: Low-Medium

### 3.1 Export to CSV (2-4 hours)

**Backend** - `src/routes/api/books/export/+server.ts`:
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireUserId } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request, url }) => {
	try {
		const userId = requireUserId(request);
		const shelfId = url.searchParams.get('shelf');
		const format = url.searchParams.get('format') || 'simple'; // 'simple' or 'goodreads'

		// Fetch books (optionally filtered by shelf)
		let query = supabase
			.from('books')
			.select('*, book_shelves(shelf_id, shelves(name))')
			.eq('user_id', userId)
			.order('added_at', { ascending: false });

		if (shelfId) {
			query = query.eq('book_shelves.shelf_id', shelfId);
		}

		const { data: books, error } = await query;

		if (error) {
			return json({ error: 'Failed to fetch books' }, { status: 500 });
		}

		// Generate CSV
		let csv = '';

		if (format === 'goodreads') {
			// Goodreads-compatible format
			csv = 'Title,Author,ISBN13,My Rating,Exclusive Shelf,Bookshelves,Date Added\n';
			books?.forEach(book => {
				const author = book.author?.[0] || '';
				const shelves = book.book_shelves?.map((bs: any) => bs.shelves?.name).filter(Boolean).join(', ') || '';
				const exclusiveShelf = book.is_read ? 'read' : 'to-read';
				const dateAdded = new Date(book.added_at).toISOString().split('T')[0];

				csv += `"${book.title}","${author}","${book.isbn13}","","${exclusiveShelf}","${shelves}","${dateAdded}"\n`;
			});
		} else {
			// Simple format
			csv = 'Title,Author,ISBN13,Read,Owned,Added\n';
			books?.forEach(book => {
				const author = book.author?.[0] || '';
				const read = book.is_read ? 'Yes' : 'No';
				const owned = book.is_owned ? 'Yes' : 'No';
				const added = new Date(book.added_at).toISOString().split('T')[0];

				csv += `"${book.title}","${author}","${book.isbn13}","${read}","${owned}","${added}"\n`;
			});
		}

		// Return as downloadable file
		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename="tbr-export-${new Date().toISOString().split('T')[0]}.csv"`
			}
		});
	} catch (error) {
		console.error('Export error:', error);
		return json({ error: 'Export failed' }, { status: 500 });
	}
};
```

**Frontend** - Add export button to shelf header:
```svelte
<!-- Add near the view toggle buttons -->
<button
	onclick={() => window.location.href = `/api/books/export?shelf=${data.selectedShelfId || ''}`}
	class="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50
	       flex items-center gap-2"
	title="Export books to CSV"
>
	<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
		      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
	</svg>
	Export CSV
</button>
```

---

### 3.2 SMS: REMOVE LAST [N] (2-3 hours)

**Update SMS endpoint** - `src/routes/api/sms/+server.ts`:
```typescript
// Add after HELP command handling (around line 183)
if (/^REMOVE\s+LAST(\s+\d+)?/i.test(rawBody)) {
	const match = rawBody.match(/^REMOVE\s+LAST(?:\s+(\d+))?/i);
	const count = match?.[1] ? parseInt(match[1]) : 1;

	if (count > 50) {
		return twimlResponse('Maximum 50 books can be removed at once. Please specify a smaller number.');
	}

	// Fetch most recent books
	const { data: recentBooks, error: fetchError } = await supabase
		.from('books')
		.select('id, title')
		.eq('user_id', userId)
		.order('added_at', { ascending: false })
		.limit(count);

	if (fetchError || !recentBooks || recentBooks.length === 0) {
		return twimlResponse('No recent books found to remove.');
	}

	// Delete them
	const bookIds = recentBooks.map(b => b.id);
	const { error: deleteError } = await supabase
		.from('books')
		.delete()
		.in('id', bookIds)
		.eq('user_id', userId);

	if (deleteError) {
		logger.error({ error: deleteError }, 'Failed to remove books');
		return twimlResponse('Failed to remove books. Please try again.');
	}

	// Build response
	let message = `✅ Removed ${recentBooks.length} book${recentBooks.length !== 1 ? 's' : ''}:\n\n`;
	const preview = recentBooks.slice(0, 3).map(b => `• ${b.title}`).join('\n');
	message += preview;
	if (recentBooks.length > 3) {
		message += `\n• ...and ${recentBooks.length - 3} more`;
	}

	logUserEvent({
		event: 'user_event',
		user_id: userId,
		action: 'bulk_remove_sms',
		metadata: { count: recentBooks.length }
	});

	return twimlResponse(message);
}
```

**Update SMS_MESSAGES.ts**:
```typescript
export const SMS_MESSAGES = {
	// ... existing messages ...
	HELP: `Commands:\n• Text ISBN or photo of barcode to add books\n• START - Begin using TBR\n• STOP - Unsubscribe\n• ADD [ISBN] - Add specific book\n• REMOVE LAST [N] - Remove N recent books (default 1)\n• HELP - Show this message`,
	// ... rest ...
};
```

---

### 3.3 Copy All to Shelf (1 hour)

**Backend** - Add to bulk operations endpoint:
```typescript
// Add new operation type to BulkOperation union
type BulkOperation = 'delete' | 'update' | 'move_to_shelf' | 'copy_to_shelf';

// Add case in switch statement:
case 'copy_to_shelf': {
	if (!body.shelf_id) {
		return json({ error: 'Shelf ID required' }, { status: 400 });
	}

	// Verify shelf belongs to user (same as move_to_shelf)
	const { data: shelf, error: shelfError } = await supabase
		.from('shelves')
		.select('id')
		.eq('id', body.shelf_id)
		.eq('user_id', userId)
		.maybeSingle();

	if (shelfError || !shelf) {
		return json({ error: 'Shelf not found' }, { status: 404 });
	}

	// Create relationships (same as move, but conceptually different)
	const bookShelfRelations = body.book_ids.map(book_id => ({
		book_id,
		shelf_id: body.shelf_id!
	}));

	const { error } = await supabase
		.from('book_shelves')
		.upsert(bookShelfRelations, {
			onConflict: 'book_id,shelf_id',
			ignoreDuplicates: true
		});

	if (error) {
		return json({ error: 'Failed to copy books' }, { status: 500 });
	}

	result.processed = body.book_ids.length;
	break;
}
```

**Frontend** - Add "Copy all to shelf" button:
```svelte
<!-- Add to shelf tabs, next to Delete button -->
{#if data.selectedShelfId}
	<button
		onclick={() => {
			const targetShelfId = prompt('Enter shelf name to copy all books to:');
			if (targetShelfId) {
				copyAllToShelf(data.selectedShelfId, targetShelfId);
			}
		}}
		class="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800
		       border border-blue-300 rounded-lg hover:bg-blue-50"
		title="Copy all books from this shelf to another"
	>
		Copy all to shelf
	</button>
{/if}
```

---

### Phase 3 Checklist
- [ ] Export endpoint created
- [ ] Export supports simple and Goodreads formats
- [ ] Export button added to UI
- [ ] CSV download works in browser
- [ ] SMS REMOVE LAST command implemented
- [ ] SMS REMOVE LAST N with number parsing
- [ ] Updated HELP command text
- [ ] Copy all to shelf operation added
- [ ] Tested export with various shelf sizes
- [ ] Tested REMOVE LAST with 1, 5, 10 books
- [ ] Tested copy operation

---

### Future Enhancements (Later)
- [ ] Export in multiple formats (JSON, Excel, LibraryThing)
- [ ] Scheduled exports (weekly CSV via email)
- [ ] Import/export sync with Goodreads API
- [ ] SMS: UNDO command (undo last operation)
- [ ] Web UI: "Copy to shelf" in bulk toolbar
- [ ] Archive shelf operation (hide but don't delete)
- [ ] Filter-based export (only unread, only owned, etc.)

---

## Risk Mitigation

### Web UI Bulk Operations
- **Risk**: Accidental bulk deletion
- **Mitigation**: Confirmation dialog, clear count ("Remove 45 books?")
- **Recovery**: Future undo feature

### SMS Multi-Photo Processing
- **Risk**: Background job failures leave user waiting
- **Mitigation**: Timeout monitoring, error SMS notifications
- **Recovery**: Job retry endpoint, manual reprocessing

### API Rate Limits
- **Risk**: Google Books API throttling on bulk operations
- **Mitigation**: Batch processing with delays, 500-book limit
- **Fallback**: Queue jobs for later processing

### Database Performance
- **Risk**: Slow queries on large bulk operations
- **Mitigation**: Use `.in()` for batch queries, limit to 500 items
- **Monitoring**: Add query timing logs

---

## Success Metrics

### Web Bulk Operations
- ✅ Users can select and operate on 100+ books without timeout
- ✅ All operations complete in <3 seconds for 50 books
- ✅ Less than 1% accidental deletions (measured by immediate re-adds)
- ✅ Clear visual feedback for all operations

### SMS Multi-Photo
- ✅ 95%+ of multi-photo MMS successfully processed
- ✅ Completion notification arrives within 60 seconds
- ✅ Average 5+ books detected per multi-photo submission
- ✅ User understands background processing workflow

### Additional Operations
- ✅ Export generates valid CSV that can be re-imported
- ✅ REMOVE LAST command has <5% error rate
- ✅ Copy operations work across all shelf types

---

## Documentation Updates

### Additional Operations
- **Export**: Download shelf as CSV (simple or Goodreads format)
- **REMOVE LAST N**: SMS command to remove N recent books
- **Copy to shelf**: Duplicate books from one shelf to another
```

---

## Deployment Checklist

### Before Shipping
- [ ] All three phases tested independently
- [ ] Integration test: Bulk web operation → Export → Re-import
- [ ] SMS multi-photo tested with real Twilio MMS
- [ ] Database migrations run on staging
- [ ] Error handling verified (network failures, API timeouts)
- [ ] User documentation updated
- [ ] Changelog entry added

### Post-Deployment Monitoring
- [ ] Monitor bulk operation success rates
- [ ] Track MMS job completion times
- [ ] Check for database query performance issues
- [ ] Gather user feedback on workflows
- [ ] Monitor Twilio SMS usage (outbound notifications)

---

## Timeline Summary

| Phase | Effort | Features |
|-------|--------|----------|
| Phase 1: Web Bulk Ops | 1-2 days | Selection UI, 4 bulk operations, toolbar |
| Phase 2: SMS Multi-Photo | 2-3 days | Background jobs, parallel processing, outbound SMS |
| Phase 3: Additional Ops | 1 day | Export CSV, REMOVE LAST, Copy shelf |
| **Total** | **4-6 days** | **Complete bulk operations suite** |

---

## Future Vision

### Advanced Bulk Operations
- Smart filters + bulk actions ("Mark all unread from 2023 as read")
- Bulk metadata editing
- Scheduled bulk operations (cron jobs)
- Undo/redo for all operations
- Operation history log

### SMS Enhancements
- "CLEAR [shelf]" command (remove all from shelf)
- "MARK [shelf] READ" command (bulk update via SMS)
- Photo quality pre-check before processing
- Video barcode scanning support

### Cross-Platform
- Mobile app with native multi-select gestures
- Browser extension for one-click bulk add from websites
- API for third-party integrations
