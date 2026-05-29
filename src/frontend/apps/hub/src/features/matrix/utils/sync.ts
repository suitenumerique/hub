import { ClientEvent, MatrixClient } from "matrix-js-sdk";
import { applicationEmitter } from "./eventEmitter";

export const initSync = (mx: MatrixClient) => {

  mx.on(ClientEvent.Sync, (state) => {
    if (state === "PREPARED") {
      applicationEmitter.emit("matrix:roomlist:update", null)
    }
  })
}
