import { useCallback, useEffect, useState } from "react";
import { initClient, startClient } from "../initMatrix";

import { useAuth } from "@/features/auth/Auth";
import { MatrixClient } from "matrix-js-sdk/lib/matrix";
import { useMatrixSyncState } from "../hooks/useMatrixSynxState";


export function MatrixClientRoot() {
  // const queryClient = useQueryClient();
  // get logged matrix chatUser
  const { chatUser } = useAuth();
  const [mx, setMx] = useState<MatrixClient | null>(null);

  // We only initialize the matrix client after the user as authenticated
  useEffect(() => {
    if (!chatUser || mx && mx.clientRunning) return;
    const initialization = async () => {
      const mx = await initClient(chatUser!);
      startClient(mx);
      setMx(mx);
    }
    initialization();
  }, [chatUser]);

  useMatrixSyncState(
    mx,
    useCallback((state) => {
      if (state === 'PREPARED') {
        console.log('**** Matrix client ready ! ');
        // Invalidate room list query to fetch visible rooms
        // queryClient.invalidateQueries({ queryKey: ['matrixRooms'] });
      }
    }, []),
  );

  return (
    mx
  );
}
