import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'BrightSpark Electronics',
    template: '%s | BrightSpark Electronics',
  },
  description: 'Smart inventory & sales management for BrightSpark Electronics – track stock, manage sales, and grow your business.',
  icons: {
    icon: [
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BrightSpark',
  },
};

// Separate viewport export (required in Next.js 16)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}