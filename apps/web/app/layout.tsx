
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SubFlow — Video Translator',
  description:
    'Import videos, manage subtitles, and track processing jobs with SubFlow.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
