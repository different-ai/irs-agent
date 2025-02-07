import './globals.css';
import { Inter } from 'next/font/google';
import { DatabaseProvider } from '@/components/providers/database-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Agent View',
  description: 'A powerful agent for viewing and managing your data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DatabaseProvider>
          {children}
        </DatabaseProvider>
      </body>
    </html>
  );
}
