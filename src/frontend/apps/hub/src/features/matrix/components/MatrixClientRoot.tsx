import React, { ReactNode, useCallback, useEffect } from 'react';
import { initClient, startClient } from '../initMatrix';

import { MatrixClientProvider } from '../hooks/useMatrixClients';
import { useMatrixSyncState } from '../hooks/useMatrixSynxState';
import { useAuth } from '@/features/auth/Auth';
import { useQuery } from '@tanstack/react-query';
// import { getDriver } from '@/features/config/Config';
// import { MatrixDriver } from '@/features/drivers/implementations/MatrixDriver';

type ClientRootProps = {
  children: ReactNode;
};

export function MatrixClientRoot({ children }: ClientRootProps) {
  // const queryClient = useQueryClient();
  // get logged matrix chatUser
  const { chatUser } = useAuth();
  // const driver = getDriver() as MatrixDriver;

  // We only initialize the matrix client after the user as authenticated
  const { data: mx } = useQuery({
    queryKey: ['matrixClient', chatUser], // Refetch when chatUser changes
    queryFn: async () => {
      console.log('**** initializing matrix client', chatUser);
      return initClient(chatUser!);
    },
    enabled: !!chatUser, // Only run query when chatUser exists
    staleTime: Infinity, // Client doesn't stale
    retry: 1,
  });

  useEffect(() => {
    if (mx && !mx.clientRunning) {
      console.log('***Start syncing');
      startClient(mx)
        .then(() => {
          // we pass down the mx client to the driver
          // driver.setMatrixClient(mx!);
        })
        .catch((error) => {
          console.error('Failed to start matrix client:', error);
        });
    }
  }, [mx]);

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
    <MatrixClientProvider value={mx || null}>{children}</MatrixClientProvider>
  );
}
