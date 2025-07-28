// app/layout.tsx
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  const cookieTheme = cookies().get('theme')?.value as 'light' | 'dark' | undefined;

  return (
    <html lang="en" data-theme={cookieTheme} suppressHydrationWarning>
      <head>
        {/* If no data-theme yet (first visit), choose from localStorage / system BEFORE hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var html = document.documentElement;
    if (!html.getAttribute('data-theme')) {
      var t = localStorage.getItem('theme');
      if (t !== 'light' && t !== 'dark') {
        t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
          ? 'dark' : 'light';
      }
      html.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();`,
          }}
        />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body>{children}</body>
    </html>
  );
}