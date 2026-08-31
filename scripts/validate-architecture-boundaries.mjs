#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(scriptDir, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendProxyPath = path.join(rootDir, 'src/proxy.ts');
const deprecatedMiddlewarePath = path.join(rootDir, 'src/middleware.ts');

const rules = [
  {
    sourcePrefix: 'backend/internal/handler/',
    forbiddenImports: ['yistack/internal/repository'],
    reason: 'handler must not bypass service by importing repository directly',
  },
  {
    sourcePrefix: 'backend/internal/service/',
    forbiddenImports: ['yistack/internal/handler'],
    reason: 'service must not depend on handler',
  },
  {
    sourcePrefix: 'backend/internal/repository/',
    forbiddenImports: [
      'yistack/internal/handler',
      'yistack/internal/service',
      'yistack/internal/orchestration',
      'yistack/pkg/container',
      'yistack/pkg/file',
    ],
    reason: 'repository must stay persistence-focused and avoid orchestration/runtime dependencies',
  },
  {
    sourcePrefix: 'backend/pkg/',
    forbiddenImports: [
      'yistack/internal/handler',
      'yistack/internal/service',
      'yistack/internal/repository',
      'yistack/internal/orchestration',
    ],
    reason: 'pkg must remain a reusable technical layer and avoid depending on upper internal layers',
  },
];

function walkGoFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkGoFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.go')) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseGoImports(content) {
  const imports = [];
  const blockImportPattern = /import\s*\((?<body>[\s\S]*?)\)/gm;
  const singleImportPattern = /import\s+(?:\w+\s+|[._]\s+)?(?<path>"[^"]+")/gm;
  let blockMatch;
  while ((blockMatch = blockImportPattern.exec(content)) !== null) {
    const body = blockMatch.groups.body;
    for (const line of body.split('\n')) {
      const importMatch = /(?:\w+\s+|[._]\s+)?(?<path>"[^"]+")/.exec(line.trim());
      if (importMatch) {
        imports.push(importMatch.groups.path.slice(1, -1));
      }
    }
  }
  let singleMatch;
  while ((singleMatch = singleImportPattern.exec(content)) !== null) {
    imports.push(singleMatch.groups.path.slice(1, -1));
  }
  return imports;
}

function relativePath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

const failures = [];
if (fs.existsSync(deprecatedMiddlewarePath)) {
  failures.push('src/middleware.ts exists: Next.js 16 auth boundary must use src/proxy.ts instead of deprecated middleware convention');
}

if (!fs.existsSync(frontendProxyPath)) {
  failures.push('src/proxy.ts is missing: protected /workspace and /projects auth boundary must use Next.js proxy convention');
} else {
  const proxyContent = fs.readFileSync(frontendProxyPath, 'utf8');
  const proxyChecks = [
    {
      pattern: /export\s+function\s+proxy\s*\(\s*request\s*:\s*NextRequest\s*\)/,
      reason: 'src/proxy.ts must export function proxy(request: NextRequest)',
    },
    {
      pattern: /NextResponse\.redirect\(loginUrl\)/,
      reason: 'src/proxy.ts must keep unauthenticated protected routes redirected through /auth',
    },
    {
      pattern: /matcher:\s*\[\s*['"]\/workspace\/:path\*['"]\s*,\s*['"]\/projects\/:path\*['"]\s*\]/,
      reason: 'src/proxy.ts must protect /workspace and /projects through config.matcher',
    },
    {
      pattern: /loginUrl\.searchParams\.set\(\s*['"]redirect['"]\s*,\s*`\$\{pathname\}\$\{search\}`\s*\)/,
      reason: 'src/proxy.ts must preserve pathname and search in the auth redirect parameter',
    },
  ];
  for (const check of proxyChecks) {
    if (!check.pattern.test(proxyContent)) {
      failures.push(check.reason);
    }
  }
}

for (const filePath of walkGoFiles(backendDir)) {
  const relativeFilePath = relativePath(filePath);
  const matchedRules = rules.filter((rule) => relativeFilePath.startsWith(rule.sourcePrefix));
  if (matchedRules.length === 0) {
    continue;
  }
  const imports = parseGoImports(fs.readFileSync(filePath, 'utf8'));
  for (const rule of matchedRules) {
    for (const importedPath of imports) {
      const forbiddenImport = rule.forbiddenImports.find((prefix) => importedPath === prefix || importedPath.startsWith(`${prefix}/`));
      if (forbiddenImport) {
        failures.push(`${relativeFilePath} imports ${importedPath}: ${rule.reason}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('[YES] Architecture boundary validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[YES] Architecture boundaries valid.');
