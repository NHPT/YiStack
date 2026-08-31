#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const personalName = ['suru', 'ixiong'].join('');
const companyDomain = ['byte', 'dance.com'].join('');
const forbiddenTextPatterns = [
  {
    name: 'personal identifier',
    pattern: new RegExp(personalName, 'i'),
  },
  {
    name: 'company email domain',
    pattern: new RegExp(companyDomain.replace('.', '\\.'), 'i'),
  },
  {
    name: 'absolute user path',
    pattern: /(?<![A-Za-z0-9._/-])(?:(?:\/data\d+)?\/home\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+|\/Users\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\)/,
  },
  {
    name: 'real Supabase project reference',
    pattern: /\b(?!projectref\.|demo\.|xxx\.|your-project\.)[a-z0-9]{18,}\.supabase\.co\b/i,
  },
];
const forbiddenPaths = [
  /^docs\/debug-archive(?:\/|$)/,
  /^docs\/internal(?:\/|$)/,
  /^docs\/roadmap\/(?!ROADMAP\.md$)/,
  /(^|\/)\.env(?:$|\.(?!example$))/,
  /^runtime(?:\/|$)/,
  /^logs(?:\/|$)/,
];

function git(args) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
}

function isPrivateIPv4(value) {
  const octets = value.split('.').map(Number);
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function findTextViolations(text, source) {
  const violations = [];
  for (const item of forbiddenTextPatterns) {
    if (item.pattern.test(text)) {
      violations.push(`${source}: ${item.name}`);
    }
  }
  const addresses = text.match(/(?<![A-Za-z0-9])(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?![A-Za-z0-9])/g) || [];
  if (addresses.some(isPrivateIPv4)) {
    violations.push(`${source}: private IPv4 address`);
  }
  return violations;
}

const trackedIgnored = git(['ls-files', '-ci', '--exclude-standard'])
  .split('\n')
  .filter(Boolean)
  .filter((file) => fs.existsSync(path.join(rootDir, file)));
const trackedIgnoredSet = new Set(trackedIgnored);
const files = git(['ls-files', '-co', '--exclude-standard', '-z'])
  .split('\0')
  .filter(Boolean)
  .filter((file) => fs.existsSync(path.join(rootDir, file)))
  .filter((file) => !trackedIgnoredSet.has(file));
const violations = [];

for (const file of files) {
  if (forbiddenPaths.some((pattern) => pattern.test(file))) {
    violations.push(`${file}: forbidden release path`);
    continue;
  }
  const content = fs.readFileSync(path.join(rootDir, file));
  if (content.includes(0)) {
    continue;
  }
  violations.push(...findTextViolations(content.toString('utf8'), file));
}

for (const file of trackedIgnored) {
  violations.push(`${file}: tracked file is also ignored`);
}

if (process.env.YISTACK_PUBLIC_AUDIT_SKIP_HISTORY !== 'true') {
  const historyMetadata = git(['log', '--all', '--format=%an%n%ae%n%cn%n%ce%n%B']);
  violations.push(...findTextViolations(historyMetadata, 'git history metadata'));
  const historyPatch = git(['log', '--all', '--patch', '--no-color', '--no-ext-diff', '--unified=0']);
  violations.push(...findTextViolations(historyPatch, 'git history content'));
}

const uniqueViolations = [...new Set(violations)].sort();
if (uniqueViolations.length > 0) {
  console.error('[release-audit] blocked:');
  for (const violation of uniqueViolations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`[release-audit] privacy boundary valid (${files.length} publishable files checked).`);
