import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NEO STUDIO AI — Complete AI Production Platform',
  description:
    'Platform produksi konten berbasis kecerdasan buatan terinspirasi workflow SUTRADARA AI V5.3. Buat cerita, karakter, storyboard, gambar, video, dialog, dan voice over dengan multi-provider AI.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: '#080910',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-background text-gray-100 antialiased selection:bg-accent-purple selection:text-white">
        {children}
      </body>
    </html>
  );
}
