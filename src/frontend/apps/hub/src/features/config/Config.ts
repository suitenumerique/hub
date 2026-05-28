import { MatrixDriver } from "../drivers/implementations/MatrixDriver";
import { MockDriver } from "../drivers/implementations/MockDriver";

let cachedDriver: MatrixDriver | MockDriver | null = null;

export const getConfig = () => {
  // TODO: Later, be based on URL query params for instance.
  if (!cachedDriver) {
     cachedDriver = new MatrixDriver();
   }

  return {
    // driver: new MockDriver(),
    driver: cachedDriver,
  };
};

export const getDriver = () => {
  return getConfig().driver;
};
