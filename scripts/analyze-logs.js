#!/usr/bin/env node

/**
 * Quick log analysis script
 *
 * For now, analyzes logs from local dev server output.
 * In production, you can:
 * 1. Use Vercel CLI: `vercel logs --output=json > logs.json`
 * 2. Run this script on the JSON file
 */

const fs = require('fs');

// Parse NDJSON (newline-delimited JSON) logs
function parseNDJSON(content) {
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

// Analyze book additions
function analyzeBookAdditions(logs) {
  const additions = logs.filter(log => log.event === 'book_addition');

  console.log('\n📚 BOOK ADDITIONS');
  console.log('='.repeat(50));
  console.log(`Total attempts: ${additions.length}`);

  const successful = additions.filter(log => log.success);
  const failed = additions.filter(log => !log.success);

  console.log(`  ✅ Successful: ${successful.length}`);
  console.log(`  ❌ Failed: ${failed.length}`);

  if (additions.length > 0) {
    const avgDuration = additions.reduce((sum, log) => sum + log.duration_ms, 0) / additions.length;
    console.log(`  ⏱️  Average duration: ${avgDuration.toFixed(0)}ms`);

    // By source
    const bySMS = additions.filter(log => log.source === 'sms').length;
    const byWeb = additions.filter(log => log.source === 'web').length;
    console.log(`\n  By Source:`);
    console.log(`    SMS: ${bySMS}`);
    console.log(`    Web: ${byWeb}`);

    // By method
    const methods = {};
    additions.forEach(log => {
      methods[log.method] = (methods[log.method] || 0) + 1;
    });
    console.log(`\n  By Method:`);
    Object.entries(methods).forEach(([method, count]) => {
      console.log(`    ${method}: ${count}`);
    });

    // Failed reasons
    if (failed.length > 0) {
      console.log(`\n  Failure Reasons:`);
      const errors = {};
      failed.forEach(log => {
        errors[log.error] = (errors[log.error] || 0) + 1;
      });
      Object.entries(errors).forEach(([error, count]) => {
        console.log(`    "${error}": ${count}`);
      });
    }
  }
}

// Analyze API calls
function analyzeAPICalls(logs) {
  const apiCalls = logs.filter(log => log.event === 'api_call');

  if (apiCalls.length === 0) return;

  console.log('\n🌐 API CALLS');
  console.log('='.repeat(50));

  const byService = {};
  apiCalls.forEach(log => {
    if (!byService[log.service]) {
      byService[log.service] = { count: 0, totalDuration: 0, successes: 0, failures: 0 };
    }
    byService[log.service].count++;
    byService[log.service].totalDuration += log.duration_ms;
    if (log.success) {
      byService[log.service].successes++;
    } else {
      byService[log.service].failures++;
    }
  });

  Object.entries(byService).forEach(([service, stats]) => {
    const avgDuration = (stats.totalDuration / stats.count).toFixed(0);
    console.log(`\n  ${service}:`);
    console.log(`    Calls: ${stats.count}`);
    console.log(`    Success: ${stats.successes}`);
    console.log(`    Failed: ${stats.failures}`);
    console.log(`    Avg duration: ${avgDuration}ms`);
  });
}

// Analyze requests
function analyzeRequests(logs) {
  const requests = logs.filter(log => log.request_id && log.path);

  if (requests.length === 0) return;

  console.log('\n🌍 HTTP REQUESTS');
  console.log('='.repeat(50));
  console.log(`Total requests: ${requests.length}`);

  const avgDuration = requests.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / requests.length;
  console.log(`Average duration: ${avgDuration.toFixed(0)}ms`);

  // By endpoint
  const byPath = {};
  requests.forEach(log => {
    byPath[log.path] = (byPath[log.path] || 0) + 1;
  });

  console.log(`\nTop endpoints:`);
  Object.entries(byPath)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([path, count]) => {
      console.log(`  ${path}: ${count}`);
    });
}

// Analyze user events
function analyzeUserEvents(logs) {
  const events = logs.filter(log => log.event === 'user_event');

  if (events.length === 0) return;

  console.log('\n👤 USER EVENTS');
  console.log('='.repeat(50));

  const byAction = {};
  events.forEach(log => {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
  });

  Object.entries(byAction).forEach(([action, count]) => {
    console.log(`  ${action}: ${count}`);
  });
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const logFile = args[0];

  if (!logFile) {
    console.log('📊 Log Analysis Tool\n');
    console.log('Usage:');
    console.log('  node scripts/analyze-logs.js <log-file.json>');
    console.log('');
    console.log('To get logs from Vercel:');
    console.log('  vercel logs --output=json > vercel-logs.json');
    console.log('  node scripts/analyze-logs.js vercel-logs.json');
    console.log('');
    console.log('For local dev logs:');
    console.log('  npm run dev 2>&1 | tee dev-logs.txt');
    console.log('  # Then extract JSON lines from dev-logs.txt');
    return;
  }

  if (!fs.existsSync(logFile)) {
    console.error(`❌ File not found: ${logFile}`);
    return;
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  const logs = parseNDJSON(content);

  console.log(`\n📂 Analyzing ${logs.length} log entries...\n`);

  analyzeBookAdditions(logs);
  analyzeAPICalls(logs);
  analyzeUserEvents(logs);
  analyzeRequests(logs);

  console.log('\n' + '='.repeat(50) + '\n');
}

main();
