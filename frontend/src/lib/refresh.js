import { createContext, useContext } from 'react';

// The refresh button lives in the tab header, outside the screens. It bumps this
// number; screens list it in their load effect's dependencies to reload.
export const RefreshContext = createContext(0);

export function useRefreshKey() {
  return useContext(RefreshContext);
}
