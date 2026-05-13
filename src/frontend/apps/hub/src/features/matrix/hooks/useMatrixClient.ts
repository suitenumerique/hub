import { createContext, useContext } from 'react';
import { MatrixClient } from 'matrix-js-sdk';

const MatrixClientContext = createContext<MatrixClient | null>(null);

export const MatrixClientProvider = MatrixClientContext.Provider;

export function useMatrixClient(): MatrixClient | null {
  const mx = useContext(MatrixClientContext);
  if (!mx) {
    console.log('mx not initialized yet');
  }
  return mx;
}
