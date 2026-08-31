#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const initSQL = read('backend/init.sql');
const initLines = initSQL.split(/\r?\n/);

function requirePairedDrop(createPattern, buildDrop, label) {
  let count = 0;
  for (let index = 0; index < initLines.length; index += 1) {
    const match = initLines[index].match(createPattern);
    if (!match) continue;
    count += 1;
    const expectedDrop = buildDrop(match);
    const previousLine = initLines[index - 1]?.trim() ?? '';
    if (previousLine !== expectedDrop) {
      throw new Error(
        `backend/init.sql ${label} at line ${index + 1} must be preceded by: ${expectedDrop}`,
      );
    }
  }
  if (count === 0) throw new Error(`backend/init.sql does not define any ${label}.`);
  return count;
}

const policyCount = requirePairedDrop(
  /^CREATE POLICY ("[^"]+") ON ([A-Za-z0-9_.]+)\b/,
  (match) => `DROP POLICY IF EXISTS ${match[1]} ON ${match[2]};`,
  'policy',
);
const triggerCount = requirePairedDrop(
  /^CREATE TRIGGER ([A-Za-z0-9_]+)\b.*\bON ([A-Za-z0-9_.]+)\b/,
  (match) => `DROP TRIGGER IF EXISTS ${match[1]} ON ${match[2]};`,
  'trigger',
);

for (const relativePath of [
  'backend/init.sql',
  'backend/AUTH_IMPLEMENTATION.md',
  'README.md',
  'src/app/admin/login/page.tsx',
]) {
  const source = read(relativePath);
  const legacyAdminEmail = ['admin@yistack', 'dev'].join('.');
  if (source.includes(legacyAdminEmail)) {
    throw new Error(`${relativePath} must use admin@yistack.com instead of the legacy admin email.`);
  }
}
if (!initSQL.includes("'admin@yistack.com'")) {
  throw new Error('backend/init.sql must seed admin@yistack.com.');
}
for (const snippet of [
  `must_change_password boolean NOT NULL DEFAULT false`,
  `auth_version integer NOT NULL DEFAULT 1 CHECK (auth_version > 0)`,
  `ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false`,
  `ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 1`,
  `SET must_change_password = true`,
]) {
  if (!initSQL.includes(snippet)) {
    throw new Error(`backend/init.sql is missing the Admin forced password-change baseline: ${snippet}`);
  }
}

for (const snippet of [
  'CREATE TABLE IF NOT EXISTS public.commits (',
  'REFERENCES public.projects(project_id) ON DELETE CASCADE',
  'CREATE INDEX IF NOT EXISTS idx_commits_project_id ON public.commits(project_id);',
  'ALTER TABLE public.commits ENABLE ROW LEVEL SECURITY;',
  'CREATE POLICY "Service role full access on commits" ON public.commits',
]) {
  if (!initSQL.includes(snippet)) throw new Error(`backend/init.sql is missing the commits baseline: ${snippet}`);
}

console.log(
  `[YES] init.sql repeatability valid: ${policyCount} policies, ${triggerCount} triggers, admin@yistack.com.`,
);
