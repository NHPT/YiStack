import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const config=read('backend/config/config.go'); const models=read('backend/internal/model/deployment_models.go'); const sql=read('backend/init.sql');
const artifact=read('backend/internal/service/project_deployment_artifact.go'); const service=read('backend/internal/service/project_deployment_service.go'); const adapter=read('backend/internal/service/vercel_deployment_adapter.go');
const handler=read('backend/internal/handler/project_deployment_handler.go'); const routes=read('backend/cmd/server/main.go'); const tests=read('backend/internal/service/project_deployment_service_test.go'); const page=read('src/app/projects/[id]/deploy/page.tsx');
assert.match(config,/Deployment\s+DeploymentConfig\s+`json:"-"`/); for(const key of ['VERCEL_ACCESS_TOKEN','VERCEL_TEAM_ID','VERCEL_API_BASE_URL','DEPLOYMENT_SECRET_ENCRYPTION_KEY']) assert.ok(config.includes(key),`missing ${key}`);
for(const table of ['project_deployment_bindings','project_deployment_releases','project_deployment_domains','project_deployment_operations']) { assert.ok(sql.includes(table),`missing ${table}`); assert.match(sql,new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`)); assert.match(sql,new RegExp(`Service role full access on ${table}`)); }
assert.match(sql,/UNIQUE \(user_id, idempotency_key\)/); assert.match(models,/SecretCiphertext\s+string[^\n]*json:"-"/); assert.match(models,/SecretNonce\s+string[^\n]*json:"-"/);
assert.match(artifact,/validator\.Validate/); assert.match(artifact,/"status", "--porcelain"/); assert.match(artifact,/"rev-parse", "HEAD"/); assert.match(artifact,/"ls-files", "-z"/); assert.match(artifact,/sha256\.New/); assert.match(artifact,/deploymentArtifactMaxTotalBytes/); assert.match(artifact,/isProtectedGenerationPath/);
assert.match(adapter,/\/v2\/files/); assert.match(adapter,/x-Vercel-Digest/); assert.match(adapter,/\/v13\/deployments/); assert.match(adapter,/\/events\?direction=forward&limit=200/); assert.match(adapter,/\/promote\//); assert.match(adapter,/\/domains\/.*\/verify/); assert.match(adapter,/http\.MethodDelete/); assert.doesNotMatch(adapter,/token=/i);
assert.match(service,/SecretCiphertext: encrypted/); assert.match(service,/redactDeploymentLog/); assert.match(service,/deployment_secret_decrypt_failed/); assert.match(service,/ExpectedCurrentDeploymentID/); assert.match(service,/currentProductionDeployment/); assert.match(service,/deployment_rollback_stale/); assert.match(service,/executeOperation/); assert.match(service,/ConfirmDeploy/); assert.match(service,/ConfirmRollback/);
for(const route of ['/deployment/provider','/deployment/releases','/deployment/rollback','/deployment/domains']) assert.ok(routes.includes(route),`missing route ${route}`);
assert.match(handler,/AuthorizeProjectAccess/); assert.match(page,/发布与域名/); assert.match(page,/confirmDeploy/); assert.match(page,/回滚到此版本/); assert.match(page,/verification_value/);
for(const name of ['TestProjectDeploymentDeployEncryptsSecretsAndReplaysIdempotently','TestProjectDeploymentLogsRollbackAndDomainLifecycle','TestProjectDeploymentValidationFailureBlocksProviderMutation','TestVercelAdapterUploadsImmutableArtifactWithoutTokenInURL']) assert.ok(tests.includes(name),`missing ${name}`);
process.stdout.write('PLATFORM-001 deployment and domain contract passed.\n');
