# Privacy Controls & Settings - Design Document

**Date:** December 6, 2025
**Status:** Approved
**Scope:** Privacy controls for shelves/books + user settings page + discovery APIs

## Overview

This design adds user control over shelf and book visibility, plus a settings page for profile management. The approach uses hybrid enforcement (server-side validation + minimal RLS preparation) to balance simplicity with security.

**Key constraint:** MVP-appropriate complexity - no permission systems, no sharing/collaboration, just public/unlisted/private.

## Requirements

### Privacy Levels
Users can set shelves and books to:
- **Public** - Anyone can view (default for new shelves)
- **Unlisted** - Anyone with direct link can view (not discoverable)
- **Private** - Only owner can view

### Granularity
- **Shelf-level default** - All books inherit shelf's privacy unless overridden
- **Book-level override** - Individual books can override shelf default
- **Backward compatible** - Existing phone-based shelves remain public

### Privacy Controls Locations
1. Settings page - Shelf privacy and profile management
2. Shelf header - Quick toggle for shelf privacy (future enhancement)
3. Book context menu - Right-click to set individual book privacy

### Settings Page Content
- Update username, display name, email
- Set default privacy levels for new shelves/books
- Sign out button

### APIs Needed
1. PATCH /api/shelves/:id - Update shelf privacy
2. PATCH /api/books/:id - Update book privacy override
3. PATCH /api/auth/profile - Update profile fields
4. GET /api/shelves/public - Discover public shelves with pagination

## Database Schema

### Shelves Table
```sql
ALTER TABLE shelves ADD COLUMN IF NOT EXISTS privacy_level text DEFAULT 'public'
  CHECK (privacy_level IN ('public', 'unlisted', 'private'));
CREATE INDEX idx_shelves_privacy ON shelves(privacy_level);
CREATE INDEX idx_shelves_user_privacy ON shelves(user_id, privacy_level);
```

### Books Table
```sql
ALTER TABLE books ADD COLUMN IF NOT EXISTS privacy_override text
  CHECK (privacy_override IS NULL OR privacy_override IN ('public', 'unlisted', 'private'));
CREATE INDEX idx_books_privacy_override ON books(privacy_override);
```

**Logic:**
- If `books.privacy_override` IS NULL → Use shelf's `privacy_level`
- If `books.privacy_override` IS NOT NULL → Use book's override

### No RLS Policies Yet
We enforce privacy in application code (endpoints check authorization). This keeps MVP simple while structure supports future migration to Supabase RLS policies.

## API Endpoints

### 1. PATCH /api/shelves/:id
**Update shelf privacy level**

```typescript
Request: {
  privacy_level: 'public' | 'unlisted' | 'private'
}

Response (200): {
  data: {
    id: string,
    user_id: string,
    name: string,
    privacy_level: string,
    updated_at: string
  },
  error: null
}

Error responses:
- 401: Not authenticated
- 403: User doesn't own this shelf
- 404: Shelf not found
- 400: Invalid privacy level
```

**Authentication:** Check `locals.user` owns shelf via `shelves.user_id`

**Logic:**
```typescript
1. Verify user owns shelf
2. Validate privacy_level enum
3. Update shelves.privacy_level
4. Return updated shelf
```

### 2. PATCH /api/books/:id
**Update book privacy override**

```typescript
Request: {
  privacy_override: 'public' | 'unlisted' | 'private' | null
}

Response (200): {
  data: {
    id: string,
    isbn13: string,
    privacy_override: string | null,
    effective_privacy: string,
    updated_at: string
  },
  error: null
}

Error responses:
- 401: Not authenticated
- 403: User doesn't own this book/shelf
- 404: Book not found
- 400: Invalid privacy level
```

**Authentication:** Check `locals.user` owns book via books → shelves → user_id

**Logic:**
```typescript
1. Verify user owns book (via shelf)
2. If privacy_override is null → remove override
3. If privacy_override is enum value → validate and set
4. Return book with both privacy_override and effective_privacy (computed)
```

### 3. PATCH /api/auth/profile
**Update user profile**

```typescript
Request: {
  display_name?: string,
  email?: string
}

Response (200): {
  data: {
    username: string,
    email: string,
    display_name: string,
    updated_at: string
  },
  error: null
}

Error responses:
- 401: Not authenticated
- 409: Email already in use
- 400: Invalid email format
```

**Authentication:** Check `locals.user` exists

**Logic:**
```typescript
1. Validate email if provided (format + uniqueness check vs auth.users)
2. If email changed, trigger Supabase email update flow
3. Update users table (display_name, email)
4. Return updated profile
```

### 4. GET /api/shelves/public
**Discover public shelves**

```typescript
Query params:
- limit: number (default 20, max 100)
- offset: number (default 0)
- search?: string (search shelf names)

Response (200): {
  data: [
    {
      id: string,
      user_id: string,
      username: string,
      name: string,
      book_count: number,
      privacy_level: string,
      updated_at: string
    }
  ],
  pagination: {
    total: number,
    limit: number,
    offset: number,
    has_more: boolean
  },
  error: null
}

Error responses:
- 400: Invalid limit/offset
```

**Authentication:** None (public endpoint)

**Logic:**
```typescript
1. Query shelves WHERE privacy_level = 'public'
2. If search provided, filter by name ILIKE '%search%'
3. Order by updated_at DESC
4. Return paginated results with username joined from users table
5. Count books per shelf
```

## UI Components & Pages

### /settings Page
**Route:** `/settings` (authenticated only)
**Components:**
- Header: "Account Settings"
- Profile section
  - Username (read-only, shown for reference)
  - Display name (text input, editable)
  - Email (text input with change confirmation)
  - Save/Cancel buttons
- Privacy defaults section (future)
- Account section
  - Current device info
  - Sign out button

**States:**
- `loading` - Initial load of profile data
- `saving` - API call in progress
- `success` - Profile updated
- `error` - Error message

**Validation:**
- Display name: 1-100 characters
- Email: Valid email format, uniqueness check via API

### Book Privacy Context Menu
**Trigger:** Right-click on book card
**Modal content:**
- Current privacy setting displayed
- Three options:
  1. "Inherit from shelf" (clears privacy_override, default)
  2. "Public" (overrides to public)
  3. "Unlisted" (overrides to unlisted)
  4. "Private" (overrides to private)
- Visual indicator of current selection (checkmark)

**Behavior:**
- Click option → API call → Update display
- Toast notification on success/error
- Close modal after selection

### Shelf Privacy Quick Toggle (Future)
**Location:** Shelf page header
**Trigger:** Click lock icon
**Interaction:** Simple 3-choice modal (public/unlisted/private)
**Note:** Can be built after settings/book privacy are working

## Data Flow

### Setting Shelf Privacy
```
User clicks shelf privacy icon
  ↓
Opens modal with 3 options
  ↓
User selects option
  ↓
PATCH /api/shelves/:id { privacy_level: 'unlisted' }
  ↓
Server validates ownership, updates db
  ↓
Client updates UI, shows toast
```

### Setting Book Privacy
```
User right-clicks on book
  ↓
Context menu appears with "Set visibility"
  ↓
Opens modal with 4 options (inherit + 3 levels)
  ↓
User selects option
  ↓
PATCH /api/books/:id { privacy_override: 'private' }
  ↓
Server validates ownership, updates db
  ↓
Client updates UI, shows toast
```

### Viewing Shelf with Privacy
```
User visits /@username shelf page
  ↓
GET /api/shelves/:id (existing endpoint)
  ↓
Server checks:
  - Is user the owner? → Return all books
  - Is shelf public? → Return books
  - Is shelf unlisted? → If user has link, return books
  - Is shelf private? → If user is owner, return books; else 403
  ↓
Client renders shelf with visible books
```

### Discovering Shelves
```
User visits /discover page
  ↓
GET /api/shelves/public?limit=20&offset=0
  ↓
Server queries public shelves, counts books
  ↓
Returns paginated list with usernames and preview
  ↓
User can click to view /@username
```

## Error Handling

**Consistent error responses:**
```typescript
// Success
{ data: { ...payload }, error: null }

// Error
{ data: null, error: "Descriptive error message", code?: "ERROR_CODE" }
```

**Common scenarios:**
- User tries to update another user's shelf → 403 Forbidden
- Invalid privacy level → 400 Bad Request
- Email already taken → 409 Conflict
- Shelf doesn't exist → 404 Not Found
- Not authenticated → 401 Unauthorized

## Testing Strategy

**Endpoints to test:**
1. PATCH /api/shelves/:id
   - Own shelf privacy change ✓
   - Another user's shelf (403) ✓
   - Invalid privacy level (400) ✓

2. PATCH /api/books/:id
   - Own book privacy change ✓
   - Remove override (set to null) ✓
   - Invalid privacy level (400) ✓

3. PATCH /api/auth/profile
   - Update display_name ✓
   - Update email (with validation) ✓
   - Duplicate email (409) ✓

4. GET /api/shelves/public
   - Returns only public shelves ✓
   - Pagination works ✓
   - Search filters correctly ✓
   - Includes book counts ✓

**UI to test:**
1. Settings page loads and submits ✓
2. Book context menu appears and updates ✓
3. Toast notifications show on success/error ✓
4. Email change shows confirmation flow ✓

## Future Enhancements

**Not in MVP, but structure supports:**
1. **Row-Level Security (RLS)** - Migrate privacy enforcement from code to Supabase policies
2. **Sharing** - Give specific users access to private shelves
3. **Followers** - "Followers only" privacy level
4. **Discovery** - Search, filters, trending shelves
5. **Notifications** - Alert user when shelf is viewed or shared
6. **Analytics** - Track shelf views, popular books

## Migration Notes

**Existing phone-based users:**
- All current shelves remain `privacy_level = 'public'` (default)
- No privacy_override set on books (null = inherit)
- When they create account, can change defaults per shelf

**Backward compatibility:**
- Old shelf viewing code works unchanged
- New privacy checks are additive (only restrict, never open)
- Queries without privacy filter still return all books for owner

## Implementation Order

1. Database migrations (if not already done)
2. API endpoints (shelves, books, auth profile, discover)
3. Settings page UI
4. Book context menu
5. Update shelf viewing to respect privacy
6. Shelf header quick toggle (optional, can defer)
7. Discovery page (optional, can defer)
