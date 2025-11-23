# Vercel → Better Stack Configuration - Final Status

## Actual Implementation

Your Better Stack integration is configured as a **Metrics source**, not a raw logs source.

### What You Have ✅
- **Infrastructure monitoring** via pre-aggregated metrics
- **HTTP request/response data:** status codes, methods, paths, timestamps
- **3 dashboards:** Application Health, Traffic Analysis, Critical Alerts
- **12 widgets:** Success rates, error counts, traffic patterns, status breakdowns
- **3 alerts:** 5xx errors, downtime, low success rate

### What You Don't Have ❌
- Raw log messages (`message` field)
- Application logs from Pino (book additions, user events, API calls)
- Full-text log search

## Why This Happened

Better Stack's Vercel integration creates a **Metrics/APM source** optimized for infrastructure observability, not a **Logs source** for raw log data. The integration:
- Captures HTTP request/response metadata
- Pre-aggregates data into queryable metrics
- Stores in ClickHouse as structured columns
- Does NOT store raw stdout/stderr from functions

## Current Status
- ✅ Infrastructure metrics flowing to Better Stack (working perfectly)
- ❌ Application logs (Pino output) not accessible via queries
- ✅ Production monitoring complete and operational

## What's Working

### Vercel Integration
- **Integration:** Better Stack (Logtail) installed and active
- **Source:** `tbr-delta` (Metrics source, ID: 1572023)
- **Data flowing:** ~2.64 MB, 114k events
- **Log types enabled:** Functions, Edge Functions, Static Files, Rewrites, Builds
- **Environments:** Production + Preview

### Manual Log Drain (Attempted)
- **Endpoint:** `https://s1572023.eu-nbg-2-vec.betterstackdata.com:65`
- **Authorization:** Bearer token configured
- **Result:** Logs sent to same metrics source (not a separate logs source)

## Recommendation

**Keep your current setup.** You have excellent production monitoring covering:
- Uptime and downtime detection
- Error rate tracking (4xx/5xx)
- Traffic analysis and patterns
- Platform/device breakdown

For business metrics (book additions, user signups), query your Supabase database directly rather than trying to set up complex log aggregation.

---

## (Reference Only) How to Get Application Logs

If you really need application-level logs in the future, you would need to:

## Setup Steps (For Future Reference)

### Method 1: Better Stack Integration (Recommended)

1. **Open Vercel Dashboard:**
   ```
   https://vercel.com/stevenpates-projects/tbr-delta/settings/integrations
   ```

2. **Configure Better Stack Integration:**
   - Find "Better Stack" or "Logtail" in integrations
   - Click "Configure"
   - Enable these log types:
     - ✅ Edge & Middleware Logs
     - ✅ **Function Logs** ← CRITICAL for Pino logs
     - ✅ Build Logs

3. **Save and Deploy:**
   - Changes take effect on next deployment
   - Redeploy if needed: `vercel --prod`

---

### Method 2: Manual Log Drain

If Better Stack integration doesn't support function logs:

1. **Get Better Stack Source Token:**
   - Go to Better Stack → Sources → tbr-delta
   - Copy the "Source Token"

2. **Get Better Stack Endpoint:**
   - Usually: `https://in.logs.betterstack.com/`
   - Or check your Better Stack source settings

3. **Add Log Drain in Vercel:**
   ```
   https://vercel.com/stevenpates-projects/tbr-delta/settings/log-drains
   ```

   Click "Add Log Drain":
   - **Endpoint:** `https://in.logs.betterstack.com/`
   - **Headers:**
     - Key: `Authorization`
     - Value: `Bearer YOUR_SOURCE_TOKEN`
   - **Log Types:**
     - ✅ Function Logs (required!)
     - ✅ Edge Logs
     - ✅ Build Logs

4. **Save and Test:**
   - Trigger a book addition (text ISBN or use web UI)
   - Check Better Stack for function logs

---

## Verification

### Test Query in Better Stack

After configuration, run this query to verify function logs are flowing:

```sql
SELECT
  dt,
  message
FROM {{source:tbr_delta}}
WHERE message LIKE '%Book addition:%'
   OR message LIKE '%User event:%'
   OR message LIKE '%"event":%'
ORDER BY dt DESC
LIMIT 10
```

**Expected Result:**
- Should see JSON log entries from Pino
- Message field contains: `{"event":"book_addition","user_id":"+1...", ...}`

**If No Results:**
- Logs aren't flowing yet
- Check Vercel log drain status
- Trigger another test event
- Wait 1-2 minutes for propagation

---

## What Gets Logged

From `src/lib/server/logger.ts`:

### Book Additions
```json
{
  "event": "book_addition",
  "user_id": "+15551234567",
  "source": "sms" | "web",
  "method": "isbn" | "amazon_link" | "image" | "search",
  "isbn13": "9781234567890",
  "title": "Book Title",
  "success": true,
  "duration_ms": 456
}
```

### User Events
```json
{
  "event": "user_event",
  "user_id": "+15551234567",
  "action": "signup" | "opt_out" | "help" | "unknown_command",
  "source": "sms" | "web"
}
```

### API Calls
```json
{
  "event": "api_call",
  "service": "google_books" | "google_vision" | "supabase",
  "duration_ms": 234,
  "success": true
}
```

### Errors
```json
{
  "event": "error",
  "error_type": "isbn_validation",
  "message": "Error details",
  "user_id": "+15551234567"
}
```

---

## After Logs Are Flowing

Once function logs reach Better Stack, you can use the application queries in:
- `docs/betterstack-working-queries.md`
- Look for sections marked with ⚠️ (requires application logs)

These will work:
- Dashboard 3: Book Addition Analytics
- Dashboard 4: User Activity
- Dashboard 5: API Performance
- Application-specific alerts

---

## Troubleshooting

### Logs Still Not Appearing

1. **Check Vercel Logs Locally:**
   ```bash
   vercel logs DEPLOYMENT_URL --json | grep "Book addition"
   ```
   If you see Pino output here, logs are being produced.

2. **Check Log Drain Status:**
   ```
   https://vercel.com/stevenpates-projects/tbr-delta/settings/log-drains
   ```
   Should show "Active" status

3. **Verify Better Stack Source:**
   - Check if you have multiple sources
   - One might be for edge logs, one for function logs
   - Check the correct source in Better Stack

4. **Force a Deployment:**
   ```bash
   vercel --prod --force
   ```
   Sometimes config changes need a fresh deployment

### Logs Appearing in Wrong Format

If logs appear but queries don't work:
- Check if `message` field has the JSON
- May need to use JSON parsing in queries
- Or check if Better Stack is extracting fields automatically

---

## Notes

- **Propagation Time:** Allow 1-2 minutes after configuration
- **Deployment Required:** Changes take effect on next deploy
- **Multiple Sources:** Edge logs and function logs might go to different Better Stack sources
- **Cost:** Better Stack free tier: 1GB/month, then paid (check your usage)

---

## References

- Vercel Log Drains Docs: https://vercel.com/docs/observability/log-drains
- Better Stack Integration: https://vercel.com/integrations/logtail
- Pino Logger: https://github.com/pinojs/pino
