/**
 * KronosPortal stress test
 * Usage: TOKEN=<your-jwt> node stress-test.js [--duration 10] [--connections 50]
 *
 * Get your token: open browser devtools → Application → Local Storage → token
 */

const autocannon = require('./node_modules/autocannon/autocannon');

const TOKEN = process.env.TOKEN || '';
const BASE = process.env.BASE_URL || 'http://localhost:5000';

const DURATION = parseInt(process.argv.find((a) => a.startsWith('--duration='))?.split('=')[1] ?? '10');
const CONNECTIONS = parseInt(process.argv.find((a) => a.startsWith('--connections='))?.split('=')[1] ?? '50');

if (!TOKEN) {
  console.error('\n  ERROR: No TOKEN set.');
  console.error('  Run: TOKEN="your-jwt-here" node stress-test.js\n');
  console.error('  Get token from browser: localStorage.getItem("token")\n');
  process.exit(1);
}

const AUTH = { Authorization: `Bearer ${TOKEN}` };

// ─── Test definitions ──────────────────────────────────────────────────────
const TESTS = [
  {
    name: 'Health check (no auth)',
    url: `${BASE}/api/health`,
    method: 'GET',
    headers: {},
  },
  {
    name: 'GET /timecorrections (pending) — badge endpoint',
    url: `${BASE}/api/timecorrections?status=pending`,
    method: 'GET',
    headers: AUTH,
  },
  {
    name: 'GET /timecorrections (all)',
    url: `${BASE}/api/timecorrections`,
    method: 'GET',
    headers: AUTH,
  },
  {
    name: 'GET /schedules',
    url: `${BASE}/api/schedules`,
    method: 'GET',
    headers: AUTH,
  },
  {
    name: 'GET /messages/unread-count',
    url: `${BASE}/api/messages/unread-count`,
    method: 'GET',
    headers: AUTH,
  },
  {
    name: 'GET /notifications',
    url: `${BASE}/api/notifications`,
    method: 'GET',
    headers: AUTH,
  },
  {
    name: 'GET /users (staff list)',
    url: `${BASE}/api/users`,
    method: 'GET',
    headers: AUTH,
  },
];

// ─── Rate limit hit test (intentional abuse to verify limiter) ────────────
const RATE_LIMIT_TEST = {
  name: 'Rate limiter — rapid login attempts (expect 429s)',
  url: `${BASE}/api/auth/login`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong' }),
  connections: 20,
  duration: 5,
  expectStatus: 429,
};

// ─── Runner ────────────────────────────────────────────────────────────────
function fmt(n) { return n?.toFixed(2) ?? '—'; }

function grade(p99) {
  if (p99 < 100) return '🟢 Excellent';
  if (p99 < 300) return '🟡 Good';
  if (p99 < 800) return '🟠 Acceptable';
  return '🔴 Slow';
}

function runTest(config) {
  return new Promise((resolve) => {
    const instance = autocannon({
      url: config.url,
      method: config.method || 'GET',
      headers: config.headers || {},
      body: config.body,
      connections: config.connections || CONNECTIONS,
      duration: config.duration || DURATION,
      pipelining: 1,
      timeout: 10,
    }, (err, result) => {
      if (err) return resolve({ name: config.name, error: err.message });
      resolve({ name: config.name, result, expectStatus: config.expectStatus });
    });
    autocannon.track(instance, { renderProgressBar: false });
  });
}

function printResult({ name, result, error, expectStatus }) {
  if (error) {
    console.log(`\n  ❌ ${name}`);
    console.log(`     Error: ${error}`);
    return;
  }

  const { requests, latency, errors, non2xx, statusCodeStats } = result;
  const p99 = latency?.p99 ?? 0;
  const rps = requests?.average ?? 0;
  const errRate = ((errors + non2xx) / Math.max(requests?.total, 1) * 100).toFixed(1);

  const statusLine = Object.entries(statusCodeStats || {})
    .map(([code, { count }]) => `${code}×${count}`)
    .join('  ');

  const label = expectStatus === 429
    ? (statusCodeStats?.['429']?.count > 0 ? '🟢 Rate limiter firing' : '🔴 Rate limiter NOT working')
    : grade(p99);

  console.log(`\n  ${label}  ${name}`);
  console.log(`     RPS: ${fmt(rps)}   p50: ${fmt(latency?.p50)}ms   p99: ${fmt(p99)}ms   p999: ${fmt(latency?.p999)}ms`);
  console.log(`     Total: ${requests?.total}   Errors: ${errors + non2xx} (${errRate}%)   Statuses: ${statusLine || 'all 2xx'}`);
}

async function main() {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  KronosPortal Stress Test`);
  console.log(`  Base: ${BASE}   Connections: ${CONNECTIONS}   Duration: ${DURATION}s`);
  console.log(`${'─'.repeat(60)}\n`);

  // Run read-only tests in series (avoid overwhelming local server)
  for (const test of TESTS) {
    process.stdout.write(`  Running: ${test.name}...`);
    const res = await runTest(test);
    process.stdout.write('\r' + ' '.repeat(60) + '\r');
    printResult(res);
  }

  // Rate limit test
  console.log('\n  ── Rate limiter verification ──');
  process.stdout.write(`  Running: ${RATE_LIMIT_TEST.name}...`);
  const rlRes = await runTest(RATE_LIMIT_TEST);
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  printResult(rlRes);

  // Concurrent mixed load burst
  console.log('\n  ── Concurrent mixed burst (30s) ──');
  const burst = [
    TESTS[1], // pending corrections
    TESTS[3], // schedules
    TESTS[4], // unread messages
  ];
  console.log('  Running 3 endpoints simultaneously...');
  const burstResults = await Promise.all(
    burst.map((t) => runTest({ ...t, duration: 30, connections: Math.ceil(CONNECTIONS / 3) }))
  );
  burstResults.forEach(printResult);

  console.log(`\n${'─'.repeat(60)}`);
  console.log('  Done.\n');
}

main().catch(console.error);
