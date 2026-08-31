#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const preferencesContext = read('src/contexts/ui-preferences-context.tsx');
const preferenceLocalErrors = read('src/lib/ui-preferences-local-errors.ts');
const preferenceControls = read('src/components/app-preference-controls.tsx');
const validationLayer = read('docs/engineering/VALIDATION_LAYER.md');

assert.match(
  preferencesContext,
  /const localeStorageKey = 'yistack_locale';[\s\S]*const \[localeStorageNotice, setLocaleStorageNotice\] = useState\(''\);[\s\S]*const \[preferencesLoaded, setPreferencesLoaded\] = useState\(false\);/,
  'UI preferences context should keep visible locale storage notice state and an initialization latch',
);
assert.match(
  preferenceLocalErrors,
  /export type UIPreferenceLocaleStorageDetails = string;[\s\S]*export function formatUIPreferenceLocaleStorageFailure\([\s\S]*fallback: UIPreferenceLocaleStorageDetails,[\s\S]*formatUserVisibleApiError\(\{[\s\S]*source: 'local_storage'[\s\S]*details,/,
  'UI preferences locale storage failures should use a shared formatter that preserves local_storage source/details',
);
assert.doesNotMatch(
  preferenceLocalErrors,
  /fallback: string/,
  'UI preferences locale storage formatter should not regress to raw fallback strings',
);
assert.doesNotMatch(
  preferencesContext,
  /function formatLocaleStorageFailure|formatUserVisibleApiError\(/,
  'UI preferences context should not directly format locale storage source/details',
);
assert.match(
  preferencesContext,
  /try \{[\s\S]*window\.localStorage\.getItem\(localeStorageKey\)[\s\S]*setLocaleStorageNotice\(''\);[\s\S]*\} catch \(error\) \{[\s\S]*formatUIPreferenceLocaleStorageFailure\(error, '浏览器拒绝读取语言偏好'\)[\s\S]*语言偏好读取失败：\$\{reason\}[\s\S]*无法确认本地 yistack_locale 是否记录了其他语言[\s\S]*\} finally \{[\s\S]*setPreferencesLoaded\(true\);/,
  'UI preferences locale reads should be guarded and explain unknown stored language state with local_storage source/details',
);
assert.match(
  preferencesContext,
  /document\.documentElement\.lang = locale;[\s\S]*if \(typeof window === 'undefined' \|\| !preferencesLoaded\) return;[\s\S]*window\.localStorage\.setItem\(localeStorageKey, locale\);[\s\S]*formatUIPreferenceLocaleStorageFailure\(error, '浏览器拒绝保存语言偏好'\)[\s\S]*语言偏好保存失败：\$\{reason\}[\s\S]*当前语言已在本页生效[\s\S]*刷新或重新打开后可能回到默认中文界面/,
  'UI preferences locale writes should be guarded and explain current-page versus persisted language drift with local_storage source/details',
);
assert.match(
  preferencesContext,
  /localeStorageNotice,[\s\S]*\}\), \[locale, localeStorageNotice\]\);/,
  'UI preferences context should expose locale storage notices to consumers',
);
assert.match(
  preferenceControls,
  /const \{ locale, setLocale, localeOptions, localeStorageNotice \} = useUIPreferences\(\);[\s\S]*localeStorageNotice \? \([\s\S]*<p role="status"[\s\S]*\{localeStorageNotice\}/,
  'App preference controls should render locale storage failures as visible status feedback',
);
assert.match(
  preferenceControls,
  /import type \{ ReactNode \} from 'react';[\s\S]*import type \{ AppLocale, LocaleOption \} from '@\/contexts\/ui-preferences-context';[\s\S]*type AppPreferenceLocaleOptionNodeList = ReactNode\[\];[\s\S]*type AppPreferenceThemeOptionNodeList = ReactNode\[\];[\s\S]*function getAppPreferenceFirstLocaleOption\(localeOptions: LocaleOption\[\]\): LocaleOption \| undefined \{[\s\S]*for \(const option of localeOptions\)[\s\S]*return option;[\s\S]*return undefined;[\s\S]*function getAppPreferenceActiveLocaleOption\(localeOptions: LocaleOption\[\], locale: AppLocale\): LocaleOption \{[\s\S]*for \(const option of localeOptions\)[\s\S]*if \(option\.code === locale\)[\s\S]*const firstOption = getAppPreferenceFirstLocaleOption\(localeOptions\);[\s\S]*function getAppPreferenceActiveThemeLabel\(theme: string \| undefined, mounted: boolean\): string \{[\s\S]*if \(mounted === false\)[\s\S]*for \(const option of themeOptions\)[\s\S]*if \(option\.value === theme\)[\s\S]*function materializeAppPreferenceLocaleOptionNodes\([\s\S]*\): AppPreferenceLocaleOptionNodeList \{[\s\S]*const nodes: AppPreferenceLocaleOptionNodeList = \[\];[\s\S]*for \(const option of localeOptions\)[\s\S]*nodes\.push\([\s\S]*<DropdownMenuItem[\s\S]*key=\{option\.code\}[\s\S]*onClick=\{\(\) => setLocale\(option\.code\)\}[\s\S]*function materializeAppPreferenceThemeOptionNodes\([\s\S]*\): AppPreferenceThemeOptionNodeList \{[\s\S]*const nodes: AppPreferenceThemeOptionNodeList = \[\];[\s\S]*for \(const option of themeOptions\)[\s\S]*nodes\.push\([\s\S]*<DropdownMenuItem[\s\S]*key=\{option\.value\}[\s\S]*onClick=\{\(\) => setTheme\(option\.value\)\}[\s\S]*getAppPreferenceActiveLocaleOption\(localeOptions, locale\)[\s\S]*getAppPreferenceActiveThemeLabel\(theme, mounted\)[\s\S]*materializeAppPreferenceLocaleOptionNodes\(localeOptions, locale, setLocale\)[\s\S]*materializeAppPreferenceThemeOptionNodes\(theme, mounted, setTheme\)/,
  'App preference controls should derive active labels and dropdown options through named readers/materializers',
);
assert.doesNotMatch(
  preferenceControls,
  /localeOptions\.(find|map)\(|themeOptions\.(find|map)\(|localeOptions\[0\]|\?\./,
  'App preference controls should not regress to inline option array pipelines, direct first option indexing or optional fallback reads',
);
assert.match(
  validationLayer,
  /UI 偏好状态校验[\s\S]*yistack_locale[\s\S]*读取或保存失败[\s\S]*source=local_storage[\s\S]*用户可见[\s\S]*AppPreferenceControls[\s\S]*active locale\/theme[\s\S]*Dropdown option/,
  'Validation layer should document UI preference storage source/details visibility requirements',
);
console.log('[YES] UI preferences storage model validation passed.');
