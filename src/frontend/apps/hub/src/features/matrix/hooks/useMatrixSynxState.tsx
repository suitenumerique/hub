import {
    ClientEvent,
    ClientEventHandlerMap,
    MatrixClient,
} from "matrix-js-sdk";
import { useEffect } from "react";

export const useMatrixSyncState = (
  mx: MatrixClient | null,
  onChange: ClientEventHandlerMap[ClientEvent.Sync],
): void => {
  useEffect(() => {
    mx?.on(ClientEvent.Sync, onChange);
    return () => {
      mx?.removeListener(ClientEvent.Sync, onChange);
    };
  }, [mx, onChange]);
};
