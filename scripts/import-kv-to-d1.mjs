/**
 * Import all user records from KV (WXMINI) into D1 (wxsqlite).
 *
 * Usage:
 *   node scripts/import-kv-to-d1.mjs
 *   node scripts/import-kv-to-d1.mjs --from users-export.json
 *   node scripts/import-kv-to-d1.mjs --dry-run
 *
 * Requires: wrangler login (reads OAuth token from ~/.wrangler config)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ACCOUNT_ID = '4cd528848c4a3e514877039da5474499';
const KV_NAMESPACE_ID = '54f58d0691504c8b99d0097a33e577ea';
const D1_DATABASE = 'wxsqlite';
const OPENID_PATTERN = /^o[a-zA-Z0-9_-]{27}$/;
const CONCURRENCY = 20;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fromIndex = args.indexOf('--from');
const fromFile = fromIndex >= 0 ? args[fromIndex + 1] : null;

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function getWranglerToken() {
  const candidates = [
    join(homedir(), 'Library', 'Preferences', '.wrangler', 'config', 'default.toml'),
    join(homedir(), '.config', '.wrangler', 'config', 'default.toml'),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) {
      continue;
    }
    const content = readFileSync(path, 'utf8');
    const match = content.match(/oauth_token\s*=\s*"([^"]+)"/);
    if (match) {
      return match[1];
    }
  }

  throw new Error('No wrangler OAuth token found. Run: npx wrangler login');
}

async function cfFetch(path, token) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || `API error: ${path}`);
  }
  return data;
}

async function listAllKvKeys(token) {
  const keys = [];
  let cursor;

  do {
    const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const data = await cfFetch(
      `/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/keys?limit=1000${cursorParam}`,
      token,
    );
    for (const entry of data.result) {
      if (entry?.name) {
        keys.push(entry.name);
      }
    }
    cursor = data.result_info?.cursor;
  } while (cursor);

  return keys;
}

async function getKvValue(key, token) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    return null;
  }
  return response.text();
}

async function mapPool(items, concurrency, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function userToInsert(user) {
  const openid = escapeSql(user.openid);
  const totalMerit = user.totalMerit ?? 0;
  const loginMerit = user.loginMerit ?? 0;
  const lastLoginDate = user.lastLoginDate ? `'${escapeSql(user.lastLoginDate)}'` : 'NULL';
  const consecutiveDays = user.consecutiveDays ?? 0;
  const maxConsecutiveDays = user.maxConsecutiveDays ?? 0;
  const createdAt = escapeSql(user.createdAt || new Date().toISOString());
  const updatedAt = escapeSql(user.updatedAt || new Date().toISOString());

  return `INSERT OR REPLACE INTO users (
  openid, total_merit, login_merit, last_login_date,
  consecutive_days, max_consecutive_days, created_at, updated_at
) VALUES (
  '${openid}', ${totalMerit}, ${loginMerit}, ${lastLoginDate},
  ${consecutiveDays}, ${maxConsecutiveDays}, '${createdAt}', '${updatedAt}'
);`;
}

async function loadUsersFromKv() {
  const token = getWranglerToken();
  const allKeys = await listAllKvKeys(token);
  const openids = allKeys.filter((key) => OPENID_PATTERN.test(key));

  console.log(`KV total keys: ${allKeys.length}, valid openids: ${openids.length}`);

  const users = [];
  let skipped = 0;

  await mapPool(openids, CONCURRENCY, async (key) => {
    try {
      const raw = await getKvValue(key, token);
      if (!raw) {
        skipped += 1;
        return;
      }
      const user = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!user.openid) {
        user.openid = key;
      }
      users.push(user);
    } catch {
      console.warn(`Skip invalid data for key: ${key}`);
      skipped += 1;
    }
  });

  if (skipped > 0) {
    console.log(`Skipped ${skipped} key(s) with missing or invalid data.`);
  }

  return users;
}

function loadUsersFromFile(path) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(data) ? data : [data];
}

function buildSql(users) {
  const lines = ['-- KV to D1 import'];
  for (const user of users) {
    if (user?.openid) {
      lines.push(userToInsert(user));
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const users = fromFile ? loadUsersFromFile(fromFile) : await loadUsersFromKv();

  console.log(`Found ${users.length} user record(s) to import.`);

  if (users.length === 0) {
    console.log('Nothing to import.');
    return;
  }

  const sql = buildSql(users);
  const sqlPath = join(ROOT, 'scripts', 'import-users.sql');
  writeFileSync(sqlPath, sql, 'utf8');
  console.log(`SQL written to ${sqlPath}`);

  if (dryRun) {
    console.log('Dry run — skipping D1 execute.');
    return;
  }

  run(`npx wrangler d1 execute ${D1_DATABASE} --remote --file=${sqlPath}`);
  console.log('Import complete.');

  const countOutput = run(
    `npx wrangler d1 execute ${D1_DATABASE} --remote --command "SELECT COUNT(*) as userCount FROM users"`,
  );
  console.log(countOutput);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
