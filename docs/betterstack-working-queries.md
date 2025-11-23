# Better Stack Working Queries for tbr-delta

**Production-ready infrastructure monitoring queries**

## Important: Metrics Source Only

Your Better Stack source (`tbr-delta`) is configured as a **Metrics source**, not a raw logs source. This means:

✅ **What Works:**
- HTTP request/response metrics (status codes, methods, paths)
- Infrastructure monitoring (uptime, errors, traffic patterns)
- Pre-aggregated data optimized for dashboards

❌ **What Doesn't Work:**
- Raw log messages (`message` field doesn't exist)
- Application logs from Pino (book additions, user events, API calls)
- Full-text log search

**You have excellent production monitoring** covering all critical operational metrics. Application-level business metrics (books added, signups) should be tracked via database queries or a separate logs source.

---

## Key Learnings

- ✅ Use `countMergeIf()` for conditional counting (not CASE WHEN ... ELSE NULL)
- ✅ Don't multiply by 100 when using "Percent" unit
- ✅ Use `countMerge(events_count)` to count rows
- ✅ Source syntax: `{{source:tbr_delta}}`
- ✅ Time functions: `toStartOfHour()`, `toStartOfDay()` for grouping

## Available Fields

### Infrastructure Metrics (Vercel) ✅ WORKING
- `response_status` - HTTP status codes (200, 404, 500, etc.)
- `request_method` - HTTP methods (GET, POST, etc.)
- `request_path` - Request paths
- `dt` - Timestamp
- `user_agent_platform` - Platform (PC, iOS, Mac, etc.)
- `user_agent_bot` - Bot detection
- `referrer` - HTTP referrer
- `events_count` - Aggregated event count (use with `countMerge()`)

### Application Logs ❌ NOT AVAILABLE
The following are **not available** in the metrics source:
- `message` field (doesn't exist)
- Pino log fields (event, success, method, user_id)
- Raw log text

To get these, you would need a separate Better Stack **Logs source** (not Metrics/APM).

---

## Dashboard 1: Application Health Overview (Infrastructure) ✅ COMPLETE

### Widget 1: Request Success Rate (24h) ✅
```sql
SELECT
  ROUND(countMergeIf(events_count, response_status < 400) / countMerge(events_count), 2) as success_rate
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '24 hours'
  AND response_status IS NOT NULL
```
- Visualization: Number
- Unit: Percent
- Decimal places: 1

---

### Widget 2: Error Count (24h) ✅
```sql
SELECT
  countMerge(events_count) as error_count
FROM {{source:tbr_delta}}
WHERE response_status >= 400
  AND dt >= NOW() - INTERVAL '24 hours'
```
- Visualization: Number
- Title: "Error Count (24h)"

---

### Widget 3: Total Requests (24h) ✅
```sql
SELECT
  countMerge(events_count) as total_requests
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '24 hours'
  AND response_status IS NOT NULL
```
- Visualization: Number
- Title: "Total Requests (24h)"

---

### Widget 4: Requests Over Time ✅
```sql
SELECT
  toStartOfHour(dt) as time,
  countMerge(events_count) as requests,
  countMergeIf(events_count, response_status < 400) as successful,
  countMergeIf(events_count, response_status >= 400) as errors
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '24 hours'
  AND response_status IS NOT NULL
GROUP BY time
ORDER BY time ASC
```
- Visualization: Line Chart
- Title: "Requests Over Time (24h)"

---

### Widget 5: Status Code Breakdown ✅
```sql
SELECT
  response_status as status,
  countMerge(events_count) as count
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '24 hours'
  AND response_status IS NOT NULL
GROUP BY status
ORDER BY count DESC
LIMIT 10
```
- Visualization: Table
- Title: "Status Code Breakdown (24h)"

---

### Widget 6: Top Request Paths ✅
```sql
SELECT
  request_path as path,
  countMerge(events_count) as requests,
  countMergeIf(events_count, response_status < 400) as successful,
  countMergeIf(events_count, response_status >= 400) as errors
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '24 hours'
  AND request_path IS NOT NULL
GROUP BY path
ORDER BY requests DESC
LIMIT 10
```
- Visualization: Table
- Title: "Top Request Paths (24h)"

---

## Dashboard 2: Traffic Analysis (Infrastructure) ✅ COMPLETE

### Widget 1: Requests by Method ✅
```sql
SELECT
  request_method as method,
  countMerge(events_count) as count
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '24 hours'
  AND request_method IS NOT NULL
GROUP BY method
ORDER BY count DESC
```
- Visualization: Pie Chart
- Title: "Requests by Method (24h)"

---

### Widget 2: Traffic by Platform ✅
```sql
SELECT
  user_agent_platform as platform,
  countMerge(events_count) as requests
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '24 hours'
  AND user_agent_platform IS NOT NULL
GROUP BY platform
ORDER BY requests DESC
LIMIT 10
```
- Visualization: Bar Chart
- Title: "Traffic by Platform (24h)"

---

### Widget 3: Bot Traffic ✅
```sql
SELECT
  countMerge(events_count) as bot_requests
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '24 hours'
  AND user_agent_bot IS NOT NULL
```
- Visualization: Number
- Title: "Bot Requests (24h)"

---

### Widget 4: Top Referrers
```sql
SELECT
  referrer,
  countMerge(events_count) as visits
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '7 days'
  AND referrer IS NOT NULL
  AND referrer != ''
GROUP BY referrer
ORDER BY visits DESC
LIMIT 10
```
- Visualization: Table
- Title: "Top Referrers (7d)"

---

## ❌ Dashboards 3-5: Application Logs NOT AVAILABLE

**The following dashboards WILL NOT WORK** with your current Better Stack metrics source.

The `tbr-delta` source does not have a `message` field or Pino log data. These queries are kept for reference in case you set up a separate logs source in the future.

---

## Dashboard 3: Book Addition Analytics (Application) ❌ NOT AVAILABLE

**⚠️ IMPORTANT: These queries DO NOT WORK with metrics source.**

Requires: Better Stack Logs source (not Metrics/APM) + Pino application logs flowing.

### Widget 1: Books Added Today
```sql
SELECT countMerge(events_count) as books_added
FROM {{source:tbr_delta}}
WHERE message LIKE '%book_addition%'
  AND message LIKE '%"success":true%'
  AND dt >= toStartOfDay(NOW())
```
- Visualization: Number
- Title: "Books Added Today"

---

### Widget 2: Books Added Over Time (7d)
```sql
SELECT
  toStartOfDay(dt) as day,
  countMerge(events_count) as books_added
FROM {{source:tbr_delta}}
WHERE message LIKE '%book_addition%'
  AND dt >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day ASC
```
- Visualization: Line Chart
- Title: "Books Added (7d)"

---

### Widget 3: SMS vs Web Usage (7d)
```sql
SELECT
  if(message LIKE '%"source":"sms"%', 'SMS', 'Web') as source,
  countMerge(events_count) as count
FROM {{source:tbr_delta}}
WHERE message LIKE '%book_addition%'
  AND dt >= NOW() - INTERVAL '7 days'
GROUP BY source
ORDER BY count DESC
```
- Visualization: Pie Chart
- Title: "Book Addition Source (7d)"

---

### Widget 4: Addition Method Breakdown (7d)
```sql
SELECT
  multiIf(
    message LIKE '%"method":"isbn"%', 'ISBN',
    message LIKE '%"method":"amazon_link"%', 'Amazon Link',
    message LIKE '%"method":"image"%', 'Image/Photo',
    message LIKE '%"method":"search"%', 'Search',
    'Other'
  ) as method,
  countMerge(events_count) as count
FROM {{source:tbr_delta}}
WHERE message LIKE '%book_addition%'
  AND dt >= NOW() - INTERVAL '7 days'
GROUP BY method
ORDER BY count DESC
```
- Visualization: Bar Chart
- Title: "Addition Methods (7d)"

---

### Widget 5: Recent Failed Additions
```sql
SELECT
  dt,
  message
FROM {{source:tbr_delta}}
WHERE message LIKE '%book_addition%'
  AND message LIKE '%"success":false%'
  AND dt >= NOW() - INTERVAL '24 hours'
ORDER BY dt DESC
LIMIT 20
```
- Visualization: Table
- Title: "Recent Failed Book Additions"

---

## Dashboard 4: User Activity (Application) ❌ NOT AVAILABLE

**⚠️ IMPORTANT: These queries DO NOT WORK with metrics source.**

Requires: Better Stack Logs source (not Metrics/APM) + Pino application logs flowing.

### Widget 1: New Signups (7d)
```sql
SELECT countMerge(events_count) as new_users
FROM {{source:tbr_delta}}
WHERE message LIKE '%user_event%'
  AND message LIKE '%"action":"signup"%'
  AND dt >= NOW() - INTERVAL '7 days'
```
- Visualization: Number
- Title: "New Signups (7d)"

---

### Widget 2: Opt-Outs (7d)
```sql
SELECT countMerge(events_count) as opt_outs
FROM {{source:tbr_delta}}
WHERE message LIKE '%user_event%'
  AND message LIKE '%"action":"opt_out"%'
  AND dt >= NOW() - INTERVAL '7 days'
```
- Visualization: Number
- Title: "Opt-Outs (7d)"

---

### Widget 3: Signups Over Time (30d)
```sql
SELECT
  toStartOfDay(dt) as day,
  countMerge(events_count) as signups
FROM {{source:tbr_delta}}
WHERE message LIKE '%user_event%'
  AND message LIKE '%"action":"signup"%'
  AND dt >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day ASC
```
- Visualization: Line Chart
- Title: "Daily Signups (30d)"

---

### Widget 4: User Actions Breakdown (7d)
```sql
SELECT
  multiIf(
    message LIKE '%"action":"signup"%', 'Signup',
    message LIKE '%"action":"opt_out"%', 'Opt Out',
    message LIKE '%"action":"help"%', 'Help Request',
    message LIKE '%"action":"unknown_command"%', 'Unknown Command',
    'Other'
  ) as action,
  countMerge(events_count) as count
FROM {{source:tbr_delta}}
WHERE message LIKE '%user_event%'
  AND dt >= NOW() - INTERVAL '7 days'
GROUP BY action
ORDER BY count DESC
```
- Visualization: Bar Chart
- Title: "User Actions (7d)"

---

## Dashboard 5: API Performance (Application) ❌ NOT AVAILABLE

**⚠️ IMPORTANT: These queries DO NOT WORK with metrics source.**

Requires: Better Stack Logs source (not Metrics/APM) + Pino application logs flowing.

### Widget 1: API Call Success Rate (24h)
```sql
SELECT
  multiIf(
    message LIKE '%"service":"google_books"%', 'Google Books',
    message LIKE '%"service":"google_vision"%', 'Google Vision',
    message LIKE '%"service":"supabase"%', 'Supabase',
    'Other'
  ) as service,
  countMerge(events_count) as total_calls,
  ROUND(countMergeIf(events_count, message LIKE '%"success":true%') / countMerge(events_count), 2) as success_rate
FROM {{source:tbr_delta}}
WHERE message LIKE '%api_call%'
  AND dt >= NOW() - INTERVAL '24 hours'
GROUP BY service
ORDER BY total_calls DESC
```
- Visualization: Table
- Title: "API Success Rates (24h)"
- Note: success_rate displayed as decimal (0.95 = 95%)

---

### Widget 2: API Calls Over Time (24h)
```sql
SELECT
  toStartOfHour(dt) as time,
  countMerge(events_count) as api_calls
FROM {{source:tbr_delta}}
WHERE message LIKE '%api_call%'
  AND dt >= NOW() - INTERVAL '24 hours'
GROUP BY time
ORDER BY time ASC
```
- Visualization: Line Chart
- Title: "API Calls Over Time (24h)"

---

### Widget 3: Failed API Calls (24h)
```sql
SELECT
  dt,
  multiIf(
    message LIKE '%"service":"google_books"%', 'Google Books',
    message LIKE '%"service":"google_vision"%', 'Google Vision',
    message LIKE '%"service":"supabase"%', 'Supabase',
    'Other'
  ) as service,
  message
FROM {{source:tbr_delta}}
WHERE message LIKE '%api_call%'
  AND message LIKE '%"success":false%'
  AND dt >= NOW() - INTERVAL '24 hours'
ORDER BY dt DESC
LIMIT 20
```
- Visualization: Table
- Title: "Recent API Failures"

---

## Critical Alerts (Infrastructure) ✅ COMPLETE

### Alert 1: High Error Rate (5xx) ✅
```sql
SELECT countMerge(events_count) as errors
FROM {{source:tbr_delta}}
WHERE response_status >= 500
  AND dt >= NOW() - INTERVAL '10 minutes'
```
- Threshold: > 10 errors
- Actions: Email + SMS

---

### Alert 2: Low Success Rate ✅
```sql
SELECT
  ROUND(countMergeIf(events_count, response_status < 400) / countMerge(events_count), 2) as success_rate
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '15 minutes'
  AND response_status IS NOT NULL
```
- Threshold: < 0.95 (95%)
- Actions: Email

---

### Alert 3: No Traffic (Downtime) ✅
```sql
SELECT countMerge(events_count) as request_count
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '5 minutes'
```
- Threshold: = 0 requests
- Actions: Email + SMS

---

### Alert 4: High 4xx Rate (Client Errors)
```sql
SELECT
  ROUND(countMergeIf(events_count, response_status >= 400 AND response_status < 500) / countMerge(events_count), 2) as client_error_rate
FROM {{source:tbr_delta}}
WHERE dt >= NOW() - INTERVAL '15 minutes'
  AND response_status IS NOT NULL
```
- Threshold: > 0.20 (20%)
- Actions: Email

---

## Warning Alerts (Application) ❌ NOT AVAILABLE

**⚠️ IMPORTANT: These alerts DO NOT WORK with metrics source.**

Requires: Better Stack Logs source (not Metrics/APM) + Pino application logs flowing.

### Alert 5: Book Addition Failures
```sql
SELECT countMerge(events_count) as failures
FROM {{source:tbr_delta}}
WHERE message LIKE '%book_addition%'
  AND message LIKE '%"success":false%'
  AND dt >= NOW() - INTERVAL '1 hour'
```
- Threshold: > 5 failures per hour
- Actions: Email (daily digest)

---

### Alert 6: User Opt-Outs
```sql
SELECT countMerge(events_count) as opt_outs
FROM {{source:tbr_delta}}
WHERE message LIKE '%user_event%'
  AND message LIKE '%"action":"opt_out"%'
  AND dt >= NOW() - INTERVAL '1 day'
```
- Threshold: > 3 opt-outs per day
- Actions: Email (daily digest)

---

### Alert 7: API Failure Rate
```sql
SELECT
  ROUND(countMergeIf(events_count, message LIKE '%"success":false%') / countMerge(events_count), 2) as failure_rate
FROM {{source:tbr_delta}}
WHERE message LIKE '%api_call%'
  AND dt >= NOW() - INTERVAL '15 minutes'
```
- Threshold: > 0.20 (20% failure rate)
- Actions: Email

---

## Scheduled Reports

### Daily Report: Application Summary

Run at 9:00 AM daily:

```sql
-- Total requests yesterday
SELECT countMerge(events_count) as total_requests
FROM {{source:tbr_delta}}
WHERE dt >= toStartOfDay(NOW() - INTERVAL '1 day')
  AND dt < toStartOfDay(NOW())
  AND response_status IS NOT NULL;

-- Success rate yesterday
SELECT
  ROUND(countMergeIf(events_count, response_status < 400) / countMerge(events_count), 2) as success_rate
FROM {{source:tbr_delta}}
WHERE dt >= toStartOfDay(NOW() - INTERVAL '1 day')
  AND dt < toStartOfDay(NOW())
  AND response_status IS NOT NULL;

-- Errors by status code yesterday
SELECT
  response_status,
  countMerge(events_count) as count
FROM {{source:tbr_delta}}
WHERE dt >= toStartOfDay(NOW() - INTERVAL '1 day')
  AND dt < toStartOfDay(NOW())
  AND response_status >= 400
GROUP BY response_status
ORDER BY count DESC;
```

### Daily Report: Business Metrics (Application) ❌ NOT AVAILABLE

**⚠️ IMPORTANT: This report DOES NOT WORK with metrics source.**

Run at 9:00 AM daily:

```sql
-- Books added yesterday
SELECT countMerge(events_count) as books_added
FROM {{source:tbr_delta}}
WHERE message LIKE '%book_addition%'
  AND message LIKE '%"success":true%'
  AND dt >= toStartOfDay(NOW() - INTERVAL '1 day')
  AND dt < toStartOfDay(NOW());

-- New signups yesterday
SELECT countMerge(events_count) as new_signups
FROM {{source:tbr_delta}}
WHERE message LIKE '%user_event%'
  AND message LIKE '%"action":"signup"%'
  AND dt >= toStartOfDay(NOW() - INTERVAL '1 day')
  AND dt < toStartOfDay(NOW());

-- API failures yesterday
SELECT countMerge(events_count) as api_failures
FROM {{source:tbr_delta}}
WHERE message LIKE '%api_call%'
  AND message LIKE '%"success":false%'
  AND dt >= toStartOfDay(NOW() - INTERVAL '1 day')
  AND dt < toStartOfDay(NOW());
```

---

## Testing Application Logs ❌ NOT APPLICABLE

**Your Better Stack source is a Metrics source** - it does not have a `message` field or raw log data.

The following test queries **will not work**:

```sql
-- This WILL FAIL - no message field exists
SELECT dt, message
FROM {{source:tbr_delta}}
WHERE message LIKE '%book_addition%'
LIMIT 5;

-- This shows available columns (all metrics, no message)
DESCRIBE TABLE {{source:tbr_delta}};
```

**To get application logs**, you would need to:
1. Create a new Better Stack **Logs** source (not Metrics/APM)
2. Configure Vercel log drain to send to that new source
3. Use different queries designed for log data

**For now, stick with the infrastructure monitoring you have** - it's excellent for production reliability.

---

## Pro Tips

1. **Message parsing is slow** - If Pino logs appear as JSON in `message` field, performance will be slower than structured fields
2. **Consider log forwarding** - Configure Vercel to forward structured logs or use log transformation
3. **Test incrementally** - Start with simple `SELECT * ... LIMIT 1` queries before building dashboards
4. **Use time bucketing** - `toStartOfHour()`, `toStartOfDay()` are much faster than `DATE_TRUNC()`
5. **Monitor query performance** - Better Stack shows query execution time; aim for <1s
