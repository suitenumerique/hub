import { getDriver } from '@/features/config/Config';
import { useMemo, useSyncExternalStore } from 'react';
import { Driver } from '../Driver';
import { MatrixDriver } from '../implementations/MatrixDriver';

export const useDriver = (): Driver | null => {
  return useMemo(() => getDriver(), []);
};

export const useIsDriverReady = () => {
  const driver = useDriver();

  return useSyncExternalStore(
    (listener) => {
      // subscribe: listen to readiness changes for Matrix Driver
      if (driver instanceof MatrixDriver) {
        return driver.subscribeToReadiness(listener);
      }
      return () => {};
    },
    () => {
      if (driver instanceof MatrixDriver) {
        return driver.getIsMatrixClientReady();
      }
      return true;
    },
  );
};
