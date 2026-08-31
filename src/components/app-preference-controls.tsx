'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Globe2, MoonStar } from 'lucide-react';
import { useTheme } from 'next-themes';

import { useUIPreferences } from '@/contexts/ui-preferences-context';
import type { AppLocale, LocaleOption } from '@/contexts/ui-preferences-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AppPreferenceThemeOption = {
  value: string;
  label: string;
};

type AppPreferenceLocaleOptionNodeList = ReactNode[];
type AppPreferenceThemeOptionNodeList = ReactNode[];
type AppPreferenceLocaleSetter = (locale: AppLocale) => void;
type AppPreferenceThemeSetter = (theme: string) => void;

const appPreferenceFallbackLocaleOption: LocaleOption = {
  code: 'zh-CN',
  label: '中文',
  flag: '🇨🇳',
};

const themeOptions: readonly AppPreferenceThemeOption[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
] as const;

function getAppPreferenceFirstLocaleOption(localeOptions: LocaleOption[]): LocaleOption | undefined {
  for (const option of localeOptions) {
    return option;
  }

  return undefined;
}

function getAppPreferenceActiveLocaleOption(localeOptions: LocaleOption[], locale: AppLocale): LocaleOption {
  for (const option of localeOptions) {
    if (option.code === locale) {
      return option;
    }
  }

  const firstOption = getAppPreferenceFirstLocaleOption(localeOptions);
  if (firstOption === undefined) {
    return appPreferenceFallbackLocaleOption;
  }

  return firstOption;
}

function getAppPreferenceActiveThemeLabel(theme: string | undefined, mounted: boolean): string {
  if (mounted === false) {
    return '主题';
  }

  for (const option of themeOptions) {
    if (option.value === theme) {
      return option.label;
    }
  }

  return '主题';
}

function materializeAppPreferenceLocaleOptionNodes(
  localeOptions: LocaleOption[],
  locale: AppLocale,
  setLocale: AppPreferenceLocaleSetter,
): AppPreferenceLocaleOptionNodeList {
  const nodes: AppPreferenceLocaleOptionNodeList = [];

  for (const option of localeOptions) {
    nodes.push(
      <DropdownMenuItem
        key={option.code}
        onClick={() => setLocale(option.code)}
        className="flex items-center justify-between gap-3"
      >
        <span className="flex items-center gap-2">
          <span>{option.flag}</span>
          <span>{option.label}</span>
        </span>
        {locale === option.code ? <Check className="h-4 w-4" /> : null}
      </DropdownMenuItem>,
    );
  }

  return nodes;
}

function materializeAppPreferenceThemeOptionNodes(
  theme: string | undefined,
  mounted: boolean,
  setTheme: AppPreferenceThemeSetter,
): AppPreferenceThemeOptionNodeList {
  const nodes: AppPreferenceThemeOptionNodeList = [];

  for (const option of themeOptions) {
    nodes.push(
      <DropdownMenuItem
        key={option.value}
        onClick={() => setTheme(option.value)}
        className="flex items-center justify-between gap-3"
      >
        <span>{option.label}</span>
        {mounted === true && theme === option.value ? <Check className="h-4 w-4" /> : null}
      </DropdownMenuItem>,
    );
  }

  return nodes;
}

export function AppPreferenceControls({
  className,
}: {
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, localeOptions, localeStorageNotice } = useUIPreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeLocale = useMemo(
    () => getAppPreferenceActiveLocaleOption(localeOptions, locale),
    [locale, localeOptions],
  );

  const activeThemeLabel = useMemo(() => {
    return getAppPreferenceActiveThemeLabel(theme, mounted);
  }, [mounted, theme]);

  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Globe2 className="h-4 w-4" />
              <span>{activeLocale.flag}</span>
              <span className="hidden sm:inline">{activeLocale.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {materializeAppPreferenceLocaleOptionNodes(localeOptions, locale, setLocale)}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <MoonStar className="h-4 w-4" />
              <span className="hidden sm:inline">{activeThemeLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {materializeAppPreferenceThemeOptionNodes(theme, mounted, setTheme)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {localeStorageNotice ? (
        <p role="status" className="max-w-xs text-right text-xs text-amber-600 dark:text-amber-300">
          {localeStorageNotice}
        </p>
      ) : null}
    </div>
  );
}
