"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsobiServer = exports.AsobiServerError = void 0;
var error_1 = require("./error");
Object.defineProperty(exports, "AsobiServerError", { enumerable: true, get: function () { return error_1.ServerError; } });
var server_1 = require("./server");
Object.defineProperty(exports, "AsobiServer", { enumerable: true, get: function () { return server_1.Server; } });
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map