import { MatrixClient } from "matrix-js-sdk";
import { createContext, useContext } from "react";

const MatrixClientContext = createContext<MatrixClient | null>(null);

export const MatrixClientProvider = MatrixClientContext.Provider;

export function useMatrixClient(): MatrixClient | null {
  const mx = useContext(MatrixClientContext);
  if (!mx) {
    console.log('mx not initialized yet');
  }
  return mx;
}
