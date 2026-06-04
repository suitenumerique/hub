## Prerequisites
- install latest version of rustup 1.29.0
- wasm-bindgen-cli shoud be version 0.2.114 (`cargo install -f wasm-bindgen-cli --version 0.2.114`)
- 

## Usage

Bindings are currently vendored into the repo (src/frontend/apps/src/generated), run this to update them

```bash
./build-wasm-bindings.sh
```

This script will pull the matrix-rust-sdk and create the binding thanks to ubrn, a tool build on top of uniffi to create react native bindings (in our case, the typescript files).

A patch has been added for rust_modules to remove the feature `experimental-search` it causes compilation issues.
