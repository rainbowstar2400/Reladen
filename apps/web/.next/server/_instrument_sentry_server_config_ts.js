"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "_instrument_sentry_server_config_ts";
exports.ids = ["_instrument_sentry_server_config_ts"];
exports.modules = {

/***/ "(instrument)/./sentry.server.config.ts":
/*!*********************************!*\
  !*** ./sentry.server.config.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @sentry/nextjs */ \"(instrument)/../../node_modules/.pnpm/@sentry+nextjs@10.19.0_@opentelemetry+context-async-hooks@1.30.1_@opentelemetry+core@1.30.1_@_5umf2wdfulxcrspr4b6j3m5bwe/node_modules/@sentry/nextjs/build/cjs/index.server.js\");\n/* harmony import */ var _sentry_nextjs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__);\n// This file configures the initialization of Sentry on the server.\n// The config you add here will be used whenever the server handles a request.\n// https://docs.sentry.io/platforms/javascript/guides/nextjs/\n\n_sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__.init({\n    dsn: \"https://beb96e2427f5a3d4b7f9a7da22adfdf9@o4510193229561856.ingest.us.sentry.io/4510193243521024\",\n    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.\n    tracesSampleRate: 1,\n    // Enable logs to be sent to Sentry\n    enableLogs: true,\n    // Enable sending user PII (Personally Identifiable Information)\n    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii\n    sendDefaultPii: true\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vc2VudHJ5LnNlcnZlci5jb25maWcudHMiLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUVBQW1FO0FBQ25FLDhFQUE4RTtBQUM5RSw2REFBNkQ7QUFFcEI7QUFFekNBLGdEQUFXLENBQUM7SUFDVkUsS0FBSztJQUVMLG1IQUFtSDtJQUNuSEMsa0JBQWtCO0lBRWxCLG1DQUFtQztJQUNuQ0MsWUFBWTtJQUVaLGdFQUFnRTtJQUNoRSxrR0FBa0c7SUFDbEdDLGdCQUFnQjtBQUNsQiIsInNvdXJjZXMiOlsid2VicGFjazovL3dlYi8uL3NlbnRyeS5zZXJ2ZXIuY29uZmlnLnRzP2RjZGIiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gVGhpcyBmaWxlIGNvbmZpZ3VyZXMgdGhlIGluaXRpYWxpemF0aW9uIG9mIFNlbnRyeSBvbiB0aGUgc2VydmVyLlxuLy8gVGhlIGNvbmZpZyB5b3UgYWRkIGhlcmUgd2lsbCBiZSB1c2VkIHdoZW5ldmVyIHRoZSBzZXJ2ZXIgaGFuZGxlcyBhIHJlcXVlc3QuXG4vLyBodHRwczovL2RvY3Muc2VudHJ5LmlvL3BsYXRmb3Jtcy9qYXZhc2NyaXB0L2d1aWRlcy9uZXh0anMvXG5cbmltcG9ydCAqIGFzIFNlbnRyeSBmcm9tIFwiQHNlbnRyeS9uZXh0anNcIjtcblxuU2VudHJ5LmluaXQoe1xuICBkc246IFwiaHR0cHM6Ly9iZWI5NmUyNDI3ZjVhM2Q0YjdmOWE3ZGEyMmFkZmRmOUBvNDUxMDE5MzIyOTU2MTg1Ni5pbmdlc3QudXMuc2VudHJ5LmlvLzQ1MTAxOTMyNDM1MjEwMjRcIixcblxuICAvLyBEZWZpbmUgaG93IGxpa2VseSB0cmFjZXMgYXJlIHNhbXBsZWQuIEFkanVzdCB0aGlzIHZhbHVlIGluIHByb2R1Y3Rpb24sIG9yIHVzZSB0cmFjZXNTYW1wbGVyIGZvciBncmVhdGVyIGNvbnRyb2wuXG4gIHRyYWNlc1NhbXBsZVJhdGU6IDEsXG5cbiAgLy8gRW5hYmxlIGxvZ3MgdG8gYmUgc2VudCB0byBTZW50cnlcbiAgZW5hYmxlTG9nczogdHJ1ZSxcblxuICAvLyBFbmFibGUgc2VuZGluZyB1c2VyIFBJSSAoUGVyc29uYWxseSBJZGVudGlmaWFibGUgSW5mb3JtYXRpb24pXG4gIC8vIGh0dHBzOi8vZG9jcy5zZW50cnkuaW8vcGxhdGZvcm1zL2phdmFzY3JpcHQvZ3VpZGVzL25leHRqcy9jb25maWd1cmF0aW9uL29wdGlvbnMvI3NlbmREZWZhdWx0UGlpXG4gIHNlbmREZWZhdWx0UGlpOiB0cnVlLFxufSk7XG4iXSwibmFtZXMiOlsiU2VudHJ5IiwiaW5pdCIsImRzbiIsInRyYWNlc1NhbXBsZVJhdGUiLCJlbmFibGVMb2dzIiwic2VuZERlZmF1bHRQaWkiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(instrument)/./sentry.server.config.ts\n");

/***/ })

};
;