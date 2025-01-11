"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinGame = joinGame;
const jsonschema_1 = require("jsonschema");
const error_1 = __importDefault(require("../error"));
const game_service_1 = __importDefault(require("../game-service"));
const sleep_1 = __importDefault(require("../utilities/sleep"));
async function joinGame(server, request, response) {
    var _a;
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
    // Fetch the game from jsonpad
    const game = game_service_1.default.dataToGame(gameId, await server.jsonpad.fetchItemData(server.options.jsonpadGamesList, gameId));
    // Handle jsonpad rate limiting
    if (server.options.jsonpadRateLimit) {
        await (0, sleep_1.default)(server.options.jsonpadRateLimit);
    }
    // Populate player hidden state
    const players = await server.jsonpad.fetchItemsData(server.options.jsonpadPlayersList, {
        game: gameId,
    });
    const playersMap = players.data.reduce((a, p) => ({
        ...a,
        [p.id]: p,
    }), {});
    for (const player of game.players) {
        player.hiddenState = (_a = playersMap[player.id]) === null || _a === void 0 ? void 0 : _a.state;
    }
    const [updatedGame, token] = await game_service_1.default.joinGame(server, game, playerName, playerData);
    response.status(200).json({ game: updatedGame, token });
}
//# sourceMappingURL=join-game.js.map