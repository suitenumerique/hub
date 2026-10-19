/**
 * Rust Crypto otherwise downloads and compiles its WebAssembly (several MB)
 * only when `initRustCrypto` runs, after the session checks. Starting it
 * earlier overlaps both; the package shares this single load with the SDK.
 * This module stays free of matrix-js-sdk so the main bundle can import it.
 */
export const preloadRustCrypto = (): void => {
  void import("@matrix-org/matrix-sdk-crypto-wasm")
    .then(({ initAsync }) => initAsync())
    // initRustCrypto awaits the same load and reports its failure.
    .catch(() => {});
};
