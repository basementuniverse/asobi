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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const constants = __importStar(require("../constants"));
class QueueService {
    /**
     * Add a function to the specified queue
     */
    static add(gameId, fn) {
        if (!this.queues[gameId]) {
            this.queues[gameId] = [];
        }
        this.queues[gameId].push(fn);
        if (!this.processing[gameId]) {
            this.processQueue(gameId);
        }
    }
    /**
     * Process the queue for the specified game
     */
    static async processQueue(gameId) {
        this.processing[gameId] = true;
        const queue = this.queues[gameId];
        while (queue.length > 0) {
            const fn = queue.shift();
            try {
                await (fn === null || fn === void 0 ? void 0 : fn());
            }
            catch (error) {
                console.error(`Error processing function in queue for game ${gameId}:`, error);
            }
        }
        this.processing[gameId] = false;
    }
    /**
     * Setup an interval to check the queues every N seconds
     */
    static startCheck() {
        this.checkInterval = setInterval(this.checkQueues, constants.QUEUE_CHECK_INTERVAL);
    }
    /**
     * Stop the interval checking the queues
     */
    static stopCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }
    /**
     * Check all queues to make sure they are being processed if they have items
     * to process
     *
     * Any queue that is not being processed and has items to process will be
     * processed
     */
    static checkQueues() {
        for (const gameId in this.queues) {
            if (this.queues[gameId].length > 0 && !this.processing[gameId]) {
                this.processQueue(gameId);
            }
        }
    }
}
QueueService.queues = {};
QueueService.processing = {};
exports.default = QueueService;
//# sourceMappingURL=queue-service.js.map