"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ServerError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
exports.default = ServerError;
//# sourceMappingURL=error.js.map