#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(scriptDir, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const validationLayer = readProjectFile('docs/engineering/VALIDATION_LAYER.md');
const validateYes = readProjectFile('scripts/validate-yes.sh');

function getExecutableValidationLayerSection() {
  const startMarker = '## 4. 当前可执行入口';
  const endMarker = '## 5. 当前尚未自动化的验证';
  const startIndex = validationLayer.indexOf(startMarker);
  const endIndex = validationLayer.indexOf(endMarker);

  assert.notEqual(startIndex, -1, 'Validation Layer should keep the current executable entry section');
  assert.notEqual(endIndex, -1, 'Validation Layer should keep the not-yet-automated validation section');
  assert.ok(endIndex > startIndex, 'Validation Layer executable entry section should appear before future validation section');

  return validationLayer.slice(startIndex, endIndex);
}

function getDuplicateValidationLayerBullets() {
  const seen = new Map();
  const duplicates = [];

  const executableValidationLayerSection = getExecutableValidationLayerSection();
  const baseLineNumber = validationLayer.slice(0, validationLayer.indexOf(executableValidationLayerSection)).split(/\r?\n/).length;

  executableValidationLayerSection.split(/\r?\n/).forEach((line, index) => {
    if (!line.startsWith('- ')) {
      return;
    }

    const normalizedLine = line.replace(/\s+/g, ' ').trim();
    const firstLine = seen.get(normalizedLine);
    const lineNumber = baseLineNumber + index;

    if (firstLine !== undefined) {
      duplicates.push(`docs/engineering/VALIDATION_LAYER.md:${lineNumber} duplicates line ${firstLine}: ${normalizedLine}`);
      return;
    }

    seen.set(normalizedLine, lineNumber);
  });

  return duplicates;
}

const duplicateBullets = getDuplicateValidationLayerBullets();
if (duplicateBullets.length > 0) {
  console.error('[YES] Validation Layer consistency validation failed:');
  for (const duplicateBullet of duplicateBullets) {
    console.error(`- ${duplicateBullet}`);
  }
  process.exit(1);
}

assert.match(
  validateYes,
  /Checking validation layer consistency[\s\S]*validate-validation-layer-consistency\.mjs/,
  'validate-yes should execute the validation layer consistency check',
);
assert.match(
  validationLayer,
  /Validation Layer 文档一致性校验[\s\S]*validate-validation-layer-consistency\.mjs[\s\S]*重复 bullet/,
  'Validation Layer should document its duplicate-rule consistency guard',
);

console.log('[YES] Validation Layer consistency validation passed.');
