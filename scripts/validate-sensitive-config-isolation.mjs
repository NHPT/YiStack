#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(scriptDir, '..');

const forbiddenEnvKeys = [
  'DEEPSEEK_API_KEY',
  'DOUBAO_API_KEY',
  'KIMI_API_KEY',
  'OPENAI_API_KEY',
  'OPENROUTER_API_KEY',
  'PROJECT_BACKUP_REMOTE_ACCESS_KEY_ID',
  'PROJECT_BACKUP_REMOTE_SECRET_ACCESS_KEY',
  'PROJECT_RESOURCE_ALERT_NOTIFICATION_WEBHOOK_URL',
  'QWEN_API_KEY',
];

const forbiddenSystemConfigKeys = [
  'llm.api_key',
  'llm.provider_api_key',
  'project.backup_remote_access_key_id',
  'project.backup_remote_secret_access_key',
  'project.resource_alert_notification_webhook_url',
  'system.jwt_secret',
];

const forbiddenSystemConfigKeyFragments = [
  'access_key',
  'api_key',
  'client_secret',
  'password',
  'private_key',
  'secret',
  'token',
  'webhook_url',
];

const sensitiveBootstrapPlaceholders = [
  'GITHUB_OAUTH_CLIENT_SECRET',
  'DEPLOYMENT_SECRET_ENCRYPTION_KEY',
  'GITHUB_TOKEN_ENCRYPTION_KEY',
  'GITHUB_WEBHOOK_SECRET',
  'JWT_SECRET',
  'VERCEL_ACCESS_TOKEN',
];

function readRequiredFile(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing required file: ${relativePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function collectGoSystemConfigKeys(content) {
  const keys = [];
  const entryPattern = /Key:\s*"([^"]+)"/g;
  for (const match of content.matchAll(entryPattern)) {
    keys.push(match[1]);
  }
  return keys;
}

function collectSQLSystemConfigKeys(content) {
  const keys = [];
  const insertPattern = /INSERT\s+INTO\s+public\.system_config\s*\(\s*key\s*,\s*value\s*,\s*value_type\s*,\s*description\s*\)\s*VALUES([\s\S]*?)(?:ON\s+CONFLICT|;)/gi;
  for (const insertMatch of content.matchAll(insertPattern)) {
    const valuesBlock = insertMatch[1];
    const tupleKeyPattern = /\(\s*'((?:''|[^'])+)'/g;
    for (const keyMatch of valuesBlock.matchAll(tupleKeyPattern)) {
      keys.push(keyMatch[1].replaceAll("''", "'"));
    }
  }
  return keys;
}

function isSensitiveSystemConfigKey(key) {
  const normalizedKey = key.trim().toLowerCase();
  if (forbiddenSystemConfigKeys.includes(normalizedKey)) {
    return true;
  }
  for (const fragment of forbiddenSystemConfigKeyFragments) {
    if (normalizedKey.includes(fragment)) {
      return true;
    }
  }
  return false;
}

function assertIncludes(content, snippet, message, failures) {
  if (!content.includes(snippet)) {
    failures.push(message);
  }
}

function assertNotIncludes(content, snippet, message, failures) {
  if (content.includes(snippet)) {
    failures.push(message);
  }
}

function extractGoStruct(content, structName) {
  const pattern = new RegExp(`type ${structName} struct \\{([\\s\\S]*?)\\n\\}`);
  const match = pattern.exec(content);
  if (match === null) {
    throw new Error(`missing Go struct: ${structName}`);
  }
  return match[1];
}

const failures = [];
const envExample = readRequiredFile('.env.example');
const backendConfig = readRequiredFile('backend/config/config.go');
const modelsGo = readRequiredFile('backend/internal/model/models.go');
const initSQL = readRequiredFile('backend/init.sql');
const systemConfigRuntime = readRequiredFile('backend/internal/service/system_config_runtime.go');
const systemConfigService = readRequiredFile('backend/internal/service/service.go');
const adminConfigService = readRequiredFile('backend/internal/service/admin_console_config_service.go');
const projectService = readRequiredFile('backend/internal/service/project_service.go');
const projectBackupService = readRequiredFile('backend/internal/service/project_backup_service.go');
const projectResourceMonitoringService = readRequiredFile('backend/internal/service/project_resource_monitoring_service.go');
const validationLayer = readRequiredFile('docs/engineering/VALIDATION_LAYER.md');

for (const key of forbiddenEnvKeys) {
  if (envExample.includes(`${key}=`)) {
    failures.push(`.env.example must not expose sensitive runtime env key ${key}`);
  }
}

for (const key of sensitiveBootstrapPlaceholders) {
  const line = envExample.split('\n').find((entry) => entry.startsWith(`${key}=`));
  if (line === undefined) {
    failures.push(`.env.example is missing sensitive bootstrap placeholder ${key}`);
  } else if (line !== `${key}=`) {
    failures.push(`.env.example must keep ${key} empty`);
  }
}

const systemConfigSeedSources = [
  ['backend/internal/model/models.go', collectGoSystemConfigKeys(modelsGo)],
  ['backend/init.sql', collectSQLSystemConfigKeys(initSQL)],
];

for (const [source, keys] of systemConfigSeedSources) {
  for (const key of keys) {
    if (isSensitiveSystemConfigKey(key)) {
      failures.push(`${source} must not seed sensitive system_config key ${key}`);
    }
  }
}

const projectConfigStruct = extractGoStruct(backendConfig, 'ProjectConfig');
const projectSecretConfigStruct = extractGoStruct(backendConfig, 'ProjectSecretConfig');
assertNotIncludes(
  projectConfigStruct,
  'RemoteBackupAccessKeyID',
  'ProjectConfig must not carry remote backup access key id',
  failures,
);
assertNotIncludes(
  projectConfigStruct,
  'RemoteBackupSecretAccessKey',
  'ProjectConfig must not carry remote backup secret access key',
  failures,
);
assertNotIncludes(
  projectConfigStruct,
  'ResourceAlertNotificationWebhookURL',
  'ProjectConfig must not carry resource alert webhook URL',
  failures,
);
if (!/ProjectSecrets\s+ProjectSecretConfig\s+`json:"-"`/.test(backendConfig)) {
  failures.push('Config should expose ProjectSecrets through json:"-" only');
}
assertIncludes(
  projectSecretConfigStruct,
  'RemoteBackupAccessKeyID             string',
  'ProjectSecretConfig should carry remote backup access key id inside the secret boundary',
  failures,
);
assertIncludes(
  projectSecretConfigStruct,
  'RemoteBackupSecretAccessKey         string',
  'ProjectSecretConfig should carry remote backup secret access key inside the secret boundary',
  failures,
);
assertIncludes(
  projectSecretConfigStruct,
  'ResourceAlertNotificationWebhookURL string',
  'ProjectSecretConfig should carry resource alert webhook URL inside the secret boundary',
  failures,
);
assertIncludes(
  projectService,
  'ProjectSecretCfg       *config.ProjectSecretConfig',
  'ProjectServiceOptions should accept ProjectSecretCfg as an explicit secret dependency',
  failures,
);
assertIncludes(
  projectBackupService,
  'func (s *ProjectService) projectSecretConfig() config.ProjectSecretConfig',
  'ProjectService should expose a single projectSecretConfig secret boundary reader',
  failures,
);
assertIncludes(
  projectBackupService,
  'secretCfg.RemoteBackupAccessKeyID',
  'remote backup service should read access key through projectSecretConfig',
  failures,
);
assertIncludes(
  projectBackupService,
  'secretCfg.RemoteBackupSecretAccessKey',
  'remote backup service should read secret access key through projectSecretConfig',
  failures,
);
assertIncludes(
  projectResourceMonitoringService,
  'secretCfg.ResourceAlertNotificationWebhookURL',
  'resource alert notification service should read webhook URL through projectSecretConfig',
  failures,
);
assertNotIncludes(
  projectBackupService,
  'projectCfg.RemoteBackupAccessKeyID',
  'remote backup service must not read access key from ProjectConfig',
  failures,
);
assertNotIncludes(
  projectBackupService,
  'projectCfg.RemoteBackupSecretAccessKey',
  'remote backup service must not read secret access key from ProjectConfig',
  failures,
);
assertNotIncludes(
  projectResourceMonitoringService,
  'projectCfg.ResourceAlertNotificationWebhookURL',
  'resource alert notification service must not read webhook URL from ProjectConfig',
  failures,
);
assertIncludes(
  systemConfigRuntime,
  'func IsSensitiveSystemConfigKey(key string) bool',
  'system_config runtime should expose IsSensitiveSystemConfigKey',
  failures,
);
assertIncludes(
  systemConfigRuntime,
  'if IsSensitiveSystemConfigKey(cfg.Key) {',
  'visible config filtering should hide sensitive system_config keys',
  failures,
);
assertIncludes(
  systemConfigService,
  'if IsSensitiveSystemConfigKey(key) {',
  'SystemConfigService.SetConfig should reject sensitive system_config writes',
  failures,
);
assertIncludes(
  adminConfigService,
  '敏感配置必须通过受控 Secret Storage 维护',
  'Admin Config update should return a clear Chinese sensitive-config error',
  failures,
);
assertIncludes(
  validationLayer,
  '敏感配置隔离门禁',
  'Validation Layer should document the sensitive config isolation gate',
  failures,
);

if (failures.length > 0) {
  console.error('[YES] Sensitive config isolation validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[YES] Sensitive config isolation valid.');
