'use client';

import { createContext, useContext } from 'react';

type DeskTransitionContextValue = {
  beginDeskTransition: (target: 'home' | 'desk') => number;
};

const DeskTransitionContext = createContext<DeskTransitionContextValue | null>(null);

export function DeskTransitionProvider({
  beginDeskTransition,
  children,
}: {
  beginDeskTransition: (target: 'home' | 'desk') => number;
  children: React.ReactNode;
}) {
  return (
    <DeskTransitionContext.Provider value={{ beginDeskTransition }}>
      {children}
    </DeskTransitionContext.Provider>
  );
}

export function useDeskTransition() {
  return useContext(DeskTransitionContext);
}
