export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en">
        <body className="min-h-screen bg-neutral-900 text-neutral-100">{children}</body>
      </html>
    );
  }