import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), '..');
const manifestPath = path.join(ROOT_DIR, 'docs/engineering/diagnostic-models.json');
const yesScriptPath = path.join(ROOT_DIR, 'scripts/validate-yes.sh');
const validationLayerPath = path.join(ROOT_DIR, 'docs/engineering/VALIDATION_LAYER.md');

function fail(message) {
  console.error(`[YES] Diagnostic model manifest invalid: ${message}`);
  process.exit(1);
}

function readText(relativePath) {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

function assertFile(relativePath, ownerId) {
  if (!relativePath || typeof relativePath !== 'string') {
    fail(`${ownerId} has an empty file path`);
  }
  if (path.isAbsolute(relativePath) || relativePath.includes('..')) {
    fail(`${ownerId} uses a non-project-relative file path: ${relativePath}`);
  }
  if (!existsSync(path.join(ROOT_DIR, relativePath))) {
    fail(`${ownerId} references missing file: ${relativePath}`);
  }
}

function assertNonEmptyString(value, field, ownerId) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${ownerId} has empty ${field}`);
  }
}

function assertNonEmptyStringArray(value, field, ownerId) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${ownerId} must register at least one ${field}`);
  }
  for (const item of value) {
    assertNonEmptyString(item, field, ownerId);
  }
}

function assertOptionalStringArray(value, field, ownerId) {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    fail(`${ownerId} ${field} must be an array when present`);
  }
  for (const item of value) {
    assertNonEmptyString(item, field, ownerId);
  }
}

function stripKnownExtension(relativePath) {
  return relativePath.replace(/\.(ts|tsx|mjs|js|json|go|md)$/, '');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const yesScript = readFileSync(yesScriptPath, 'utf8');
const validationLayer = readFileSync(validationLayerPath, 'utf8');
const yesLines = yesScript.split('\n');

if (manifest.version !== 1) {
  fail(`unsupported manifest version: ${manifest.version}`);
}

if (!Array.isArray(manifest.models) || manifest.models.length === 0) {
  fail('models must be a non-empty array');
}

const ids = new Set();
const validationScripts = new Set();
const yesLabels = new Set();

for (const model of manifest.models) {
  assertNonEmptyString(model.id, 'id', 'diagnostic model');
  assertNonEmptyString(model.title, 'title', model.id);
  assertNonEmptyString(model.input, 'input', model.id);
  assertNonEmptyString(model.validationScript, 'validationScript', model.id);
  assertNonEmptyString(model.yesLabel, 'yesLabel', model.id);
  assertNonEmptyString(model.readonlyBoundary, 'readonlyBoundary', model.id);
  assertNonEmptyStringArray(model.validationLayerKeywords, 'validationLayerKeywords', model.id);
  assertOptionalStringArray(model.urlStateParams, 'urlStateParams', model.id);
  assertNonEmptyStringArray(model.readonlyEvidenceKeywords, 'readonlyEvidenceKeywords', model.id);

  if (ids.has(model.id)) {
    fail(`duplicate model id: ${model.id}`);
  }
  ids.add(model.id);
  validationScripts.add(model.validationScript);
  yesLabels.add(model.yesLabel);

  if (!Array.isArray(model.modelFiles) || model.modelFiles.length === 0) {
    fail(`${model.id} must register at least one model file`);
  }
  if (!Array.isArray(model.displayFiles) || model.displayFiles.length === 0) {
    fail(`${model.id} must register at least one display file`);
  }

  for (const file of model.modelFiles) {
    assertFile(file, model.id);
  }
  for (const file of model.displayFiles) {
    assertFile(file, model.id);
  }
  assertFile(model.validationScript, model.id);

  if (!yesScript.includes(model.yesLabel)) {
    fail(`${model.id} yesLabel is not present in scripts/validate-yes.sh`);
  }
  if (!yesScript.includes(model.validationScript)) {
    fail(`${model.id} validationScript is not executed by scripts/validate-yes.sh`);
  }
  for (const keyword of model.validationLayerKeywords) {
    if (!validationLayer.includes(keyword)) {
      fail(`${model.id} validationLayerKeyword is not present in VALIDATION_LAYER.md: ${keyword}`);
    }
  }

  const validationScript = readText(model.validationScript);
  if (!validationScript.includes('validation passed')) {
    fail(`${model.id} validation script should print a validation passed marker`);
  }
  for (const file of model.modelFiles) {
    const fileToken = stripKnownExtension(file);
    if (!validationScript.includes(file) && !validationScript.includes(fileToken)) {
      fail(`${model.id} validation script does not reference registered model file: ${file}`);
    }
  }
  for (const file of model.displayFiles) {
    const fileToken = stripKnownExtension(file);
    if (!validationScript.includes(file) && !validationScript.includes(fileToken)) {
      fail(`${model.id} validation script does not reference registered display file: ${file}`);
    }
  }

  const modelEvidence = [
    ...model.modelFiles.map(readText),
    ...model.displayFiles.map(readText),
    validationScript,
  ].join('\n');
  const displayEvidence = model.displayFiles.map(readText).join('\n');
  for (const keyword of model.readonlyEvidenceKeywords) {
    if (!displayEvidence.includes(keyword)) {
      fail(`${model.id} readonlyEvidenceKeyword is not present in registered display files: ${keyword}`);
    }
  }
  for (const param of model.urlStateParams ?? []) {
    if (!modelEvidence.includes(param)) {
      fail(`${model.id} urlStateParam is not present in model/display/validation evidence: ${param}`);
    }
    if (!validationLayer.includes(param)) {
      fail(`${model.id} urlStateParam is not present in VALIDATION_LAYER.md: ${param}`);
    }
  }
}

for (let index = 0; index < yesLines.length; index += 1) {
  const labelMatch = yesLines[index].match(/echo "(\[YES\] Checking (?:admin capability preflight model|.*diagnostics model|admin dashboard diagnostics layout)\.\.\.)"/);
  if (!labelMatch) {
    continue;
  }

  const yesLabel = labelMatch[1];
  const scriptWindow = yesLines.slice(index + 1, index + 6).join('\n');
  const scriptMatch = scriptWindow.match(/scripts\/[^"\s]+\.(?:ts|mjs)/);
  if (!scriptMatch) {
    fail(`could not find validation script for YES diagnostic label: ${yesLabel}`);
  }

  const validationScript = scriptMatch[0];
  if (!yesLabels.has(yesLabel)) {
    fail(`YES diagnostic label is not registered in diagnostic-models.json: ${yesLabel}`);
  }
  if (!validationScripts.has(validationScript)) {
    fail(`YES diagnostic validation script is not registered in diagnostic-models.json: ${validationScript}`);
  }
}

console.log('[YES] Diagnostic model manifest valid.');
