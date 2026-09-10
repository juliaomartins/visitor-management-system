// Metro configuration for vms-scanner.
//
// THIS FILE EXISTS FOR ONE REASON: `.wasm`.
//
// `expo-sqlite` on web is a real implementation, not a shim -- it runs SQLite
// compiled to WebAssembly (wa-sqlite) inside a worker. Its worker does:
//
//     import wasmModule from './wa-sqlite/wa-sqlite.wasm';   // worker.ts:22
//     ...
//     locateFile: () => wasmModule,                          // worker.ts:782
//
// Metro's default `assetExts` does not include `wasm`, and `sourceExts` is only
// js/jsx/json/ts/tsx -- so that import resolves to nothing and the web bundle
// fails with "Unable to resolve module ./wa-sqlite/wa-sqlite.wasm". The file is
// present in node_modules and always was; Metro simply had no rule for it.
//
// It goes in `assetExts`, NOT `sourceExts`. Emscripten's `locateFile` must
// return a URL that the runtime then fetches, and an asset import is exactly
// that: Metro serves the file and hands back its URI. Treating it as source
// would try to parse 600KB of WebAssembly as JavaScript.
//
// Native builds are unaffected -- nothing in this app imports a `.wasm` on
// iOS or Android, so the extra extension costs them nothing.

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

module.exports = config;
