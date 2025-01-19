"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGame = createGame;
const jsonschema_1 = require("jsonschema");
const error_1 = __importDefault(require("../error"));
const game_service_1 = __importDefault(require("../services/game-service"));
async function createGame(server, request, response) {
    const { playerName, playerData, gameData } = request.body;
    // Validate player data
    if (playerData && server.options.playerSchema) {
        const { valid, errors } = (0, jsonschema_1.validate)(playerData, server.options.playerSchema);
        if (!valid) {
            throw new error_1.default(`Validation error (${errors.map(e => e.message).join(', ')})`, 400);
        }
    }
    // Validate game data
    if (gameData && server.options.gameSchema) {
        const validationResult = (0, jsonschema_1.validate)(gameData, server.options.gameSchema);
        if (validationResult.errors) {
            throw new error_1.default(`Validation error (${validationResult.errors
                .map(e => e.message)
                .join(', ')})`, 400);
        }
    }
    const [game, token] = await game_service_1.default.createGame(server, playerName, playerData, gameData);
    response.status(201).json({ game, token });
}
//# sourceMappingURL=create-game.js.map