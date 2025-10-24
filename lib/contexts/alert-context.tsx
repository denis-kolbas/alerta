'use client';

import { createContext, useContext, ReactNode } from 'react';
import useSWR from 'swr';

interface AlertContextType {
  activeAlertCount: number;
  isLoading: boolean;
  mutate: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AlertProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, mutate } = useSWR('/api/alerts/count', fetcher, {
    refreshInterval: 5000, // Refresh every 5 seconds for faster updates
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const activeAlertCount = data?.count || 0;

  return (
    <AlertContext.Provider value={{ activeAlertCount, isLoading, mutate }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlertCount() {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlertCount must be used within an AlertProvider');
  }
  return context;
}
