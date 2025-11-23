# Better Stack Dashboard Setup Guide

This guide shows you how to create dashboards and reports from your Logtail queries.

> **⚠️ IMPORTANT:** The SQL queries in this file use placeholder field names and may not work with your actual log structure.
> **USE THE TESTED QUERIES:** See [betterstack-working-queries.md](./betterstack-working-queries.md) for working, tested queries with correct field names (`response_status`, `request_method`, `request_path`).

## Quick Start: Creating Your First Dashboard

1. **Go to Better Stack**: https://logs.betterstack.com
2. **Navigate to Dashboards**: Click "Dashboards" in left sidebar
3. **Create New Dashboard**: Click "+ New Dashboard" button
4. **Add Widgets**: Click "+ Add Widget" to add charts/tables

---

## Priority 1: Essential Monitoring Dashboards

### Dashboard 1: Application Health Overview

**Purpose**: Real-time health monitoring - check this daily

**Widgets to add:**

#### Widget 1: Request Success Rate (Last 24h)
- **Type**: Number
- **Query**:
```sql
SELECT
  ROUND(100.0 * SUM(CASE WHEN status < 400 THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM {{source:tbr-delta}}
WHERE request_id IS NOT NULL
  AND dt >= NOW() - INTERVAL '24 hours'
```
- **Visualization**: Big Number
- **Alert**: Set threshold < 95% (red), < 98% (yellow)

#### Widget 2: Error Rate (Last 24h)
- **Type**: Number
- **Query**:
```sql
SELECT COUNT(*) as error_count
FROM {{source:tbr-delta}}
WHERE event = 'error'
  AND dt >= NOW() - INTERVAL '24 hours'
```
- **Visualization**: Big Number
- **Alert**: Set threshold > 10 (yellow), > 50 (red)

#### Widget 3: Average Response Time (Last 24h)
- **Type**: Number
- **Query**:
```sql
SELECT ROUND(AVG(duration_ms), 0) as avg_response_ms
FROM {{source:tbr-delta}}
WHERE duration_ms IS NOT NULL
  AND dt >= NOW() - INTERVAL '24 hours'
```
- **Visualization**: Big Number with "ms" suffix
- **Alert**: Set threshold > 2000ms (yellow), > 5000ms (red)

#### Widget 4: Requests Over Time
- **Type**: Time Series
- **Query**:
```sql
SELECT
  DATE_TRUNC('hour', dt) as time,
  COUNT(*) as requests
FROM {{source:tbr-delta}}
WHERE request_id IS NOT NULL
  AND dt >= NOW() - INTERVAL '24 hours'
GROUP BY time
ORDER BY time ASC
```
- **Visualization**: Line Chart

#### Widget 5: Top Slow Endpoints (Last 24h)
- **Type**: Table
- **Query**:
```sql
SELECT
  path,
  COUNT(*) as requests,
  ROUND(AVG(duration_ms), 0) as avg_ms,
  MAX(duration_ms) as max_ms
FROM {{source:tbr-delta}}
WHERE duration_ms IS NOT NULL
  AND dt >= NOW() - INTERVAL '24 hours'
GROUP BY path
ORDER BY avg_ms DESC
LIMIT 10
```
- **Visualization**: Table

---

### Dashboard 2: Book Addition Analytics

**Purpose**: Track how users are adding books

**Widgets to add:**

#### Widget 1: Books Added Today
- **Type**: Number
- **Query**:
```sql
SELECT COUNT(*) as books_added
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
  AND success = true
  AND dt >= DATE_TRUNC('day', NOW())
```

#### Widget 2: Success Rate by Method
- **Type**: Bar Chart
- **Query**:
```sql
SELECT
  method,
  COUNT(*) as total,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
  AND dt >= NOW() - INTERVAL '7 days'
GROUP BY method
ORDER BY total DESC
```

#### Widget 3: SMS vs Web Usage
- **Type**: Pie Chart
- **Query**:
```sql
SELECT
  source,
  COUNT(*) as count
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
  AND dt >= NOW() - INTERVAL '7 days'
GROUP BY source
```

#### Widget 4: Books Added Over Time (7 days)
- **Type**: Time Series
- **Query**:
```sql
SELECT
  DATE_TRUNC('day', dt) as day,
  COUNT(*) as books_added,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
  AND dt >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day ASC
```
- **Visualization**: Stacked Area Chart

#### Widget 5: Recent Failed Additions
- **Type**: Table
- **Query**:
```sql
SELECT
  dt,
  user_id,
  method,
  error
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
  AND success = false
  AND dt >= NOW() - INTERVAL '24 hours'
ORDER BY dt DESC
LIMIT 20
```

---

### Dashboard 3: User Activity Tracking

**Purpose**: Monitor user engagement and growth

**Widgets to add:**

#### Widget 1: New Signups (Last 7 Days)
- **Type**: Number
- **Query**:
```sql
SELECT COUNT(*) as new_users
FROM {{source:tbr-delta}}
WHERE event = 'user_event'
  AND action = 'signup'
  AND dt >= NOW() - INTERVAL '7 days'
```

#### Widget 2: Opt-Outs (Last 7 Days)
- **Type**: Number
- **Query**:
```sql
SELECT COUNT(*) as opt_outs
FROM {{source:tbr-delta}}
WHERE event = 'user_event'
  AND action = 'opt_out'
  AND dt >= NOW() - INTERVAL '7 days'
```

#### Widget 3: Signups Over Time
- **Type**: Time Series
- **Query**:
```sql
SELECT
  DATE_TRUNC('day', dt) as day,
  COUNT(*) as signups
FROM {{source:tbr-delta}}
WHERE event = 'user_event'
  AND action = 'signup'
  AND dt >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day ASC
```

#### Widget 4: Most Active Users (Last 7 Days)
- **Type**: Table
- **Query**:
```sql
SELECT
  user_id,
  COUNT(*) as books_added,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
  AND dt >= NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY books_added DESC
LIMIT 10
```

---

### Dashboard 4: API Performance Monitor

**Purpose**: Track external API health (Google Books, Vision API)

**Widgets to add:**

#### Widget 1: API Call Success Rate
- **Type**: Bar Chart
- **Query**:
```sql
SELECT
  service,
  COUNT(*) as total_calls,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM {{source:tbr-delta}}
WHERE event = 'api_call'
  AND dt >= NOW() - INTERVAL '24 hours'
GROUP BY service
ORDER BY total_calls DESC
```

#### Widget 2: API Response Times
- **Type**: Line Chart
- **Query**:
```sql
SELECT
  DATE_TRUNC('hour', dt) as time,
  service,
  ROUND(AVG(duration_ms), 0) as avg_duration
FROM {{source:tbr-delta}}
WHERE event = 'api_call'
  AND dt >= NOW() - INTERVAL '24 hours'
GROUP BY time, service
ORDER BY time ASC
```

#### Widget 3: Slow API Calls (>3s)
- **Type**: Table
- **Query**:
```sql
SELECT
  dt,
  service,
  duration_ms,
  success
FROM {{source:tbr-delta}}
WHERE event = 'api_call'
  AND duration_ms > 3000
  AND dt >= NOW() - INTERVAL '24 hours'
ORDER BY duration_ms DESC
LIMIT 20
```

---

## Setting Up Alerts

### Critical Alerts (Page immediately)

1. **High Error Rate**
   - Navigate to: Alerts → New Alert
   - Query:
   ```sql
   SELECT COUNT(*) as errors
   FROM {{source:tbr-delta}}
   WHERE event = 'error'
     AND dt >= NOW() - INTERVAL '10 minutes'
   ```
   - Threshold: > 10 errors in 10 minutes
   - Actions: Email + SMS

2. **Slow Response Times**
   - Query:
   ```sql
   SELECT AVG(duration_ms) as avg_duration
   FROM {{source:tbr-delta}}
   WHERE duration_ms IS NOT NULL
     AND dt >= NOW() - INTERVAL '5 minutes'
   ```
   - Threshold: > 5000ms average
   - Actions: Email

3. **API Failure Rate**
   - Query:
   ```sql
   SELECT
     100.0 * SUM(CASE WHEN success = false THEN 1 ELSE 0 END) / COUNT(*) as failure_rate
   FROM {{source:tbr-delta}}
   WHERE event = 'api_call'
     AND dt >= NOW() - INTERVAL '15 minutes'
   ```
   - Threshold: > 20% failure rate
   - Actions: Email

### Warning Alerts (Review daily)

4. **Book Addition Failures**
   - Query:
   ```sql
   SELECT COUNT(*) as failures
   FROM {{source:tbr-delta}}
   WHERE event = 'book_addition'
     AND success = false
     AND dt >= NOW() - INTERVAL '1 hour'
   ```
   - Threshold: > 5 failures per hour
   - Actions: Email (daily digest)

5. **User Opt-Outs**
   - Query:
   ```sql
   SELECT COUNT(*) as opt_outs
   FROM {{source:tbr-delta}}
   WHERE event = 'user_event'
     AND action = 'opt_out'
     AND dt >= NOW() - INTERVAL '1 day'
   ```
   - Threshold: > 3 opt-outs per day
   - Actions: Email (daily digest)

---

## Setting Up Scheduled Reports

### Daily Report: Application Summary

1. Go to: Reports → New Report
2. Schedule: Every day at 9:00 AM
3. Include these queries:

```sql
-- Books added yesterday
SELECT
  COUNT(*) as books_added,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
  AND dt >= DATE_TRUNC('day', NOW() - INTERVAL '1 day')
  AND dt < DATE_TRUNC('day', NOW());

-- New users yesterday
SELECT COUNT(*) as new_signups
FROM {{source:tbr-delta}}
WHERE event = 'user_event'
  AND action = 'signup'
  AND dt >= DATE_TRUNC('day', NOW() - INTERVAL '1 day')
  AND dt < DATE_TRUNC('day', NOW());

-- Errors yesterday
SELECT error_type, COUNT(*) as count
FROM {{source:tbr-delta}}
WHERE event = 'error'
  AND dt >= DATE_TRUNC('day', NOW() - INTERVAL '1 day')
  AND dt < DATE_TRUNC('day', NOW())
GROUP BY error_type
ORDER BY count DESC;

-- Average response time yesterday
SELECT ROUND(AVG(duration_ms), 0) as avg_ms
FROM {{source:tbr-delta}}
WHERE duration_ms IS NOT NULL
  AND dt >= DATE_TRUNC('day', NOW() - INTERVAL '1 day')
  AND dt < DATE_TRUNC('day', NOW());
```

### Weekly Report: Growth & Engagement

1. Schedule: Every Monday at 9:00 AM
2. Include:

```sql
-- Books added last week
SELECT
  DATE_TRUNC('day', dt) as day,
  COUNT(*) as books_added
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
  AND success = true
  AND dt >= DATE_TRUNC('week', NOW() - INTERVAL '1 week')
  AND dt < DATE_TRUNC('week', NOW())
GROUP BY day
ORDER BY day;

-- New users last week
SELECT COUNT(*) as new_users
FROM {{source:tbr-delta}}
WHERE event = 'user_event'
  AND action = 'signup'
  AND dt >= DATE_TRUNC('week', NOW() - INTERVAL '1 week')
  AND dt < DATE_TRUNC('week', NOW());

-- Most active users last week
SELECT
  user_id,
  COUNT(*) as books_added
FROM {{source:tbr-delta}}
WHERE event = 'book_addition'
  AND success = true
  AND dt >= DATE_TRUNC('week', NOW() - INTERVAL '1 week')
  AND dt < DATE_TRUNC('week', NOW())
GROUP BY user_id
ORDER BY books_added DESC
LIMIT 10;
```

---

## Dashboard Layout Tips

### Application Health Dashboard
```
+---------------------------+---------------------------+---------------------------+
|   Success Rate (98.5%)    |   Error Count (3)         |   Avg Response (245ms)    |
+---------------------------+---------------------------+---------------------------+
|                                                                                   |
|                           Requests Over Time (Line Chart)                        |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                        Top Slow Endpoints (Table)                                |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### Book Addition Analytics Dashboard
```
+---------------------------+---------------------------+
|   Books Added Today (47)  |   Success Rate (95.2%)   |
+---------------------------+---------------------------+
|                           |                           |
|    Success by Method      |    SMS vs Web (Pie)      |
|       (Bar Chart)         |                           |
|                           |                           |
+---------------------------+---------------------------+
|                                                       |
|       Books Added Over Time (Area Chart)             |
|                                                       |
+-------------------------------------------------------+
|                                                       |
|       Recent Failed Additions (Table)                |
|                                                       |
+-------------------------------------------------------+
```

---

## Step-by-Step: Creating Your First Widget

1. **Open Dashboard**: Click on "Application Health Overview" dashboard
2. **Add Widget**: Click "+ Add Widget" button in top right
3. **Choose Type**: Select "Number" for single metric
4. **Enter Query**: Paste the success rate query
5. **Configure Display**:
   - Title: "Request Success Rate (24h)"
   - Unit: "%"
   - Decimal places: 1
6. **Set Thresholds**:
   - Green: ≥ 98%
   - Yellow: 95-98%
   - Red: < 95%
7. **Save**: Click "Save Widget"

---

## Troubleshooting

### "Query returned no results"
**Fix**: Your log fields might have different names. Run this first:
```sql
SELECT * FROM {{source:tbr-delta}} LIMIT 1
```
Look at the column names and update queries accordingly.

### "Field 'duration_ms' does not exist"
**Fix**: Check if your logs use `duration`, `elapsed`, or `responseTime` instead:
```sql
SELECT dt, duration, elapsed, responseTime
FROM {{source:tbr-delta}}
LIMIT 5
```

### "No data in widget"
**Fix**: Check the time range (top right dropdown). Try "Last 7 days" instead of "Last 24 hours".

---

## Next Steps

1. **Create Priority 1 Dashboard** (Application Health) - Start here
2. **Set up Critical Alerts** - Get notified of problems
3. **Create remaining dashboards** as needed
4. **Schedule Daily Report** - Morning overview in your inbox

---

## Quick Reference: Dashboard URLs

After creating dashboards, bookmark these:
- Application Health: `https://logs.betterstack.com/team/YOUR_TEAM/dashboards/app-health`
- Book Analytics: `https://logs.betterstack.com/team/YOUR_TEAM/dashboards/book-analytics`
- User Activity: `https://logs.betterstack.com/team/YOUR_TEAM/dashboards/user-activity`
- API Performance: `https://logs.betterstack.com/team/YOUR_TEAM/dashboards/api-performance`

---

## Pro Tips

1. **Use Time Variables**: Better Stack supports `{{time_range}}` variable for dynamic filtering
2. **Share Dashboards**: Click "Share" → Generate public link for stakeholders
3. **Mobile App**: Install Better Stack mobile app for on-the-go monitoring
4. **Refresh Rate**: Set dashboards to auto-refresh every 30 seconds for live monitoring
5. **Export Data**: Click "Export" on any widget to download CSV for deeper analysis
