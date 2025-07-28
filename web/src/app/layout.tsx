import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import './globals.css';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();           // 👈 await
  const cookieTheme = cookieStore.get('theme')?.value as 'light'|'dark'|undefined;

  return (
    <html lang="en" data-theme={cookieTheme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}