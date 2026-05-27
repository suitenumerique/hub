import { MockDriver } from "../drivers/implementations/MockDriver";

export const getConfig = () => {
  // TODO: Later, be based on URL query params for instance.
  return {
    driver: new MockDriver(),
  };
};

export const getDriver = () => {
  return getConfig().driver;
};
