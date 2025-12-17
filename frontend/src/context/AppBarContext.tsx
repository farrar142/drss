'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface AppBarContextValue {
  isAppBarHidden: boolean;
  setAppBarHidden: (hidden: boolean) => void;
  toggleAppBar: () => void;
}

const AppBarContext = createContext<AppBarContextValue | null>(null);

export function AppBarProvider({ children }: { children: React.ReactNode }) {
  const [isAppBarHidden, setIsAppBarHidden] = useState(false);

  const setAppBarHidden = useCallback((hidden: boolean) => {
    setIsAppBarHidden(hidden);
  }, []);

  const toggleAppBar = useCallback(() => {
    setIsAppBarHidden(prev => !prev);
  }, []);

  const value = useMemo(() => ({
    isAppBarHidden,
    setAppBarHidden,
    toggleAppBar,
  }), [isAppBarHidden, setAppBarHidden, toggleAppBar]);

  return (
    <AppBarContext.Provider value={value}>
      {children}
    </AppBarContext.Provider>
  );
}

export function useAppBar() {
  const context = useContext(AppBarContext);
  if (!context) {
    throw new Error('useAppBar must be used within AppBarProvider');
  }
  return context;
}
