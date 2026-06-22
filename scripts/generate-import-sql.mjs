/**
 * Generate SQL INSERT statements from KV-exported user JSON.
 *
 * Usage:
 *   node scripts/generate-import-sql.mjs users-export.json > import.sql
 *   npx wrangler d1 execute wxmini-db --remote --file=import.sql
 *
 * Export KV keys first:
 *   npx wrangler kv key list --namespace-id=54f58d0691504c8b99d0097a33e577ea --remote
 *   npx wrangler kv key get --namespace-id=... --remote <openid>
 *
 * Or use lazy migration: existing users are auto-migrated on next login.
 */

import { readFileSync } from 'node:fs';

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

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/generate-import-sql.mjs <users-export.json>');
  process.exit(1);
}

const users = JSON.parse(readFileSync(inputPath, 'utf8'));
const list = Array.isArray(users) ? users : [users];

console.log('-- KV to D1 bulk import');
for (const user of list) {
  if (user?.openid) {
    console.log(userToInsert(user));
  }
}
