#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(scriptDir, '..');
const goDefaultsPath = path.join(rootDir, 'backend/internal/model/models.go');
const initSQLPath = path.join(rootDir, 'backend/init.sql');

const activePrefixes = [
  'prompt.',
  'template.',
  'container.',
  'system.',
  'project.',
  'capability.',
  'enterprise.sso.',
  'enterprise.audit.',
  'enterprise.project_access_guard.',
];

function readRequiredFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing required file: ${path.relative(rootDir, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function isActiveConfigKey(key) {
  return activePrefixes.some((prefix) => key.startsWith(prefix));
}

function decodeGoStringLiteral(literal) {
  if (literal.startsWith('`') && literal.endsWith('`')) {
    return literal.slice(1, -1);
  }

  return JSON.parse(literal);
}

function parseGoDefaults(content) {
  const defaultsMatch = content.match(/var DefaultSystemConfigs = \[\]SystemConfig\{([\s\S]*?)\n\}\n\n\/\/ GeneratedFile/);
  if (!defaultsMatch) {
    throw new Error('DefaultSystemConfigs block was not found in backend/internal/model/models.go');
  }

  const entries = new Map();
  const entryPattern = /\{\s*Key:\s*("(?:(?:\\.)|[^"\\])*")\s*,\s*Value:\s*(`[\s\S]*?`|"(?:(?:\\.)|[^"\\])*")\s*,\s*ValueType:\s*("(?:(?:\\.)|[^"\\])*")\s*,\s*Description:\s*("(?:(?:\\.)|[^"\\])*")\s*\}/g;

  for (const match of defaultsMatch[1].matchAll(entryPattern)) {
    const key = decodeGoStringLiteral(match[1]);
    if (!isActiveConfigKey(key)) {
      continue;
    }

    entries.set(key, {
      key,
      value: decodeGoStringLiteral(match[2]),
      value_type: decodeGoStringLiteral(match[3]),
      description: decodeGoStringLiteral(match[4]),
      source: 'backend/internal/model/models.go',
    });
  }

  return entries;
}

function parseSQLString(content, start) {
  if (content[start] === "'") {
    let cursor = start + 1;
    let value = '';

    while (cursor < content.length) {
      const char = content[cursor];
      if (char === "'") {
        if (content[cursor + 1] === "'") {
          value += "'";
          cursor += 2;
          continue;
        }
        return { value: value.replaceAll('\\n', '\n'), end: cursor + 1 };
      }
      value += char;
      cursor += 1;
    }

    throw new Error(`unterminated SQL single-quoted string at offset ${start}`);
  }

  if (content.startsWith('$$', start)) {
    const end = content.indexOf('$$', start + 2);
    if (end === -1) {
      throw new Error(`unterminated SQL dollar-quoted string at offset ${start}`);
    }
    return { value: content.slice(start + 2, end), end: end + 2 };
  }

  throw new Error(`expected SQL string literal at offset ${start}`);
}

function skipSQLWhitespace(content, start) {
  let cursor = start;
  while (cursor < content.length && /\s/.test(content[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function parseSQLTuple(content, start) {
  let cursor = skipSQLWhitespace(content, start);
  if (content[cursor] !== '(') {
    return null;
  }
  cursor += 1;

  const fields = [];
  for (let index = 0; index < 4; index += 1) {
    cursor = skipSQLWhitespace(content, cursor);
    const parsed = parseSQLString(content, cursor);
    fields.push(parsed.value);
    cursor = skipSQLWhitespace(content, parsed.end);

    if (index < 3) {
      if (content[cursor] !== ',') {
        throw new Error(`expected comma in SQL system_config tuple at offset ${cursor}`);
      }
      cursor += 1;
    }
  }

  cursor = skipSQLWhitespace(content, cursor);
  if (content[cursor] !== ')') {
    throw new Error(`expected closing parenthesis in SQL system_config tuple at offset ${cursor}`);
  }

  return {
    record: {
      key: fields[0],
      value: fields[1],
      value_type: fields[2],
      description: fields[3],
    },
    end: cursor + 1,
  };
}

function extractValuesSection(content, insertOffset) {
  const valuesOffset = content.indexOf('VALUES', insertOffset);
  if (valuesOffset === -1) {
    throw new Error(`system_config INSERT at offset ${insertOffset} has no VALUES clause`);
  }

  const onConflictOffset = content.indexOf('ON CONFLICT', valuesOffset);
  const semicolonOffset = content.indexOf(';', valuesOffset);
  const end = onConflictOffset === -1 ? semicolonOffset : onConflictOffset;
  if (end === -1) {
    throw new Error(`system_config INSERT at offset ${insertOffset} has no statement terminator`);
  }

  return content.slice(valuesOffset + 'VALUES'.length, end);
}

function parseSQLSystemConfigSeeds(content, source) {
  const entries = new Map();
  const insertPattern = /INSERT\s+INTO\s+public\.system_config\s*\(\s*key\s*,\s*value\s*,\s*value_type\s*,\s*description\s*\)/gi;

  for (const match of content.matchAll(insertPattern)) {
    const valuesSection = extractValuesSection(content, match.index);
    let cursor = 0;

    while (cursor < valuesSection.length) {
      cursor = skipSQLWhitespace(valuesSection, cursor);
      if (valuesSection[cursor] === ',') {
        cursor += 1;
        continue;
      }
      if (cursor >= valuesSection.length) {
        break;
      }

      const tuple = parseSQLTuple(valuesSection, cursor);
      if (!tuple) {
        throw new Error(`expected system_config VALUES tuple in ${source} at values offset ${cursor}`);
      }
      cursor = tuple.end;

      if (!isActiveConfigKey(tuple.record.key)) {
        continue;
      }

      entries.set(tuple.record.key, {
        ...tuple.record,
        source,
      });
    }
  }

  return entries;
}

function pushDuplicateFailures(failures, entries, label) {
  const seen = new Set();
  for (const key of entries.keys()) {
    if (seen.has(key)) {
      failures.push(`${label} contains duplicate active system_config key: ${key}`);
    }
    seen.add(key);
  }
}

function compareKeySets(failures, expected, actual, actualLabel) {
  for (const key of expected.keys()) {
    if (!actual.has(key)) {
      failures.push(`${actualLabel} is missing active system_config key: ${key}`);
    }
  }

  for (const key of actual.keys()) {
    if (!expected.has(key)) {
      failures.push(`${actualLabel} contains active system_config key not present in DefaultSystemConfigs: ${key}`);
    }
  }
}

function compareRecords(failures, expected, actual, actualLabel) {
  for (const [key, expectedRecord] of expected.entries()) {
    const actualRecord = actual.get(key);
    if (!actualRecord) {
      continue;
    }

    for (const field of ['value', 'value_type', 'description']) {
      if (expectedRecord[field] !== actualRecord[field]) {
        failures.push(`${actualLabel} drift for ${key}.${field}: expected ${JSON.stringify(expectedRecord[field])}, got ${JSON.stringify(actualRecord[field])}`);
      }
    }
  }
}

function main() {
  const failures = [];
  const goDefaults = parseGoDefaults(readRequiredFile(goDefaultsPath));
  const initSeeds = parseSQLSystemConfigSeeds(readRequiredFile(initSQLPath), 'backend/init.sql');

  pushDuplicateFailures(failures, goDefaults, 'DefaultSystemConfigs');
  pushDuplicateFailures(failures, initSeeds, 'backend/init.sql');

  compareKeySets(failures, goDefaults, initSeeds, 'backend/init.sql');
  compareRecords(failures, goDefaults, initSeeds, 'backend/init.sql');

  if (failures.length > 0) {
    console.error('[YES] system_config seed sync validation failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`[YES] system_config seed sync valid for active prefixes: ${activePrefixes.join(', ')}`);
}

main();
