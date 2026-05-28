import { MatrixDriver } from "../drivers/implementations/MatrixDriver";

export const getConfig = () => {
  // TODO: Later, be based on URL query params for instance.
  return {
    // driver: new MockDriver(),
    driver: new MatrixDriver(),
  };
};

export const getDriver = () => {
  return getConfig().driver;
};
