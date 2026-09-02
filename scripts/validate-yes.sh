#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_files=(
  "$ROOT_DIR/AGENTS.md"
  "$ROOT_DIR/docs/engineering/YES.md"
  "$ROOT_DIR/docs/engineering/PRINCIPLES.md"
  "$ROOT_DIR/docs/engineering/ARCHITECTURE_RULES.md"
  "$ROOT_DIR/docs/engineering/DEVELOPMENT_WORKFLOW.md"
  "$ROOT_DIR/docs/engineering/AI_DEVELOPMENT_PROTOCOL.md"
  "$ROOT_DIR/docs/engineering/CODING_STANDARD.md"
  "$ROOT_DIR/docs/engineering/VALIDATION_LAYER.md"
  "$ROOT_DIR/scripts/smoke-check.sh"
)

echo "[YES] Checking kernel documents..."
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[YES] Missing required file: $file" >&2
    exit 1
  fi
done

echo "[YES] Checking smoke check entrypoint..."
grep -q '"smoke:check": "bash ./scripts/smoke-check.sh"' "$ROOT_DIR/package.json"

echo "[YES] Checking capability contracts..."
node "$ROOT_DIR/scripts/validate-capability-contract-manifests.mjs"

echo "[YES] Checking roadmap table format..."
node "$ROOT_DIR/scripts/validate-roadmap-table-format.mjs"

echo "[YES] Checking roadmap sync..."
node "$ROOT_DIR/scripts/validate-roadmap-sync.mjs"

private_document_validator="$ROOT_DIR/docs/internal/validate.mjs"
if [[ -f "$private_document_validator" ]]; then
  echo "[YES] Checking private development documents..."
  node "$private_document_validator"
fi

echo "[YES] Checking validation layer consistency..."
node "$ROOT_DIR/scripts/validate-validation-layer-consistency.mjs"

echo "[YES] Checking architecture boundaries..."
node "$ROOT_DIR/scripts/validate-architecture-boundaries.mjs"

echo "[YES] Checking workflow contract sync..."
node "$ROOT_DIR/scripts/validate-workflow-contract-sync.mjs"

echo "[YES] Checking workflow recovery contract sync..."
node "$ROOT_DIR/scripts/validate-workflow-recovery-contract-sync.mjs"

echo "[YES] Checking Foundation artifact contract..."
node "$ROOT_DIR/scripts/validate-foundation-artifact-contract.mjs"

echo "[YES] Checking GEN-001 generation contract..."
node "$ROOT_DIR/scripts/validate-gen001-generation-contract.mjs"

echo "[YES] Checking GEN-002 project validation gate..."
node "$ROOT_DIR/scripts/validate-gen002-project-validation-gate.mjs"

echo "[YES] Checking GEN-003 file patch and bounded repair..."
node "$ROOT_DIR/scripts/validate-gen003-file-patch-repair.mjs"

echo "[YES] Checking JOB-001 durable Generation Job and SSE replay..."
node "$ROOT_DIR/scripts/validate-job001-generation-job-replay.mjs"
pnpm exec tsx "$ROOT_DIR/scripts/validate-generation-job-replay-model.ts"

echo "[YES] Checking EVAL-001 browser acceptance and canonical benchmark..."
node "$ROOT_DIR/scripts/validate-eval001-browser-benchmark.mjs"
node "$ROOT_DIR/scripts/validate-browser-acceptance-model.mjs"
node "$ROOT_DIR/scripts/validate-generation-benchmark-model.mjs"

echo "[YES] Checking PLATFORM-001 Supabase application preset..."
node "$ROOT_DIR/scripts/validate-platform001-supabase-preset.mjs"

echo "[YES] Checking PLATFORM-001 GitHub import and sync..."
node "$ROOT_DIR/scripts/validate-platform001-github-sync.mjs"

echo "[YES] Checking PLATFORM-001 deployment and domain lifecycle..."
node "$ROOT_DIR/scripts/validate-platform001-deployment.mjs"

echo "[YES] Checking PLATFORM-001 collaboration and official templates..."
node "$ROOT_DIR/scripts/validate-platform001-collaboration-templates.mjs"

echo "[YES] Checking R7 Contributor Alpha repository contract..."
node "$ROOT_DIR/scripts/validate-contributor-alpha.mjs"

echo "[YES] Checking LT-05 orchestration state contract..."
node "$ROOT_DIR/scripts/validate-lt05-orchestration-state-contract.mjs"

echo "[YES] Checking LT-06 capability catalog contract..."
node "$ROOT_DIR/scripts/validate-lt06-capability-catalog-contract.mjs"

echo "[YES] Checking LT-07 professional efficiency contract..."
node "$ROOT_DIR/scripts/validate-lt07-professional-efficiency-contract.mjs"

echo "[YES] Checking LT-08 enterprise governance contract..."
node "$ROOT_DIR/scripts/validate-lt08-enterprise-governance-contract.mjs"

echo "[YES] Checking VIS-001 visual context model..."
cd "$ROOT_DIR"
pnpm exec tsx "$ROOT_DIR/scripts/validate-vis001-visual-context-model.ts"

echo "[YES] Checking config env sync..."
node "$ROOT_DIR/scripts/validate-config-env-sync.mjs"

echo "[YES] Checking sensitive config isolation..."
node "$ROOT_DIR/scripts/validate-sensitive-config-isolation.mjs"

echo "[YES] Checking system config seed sync..."
node "$ROOT_DIR/scripts/validate-system-config-seed-sync.mjs"

echo "[YES] Checking init.sql repeatability..."
node "$ROOT_DIR/scripts/validate-init-sql-baseline.mjs"

echo "[YES] Checking API response contracts..."
node "$ROOT_DIR/scripts/validate-api-response-contracts.mjs"

echo "[YES] Checking admin API response contracts..."
node "$ROOT_DIR/scripts/validate-admin-api-response-contracts.mjs"

echo "[YES] Checking admin auth storage model..."
node "$ROOT_DIR/scripts/validate-admin-auth-storage-model.mjs"

echo "[YES] Checking user auth storage model..."
node "$ROOT_DIR/scripts/validate-user-auth-storage-model.mjs"

echo "[YES] Checking UI preferences storage model..."
node "$ROOT_DIR/scripts/validate-ui-preferences-storage-model.mjs"

echo "[YES] Checking terminal visibility model..."
node "$ROOT_DIR/scripts/validate-terminal-visibility-model.mjs"

echo "[YES] Checking Preview URL build model..."
node "$ROOT_DIR/scripts/validate-preview-url-build-model.mjs"

echo "[YES] Checking admin diagnostic URL sync model..."
node "$ROOT_DIR/scripts/validate-admin-diagnostic-url-sync-model.mjs"

echo "[YES] Checking admin capability preflight model..."
cd "$ROOT_DIR"
pnpm exec tsx "$ROOT_DIR/scripts/validate-admin-capability-preflight-model.ts"

echo "[YES] Checking admin audit diagnostics model..."
cd "$ROOT_DIR"
pnpm exec tsx "$ROOT_DIR/scripts/validate-admin-audit-diagnostics-model.ts"

echo "[YES] Checking capability audit diagnostics model..."
cd "$ROOT_DIR"
pnpm exec tsx "$ROOT_DIR/scripts/validate-capability-audit-diagnostics-model.ts"

echo "[YES] Checking runtime health diagnostics model..."
cd "$ROOT_DIR"
pnpm exec tsx "$ROOT_DIR/scripts/validate-runtime-health-diagnostics-model.ts"

echo "[YES] Checking workspace message restore model..."
cd "$ROOT_DIR"
pnpm exec tsx "$ROOT_DIR/scripts/validate-workspace-message-restore-model.ts"

echo "[YES] Checking workspace snapshot governance model..."
cd "$ROOT_DIR"
pnpm exec tsx "$ROOT_DIR/scripts/validate-workspace-snapshot-governance-model.ts"

echo "[YES] Checking workspace resource consistency model..."
cd "$ROOT_DIR"
pnpm exec tsx "$ROOT_DIR/scripts/validate-workspace-resource-consistency-model.ts"

echo "[YES] Checking admin runtime health diagnostics model..."
cd "$ROOT_DIR"
pnpm exec tsx "$ROOT_DIR/scripts/validate-admin-runtime-health-diagnostics-model.ts"

echo "[YES] Checking admin provider health diagnostics model..."
cd "$ROOT_DIR"
pnpm exec tsx "$ROOT_DIR/scripts/validate-admin-provider-health-diagnostics-model.ts"

echo "[YES] Checking admin dashboard diagnostics layout..."
node "$ROOT_DIR/scripts/validate-admin-dashboard-diagnostics-layout.mjs"

echo "[YES] Checking diagnostic model manifest..."
node "$ROOT_DIR/scripts/validate-diagnostic-models.mjs"

echo "[YES] Generating Next.js route types..."
cd "$ROOT_DIR"
pnpm exec next typegen

echo "[YES] Running frontend type check..."
cd "$ROOT_DIR"
pnpm exec tsc -p tsconfig.json --noEmit

echo "[YES] Running backend build..."
cd "$ROOT_DIR/backend"
go build ./...

echo "[YES] Running backend package tests..."
go test ./... -count=1

echo "[YES] Validation passed."
