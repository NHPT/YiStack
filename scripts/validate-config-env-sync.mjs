#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(scriptDir, '..');
const envExamplePath = path.join(rootDir, '.env.example');
const envPath = path.join(rootDir, '.env');
const envTemplatePattern = /^#?\s*(?<key>[A-Z][A-Z0-9_]+)=/;

const bootstrapEnvKeys = [
  'APP_DEBUG',
  'APP_ENV',
  'APP_HOST',
  'APP_PORT',
  'BACKEND_URL',
  'CONTAINER_PREVIEW_BIND_HOST',
  'CONTAINER_PREVIEW_PORT',
  'CONTAINER_PREVIEW_URL',
  'CORS_ALLOWED_HEADERS',
  'CORS_ALLOWED_METHODS',
  'CORS_ALLOWED_ORIGINS',
  'CORS_EXPOSED_HEADERS',
  'CORS_MAX_AGE',
  'DB_AUTO_MIGRATE',
  'DB_TYPE',
  'DEPLOYMENT_SECRET_ENCRYPTION_KEY',
  'FRONTEND_HOST',
  'FRONTEND_PORT',
  'GITHUB_API_BASE_URL',
  'GITHUB_OAUTH_CALLBACK_URL',
  'GITHUB_OAUTH_CLIENT_ID',
  'GITHUB_OAUTH_CLIENT_SECRET',
  'GITHUB_TOKEN_ENCRYPTION_KEY',
  'GITHUB_WEBHOOK_SECRET',
  'GITHUB_WEBHOOK_URL',
  'GITHUB_WEB_BASE_URL',
  'JWT_EXPIRY',
  'JWT_SECRET',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_PREVIEW_GATEWAY_URL',
  'REFRESH_TOKEN_EXPIRY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_DB_REGION',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
  'VERCEL_ACCESS_TOKEN',
  'VERCEL_API_BASE_URL',
  'VERCEL_TEAM_ID',
];

const optionalBootstrapEnvKeys = new Set([
  'DB_AUTO_MIGRATE',
  'GITHUB_API_BASE_URL',
  'GITHUB_OAUTH_CALLBACK_URL',
  'GITHUB_OAUTH_CLIENT_ID',
  'GITHUB_OAUTH_CLIENT_SECRET',
  'GITHUB_TOKEN_ENCRYPTION_KEY',
  'GITHUB_WEBHOOK_SECRET',
  'GITHUB_WEBHOOK_URL',
  'GITHUB_WEB_BASE_URL',

  'DEPLOYMENT_SECRET_ENCRYPTION_KEY',
  'VERCEL_ACCESS_TOKEN',
  'VERCEL_API_BASE_URL',
  'VERCEL_TEAM_ID',
]);
const runtimeEnvKeyPrefixes = [
  'CAPABILITY_',
  'DEEPSEEK_',
  'DOUBAO_',
  'KIMI_',
  'LLM_',
  'OLLAMA_',
  'OPENAI_',
  'OPENROUTER_',
  'PROJECT_',
  'QWEN_',
  'SYSTEM_',
];

const runtimeEnvKeys = [
  'CONTAINER_APT_MIRROR',
  'CONTAINER_APT_MIRROR_CANDIDATES',
  'CONTAINER_DATA_DIR',
  'CONTAINER_DEFAULT_CPU',
  'CONTAINER_DEFAULT_DISK',
  'CONTAINER_DEFAULT_MEMORY',
  'CONTAINER_ENABLED',
  'CONTAINER_IDLE_TIMEOUT_MIN',
  'CONTAINER_PORT_RANGE_END',
  'CONTAINER_PORT_RANGE_START',
  'CONTAINER_PROJECT_DIR',
  'CONTAINER_RUNTIME',
  'CONTAINER_SOCKET_PATH',
  'CONTAINER_TEMPLATE_DIR',
];

function readRequiredFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing required config file: ${path.relative(rootDir, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function parseEnvKeys(content) {
  const keys = new Set();
  for (const line of content.split('\n')) {
    const match = envTemplatePattern.exec(line.trim());
    if (match) {
      keys.add(match.groups.key);
    }
  }
  return [...keys].sort();
}

function isRuntimeEnvKey(key) {
  if (runtimeEnvKeys.includes(key)) {
    return true;
  }
  for (const prefix of runtimeEnvKeyPrefixes) {
    if (key.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

const envExampleKeys = parseEnvKeys(readRequiredFile(envExamplePath));
const envKeys = fs.existsSync(envPath) ? parseEnvKeys(fs.readFileSync(envPath, 'utf8')) : [];
const bootstrapKeySet = new Set(bootstrapEnvKeys);
const failures = [];

for (const key of bootstrapEnvKeys) {
  if (!envExampleKeys.includes(key)) {
    failures.push(`.env.example is missing bootstrap key ${key}`);
  }
}

for (const key of envExampleKeys) {
  if (!bootstrapKeySet.has(key)) {
    failures.push(`.env.example must not expose non-bootstrap key ${key}; move it to Admin Config, LLM Provider storage or another DB-backed control plane`);
  }
  if (isRuntimeEnvKey(key)) {
    failures.push(`.env.example must not expose runtime policy key ${key}; runtime policy belongs to DB-backed admin configuration`);
  }
}

if (envKeys.length > 0) {
  for (const key of envExampleKeys) {
    if (!optionalBootstrapEnvKeys.has(key) && !envKeys.includes(key)) {
      failures.push(`.env.example key ${key} is not present in the local .env bootstrap key set`);
    }
  }
}

if (failures.length > 0) {
  console.error('[YES] Config env boundary validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[YES] Config env boundary valid: .env.example only exposes bootstrap configuration.');
