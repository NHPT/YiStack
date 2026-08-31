#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(scriptDir, '..');
const roadmapTableFiles = [
  'docs/roadmap/ROADMAP.md',
];

function readRequiredFile(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing required roadmap file: ${relativePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function splitMarkdownTableRow(line) {
  const columns = [];
  let current = '';
  for (let index = 1; index < line.length - 1; index += 1) {
    const char = line[index];
    const previousChar = line[index - 1];
    if (char === '|' && previousChar !== '\\') {
      columns.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  columns.push(current.trim());
  return columns;
}

function isMarkdownTableSeparator(line) {
  const columns = splitMarkdownTableRow(line);
  return columns.length > 0 && columns.every((column) => /^:?-{3,}:?$/.test(column));
}

function validateTableBlock(relativePath, blockLines, startLine) {
  const failures = [];
  if (blockLines.length < 2) {
    failures.push(`${relativePath}:${startLine} table block must include a header and separator row`);
    return failures;
  }

  const expectedColumnCount = splitMarkdownTableRow(blockLines[0]).length;
  if (expectedColumnCount === 0) {
    failures.push(`${relativePath}:${startLine} table header must contain columns`);
  }

  if (!isMarkdownTableSeparator(blockLines[1])) {
    failures.push(`${relativePath}:${startLine + 1} table separator row is missing or malformed`);
  }

  blockLines.forEach((line, index) => {
    const lineNumber = startLine + index;
    if (!line.startsWith('|') || !line.endsWith('|')) {
      failures.push(`${relativePath}:${lineNumber} table row must start and end with "|"`);
      return;
    }
    const columnCount = splitMarkdownTableRow(line).length;
    if (columnCount !== expectedColumnCount) {
      failures.push(`${relativePath}:${lineNumber} expected ${expectedColumnCount} columns, got ${columnCount}`);
    }
  });

  return failures;
}

function validateRoadmapTableFormat(relativePath, content) {
  const failures = [];
  const lines = content.split('\n');
  let tableLines = [];
  let tableStartLine = 0;

  function flushTable() {
    if (tableLines.length > 0) {
      failures.push(...validateTableBlock(relativePath, tableLines, tableStartLine));
      tableLines = [];
      tableStartLine = 0;
    }
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (line.startsWith('|')) {
      if (tableLines.length === 0) {
        tableStartLine = lineNumber;
      }
      tableLines.push(line);
      return;
    }

    if (tableLines.length > 0 && line.trim() !== '' && !line.startsWith('#')) {
      failures.push(`${relativePath}:${lineNumber} non-table line appears inside a markdown table block`);
    }
    flushTable();
  });
  flushTable();

  return failures;
}

const failures = [];
for (const relativePath of roadmapTableFiles) {
  failures.push(...validateRoadmapTableFormat(relativePath, readRequiredFile(relativePath)));
}

if (failures.length > 0) {
  console.error('[YES] Roadmap table format validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[YES] Roadmap table format valid.');
