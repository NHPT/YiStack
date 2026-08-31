import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const config = read("backend/config/config.go");
const models = read("backend/internal/model/models.go");
const initSQL = read("backend/init.sql");
const crypto = read("backend/internal/service/github_integration_crypto.go");
const integration = read("backend/internal/service/github_integration_service.go");
const sync = read("backend/internal/service/github_sync_service.go");
const webhook = read("backend/internal/service/github_webhook_service.go");
const repository = read("backend/internal/repository/github_integration_repository.go");
const containerTypes = read("backend/pkg/container/types.go");
const containerRuntime = read("backend/pkg/container/podman.go");
const handler = read("backend/internal/handler/github_integration_handler.go");
const routes = read("backend/cmd/server/main.go");
const proxy = read("src/app/api/_utils/backend-proxy.ts");
const webhookProxy = read("src/app/api/github/webhook/route.ts");
const client = read("src/lib/github-api.ts");
const page = read("src/app/projects/[id]/github/page.tsx");
const tests = read("backend/internal/service/github_integration_service_test.go");

assert.match(config, /GitHub\s+GitHubIntegrationConfig\s+`json:"-"`/);
for (const key of [
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "GITHUB_OAUTH_CALLBACK_URL",
  "GITHUB_TOKEN_ENCRYPTION_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "GITHUB_WEBHOOK_URL",
]) {
  assert.ok(config.includes(key), `backend config missing ${key}`);
}

assert.match(crypto, /aes\.NewCipher/);
assert.match(crypto, /cipher\.NewGCM/);
assert.match(crypto, /githubTokenKeyVersion\s*=\s*"v1"/);
assert.match(integration, /githubSHA256\(state\)/);
assert.match(integration, /code_challenge_method/);
assert.match(integration, /githubPKCEChallenge\(verifier\)/);
assert.match(integration, /revokeOAuthToken/);
assert.match(integration, /req\.SetBasicAuth\(clientID, clientSecret\)/);

for (const table of [
  "github_connections",
  "github_oauth_states",
  "github_project_bindings",
  "github_sync_operations",
  "github_webhook_deliveries",
]) {
  assert.ok(initSQL.includes(table), `init.sql missing ${table}`);
}
assert.match(initSQL, /UNIQUE\s*\(user_id,\s*idempotency_key\)/i);
assert.match(initSQL, /delivery_id\s+(?:varchar|character varying)\(255\)\s+PRIMARY KEY/i);
assert.match(models, /TokenCiphertext\s+string[^\n]*json:"-"/);
assert.match(models, /TokenNonce\s+string[^\n]*json:"-"/);
assert.match(containerTypes, /Env\s+\[\]string\s+`json:"-"`/);
assert.match(containerRuntime, /Env:\s+opts\.Env/);

assert.match(sync, /GIT_TERMINAL_PROMPT=0/);
assert.match(sync, /GIT_CONFIG_KEY_0=http\.extraHeader/);
assert.match(sync, /GIT_CONFIG_VALUE_0=Authorization: Bearer /);
assert.doesNotMatch(sync, /https:\/\/[^"\s]*@github\.com/);
assert.match(sync, /requireCleanWorktree/);
assert.match(sync, /github_sync_diverged/);
assert.match(sync, /merge", "--ff-only"/);
assert.match(sync, /github_force_push_confirmation_required/);
assert.match(sync, /github_force_push_stale_remote/);
assert.match(sync, /--force-with-lease=refs\/heads\//);
assert.match(sync, /executeIdempotentSync/);
assert.match(repository, /clause\.OnConflict/);
assert.match(repository, /DoNothing:\s+true/);

assert.match(webhook, /hmac\.New\(sha256\.New/);
assert.match(webhook, /hmac\.Equal/);
assert.match(webhook, /CreateWebhookDelivery/);
assert.match(webhook, /result\.Replayed = true/);
assert.doesNotMatch(webhook, /runGit|fetch|merge|reset/);

assert.match(handler, /githubWebhookMaxBodyBytes\s*=\s*1024 \* 1024/);
for (const route of [
  'api.GET("/github/oauth/callback"',
  'api.POST("/github/webhook"',
  'githubProtected.POST("/oauth/start"',
  'project.POST("/:id/github/import"',
  'project.POST("/:id/github/pull"',
  'project.POST("/:id/github/push"',
]) {
  assert.ok(routes.includes(route), `backend route missing ${route}`);
}
assert.match(proxy, /forwardHeaders\?: string\[\]/);
for (const header of ["X-GitHub-Delivery", "X-GitHub-Event", "X-Hub-Signature-256"]) {
  assert.ok(webhookProxy.includes(header), `webhook proxy missing ${header}`);
}
assert.match(client, /githubApi/);
assert.match(page, /confirmImport/);
assert.match(page, /confirmForcePush/);
assert.match(page, /expectedRemoteSHA/);

for (const testName of [
  "TestGitHubOAuthUsesPKCEHashedStateAndEncryptedToken",
  "TestGitHubDisconnectRevokesTokenBeforeDeletingConnection",
  "TestGitHubWebhookVerifiesSignatureAndRejectsReplay",
  "TestGitHubIdempotencyRejectsMismatchAndReplaysSuccess",
  "TestGitHubImportUsesEphemeralTokenAndInstallsWebhook",
  "TestGitHubForcePushUsesExpectedRemoteSHAWithLease",
]) {
  assert.ok(tests.includes(testName), `missing Go contract test ${testName}`);
}

process.stdout.write("PLATFORM-001 GitHub import and sync contract passed.\n");
