'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === 'dark' : undefined;

  function toggle() {
    if (!mounted) return;
    setTheme(isDark ? 'light' : 'dark');
  }

  return (
    <button
      onClick={toggle}
      // Use a stable title during SSR to avoid mismatches
      title={mounted ? (isDark ? 'Switch to Light mode' : 'Switch to Dark mode') : 'Toggle theme'}
      className="p-2 rounded hover:bg-black/10 dark:hover:bg-white/10 border border-transparent hover:border-black/10 dark:hover:border-white/20"
      aria-label="Toggle theme"
    >
      {/* Render a neutral placeholder until mounted */}
      {mounted ? (isDark ? <Sun size={18} /> : <Moon size={18} />) : (
        <span className="inline-block w-[18px] h-[18px]" />
      )}
    </button>
  );
}