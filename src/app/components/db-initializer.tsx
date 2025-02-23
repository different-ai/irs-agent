'use client';

import { useEffect } from 'react';
import { initDB } from '@/db';

export function DatabaseInitializer() {
  useEffect(() => {
    const initialize = async () => {
      try {
        await initDB();
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initialize();
  }, []);

  return null; // This component doesn't render anything
} 