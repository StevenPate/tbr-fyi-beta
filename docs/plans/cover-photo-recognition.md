# Cover Photo Recognition

**Status:** Planned (Needs Prototype Validation)
**Created:** 2025-01-07
**Priority:** Medium - Enables frictionless book capture

---

## Risk Assessment

### High Risk

**1. OCR Quality on Stylized Typography**
- Vision TEXT_DETECTION fragments stylized fonts into out-of-order blocks
- Subtitles, series names, and taglines often mislabeled as title
- **Mitigation**: Prototype with 50+ real cover photos before committing flow. Kill feature if <40% parse correctly.

**2. textAnnotations API Limitations**
- Confidence values rarely populated
- Polygon vertices need rotation/scaling normalization before area comparison
- **Mitigation**: Use `documentTextDetection` instead (structured paragraphs). Fall back to bounding box height relative to image dimensions, not raw area.

### Medium Risk

**3. Text Normalization for Search**
- OCR drops diacritics ("García" → "Garcia"), injects line breaks
- Exact string search fails on dirty input
- **Mitigation**: Add ASCII folding, collapse whitespace, strip common noise phrases before search. Set minimum match threshold on results.

**4. SMS Context Race Conditions**
- Two photos in quick succession could overwrite context
- No TTL on stored candidates
- **Mitigation**: Add `created_at` timestamp, 10-minute TTL, and phone_number + session_id composite key.

**5. Cost and Latency**
- TEXT_DETECTION: ~$1.50/1k images, 500-800ms latency
- Could double monthly Vision spend
- **Mitigation**: Only run OCR after barcode detection fails. Skip on tiny images (<50KB). Add monthly budget cap with circuit breaker.

---

## Why This Matters

Users frequently encounter books in contexts where barcodes aren't accessible:
- Bookstore displays (cover facing out)
- Social media posts showing covers
- Friend's bookshelf
- Library "staff picks" displays

Currently, users must flip the book to find the barcode or manually type the title. Cover recognition removes this friction.

## Current State

### What Works Today
- MMS photo → barcode detection → ISBN → metadata → shelf
- Title/author text search → candidates → user selects
- Google Vision API integrated and working

### The Gap
Photos of covers (no barcode visible) return "No valid ISBN detected."

---

## Technical Approach

### Core Insight
Don't try to build a visual book recognition system. Instead:
1. Extract text from cover image (OCR)
2. Parse text into likely title/author
3. Search existing metadata APIs
4. Handle ambiguity gracefully

This leverages existing infrastructure and avoids ML training complexity.

### Why This Should Work
- Google Vision TEXT_DETECTION is mature and handles stylized fonts reasonably well
- We already have title/author search via Google Books
- The "confirm match" UX pattern already exists for search results

---

## Implementation

### Step 0: Prototype Validation (REQUIRED FIRST)

**Script:** [`scripts/test-cover-ocr.ts`](../../scripts/test-cover-ocr.ts)

Before implementing the full flow:

1. Collect 50+ real cover photos from diverse sources
2. Run script: `npx ts-node scripts/test-cover-ocr.ts ./test-covers/`
3. Analyze: What % have usable title text? How fragmented?
4. Document failure modes
5. **Go/No-Go decision**: If <40% parse cleanly, defer feature

### Step 1: OCR Text Extraction

Use `documentTextDetection` (not `textDetection`) for structured paragraph output:

```typescript
interface CoverTextResult {
  rawText: string;
  blocks: Array<{
    text: string;
    // Height relative to image (0-1), not raw pixels
    relativeHeight: number;
    // Y position relative to image (0-1), for ordering
    relativeY: number;
  }>;
  imageHeight: number;
}

async function extractCoverText(
  imageBuffer: Buffer,
  options: { minImageSize?: number } = {}
): Promise<CoverTextResult | null> {
  // Skip tiny images (likely thumbnails, not photos)
  if (imageBuffer.length < (options.minImageSize || 50 * 1024)) {
    return null;
  }

  const client = getVisionClient();

  // Use documentTextDetection for structured output
  const [result] = await client.documentTextDetection({
    image: { content: imageBuffer.toString('base64') }
  });

  const fullText = result.fullTextAnnotation;
  if (!fullText?.pages?.[0]) {
    return null;
  }

  const page = fullText.pages[0];
  const imageHeight = page.height || 1;
  const imageWidth = page.width || 1;

  const blocks = (page.blocks || [])
    .filter(block => block.blockType === 'TEXT')
    .map(block => {
      // Get bounding box vertices
      const vertices = block.boundingBox?.vertices || [];
      const minY = Math.min(...vertices.map(v => v.y || 0));
      const maxY = Math.max(...vertices.map(v => v.y || 0));
      const blockHeight = maxY - minY;

      // Extract text from paragraphs
      const text = (block.paragraphs || [])
        .flatMap(p => (p.words || []))
        .flatMap(w => (w.symbols || []))
        .map(s => s.text || '')
        .join('');

      return {
        text,
        relativeHeight: blockHeight / imageHeight,
        relativeY: minY / imageHeight
      };
    })
    .filter(b => b.text.length > 2);

  return {
    rawText: fullText.text || '',
    blocks,
    imageHeight
  };
}
```

### Step 2: Title/Author Parsing

Heuristics for extracting structured data from cover text:

```typescript
interface ParsedCover {
  likelyTitle: string;
  likelyAuthor: string | null;
  confidence: 'high' | 'medium' | 'low';
  normalizedTitle: string;  // For search
  normalizedAuthor: string | null;  // For search
}

function parseCoverText(result: CoverTextResult): ParsedCover {
  const { rawText, blocks } = result;

  // Strategy 1: Look for "by" delimiter in raw text
  const byMatch = rawText.match(/(.+?)\s+by\s+(.+)/i);
  if (byMatch) {
    const title = cleanText(byMatch[1]);
    const author = cleanText(byMatch[2]);
    return {
      likelyTitle: title,
      likelyAuthor: author,
      normalizedTitle: normalizeForSearch(title),
      normalizedAuthor: normalizeForSearch(author),
      confidence: 'high'
    };
  }

  // Strategy 2: Tallest text block = title (using relative height)
  const sortedByHeight = [...blocks]
    .sort((a, b) => b.relativeHeight - a.relativeHeight);

  // Look for author near bottom (relative Y > 0.6)
  const bottomBlocks = blocks.filter(b => b.relativeY > 0.6);
  const possibleAuthor = bottomBlocks.length > 0
    ? bottomBlocks.sort((a, b) => b.relativeHeight - a.relativeHeight)[0]
    : null;

  if (sortedByHeight.length >= 1) {
    const title = cleanText(sortedByHeight[0].text);
    const author = possibleAuthor ? cleanText(possibleAuthor.text) : null;

    return {
      likelyTitle: title,
      likelyAuthor: author,
      normalizedTitle: normalizeForSearch(title),
      normalizedAuthor: author ? normalizeForSearch(author) : null,
      confidence: author ? 'medium' : 'low'
    };
  }

  const fallback = cleanText(rawText.slice(0, 100));
  return {
    likelyTitle: fallback,
    likelyAuthor: null,
    normalizedTitle: normalizeForSearch(fallback),
    normalizedAuthor: null,
    confidence: 'low'
  };
}

// Remove noise phrases common on book covers
const NOISE_PATTERNS = [
  /^(a\s+)?novel$/i,
  /new\s*york\s*times\s*(#\d+\s*)?bestseller/i,
  /international\s*bestseller/i,
  /winner\s+of\s+the\s+.+\s+award/i,
  /^the\s+author\s+of$/i,
  /^from\s+the\s+author/i,
  /book\s+\d+\s+(of|in)\s+the/i,
  /^\d+\s*million\s*copies/i,
];

function cleanText(text: string): string {
  let cleaned = text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove noise patterns
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  return cleaned;
}

// Normalize text for fuzzy search matching
function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Strip diacritics (é → e)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}
```

### Step 3: Search Integration

Use existing `searchBooks()` with parsed title/author:

```typescript
async function searchFromCover(parsed: ParsedCover): Promise<SearchResult[]> {
  const { likelyTitle, likelyAuthor } = parsed;

  // Try title + author first
  if (likelyAuthor) {
    const results = await searchBooks({
      title: likelyTitle,
      author: likelyAuthor,
      max: 5
    });
    if (results.length > 0) return results;
  }

  // Fall back to title only
  const results = await searchBooks({
    q: likelyTitle,
    max: 5
  });

  return results;
}
```

### Step 4: SMS Flow Integration

Modify MMS handling in `src/routes/api/sms/+server.ts`:

```typescript
// After barcode detection fails...
if (isbns.length === 0) {
  // Try cover text extraction
  const coverText = await extractCoverText(imageBuffer);

  if (coverText.rawText.length < 3) {
    return twimlResponse(SMS_MESSAGES.MMS_NO_ISBN_DETECTED);
  }

  const parsed = parseCoverText(coverText);
  const candidates = await searchFromCover(parsed);

  if (candidates.length === 0) {
    return twimlResponse(SMS_MESSAGES.COVER_NO_MATCH(parsed.likelyTitle));
  }

  if (candidates.length === 1 && parsed.confidence === 'high') {
    // Auto-add with high confidence single match
    // ... add book logic ...
    return twimlResponse(SMS_MESSAGES.bookAdded(...));
  }

  // Multiple candidates or low confidence - ask user to confirm
  await saveCoverContext(userId, candidates);
  return twimlResponse(SMS_MESSAGES.COVER_CANDIDATES(candidates));
}
```

### Step 5: New SMS Messages

Add to `src/lib/server/sms-messages.ts`:

```typescript
// Cover photo recognition
COVER_NO_MATCH: (extractedTitle: string) =>
  `Couldn't find a match for "${extractedTitle}". Try texting the title and author directly.`,

COVER_CANDIDATES: (candidates: SearchResult[]) => {
  const list = candidates
    .slice(0, 3)
    .map((c, i) => `${i + 1}. "${c.title}" by ${c.authors[0] || 'Unknown'}`)
    .join('\n');
  return `Found possible matches:\n${list}\n\nReply 1, 2, or 3 to add.`;
},

COVER_CONFIRM: (title: string, author: string) =>
  `Is this "${title}" by ${author}? Reply YES to add or NO to cancel.`,
```

### Step 6: Context Storage for Multi-Step Flow

Create dedicated table with TTL and collision handling:

```sql
-- Cover recognition context with expiry
CREATE TABLE IF NOT EXISTS cover_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  candidates JSONB NOT NULL,  -- Array of {isbn13, title, author}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),
  used_at TIMESTAMPTZ  -- Set when user makes selection
);

-- Index for lookups
CREATE INDEX idx_cover_context_phone ON cover_context(phone_number, expires_at);

-- Cleanup function (call from cron)
CREATE OR REPLACE FUNCTION cleanup_expired_cover_context()
RETURNS void AS $$
BEGIN
  DELETE FROM cover_context WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

```typescript
// Store candidates, invalidating any previous context for this user
async function saveCoverContext(
  phoneNumber: string,
  candidates: SearchResult[]
): Promise<string> {
  // Delete any existing unexpired context (prevents race conditions)
  await supabase
    .from('cover_context')
    .delete()
    .eq('phone_number', phoneNumber)
    .gt('expires_at', new Date().toISOString());

  // Insert new context
  const { data } = await supabase
    .from('cover_context')
    .insert({
      phone_number: phoneNumber,
      candidates: candidates.slice(0, 5).map(c => ({
        isbn13: c.isbn13,
        title: c.title,
        author: c.authors[0] || null
      }))
    })
    .select('id')
    .single();

  return data?.id;
}

// Retrieve and mark as used (atomic)
async function getCoverContext(phoneNumber: string): Promise<CoverCandidate[] | null> {
  const { data } = await supabase
    .from('cover_context')
    .select('candidates')
    .eq('phone_number', phoneNumber)
    .gt('expires_at', new Date().toISOString())
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  // Mark as used to prevent replay
  await supabase
    .from('cover_context')
    .update({ used_at: new Date().toISOString() })
    .eq('phone_number', phoneNumber)
    .is('used_at', null);

  return data.candidates;
}
```

---

## Edge Cases

### Text Extraction Failures
- **Highly stylized fonts**: May extract partial or garbled text
- **Text on busy backgrounds**: Lower confidence
- **Non-English titles**: Should still work with Vision API language detection
- **Wraparound covers**: Partial title visible

**Handling**: Always fall back to "text me the title" message.

### Ambiguous Matches
- **Common titles**: "The Road" matches multiple books
- **Series books**: Cover shows series name prominently
- **Editions**: Different covers for same book

**Handling**: Multi-candidate flow with user selection.

### Performance
- TEXT_DETECTION adds ~500ms to Vision API call
- Acceptable for MMS flow (already 2-5s total)

---

## Testing Plan

### Unit Tests
- [ ] `parseCoverText()` with various text layouts
- [ ] `cleanText()` filters noise correctly
- [ ] Multi-candidate ranking logic

### Integration Tests
- [ ] End-to-end MMS → cover text → search → add flow
- [ ] Fallback when no text detected
- [ ] Context storage and retrieval for multi-step

### Manual Testing (Real Covers)
- [ ] Fiction bestseller (clear title/author)
- [ ] Non-fiction with subtitle
- [ ] Graphic novel / illustrated cover
- [ ] Classic with ornate typography
- [ ] Foreign language book
- [ ] Series book (title vs series name confusion)
- [ ] Photo of screen showing cover
- [ ] Low light / blurry photo

---

## Success Metrics

- **Recognition rate**: % of cover photos that find correct book
- **False positive rate**: % where wrong book is added
- **Fallback rate**: % that require manual title entry
- **User correction rate**: % where user selects candidate 2 or 3

Target: 60%+ recognition rate for clear cover photos.

---

## Rollout Plan

### Phase 1: Silent Data Collection
- Log cover text extraction results without changing user flow
- Collect 100+ real cover photos to analyze patterns
- Tune heuristics based on real data

### Phase 2: Beta with Confirmation
- Enable for all users but always require confirmation
- "Is this [title]? Reply YES or NO"
- Build confidence in accuracy

### Phase 3: Auto-Add High Confidence
- Single match + high confidence → auto-add
- Multiple matches → candidate selection
- Low confidence → always confirm

---

## Effort Estimate

| Task | Effort |
|------|--------|
| **Step 0: Prototype validation** | **1 day** |
| OCR extraction function | 0.5 day |
| Text parsing heuristics | 1 day |
| Search integration | 0.25 day |
| SMS flow modification | 0.5 day |
| Multi-step context handling | 0.5 day |
| New SMS messages | 0.25 day |
| Testing & iteration | 1 day |
| **Total** | **~5 days** |

**Note**: If Step 0 prototype shows <40% success rate, stop and defer feature.

## Cost Estimate

| Item | Cost |
|------|------|
| documentTextDetection | ~$1.50 / 1,000 images |
| Current barcode detection | ~$1.50 / 1,000 images |
| **Worst case (all photos get OCR)** | 2x current Vision spend |

**Mitigations**:
- Only run OCR after barcode detection fails (~20% of photos?)
- Skip images <50KB
- Add monthly budget cap / circuit breaker
- Log and alert on spend anomalies

---

## Dependencies

- Google Cloud Vision API (already configured)
- Existing `searchBooks()` function
- Existing SMS context pattern

## Not In Scope

- Training custom ML models
- Reverse image search (Google Lens)
- Caching cover images for future recognition
- Web UI cover upload (SMS only for now)

---

## Open Questions

1. **Should we attempt cover recognition on every photo, or only after barcode detection fails?**
   - Recommendation: Only after barcode fails (faster, cheaper)

2. **How many candidates to show?**
   - Recommendation: Max 3 (SMS character limits, decision fatigue)

3. **What if user photo contains multiple book covers?**
   - Recommendation: Defer to v2, just handle single cover for now
