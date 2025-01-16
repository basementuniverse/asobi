"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinGame = joinGame;
const jsonschema_1 = require("jsonschema");
const error_1 = __importDefault(require("../error"));
const game_service_1 = __importDefault(require("../services/game-service"));
const queue_service_1 = __importDefault(require("../services/queue-service"));
const sleep_1 = __importDefault(require("../utilities/sleep"));
async function joinGame(server, request, response) {
    const gameId = request.params.gameId;
    const { playerName, playerData } = request.body;
    if (!gameId) {
        throw new error_1.default('Game id is required', 400);
    }
    // Validate player data
    if (playerData && server.options.playerSchema) {
        const { valid, errors } = (0, jsonschema_1.validate)(playerData, server.options.playerSchema);
        if (!valid) {
            throw new error_1.default(`Validation error (${errors.map(e => e.message).join(', ')})`, 400);
        }
    }
    // Handle player joining using a queue to avoid race conditions
    queue_service_1.default.add(gameId, async () => {
        // Fetch the game from jsonpad
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
        const game = game_service_1.default.dataToGame(gameId, await server.jsonpad.fetchItemData(server.options.jsonpadGamesList, gameId));
        // Populate player hidden state
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
        const players = await server.jsonpad.fetchItemsData(server.options.jsonpadPlayersList, {
            game: gameId,
        });
        const playersMap = players.data.reduce((a, p) => ({
            ...a,
            [p.playerId]: p.state,
        }), {});
        for (const player of game.players) {
            player.hiddenState = playersMap[player.id];
        }
        const [updatedGame, token] = await game_service_1.default.joinGame(server, game, playerName, playerData);
        response.status(200).json({ game: updatedGame, token });
    });
}
//# sourceMappingURL=join-game.js.map