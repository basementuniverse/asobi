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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.move = move;
const jsonschema_1 = require("jsonschema");
const constants = __importStar(require("../constants"));
const error_1 = require("../error");
const game_service_1 = __importDefault(require("../services/game-service"));
const queue_service_1 = __importDefault(require("../services/queue-service"));
async function move(server, request, response) {
    let token = request.headers['authorization'];
    const gameId = request.params.gameId;
    const { moveData } = request.body;
    if (!gameId) {
        throw new error_1.ServerError('Game id is required', 400);
    }
    if (!token) {
        throw new error_1.ServerError('Token is required', 400);
    }
    if (token.startsWith(constants.TOKEN_PREFIX)) {
        token = token.slice(constants.TOKEN_PREFIX.length);
    }
    // Validate move data
    if (moveData && server.options.moveSchema) {
        const { valid, errors } = (0, jsonschema_1.validate)(moveData, server.options.moveSchema);
        if (!valid) {
            throw new error_1.ServerError(`Validation error (${errors.map(e => e.message).join(', ')})`, 400);
        }
    }
    // Handle player moves using a queue to avoid race conditions
    queue_service_1.default.add(gameId, async () => {
        const updatedGame = await game_service_1.default.move(server, gameId, token, moveData);
        response.status(200).json({ game: updatedGame });
    });
}
//# sourceMappingURL=move.js.map