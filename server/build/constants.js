"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_CHECK_INTERVAL = exports.MAX_TIME_LIMIT = exports.MIN_TIMEOUT = exports.MS = exports.TOKEN_PREFIX = exports.TOKEN_LENGTH = exports.DEFAULT_PORT = void 0;
exports.DEFAULT_PORT = 3000;
exports.TOKEN_LENGTH = 32;
exports.TOKEN_PREFIX = 'Bearer ';
exports.MS = 1000;
exports.MIN_TIMEOUT = 1 * exports.MS;
exports.MAX_TIME_LIMIT = 30 * 24 * 60 * 60; // 30 days in seconds
exports.QUEUE_CHECK_INTERVAL = 5 * exports.MS;
//# sourceMappingURL=constants.js.map