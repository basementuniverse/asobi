"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = sleep;
async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
//# sourceMappingURL=sleep.js.map