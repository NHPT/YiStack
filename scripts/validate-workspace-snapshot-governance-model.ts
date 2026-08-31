import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

type SourceFilePath = string;
type SourceFilePathList = SourceFilePath[];
type LocalUiSnapshotScanRoot = string;
type LocalUiSnapshotScanRootList = LocalUiSnapshotScanRoot[];
type WorkspaceSnapshotTypeName = string;
type WorkspaceSnapshotTypeNameList = WorkspaceSnapshotTypeName[];
type UiSnapshotTargetId = string;
type UiSnapshotTargetIdList = UiSnapshotTargetId[];
type UiSnapshotTargetLocation = string;
type UiSnapshotTargetLocationList = UiSnapshotTargetLocation[];
type UiSnapshotTargetEntry = {
  targetId: UiSnapshotTargetId;
  location: UiSnapshotTargetLocation;
};
type UiSnapshotTargetEntryList = UiSnapshotTargetEntry[];
type SnapshotGovernanceViolation = string;
type SnapshotGovernanceViolationList = SnapshotGovernanceViolation[];
type SnapshotTargetMissingSemantic = 'role="status"' | 'aria-live="polite"';
type SnapshotTargetMissingSemanticList = SnapshotTargetMissingSemantic[];
type SnapshotTargetLocationsById = Map<UiSnapshotTargetId, UiSnapshotTargetLocationList>;

const LOCAL_UI_SNAPSHOT_SCAN_ROOTS: LocalUiSnapshotScanRootList = ['src/app', 'src/components'];
const WORKSPACE_SNAPSHOT_TYPE_REGISTRY = path.normalize('src/app/workspace/workspace-types.ts');
const LOCAL_UI_SNAPSHOT_TYPE_PATTERN = /\b(?:export\s+)?(?:type|interface)\s+[A-Za-z0-9]+Snapshot(?:<[^>]+>)?\s*(?:=|\{)/g;
const WORKSPACE_SNAPSHOT_TYPE_PATTERN = /\bexport\s+type\s+([A-Za-z0-9]+Snapshot)\s*=\s*\{/g;
const SNAPSHOT_TEST_ID_PATTERN = /data-testid="[^"]*snapshot"/g;
const DATA_ONLY_WORKSPACE_SNAPSHOT_TYPES: Set<WorkspaceSnapshotTypeName> = new Set([
  'WorkspaceSessionSnapshot',
  'WorkspaceEditorSessionSnapshot',
  'WorkspaceWorkflowSnapshot',
]);

const snapshotGovernanceModel = fs.readFileSync('scripts/validate-workspace-snapshot-governance-model.ts', 'utf8');
const workspaceTypes = fs.readFileSync('src/app/workspace/workspace-types.ts', 'utf8');
const resourceConsistencyModel = fs.readFileSync('scripts/validate-workspace-resource-consistency-model.ts', 'utf8');
const validateYes = fs.readFileSync('scripts/validate-yes.sh', 'utf8');
const validationLayer = fs.readFileSync('docs/engineering/VALIDATION_LAYER.md', 'utf8');

function collectSourceFiles(root: LocalUiSnapshotScanRoot | SourceFilePath): SourceFilePathList {
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(filePath);
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      return [filePath];
    }

    return [];
  });
}

function toKebabCase(value: string): string {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function getRegisteredWorkspaceSnapshotTypes(): WorkspaceSnapshotTypeNameList {
  return Array.from(workspaceTypes.matchAll(WORKSPACE_SNAPSHOT_TYPE_PATTERN)).map(match => match[1]);
}

function getUiSnapshotTargetIds(): UiSnapshotTargetIdList {
  return LOCAL_UI_SNAPSHOT_SCAN_ROOTS.flatMap(root => collectSourceFiles(root))
    .flatMap(filePath => {
      const source = fs.readFileSync(filePath, 'utf8');

      return Array.from(source.matchAll(SNAPSHOT_TEST_ID_PATTERN)).map(match => match[0].slice('data-testid="'.length, -1));
    })
    .sort();
}

function getUiSnapshotTargetEntries(): UiSnapshotTargetEntryList {
  return LOCAL_UI_SNAPSHOT_SCAN_ROOTS.flatMap(root => collectSourceFiles(root))
    .flatMap(filePath => {
      const source = fs.readFileSync(filePath, 'utf8');
      const matches = Array.from(source.matchAll(SNAPSHOT_TEST_ID_PATTERN));

      return matches.map(match => ({
        targetId: match[0].slice('data-testid="'.length, -1),
        location: `${filePath}:${source.slice(0, match.index).split(/\r?\n/).length}`,
      }));
    });
}

function getSnapshotTargetStem(snapshotType: WorkspaceSnapshotTypeName): UiSnapshotTargetId {
  return toKebabCase(snapshotType.replace(/Snapshot$/, '')) + '-snapshot';
}

function snapshotTargetMatchesType(targetId: UiSnapshotTargetId, snapshotType: WorkspaceSnapshotTypeName): boolean {
  const stem = getSnapshotTargetStem(snapshotType);

  return targetId === stem || targetId.endsWith(`-${stem}`);
}

function validateUiSnapshotTypesUseWorkspaceRegistry() {
  const localDeclarations: SnapshotGovernanceViolationList = LOCAL_UI_SNAPSHOT_SCAN_ROOTS.flatMap(root => collectSourceFiles(root))
    .filter(filePath => path.normalize(filePath) !== WORKSPACE_SNAPSHOT_TYPE_REGISTRY)
    .flatMap(filePath => {
      const source = fs.readFileSync(filePath, 'utf8');
      const matches = Array.from(source.matchAll(LOCAL_UI_SNAPSHOT_TYPE_PATTERN));

      return matches.map(match => `${filePath}: ${match[0]}`);
    });

  assert.deepEqual(
    localDeclarations,
    [],
    'UI snapshot types must be declared in src/app/workspace/workspace-types.ts instead of app/component-local files',
  );
}

function validateUiSnapshotTargetsExposeStatusSemantics() {
  const violations: SnapshotGovernanceViolationList = LOCAL_UI_SNAPSHOT_SCAN_ROOTS.flatMap(root => collectSourceFiles(root))
    .flatMap(filePath => {
      const source = fs.readFileSync(filePath, 'utf8');
      const lines = source.split(/\r?\n/);
      const matches = Array.from(source.matchAll(SNAPSHOT_TEST_ID_PATTERN));

      return matches.flatMap(match => {
        const lineNumber = source.slice(0, match.index).split(/\r?\n/).length;
        const context = lines.slice(Math.max(0, lineNumber - 6), Math.min(lines.length, lineNumber + 3)).join('\n');
        const missing: SnapshotTargetMissingSemanticList = [];

        if (!context.includes('role="status"')) {
          missing.push('role="status"');
        }

        if (!context.includes('aria-live="polite"')) {
          missing.push('aria-live="polite"');
        }

        return missing.length > 0 ? [`${filePath}:${lineNumber} ${match[0]} missing ${missing.join(' and ')}`] : [];
      });
    });

  assert.deepEqual(
    violations,
    [],
    'UI snapshot targets must expose role="status" and aria-live="polite" near their stable snapshot data-testid',
  );
}

function validateUiSnapshotTargetIdsAreUnique() {
  const locationsByTargetId: SnapshotTargetLocationsById = new Map();

  getUiSnapshotTargetEntries().forEach(({ targetId, location }) => {
    const locations = locationsByTargetId.get(targetId) || [];
    locations.push(location);
    locationsByTargetId.set(targetId, locations);
  });

  const duplicates: SnapshotGovernanceViolationList = Array.from(locationsByTargetId.entries())
    .filter(([, locations]) => locations.length > 1)
    .map(([targetId, locations]) => `${targetId} -> ${locations.join(', ')}`)
    .sort();

  assert.deepEqual(
    duplicates,
    [],
    'Stable snapshot data-testid targets should be unique across UI source files',
  );
}

function validateUiSnapshotTargetIdsUseSnapshotSuffix() {
  const violations: SnapshotGovernanceViolationList = getUiSnapshotTargetEntries()
    .filter(({ targetId }) => !targetId.endsWith('-snapshot'))
    .map(({ targetId, location }) => `${location} ${targetId} should end with -snapshot`)
    .sort();

  assert.deepEqual(
    violations,
    [],
    'Stable snapshot data-testid targets should end with -snapshot',
  );
}

function validateWorkspaceSnapshotRegistryCoversUiTargets() {
  const snapshotTypes = getRegisteredWorkspaceSnapshotTypes();
  const uiSnapshotTypes = snapshotTypes.filter(snapshotType => !DATA_ONLY_WORKSPACE_SNAPSHOT_TYPES.has(snapshotType));
  const targetIds = getUiSnapshotTargetIds();

  const missingTargets: SnapshotGovernanceViolationList = uiSnapshotTypes
    .filter(snapshotType => !targetIds.some(targetId => snapshotTargetMatchesType(targetId, snapshotType)))
    .map(snapshotType => `${snapshotType} -> expected target suffix ${getSnapshotTargetStem(snapshotType)}`);

  const orphanTargets: SnapshotGovernanceViolationList = targetIds
    .filter(targetId => !uiSnapshotTypes.some(snapshotType => snapshotTargetMatchesType(targetId, snapshotType)))
    .map(targetId => `${targetId} -> missing matching workspace-types.ts Snapshot type`);

  assert.deepEqual(
    missingTargets,
    [],
    'Every UI snapshot type in workspace-types.ts should have a stable snapshot data-testid target',
  );
  assert.deepEqual(
    orphanTargets,
    [],
    'Every stable snapshot data-testid target should map back to a workspace-types.ts Snapshot type',
  );
}

assert.match(
  snapshotGovernanceModel,
  /type SourceFilePathList = SourceFilePath\[\];[\s\S]*type LocalUiSnapshotScanRootList = LocalUiSnapshotScanRoot\[\];[\s\S]*type WorkspaceSnapshotTypeNameList = WorkspaceSnapshotTypeName\[\];[\s\S]*type UiSnapshotTargetIdList = UiSnapshotTargetId\[\];[\s\S]*type UiSnapshotTargetEntryList = UiSnapshotTargetEntry\[\];[\s\S]*type SnapshotGovernanceViolationList = SnapshotGovernanceViolation\[\];[\s\S]*type SnapshotTargetMissingSemanticList = SnapshotTargetMissingSemantic\[\];/,
  'snapshot governance validator should name source file, target, entry, semantic and violation list contracts',
);
assert.match(
  snapshotGovernanceModel,
  /function collectSourceFiles\(root: LocalUiSnapshotScanRoot \| SourceFilePath\): SourceFilePathList[\s\S]*function getRegisteredWorkspaceSnapshotTypes\(\): WorkspaceSnapshotTypeNameList[\s\S]*function getUiSnapshotTargetIds\(\): UiSnapshotTargetIdList[\s\S]*function getUiSnapshotTargetEntries\(\): UiSnapshotTargetEntryList/,
  'snapshot governance validator helpers should return named list contracts',
);
assert.doesNotMatch(
  snapshotGovernanceModel,
  new RegExp([
    'function collectSourceFiles\\(root: string\\): string\\[\\]',
    'function getRegisteredWorkspaceSnapshotTypes\\(\\): string\\[\\]',
    'function getUiSnapshotTargetIds\\(\\): string\\[\\]',
    'function getUiSnapshotTargetEntries\\(\\): Array<\\{ targetId: string; location: string \\}>',
    'const missing: string\\[\\] = \\[\\]',
    'new Map<string, string\\[\\]>',
  ].join('|')),
  'snapshot governance validator should not regress helper returns or target maps to anonymous list contracts',
);

assert.match(
  validationLayer,
  /UI\/component-local `\*Snapshot` 类型回归门禁[\s\S]*validate-workspace-snapshot-governance-model\.ts[\s\S]*src\/app[\s\S]*src\/components[\s\S]*src\/app\/workspace\/workspace-types\.ts[\s\S]*WorkspaceEngineeringStateSnapshot/,
  'validation layer should document the central workspace-types snapshot registry rule and engineering-state exception',
);
assert.match(
  validationLayer,
  /Snapshot UI target 可访问语义门禁[\s\S]*validate-workspace-snapshot-governance-model\.ts[\s\S]*data-testid[\s\S]*snapshot[\s\S]*role="status"[\s\S]*aria-live="polite"/,
  'validation layer should document that stable snapshot targets are user-visible status regions',
);
assert.match(
  validationLayer,
  /Snapshot 类型与 UI target 覆盖关系门禁[\s\S]*validate-workspace-snapshot-governance-model\.ts[\s\S]*workspace-types\.ts[\s\S]*data-testid[\s\S]*WorkspaceSessionSnapshot[\s\S]*WorkspaceWorkflowSnapshot[\s\S]*(?:data-only|state-only)/,
  'validation layer should document bidirectional snapshot type/target coverage and the data-only exception',
);
assert.match(
  validationLayer,
  /Snapshot Governance 脚本职责边界校验[\s\S]*validate-workspace-snapshot-governance-model\.ts[\s\S]*唯一 YES 入口[\s\S]*validate-workspace-resource-consistency-model\.ts[\s\S]*资源链路一致性/,
  'validation layer should document the standalone snapshot governance script boundary',
);
assert.match(
  validationLayer,
  /Snapshot UI target 唯一性门禁[\s\S]*validate-workspace-snapshot-governance-model\.ts[\s\S]*data-testid[\s\S]*重复/,
  'validation layer should document the unique stable snapshot target rule',
);
assert.match(
  validationLayer,
  /Snapshot UI target 命名后缀门禁[\s\S]*validate-workspace-snapshot-governance-model\.ts[\s\S]*-snapshot/,
  'validation layer should document the stable snapshot target suffix rule',
);
assert.match(
  validationLayer,
  /Snapshot Governance validator contract 校验[\s\S]*validate-workspace-snapshot-governance-model\.ts[\s\S]*source file[\s\S]*target entry[\s\S]*missing semantic[\s\S]*匿名 `string\[\]`[\s\S]*new Map<string, string\[\]>/,
  'validation layer should document the snapshot governance validator contract cleanup',
);
assert.doesNotMatch(
  resourceConsistencyModel,
  /validateUiSnapshotTypesUseWorkspaceRegistry|validateUiSnapshotTargetsExposeStatusSemantics|validateUiSnapshotTargetIdsAreUnique|validateUiSnapshotTargetIdsUseSnapshotSuffix|validateWorkspaceSnapshotRegistryCoversUiTargets|DATA_ONLY_WORKSPACE_SNAPSHOT_TYPES/,
  'workspace resource consistency model should not keep snapshot governance validators after the split',
);
assert.match(
  validateYes,
  /Checking workspace snapshot governance model[\s\S]*validate-workspace-snapshot-governance-model\.ts/,
  'validate-yes should execute the workspace snapshot governance model',
);

validateUiSnapshotTypesUseWorkspaceRegistry();
validateUiSnapshotTargetsExposeStatusSemantics();
validateUiSnapshotTargetIdsAreUnique();
validateUiSnapshotTargetIdsUseSnapshotSuffix();
validateWorkspaceSnapshotRegistryCoversUiTargets();

console.log('[YES] Workspace snapshot governance model validation passed.');
