'use client';
import * as React from 'react';

type Mode = 'light' | 'dark';

export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const [theme, setTheme] = React.useState<Mode>('light');

  React.useEffect(() => {
    setMounted(true);
    try {
      const html = document.documentElement;
      const attr = html.getAttribute('data-theme');
      let initial: Mode = (attr === 'dark' || attr === 'light') ? (attr as Mode) : 'light';
      setTheme(initial);
    } catch {}
  }, []);

  const apply = (next: Mode) => {
    const html = document.documentElement;
    html.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
      // 1 year cookie for SSR
      document.cookie = `theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {}
    setTheme(next);
  };

  const toggle = () => apply(theme === 'dark' ? 'light' : 'dark');

  // Stable SSR text; swap after mount
  const label = mounted ? (theme === 'dark' ? 'Light' : 'Dark') : 'Theme';

  return (
    <button
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={toggle}
      className="btn text-sm"
    >
      <span suppressHydrationWarning>{label}</span>
    </button>
  );
}