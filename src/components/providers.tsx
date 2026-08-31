'use client';

import { ThemeProvider } from 'next-themes';

import { AuthProvider } from '@/contexts/auth-context';
import { UIPreferencesProvider } from '@/contexts/ui-preferences-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <UIPreferencesProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </UIPreferencesProvider>
    </ThemeProvider>
  );
}
