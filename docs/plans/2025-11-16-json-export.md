# JSON Export Implementation Plan

**Goal:** Allow users to download their complete book collection as a JSON file containing ISBNs, notes, statuses, dates, shelf names, and metadata.

**Architecture:** Server-side API endpoint (`/api/export`) queries database with joins, transforms to clean JSON structure, returns with download headers. Settings page provides simple UI with export button. Footer navigation updated to include settings link.

**Tech Stack:** SvelteKit 5, Supabase (PostgreSQL), TypeScript

---

## Task 1: Create Export API Endpoint

**Files:**
- Create: `src/routes/api/export/+server.ts`
- Reference: `src/lib/server/auth.ts` (requireUserId helper)
- Reference: `src/routes/api/books/update/+server.ts` (auth pattern example)

**Step 1: Create export endpoint file with authentication**

Create `src/routes/api/export/+server.ts`:

```typescript
/**
 * Export API
 *
 * Returns user's complete book collection as JSON with download headers.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireUserId } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request }) => {
	try {
		// Extract and verify user ID from referer
		const userId = requireUserId(request);

		// Query books with joined shelf data
		const { data: books, error } = await supabase
			.from('books')
			.select('*, book_shelves(shelf_id, shelves(name))')
			.eq('user_id', userId)
			.order('added_at', { ascending: false });

		if (error) {
			console.error('Export query error:', error);
			return json({ error: 'Failed to fetch books' }, { status: 500 });
		}

		// Transform database rows to clean JSON structure
		const exportData = {
			exportedAt: new Date().toISOString(),
			userId: userId,
			totalBooks: books?.length || 0,
			books: (books || []).map((book) => ({
				isbn13: book.isbn13,
				title: book.title,
				author: book.author,
				publisher: book.publisher,
				publicationDate: book.publication_date,
				description: book.description,
				coverUrl: book.cover_url,
				note: book.note,
				isRead: book.is_read,
				isOwned: book.is_owned,
				shelves: (book.book_shelves || [])
					.map((bs: any) => bs.shelves?.name)
					.filter((name: string | null) => name !== null),
				addedAt: book.added_at
			}))
		};

		// Generate filename with current date
		const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		const filename = `tbr-export-${date}.json`;

		// Return JSON with download headers
		return new Response(JSON.stringify(exportData, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (error) {
		console.error('Export error:', error);
		const message = error instanceof Error ? error.message : 'Internal server error';
		const status = error instanceof Error && error.message.includes('User ID') ? 401 : 500;
		return json({ error: message }, { status });
	}
};
```

**Step 2: Commit export endpoint**

```bash
git add src/routes/api/export/+server.ts
git commit -m "feat: add JSON export API endpoint

- GET /api/export returns complete book collection as JSON
- Derives userId from referer (existing auth pattern)
- Queries books with joined shelf data in single query
- Transforms to clean JSON structure with camelCase fields
- Returns with Content-Disposition header for auto-download
- Filename format: tbr-export-YYYY-MM-DD.json
"
```

## Task 2: Manual Test Export Endpoint

**Files:**
- Test: Via browser dev tools or curl

**Step 1: Start dev server**

```bash
npm run dev
```

Expected: Dev server running on `http://localhost:5173`

**Step 2: Test export endpoint via curl**

Replace `+15551234567` with actual test user phone number:

```bash
curl -H "Referer: http://localhost:5173/+15551234567/settings" \
     http://localhost:5173/api/export \
     -o test-export.json
```

Expected:
- File `test-export.json` created
- Contains valid JSON with structure matching design
- `totalBooks` matches user's library size
- All books have required fields
- Shelf arrays populated correctly

**Step 3: Validate JSON structure**

```bash
cat test-export.json | python3 -m json.tool | head -30
```

Expected:
- Valid JSON (no parse errors)
- Contains `exportedAt`, `userId`, `totalBooks`, `books` keys
- Books array has objects with all expected fields
- Dates in ISO 8601 format

**Step 4: Clean up test file**

```bash
rm test-export.json
```

## Task 3: Create Settings Page

**Files:**
- Create: `src/routes/[username]/settings/+page.svelte`
- Reference: `src/routes/about/+page.svelte` (simple page layout example)
- Reference: `src/lib/components/ui/Button.svelte` (button component)

**Step 1: Create settings page with export button**

Create `src/routes/[username]/settings/+page.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui';

	const username = $page.params.username;
	let isExporting = $state(false);
	let exportError = $state<string | null>(null);

	async function handleExport() {
		isExporting = true;
		exportError = null;

		try {
			const response = await fetch('/api/export', {
				method: 'GET',
				headers: {
					'Referer': window.location.href
				}
			});

			if (!response.ok) {
				const result = await response.json();
				exportError = result.error || 'Export failed';
				return;
			}

			// Trigger download
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;

			// Extract filename from Content-Disposition header
			const contentDisposition = response.headers.get('Content-Disposition');
			const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
			const filename = filenameMatch?.[1] || 'tbr-export.json';

			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Export error:', error);
			exportError = 'Export failed. Please try again.';
		} finally {
			isExporting = false;
		}
	}
</script>

<svelte:head>
	<title>Settings - TBR</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-2xl mx-auto px-4">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
			<p class="text-gray-600">
				Manage your account and export your library
			</p>
		</div>

		<!-- Export Section -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-2">Export Library</h2>
			<p class="text-gray-600 mb-4">
				Download your complete book collection as a JSON file. Includes ISBNs, notes, read/owned status, shelves, and metadata.
			</p>

			<Button
				variant="primary"
				size="lg"
				onclick={handleExport}
				disabled={isExporting}
			>
				{isExporting ? 'Exporting...' : 'Export Library'}
			</Button>

			{#if exportError}
				<div class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
					<p class="text-sm text-red-800">{exportError}</p>
				</div>
			{/if}
		</div>
	</div>
</div>
```

**Step 2: Commit settings page**

```bash
git add src/routes/[username]/settings/+page.svelte
git commit -m "feat: add settings page with export functionality

- New route at /[username]/settings
- Export Library button triggers /api/export endpoint
- Handles blob download with filename from Content-Disposition
- Shows loading state during export
- Displays error message if export fails
- Simple, clean UI matching existing design system
"
```

## Task 4: Add Settings Link to Footer

**Files:**
- Modify: `src/routes/+layout.svelte`
- Reference: Existing footer with About/Help links

**Step 1: Read current footer structure**

```bash
grep -A 20 "footer" src/routes/+layout.svelte
```

Expected: Find footer section with existing navigation links

**Step 2: Add Settings link to footer navigation**

Locate the footer links section (should be near About and Help links) and add Settings link.

Find this pattern:
```svelte
<a href="/about" class="...">About</a>
<a href="/help" class="...">Help</a>
```

Add Settings link:
```svelte
<a href="/about" class="...">About</a>
<a href="/help" class="...">Help</a>
<a href={userId ? `/${userId}/settings` : '/settings'} class="...">Settings</a>
```

Note: Use same class names as existing links for consistent styling. Extract userId from localStorage or current URL if available.

**Step 3: Commit footer update**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: add Settings link to footer navigation

- Settings link added to global footer
- Uses userId from localStorage/URL when available
- Consistent styling with existing About/Help links
"
```

## Task 5: End-to-End Manual Testing

**Files:**
- Test: Complete user flow in browser

**Step 1: Verify dev server running**

```bash
npm run dev
```

**Step 2: Test complete flow**

1. Navigate to `http://localhost:5173/+15551234567` (use actual test user)
2. Verify Settings link appears in footer
3. Click Settings link
4. Verify settings page loads with Export Library button
5. Click "Export Library" button
6. Verify:
   - Button shows "Exporting..." during request
   - JSON file downloads automatically
   - Filename format is `tbr-export-YYYY-MM-DD.json`
   - No error messages appear

**Step 3: Validate downloaded JSON**

1. Open downloaded JSON file in text editor
2. Verify structure matches design:
   - Has `exportedAt`, `userId`, `totalBooks`, `books` keys
   - `totalBooks` matches library size
   - Books have all expected fields (isbn13, title, author, etc.)
   - Shelves array populated correctly
   - Notes preserved accurately
   - Dates in ISO 8601 format

**Step 4: Test edge cases**

Test with user who has:
- 0 books → Should export `{totalBooks: 0, books: []}`
- Books with no notes → `note: null` in JSON
- Books on no shelves → `shelves: []` in JSON
- Books with special characters in notes → Properly escaped JSON

**Step 5: Test error handling**

1. Navigate to settings page without authentication
2. Try to export
3. Verify error message appears (don't expose technical details)

**Step 6: Browser compatibility check**

Test export download in:
- Chrome/Chromium
- Safari (if on macOS)
- Mobile browser (if available)

Verify file downloads automatically (doesn't open in browser)

## Task 6: Type Check and Final Commit

**Files:**
- All modified files

**Step 1: Run type checking**

```bash
npm run check
```

Expected: 0 errors (warnings OK, pre-existing)

**Step 2: Review all changes**

```bash
git log --oneline feature/json-export
git diff main...feature/json-export
```

Expected:
- Clear commit history with descriptive messages
- 3 new files created
- 1 file modified (footer)
- No unintended changes

**Step 3: Final verification**

- [ ] Export endpoint works correctly
- [ ] Settings page loads and functions
- [ ] Footer link navigates to settings
- [ ] JSON structure matches design
- [ ] Download headers trigger auto-download
- [ ] Error handling works
- [ ] Type check passes

---

## Implementation Notes

### No Automated Tests
This feature follows the project's MVP philosophy: no automated tests, manual testing only. The feature is simple enough that manual testing provides sufficient confidence.

### Reusable Patterns
- Authentication: `requireUserId()` from existing endpoints
- UI Components: `Button` from component library
- Layout: Footer pattern from `+layout.svelte`
- Error Handling: Consistent with existing API endpoints

### Database Query
Single query with joins avoids N+1 problem:
```typescript
.select('*, book_shelves(shelf_id, shelves(name))')
```

This fetches books + book_shelves + shelves in one round-trip.

### File Naming
Format: `tbr-export-YYYY-MM-DD.json`
- Uses server date (not user timezone)
- Browser appends number if multiple exports same day
- Descriptive prefix for easy identification

---

## Success Criteria

- [ ] User can navigate to Settings page from footer
- [ ] Export button downloads JSON file instantly
- [ ] JSON contains all user data accurately
- [ ] File naming follows format specification
- [ ] Works on desktop and mobile browsers
- [ ] Error states display helpful messages
- [ ] Type checking passes with 0 errors
- [ ] Code follows existing patterns and conventions
