# Logtail Query Reference

This document contains SQL queries for analyzing TBR logs in Logtail (Better Stack).

## Important Notes

- All queries use `{{source:tbr-delta}}` to reference your data source
- The actual field names may vary depending on how Vercel sends logs to Logtail
- Start with the "Explore Data Structure" query first to see what fields are available

## Explore Data Structure

**See all available fields in your logs:**

```sql
SELECT *
FROM {{source:tbr-delta}}
LIMIT 10
```

Run this first to understand what columns/fields are actually available in your Logtail data.

## Request Performance Queries

**All SMS endpoint requests with timing:**

```sql
SELECT dt, duration_ms, path, status
FROM {{source:tbr-delta}}
WHERE path = '/api/sms'
ORDER BY dt DESC
LIMIT 50
```

**All HTTP requests with performance metrics:**

```sql
SELECT dt, method, path, status, duration_ms, user_agent
FROM {{source:tbr-delta}}
WHERE request_id IS NOT NULL
ORDER BY dt DESC
LIMIT 100
```

**Slow requests (over 2 seconds):**

```sql
SELECT dt, method, path, status, duration_ms
FROM {{source:tbr-delta}}
WHERE duration_ms > 2000
ORDER BY duration_ms DESC
LIMIT 50
```

**Average request duration by endpoint:**

```sql
SELECT path,
       COUNT(*) as request_count,
       AVG(duration_ms) as avg_duration,
       MIN(duration_ms) as min_duration,
       MAX(duration_ms) as max_duration
FROM {{source:tbr-delta}}
WHERE path IS NOT NULL AND duration_ms IS NOT NULL
GROUP BY path
ORDER BY request_count DESC
```

## Book Addition Queries

**All book additions with details:**

```sql
SELECT dt, user_id, source, method, title, isbn13, success, duration_ms, error
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
ORDER BY dt DESC
LIMIT 100
```

**Book addition success rate by method:**

```sql
SELECT method,
       source,
       COUNT(*) as total_attempts,
       SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
       ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate_percent
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
GROUP BY method, source
ORDER BY total_attempts DESC
```

**Failed book additions only:**

```sql
SELECT dt, user_id, source, method, isbn13, title, error
FROM {{source:tbr-delta}}
WHERE event = 'book_addition' AND success = false
ORDER BY dt DESC
LIMIT 50
```

**Book additions by user:**

```sql
SELECT user_id,
       COUNT(*) as total_books,
       SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
       SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
GROUP BY user_id
ORDER BY total_books DESC
```

**Recent successful additions:**

```sql
SELECT dt, user_id, source, method, title, duration_ms
FROM {{source:tbr-delta}}
WHERE event = 'book_addition' AND success = true
ORDER BY dt DESC
LIMIT 50
```

## API Call Performance Queries

**All external API calls:**

```sql
SELECT dt, service, duration_ms, success
FROM {{source:tbr-delta}}
WHERE event = 'api_call'
ORDER BY dt DESC
LIMIT 100
```

**Google Vision API calls (photo barcode detection):**

```sql
SELECT dt, service, duration_ms, success
FROM {{source:tbr-delta}}
WHERE event = 'api_call' AND service = 'google_vision'
ORDER BY dt DESC
LIMIT 50
```

**Google Books API calls:**

```sql
SELECT dt, service, duration_ms, success
FROM {{source:tbr-delta}}
WHERE event = 'api_call' AND service = 'google_books'
ORDER BY dt DESC
LIMIT 50
```

**API performance by service:**

```sql
SELECT service,
       COUNT(*) as total_calls,
       SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_calls,
       AVG(duration_ms) as avg_duration,
       MIN(duration_ms) as min_duration,
       MAX(duration_ms) as max_duration
FROM {{source:tbr-delta}}
WHERE event = 'api_call'
GROUP BY service
ORDER BY total_calls DESC
```

**Slow API calls (over 3 seconds):**

```sql
SELECT dt, service, duration_ms, success
FROM {{source:tbr-delta}}
WHERE event = 'api_call' AND duration_ms > 3000
ORDER BY duration_ms DESC
LIMIT 50
```

**Failed API calls:**

```sql
SELECT dt, service, duration_ms, success
FROM {{source:tbr-delta}}
WHERE event = 'api_call' AND success = false
ORDER BY dt DESC
LIMIT 50
```

## User Activity Queries

**User events (signups, opt-outs, help commands):**

```sql
SELECT dt, user_id, action, source
FROM {{source:tbr-delta}}
WHERE event = 'user_event'
ORDER BY dt DESC
LIMIT 100
```

**New user signups (START commands):**

```sql
SELECT dt, user_id, source
FROM {{source:tbr-delta}}
WHERE event = 'user_event' AND action = 'signup'
ORDER BY dt DESC
LIMIT 50
```

**User opt-outs (STOP commands):**

```sql
SELECT dt, user_id, source
FROM {{source:tbr-delta}}
WHERE event = 'user_event' AND action = 'opt_out'
ORDER BY dt DESC
LIMIT 50
```

**User activity summary:**

```sql
SELECT action, COUNT(*) as count
FROM {{source:tbr-delta}}
WHERE event = 'user_event'
GROUP BY action
ORDER BY count DESC
```

## Error Queries

**All errors:**

```sql
SELECT dt, error_type, message, user_id, stack
FROM {{source:tbr-delta}}
WHERE event = 'error'
ORDER BY dt DESC
LIMIT 100
```

**Errors by type:**

```sql
SELECT error_type, COUNT(*) as error_count
FROM {{source:tbr-delta}}
WHERE event = 'error'
GROUP BY error_type
ORDER BY error_count DESC
```

**Recent errors with stack traces:**

```sql
SELECT dt, error_type, message, stack
FROM {{source:tbr-delta}}
WHERE event = 'error' AND stack IS NOT NULL
ORDER BY dt DESC
LIMIT 20
```

## Time-Based Analysis

**Activity by hour (last 24 hours):**

```sql
SELECT DATE_TRUNC('hour', dt) as hour,
       COUNT(*) as event_count
FROM {{source:tbr-delta}}
WHERE dt >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC
```

**Book additions per day (last 7 days):**

```sql
SELECT DATE_TRUNC('day', dt) as day,
       COUNT(*) as books_added
FROM {{source:tbr-delta}}
WHERE event = 'book_addition' AND dt >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC
```

## SMS vs Web Comparison

**SMS vs Web book additions:**

```sql
SELECT source,
       COUNT(*) as total,
       SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
       ROUND(AVG(duration_ms), 0) as avg_duration_ms
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
GROUP BY source
```

**Method breakdown by source:**

```sql
SELECT source, method, COUNT(*) as count
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
GROUP BY source, method
ORDER BY source, count DESC
```

## Troubleshooting Queries

**If fields don't match, use these exploratory queries:**

**See raw message content:**

```sql
SELECT dt, message
FROM {{source:tbr-delta}}
ORDER BY dt DESC
LIMIT 50
```

**Check for JSON fields:**

```sql
SELECT dt, json
FROM {{source:tbr-delta}}
ORDER BY dt DESC
LIMIT 10
```

**Look for nested data:**

```sql
SELECT dt, body, metadata
FROM {{source:tbr-delta}}
ORDER BY dt DESC
LIMIT 10
```

## Notes

- Replace `{{source:tbr-delta}}` with your actual source name if different
- Time range is controlled by the date picker in the Logtail UI (top right)
- Field names are case-sensitive
- Use `IS NOT NULL` to filter out logs missing specific fields
- If queries fail, run `SELECT *` first to see actual available fields

## Common Field Names to Look For

If the queries above don't work, your logs might use different field names. Try these alternatives:

- **Timestamp**: `dt`, `timestamp`, `@timestamp`, `time`
- **Message**: `message`, `msg`, `log`, `text`
- **Level**: `level`, `severity`, `log_level`
- **User**: `user_id`, `userId`, `user`, `phone_number`
- **Duration**: `duration_ms`, `duration`, `elapsed`, `responseTime`
- **Status**: `status`, `statusCode`, `status_code`
- **Path**: `path`, `url`, `endpoint`, `route`

Run `SELECT * FROM {{source:tbr-delta}} LIMIT 1` and look at the column names to find the right field names for your setup.
