import assert from 'node:assert/strict';
import fs from 'node:fs';

const urlSyncHook = fs.readFileSync('src/app/admin/use-admin-diagnostic-url-sync.ts', 'utf8');
const localErrors = fs.readFileSync('src/lib/admin/admin-diagnostic-local-errors.ts', 'utf8');
const runtimeCard = fs.readFileSync('src/app/admin/admin-runtime-health-diagnostics-card.tsx', 'utf8');
const providerCard = fs.readFileSync('src/app/admin/admin-provider-health-diagnostics-card.tsx', 'utf8');
const auditCard = fs.readFileSync('src/app/admin/admin-audit-diagnostics-card.tsx', 'utf8');
const preflightCard = fs.readFileSync('src/app/admin/admin-capability-preflight-card.tsx', 'utf8');
const validationLayer = fs.readFileSync('docs/engineering/VALIDATION_LAYER.md', 'utf8');

assert.equal(
  fs.existsSync('src/app/admin/admin-diagnostic-local-errors.ts'),
  false,
  'Admin diagnostic local visible error helper should live under src/lib/admin, not the app layer',
);
assert.match(
  localErrors,
  /export type AdminDiagnosticLocalErrorSource = 'browser_history' \| 'clipboard';[\s\S]*export type AdminDiagnosticLocalErrorDetails = string;/,
  'Admin diagnostic local errors should export named source/details contracts for browser_history and clipboard failures',
);
assert.match(
  localErrors,
  /const adminDiagnosticMissingClipboardMessage: AdminDiagnosticLocalErrorDetails[\s\S]*const adminDiagnosticMissingClipboardDetails: AdminDiagnosticLocalErrorDetails/,
  'Admin diagnostic missing clipboard message/details should consume the named details contract',
);
assert.match(
  localErrors,
  /export function formatAdminDiagnosticLocalError\([\s\S]*source: AdminDiagnosticLocalErrorSource[\s\S]*formatUserVisibleApiError\(\{[\s\S]*source,[\s\S]*details,[\s\S]*\}, fallback\)/,
  'Admin diagnostic local errors should share browser_history/clipboard source formatting through one helper',
);
assert.match(
  localErrors,
  /export function formatAdminDiagnosticLocalError\([\s\S]*fallback: AdminDiagnosticLocalErrorDetails,[\s\S]*source: AdminDiagnosticLocalErrorSource/,
  'Admin diagnostic local error formatter should consume named fallback/details and source contracts',
);
assert.match(
  localErrors,
  /export function formatAdminDiagnosticMissingClipboardError\(\)[\s\S]*source: 'clipboard' satisfies AdminDiagnosticLocalErrorSource[\s\S]*details: adminDiagnosticMissingClipboardDetails[\s\S]*adminDiagnosticMissingClipboardMessage/,
  'Admin diagnostic missing clipboard formatter should keep clipboard source/details under named contracts',
);
assert.doesNotMatch(
  localErrors,
  /^type AdminDiagnosticLocalErrorSource =|fallback: string/m,
  'Admin diagnostic local errors should not regress to non-exported source aliases or raw fallback strings',
);
assert.doesNotMatch(
  `${urlSyncHook}\n${runtimeCard}\n${providerCard}\n${auditCard}\n${preflightCard}`,
  /from ['"]\.\.?\/admin-diagnostic-local-errors['"]/,
  'Admin diagnostic app files should import local visible error helpers from src/lib/admin instead of a sibling app-layer helper',
);

assert.match(
  urlSyncHook,
  /export function useAdminDiagnosticUrlSync\(\) \{[\s\S]*const \[diagnosticUrlSyncError, setDiagnosticUrlSyncError\] = useState\(''\);[\s\S]*window\.history\.replaceState\(window\.history\.state, '', nextUrl\);[\s\S]*setDiagnosticUrlSyncError\(''\);[\s\S]*catch \(error\) \{[\s\S]*formatAdminDiagnosticLocalError\(error, '浏览器拒绝更新地址栏', 'browser_history'\)[\s\S]*Admin 诊断筛选地址栏同步失败：\$\{reason\}[\s\S]*当前筛选已在面板内生效，但地址栏和复制的诊断链接可能仍是旧状态/,
  'Admin diagnostic URL sync helper should catch replaceState failures through the shared browser_history formatter and explain stale address bar / diagnostic link risk',
);

for (const [label, source] of [
  ['runtime health', runtimeCard],
  ['provider health', providerCard],
  ['audit', auditCard],
  ['capability preflight', preflightCard],
]) {
  assert.match(
    source,
    /import \{ useAdminDiagnosticUrlSync \} from '\.\/use-admin-diagnostic-url-sync';[\s\S]*const \{ diagnosticUrlSyncError, replaceUrlSearch \} = useAdminDiagnosticUrlSync\(\);/,
    `Admin ${label} diagnostics should use the shared URL sync helper instead of raw replaceState`,
  );
}

for (const [label, source] of [
  ['runtime health', runtimeCard],
  ['provider health', providerCard],
  ['audit', auditCard],
]) {
  assert.match(
    source,
    /function shouldRenderAdmin[A-Za-z]+DiagnosticUrlSyncError\(error: string \| null\): boolean \{[\s\S]*const hasError = error !== null && error\.length > 0;[\s\S]*return hasError === true;[\s\S]*const shouldRenderDiagnosticUrlSyncError = shouldRenderAdmin[A-Za-z]+DiagnosticUrlSyncError\(diagnosticUrlSyncError\);[\s\S]*\{shouldRenderDiagnosticUrlSyncError === true && \([\s\S]*<span role="status"[\s\S]*\{diagnosticUrlSyncError\}/,
    `Admin ${label} diagnostics should render URL sync failures as visible status text through a named explicit gate`,
  );
}

assert.match(
  preflightCard,
  /diagnosticLinkCopyError=\{providerPreflightDiagnosticLinkCopyError \|\| diagnosticUrlSyncError\}/,
  'Admin capability preflight diagnostics should surface URL sync failures through the existing status channel',
);

assert.doesNotMatch(
  `${runtimeCard}\n${providerCard}\n${auditCard}\n${preflightCard}`,
  /window\.history\.replaceState/,
  'Admin diagnostic cards should not call replaceState directly; use the shared guarded helper',
);

assert.match(
  validationLayer,
  /Admin 诊断 URL 筛选状态校验[\s\S]*replaceState[\s\S]*source=browser_history[\s\S]*用户可见[\s\S]*诊断链接可能仍是旧状态/,
  'Validation layer should document Admin diagnostic URL sync failure source/details visibility requirements',
);

console.log('[YES] Admin diagnostic URL sync model validation passed.');
