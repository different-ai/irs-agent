'use client';

import { useEffect } from 'react';
import { initDB } from '@/db';

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initDB().catch(console.error);
    }
  }, []);

  return <>{children}</>;
} 