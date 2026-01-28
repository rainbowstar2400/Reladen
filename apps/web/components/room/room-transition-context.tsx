'use client';

import { createContext, useContext } from 'react';

type DeskTransitionContextValue = {
  beginDeskTransition: () => number;
};

const DeskTransitionContext = createContext<DeskTransitionContextValue | null>(null);

export function DeskTransitionProvider({
  beginDeskTransition,
  children,
}: {
  beginDeskTransition: () => number;
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
