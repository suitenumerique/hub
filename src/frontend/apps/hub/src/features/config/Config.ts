import { MatrixDriver } from '../drivers/implementations/MatrixDriver';
import { StandardDriver } from '../drivers/implementations/StandardDriver';

let cachedDriver: MatrixDriver | StandardDriver | null = null;

export const getConfig = () => {
  // TODO: Later, be based on URL query params for instance.
  if (!cachedDriver) {
    cachedDriver = new MatrixDriver();
  }
  return {
    driver: cachedDriver,
  };
};

export const getDriver = () => {
  return getConfig().driver;
};
