'use client';

import { ReactNode, createContext, useContext } from 'react';

const DeskPanelVisibilityContext = createContext(true);

export function DeskPanelVisibilityProvider({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  return (
    <DeskPanelVisibilityContext.Provider value={visible}>
      {children}
    </DeskPanelVisibilityContext.Provider>
  );
}

export function useDeskPanelContentVisible() {
  return useContext(DeskPanelVisibilityContext);
}
