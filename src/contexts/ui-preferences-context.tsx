'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { formatUIPreferenceLocaleStorageFailure } from '@/lib/ui-preferences-local-errors';

export type AppLocale = 'zh-CN' | 'en-US' | 'ja-JP';

export type LocaleOption = {
  code: AppLocale;
  label: string;
  flag: string;
};

const localeOptions: LocaleOption[] = [
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'en-US', label: 'English', flag: '🇺🇸' },
  { code: 'ja-JP', label: '日本語', flag: '🇯🇵' },
];

type UIPreferencesContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  localeOptions: LocaleOption[];
  localeStorageNotice: string;
};

const UIPreferencesContext = createContext<UIPreferencesContextValue | null>(null);

const localeStorageKey = 'yistack_locale';

export function UIPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('zh-CN');
  const [localeStorageNotice, setLocaleStorageNotice] = useState('');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setPreferencesLoaded(true);
      return;
    }
    try {
      const storedLocale = window.localStorage.getItem(localeStorageKey) as AppLocale | null;
      if (storedLocale && localeOptions.some((option) => option.code === storedLocale)) {
        setLocaleState(storedLocale);
      }
      setLocaleStorageNotice('');
    } catch (error) {
      const reason = formatUIPreferenceLocaleStorageFailure(error, '浏览器拒绝读取语言偏好');
      setLocaleStorageNotice(`语言偏好读取失败：${reason}。当前会使用默认中文界面，但无法确认本地 yistack_locale 是否记录了其他语言；请检查浏览器本地存储权限后重新选择语言。`);
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    if (typeof window === 'undefined' || !preferencesLoaded) return;
    try {
      window.localStorage.setItem(localeStorageKey, locale);
      setLocaleStorageNotice('');
    } catch (error) {
      const reason = formatUIPreferenceLocaleStorageFailure(error, '浏览器拒绝保存语言偏好');
      setLocaleStorageNotice(`语言偏好保存失败：${reason}。当前语言已在本页生效，但 yistack_locale 可能没有写入本地存储；刷新或重新打开后可能回到默认中文界面。`);
    }
  }, [locale, preferencesLoaded]);

  const value = useMemo(() => ({
    locale,
    setLocale: setLocaleState,
    localeOptions,
    localeStorageNotice,
  }), [locale, localeStorageNotice]);

  return (
    <UIPreferencesContext.Provider value={value}>
      {children}
    </UIPreferencesContext.Provider>
  );
}

export function useUIPreferences() {
  const context = useContext(UIPreferencesContext);
  if (!context) {
    throw new Error('useUIPreferences must be used within UIPreferencesProvider');
  }
  return context;
}
