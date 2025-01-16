"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const queue_service_1 = __importDefault(require("./queue-service"));
class SchedulerService {
    /**
     * Schedule a function to be queued after a certain amount of time
     */
    static schedule(gameId, playerId, type, fn, ms) {
        const actualId = `${gameId}-${playerId}-${type}`;
        if (this.timeouts[actualId]) {
            clearTimeout(this.timeouts[actualId]);
        }
        this.timeouts[actualId] = setTimeout(() => {
            queue_service_1.default.add(gameId, async () => {
                fn();
                delete this.timeouts[actualId];
            });
        }, ms);
    }
    /**
     * Cancel a scheduled function
     */
    static clear(gameId, playerId, type) {
        // If no playerId or type is provided, clear all timeouts for the game
        // regardless of which player or type they are for
        if (playerId === undefined || type === undefined) {
            for (const key in this.timeouts) {
                if (key.startsWith(gameId)) {
                    clearTimeout(this.timeouts[key]);
                    delete this.timeouts[key];
                }
            }
            return;
        }
        // Otherwise clear only the specified timeout, if it exists
        const actualId = `${gameId}-${playerId}-${type}`;
        if (this.timeouts[actualId]) {
            clearTimeout(this.timeouts[actualId]);
            delete this.timeouts[actualId];
        }
    }
}
SchedulerService.timeouts = {};
exports.default = SchedulerService;
//# sourceMappingURL=scheduler-service.js.map