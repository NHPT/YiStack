#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(scriptDir, '..');
const manifestPaths = [
  'docs/contracts/capability/skill-contract.example.json',
  'docs/contracts/capability/mcp-contract.example.json',
];
const httpProtocolExamples = [
  {
    path: 'docs/contracts/capability/mcp-http-protocol.example.json',
    provider: 'mcp',
  },
  {
    path: 'docs/contracts/capability/skill-http-protocol.example.json',
    provider: 'skill',
  },
];
const allowedStatuses = new Set(['executed', 'skipped', 'blocked']);
const allowedProviderResolutionStatuses = new Set(['resolved', 'skipped', 'blocked']);

const failures = [];

function pushFailure(filePath, message) {
  failures.push(`${filePath}: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateMetadata(filePath, pathLabel, value) {
  if (value === undefined) {
    return;
  }
  if (!isPlainObject(value)) {
    pushFailure(filePath, `${pathLabel}.metadata must be an object when present`);
  }
}

function validateArtifact(filePath, capabilityID, artifact, index) {
  const pathLabel = `capabilities.${capabilityID}.artifacts[${index}]`;
  if (!isPlainObject(artifact)) {
    pushFailure(filePath, `${pathLabel} must be an object`);
    return;
  }
  for (const key of ['id', 'type', 'name', 'source_note']) {
    if (!nonEmptyString(artifact[key])) {
      pushFailure(filePath, `${pathLabel}.${key} must be a non-empty string`);
    }
  }
  if (artifact.uri !== undefined && typeof artifact.uri !== 'string') {
    pushFailure(filePath, `${pathLabel}.uri must be a string when present`);
  }
  validateMetadata(filePath, pathLabel, artifact.metadata);
}

function validateCapabilityResult(filePath, pathLabel, capability) {
  if (!isPlainObject(capability)) {
    pushFailure(filePath, `${pathLabel} must be an object`);
    return;
  }
  if (!allowedStatuses.has(String(capability.status || '').trim())) {
    pushFailure(filePath, `${pathLabel}.status must be one of: ${Array.from(allowedStatuses).join(', ')}`);
  }
  for (const key of ['reason_code', 'source_note']) {
    if (!nonEmptyString(capability[key])) {
      pushFailure(filePath, `${pathLabel}.${key} must be a non-empty string`);
    }
  }
  validateMetadata(filePath, pathLabel, capability.metadata);
  if (capability.artifacts !== undefined) {
    if (!Array.isArray(capability.artifacts)) {
      pushFailure(filePath, `${pathLabel}.artifacts must be an array when present`);
    } else {
      capability.artifacts.forEach((artifact, index) => validateArtifact(filePath, pathLabel, artifact, index));
    }
  }
}

function validateHTTPProtocolMetadata(filePath, pathLabel, value, provider, runnerMode) {
  if (!isPlainObject(value)) {
    pushFailure(filePath, `${pathLabel}.metadata must be an object`);
    return;
  }
  if (value.provider !== provider) {
    pushFailure(filePath, `${pathLabel}.metadata.provider must be "${provider}"`);
  }
  if (value.runner_mode !== runnerMode) {
    pushFailure(filePath, `${pathLabel}.metadata.runner_mode must be "${runnerMode}"`);
  }
}

function validateHTTPProtocolArtifacts(filePath, response, provider, runnerMode) {
  if (response.artifacts === undefined) {
    return;
  }
  if (!Array.isArray(response.artifacts)) {
    return;
  }
  response.artifacts.forEach((artifact, index) => {
    if (!isPlainObject(artifact)) {
      return;
    }
    validateHTTPProtocolMetadata(filePath, `response.artifacts[${index}]`, artifact.metadata, provider, runnerMode);
  });
}

function validateCapability(filePath, capabilityID, capability) {
  if (!nonEmptyString(capabilityID)) {
    pushFailure(filePath, 'capability id must be a non-empty string');
  }
  validateCapabilityResult(filePath, `capabilities.${capabilityID}`, capability);
}

function validateManifest(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) {
    pushFailure(relativePath, 'manifest file is missing');
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    pushFailure(relativePath, `manifest must be valid JSON: ${error.message}`);
    return;
  }

  if (!isPlainObject(manifest)) {
    pushFailure(relativePath, 'manifest root must be an object');
    return;
  }
  if (!nonEmptyString(manifest.source_note)) {
    pushFailure(relativePath, 'source_note must be a non-empty string');
  }
  if (!isPlainObject(manifest.capabilities)) {
    pushFailure(relativePath, 'capabilities must be an object');
    return;
  }
  const entries = Object.entries(manifest.capabilities);
  if (entries.length === 0) {
    pushFailure(relativePath, 'capabilities must contain at least one capability');
  }
  for (const [capabilityID, capability] of entries) {
    validateCapability(relativePath, capabilityID, capability);
  }
}

function validateHTTPProtocolExample({ path: relativePath, provider }) {
  const filePath = path.join(rootDir, relativePath);
  const runnerMode = `${provider}-http`;
  if (!fs.existsSync(filePath)) {
    pushFailure(relativePath, `${provider} HTTP protocol example is missing`);
    return;
  }

  let protocol;
  try {
    protocol = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    pushFailure(relativePath, `protocol example must be valid JSON: ${error.message}`);
    return;
  }

  if (!isPlainObject(protocol)) {
    pushFailure(relativePath, 'protocol root must be an object');
    return;
  }
  if (!nonEmptyString(protocol.source_note)) {
    pushFailure(relativePath, 'source_note must be a non-empty string');
  }
  if (!isPlainObject(protocol.request)) {
    pushFailure(relativePath, 'request must be an object');
  } else {
    for (const key of [
      'capability_id',
      'capability_name',
      'capability_version',
      'capability_catalog_source',
      'provider',
      'provider_resolution_status',
      'reason_code',
      'source_note',
      'workflow_stage',
      'workflow_mode',
      'capability_profile',
      'project_id',
      'user_id',
    ]) {
      if (!nonEmptyString(protocol.request[key])) {
        pushFailure(relativePath, `request.${key} must be a non-empty string`);
      }
    }
    if (protocol.request.provider !== provider) {
      pushFailure(relativePath, `request.provider must be "${provider}"`);
    }
    if (!allowedProviderResolutionStatuses.has(String(protocol.request.provider_resolution_status || '').trim())) {
      pushFailure(
        relativePath,
        `request.provider_resolution_status must be one of: ${Array.from(allowedProviderResolutionStatuses).join(', ')}`,
      );
    }
    if (typeof protocol.request.required !== 'boolean') {
      pushFailure(relativePath, 'request.required must be a boolean');
    }
  }
  validateCapabilityResult(relativePath, 'response', protocol.response);
  if (isPlainObject(protocol.response)) {
    validateHTTPProtocolMetadata(relativePath, 'response', protocol.response.metadata, provider, runnerMode);
    validateHTTPProtocolArtifacts(relativePath, protocol.response, provider, runnerMode);
  }
}

for (const manifestPath of manifestPaths) {
  validateManifest(manifestPath);
}
for (const protocolExample of httpProtocolExamples) {
  validateHTTPProtocolExample(protocolExample);
}

if (failures.length > 0) {
  console.error('[YES] Capability contract validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[YES] Capability contracts valid.');
