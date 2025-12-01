import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorkFlow - Employee Portal',
  description: 'Gestione presenze, ferie e turni per team moderni',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-gray-50 text-gray-900 antialiased select-none overscroll-none">
        {children}
      </body>
    </html>
  );
}
