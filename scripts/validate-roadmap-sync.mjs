#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(scriptDir, '..');
const publicRoadmapPath = path.join(rootDir, 'docs/roadmap/ROADMAP.md');

function readRequiredFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing required roadmap file: ${path.relative(rootDir, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

const failures = [];
const publicRoadmapContent = readRequiredFile(publicRoadmapPath);

if (!publicRoadmapContent.includes('公开仓库唯一的 roadmap 真源')) {
  failures.push('docs/roadmap/ROADMAP.md must declare itself as the only public roadmap source');
}

if (/docs\/internal(?:\/|$)/.test(publicRoadmapContent)) {
  failures.push('docs/roadmap/ROADMAP.md must not link to private development documents');
}

if (failures.length > 0) {
  console.error('[YES] Roadmap sync validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[YES] Roadmap sync valid.');
