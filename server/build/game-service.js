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
const async_1 = require("@basementuniverse/async");
const utils_1 = require("@basementuniverse/utils");
const uuid_1 = require("uuid");
const constants = __importStar(require("./constants"));
const error_1 = __importDefault(require("./error"));
const types_1 = require("./types");
const generate_token_1 = __importDefault(require("./utilities/generate-token"));
const sleep_1 = __importDefault(require("./utilities/sleep"));
const TURN_TIMEOUTS = {};
const ROUND_TIMEOUTS = {};
const GAME_TIMEOUTS = {};
class GameService {
    /**
     * Convert a game to serialisable data
     */
    static gameToData(game) {
        var _a, _b, _c;
        const data = {
            ...(0, utils_1.exclude)(game, 'id'),
            moves: game.moves.map(move => ({
                ...move,
                movedAt: move.movedAt.toISOString(),
            })),
            startedAt: ((_a = game.startedAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || null,
            finishedAt: ((_b = game.finishedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || null,
        };
        // Convert the movedAt date if present
        // (for 'player-moved' events, lastEventData will contain move data)
        if ((_c = game.lastEventData) === null || _c === void 0 ? void 0 : _c.movedAt) {
            data.lastEventData = {
                ...game.lastEventData,
                movedAt: game.lastEventData.movedAt.toISOString(),
            };
        }
        // Remove hidden state from player data if any remains
        // (it should have been removed already, but just in case...)
        data.players.forEach((player) => {
            if (player.hiddenState) {
                delete player.hiddenState;
            }
        });
        return data;
    }
    /**
     * Convert serialised data to a game
     */
    static dataToGame(id, data) {
        var _a;
        const game = {
            id,
            ...data,
            moves: data.moves.map((move) => ({
                ...move,
                movedAt: new Date(move.movedAt),
            })),
            startedAt: data.startedAt ? new Date(data.startedAt) : null,
            finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
        };
        // Convert the movedAt date if present
        // (for 'player-moved' events, lastEventData will contain move data)
        if ((_a = data.lastEventData) === null || _a === void 0 ? void 0 : _a.movedAt) {
            game.lastEventData = {
                ...data.lastEventData,
                movedAt: new Date(data.lastEventData.movedAt),
            };
        }
        return game;
    }
    /**
     * Create a new game with the specified player as Player 1
     */
    static async createGame(server, playerName, playerData, gameData, numPlayers) {
        var _a, _b, _c;
        // Prepare public player data for the new player
        const player = {
            id: (0, uuid_1.v4)(),
            name: playerName || 'Player 1',
            status: types_1.PlayerStatus.WAITING_FOR_TURN,
            state: playerData !== null && playerData !== void 0 ? playerData : {},
        };
        // Calculate how many players are required for this game session
        const actualNumPlayers = (0, utils_1.clamp)(numPlayers || server.options.minPlayers, server.options.minPlayers, server.options.maxPlayers);
        // Create initial game data
        let game = {
            id: '',
            status: types_1.GameStatus.WAITING_TO_START,
            startedAt: null,
            finishedAt: null,
            lastEventType: 'game-created',
            lastEventData: null,
            numPlayers: actualNumPlayers,
            players: [player],
            moves: [],
            round: 0,
            state: gameData !== null && gameData !== void 0 ? gameData : {},
        };
        // If we've got enough players, start the game
        if (game.players.length >= game.numPlayers) {
            this.startGame(server, game);
        }
        // Call createGame hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.createGame) === null || _b === void 0 ? void 0 : _b.call(_a, game, player)))) !== null && _c !== void 0 ? _c : game;
        // Extract hidden state
        let hiddenState = undefined;
        if (game.players[0].hiddenState) {
            hiddenState = game.players[0].hiddenState;
            delete game.players[0].hiddenState;
        }
        // Save the game in jsonpad
        const createdGameItem = await server.jsonpad.createItem(server.options.jsonpadGamesList, {
            data: this.gameToData(game),
        });
        // Handle jsonpad rate limiting
        if (server.options.jsonpadRateLimit) {
            await (0, sleep_1.default)(server.options.jsonpadRateLimit);
        }
        // Save player data in jsonpad
        const token = (0, generate_token_1.default)();
        await server.jsonpad.createItem(server.options.jsonpadPlayersList, {
            data: {
                playerId: player.id,
                gameId: createdGameItem.id,
                token,
                state: hiddenState !== null && hiddenState !== void 0 ? hiddenState : {},
            },
        });
        // Re-insert hidden state
        const result = this.dataToGame(createdGameItem.id, createdGameItem.data);
        result.players[0].hiddenState = hiddenState;
        return [result, token];
    }
    /**
     * Join an existing game as Player 2+
     */
    static async joinGame(server, game, playerName, playerData) {
        var _a, _b, _c, _d;
        // Check if we've already reached the maximum number of players
        if (game.players.length >= game.numPlayers) {
            throw new error_1.default('Game is full', 403);
        }
        // Check if the game has already started
        if (game.status !== types_1.GameStatus.WAITING_TO_START) {
            throw new error_1.default('Game has already started', 403);
        }
        // Prepare public player data for the joining player
        const player = {
            id: (0, uuid_1.v4)(),
            name: playerName || `Player ${game.players.length + 1}`,
            status: types_1.PlayerStatus.WAITING_FOR_TURN,
            state: playerData !== null && playerData !== void 0 ? playerData : {},
        };
        // Add player to the game
        game.players.push(player);
        // If we've got enough players, start the game
        if (game.players.length >= game.numPlayers) {
            this.startGame(server, game);
        }
        // Hash and cache all player hidden states so we can check later if
        // they've been changed
        const originalHiddenStates = game.players
            .map(p => [p.id, JSON.stringify(p.hiddenState)])
            .reduce((a, [id, state]) => ({ ...a, [id]: state }), {});
        // Call joinGame hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.joinGame) === null || _b === void 0 ? void 0 : _b.call(_a, game, player)))) !== null && _c !== void 0 ? _c : game;
        // Extract hidden state for all players
        const updatedHiddenStates = {};
        for (const p of game.players) {
            if (p.hiddenState) {
                updatedHiddenStates[p.id] = p.hiddenState;
                delete p.hiddenState;
            }
        }
        // Save the game in jsonpad
        const updatedGameItem = await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData({
            ...game,
            lastEventType: 'player-joined',
            lastEventData: player,
        }));
        // Handle jsonpad rate limiting
        if (server.options.jsonpadRateLimit) {
            await (0, sleep_1.default)(server.options.jsonpadRateLimit);
        }
        // Save joining player data in jsonpad
        const token = (0, generate_token_1.default)();
        await server.jsonpad.createItem(server.options.jsonpadPlayersList, {
            data: {
                playerId: player.id,
                gameId: updatedGameItem.id,
                token,
                state: (_d = updatedHiddenStates[player.id]) !== null && _d !== void 0 ? _d : {},
            },
        });
        // Update existing player data in jsonpad
        await (0, async_1.asyncForEach)(game.players, async (p) => {
            var _a;
            if (p.id !== player.id) {
                if (updatedHiddenStates[p.id] &&
                    JSON.stringify(p.hiddenState) !== originalHiddenStates[p.id]) {
                    await server.jsonpad.replaceItemData(server.options.jsonpadPlayersList, p.id, (_a = updatedHiddenStates[p.id]) !== null && _a !== void 0 ? _a : {}, {
                        pointer: '/state',
                    });
                    // Handle jsonpad rate limiting
                    if (server.options.jsonpadRateLimit) {
                        await (0, sleep_1.default)(server.options.jsonpadRateLimit);
                    }
                }
            }
        });
        // Re-insert hidden state for the joining player into the response
        const result = this.dataToGame(updatedGameItem.id, updatedGameItem.data);
        const playerIndex = result.players.findIndex(p => p.id === player.id);
        result.players[playerIndex].hiddenState = updatedHiddenStates[player.id];
        return [result, token];
    }
    /**
     * Start a game
     */
    static startGame(server, game) {
        game.status = types_1.GameStatus.STARTED;
        game.startedAt = new Date();
        game.round = 1;
        // Handle initial move
        let firstPlayer;
        switch (server.options.mode) {
            case types_1.GameMode.TURNS:
                // Player 1 has the first turn
                firstPlayer = game.players[0];
                firstPlayer.status = types_1.PlayerStatus.TAKING_TURN;
                // If a turn time limit is defined, set a timeout for the current player
                if (server.options.turnTimeLimit) {
                    const timeLimit = Math.max(server.options.turnTimeLimit * constants.MS, constants.MIN_TIMEOUT);
                    TURN_TIMEOUTS[firstPlayer.id] = setTimeout(async () => {
                        game.lastEventType = 'timed-out';
                        const updatedGame = this.advanceGame(server, game, firstPlayer);
                        await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(updatedGame));
                    }, timeLimit);
                    game.turnFinishesAt = new Date(Date.now() + timeLimit);
                }
                break;
            case types_1.GameMode.ROUNDS:
                // All players are ready to move
                game.players.forEach(p => {
                    p.status = types_1.PlayerStatus.TAKING_TURN;
                });
                // If a round time limit is defined, set a timeout for the current round
                if (server.options.roundTimeLimit) {
                    const timeLimit = Math.max(server.options.roundTimeLimit * constants.MS, constants.MIN_TIMEOUT);
                    ROUND_TIMEOUTS[game.id] = setTimeout(async () => {
                        game.lastEventType = 'timed-out';
                        game.round++;
                        game.players.forEach(p => {
                            p.status = types_1.PlayerStatus.TAKING_TURN;
                        });
                        await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(game));
                    }, timeLimit);
                    game.roundFinishesAt = new Date(Date.now() + timeLimit);
                }
            case types_1.GameMode.FREE:
                // All players are ready to move
                game.players.forEach(p => {
                    p.status = types_1.PlayerStatus.TAKING_TURN;
                });
                break;
        }
        // If a game time limit is defined, set a timeout for the game
        if (server.options.gameTimeLimit) {
            const timeLimit = Math.max(server.options.gameTimeLimit * constants.MS, constants.MIN_TIMEOUT);
            GAME_TIMEOUTS[game.id] = setTimeout(async () => {
                game.lastEventType = 'timed-out';
                const finishedGame = await this.finishGame(server, game);
                await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(finishedGame));
            }, timeLimit);
            game.gameFinishesAt = new Date(Date.now() + timeLimit);
        }
        return game;
    }
    /**
     * Make a move in an existing game
     */
    static async move(server, game, token, moveData) {
        var _a, _b, _c, _d;
        // Check if the game is running
        if (game.status !== types_1.GameStatus.STARTED) {
            throw new error_1.default('Game is not running', 403);
        }
        // Find out which player is making the move in this game based on the token
        const playerResults = await server.jsonpad.fetchItems(server.options.jsonpadPlayersList, {
            limit: 1,
            game: game.id,
            token,
            includeData: true,
        });
        if (playerResults.total === 0) {
            // No player found with this token
            throw new error_1.default('Invalid player token', 403);
        }
        if (playerResults.data[0].data.gameId !== game.id ||
            playerResults.data[0].data.token !== token) {
            // Game id or token doesn't match
            throw new error_1.default('Invalid player token', 403);
        }
        // Get the moving player's data from the game
        const playerId = playerResults.data[0].data.playerId;
        const player = game.players.find(p => p.id === playerId);
        if (!player) {
            throw new error_1.default('Player not found', 404);
        }
        // Check if it's the player's turn
        if (player.status !== types_1.PlayerStatus.TAKING_TURN) {
            throw new error_1.default('Not your turn', 403);
        }
        // Add the move to the game's move log
        const move = {
            playerId: player.id,
            movedAt: new Date(),
            data: moveData !== null && moveData !== void 0 ? moveData : {},
        };
        game.moves.push(move);
        game.lastEventType = 'player-moved';
        game.lastEventData = null;
        // Hash and cache all player hidden states so we can check later if
        // they've been changed
        const originalHiddenStates = game.players
            .map(p => [p.id, JSON.stringify(p.hiddenState)])
            .reduce((a, [id, state]) => ({ ...a, [id]: state }), {});
        // Call move hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.move) === null || _b === void 0 ? void 0 : _b.call(_a, game, player, move)))) !== null && _c !== void 0 ? _c : game;
        // Extract hidden state for all players
        const updatedHiddenStates = {};
        for (const p of game.players) {
            if (p.hiddenState) {
                updatedHiddenStates[p.id] = p.hiddenState;
                delete p.hiddenState;
            }
        }
        // Check if the game has been finished in this move
        if (game.status === types_1.GameStatus.FINISHED) {
            game = await this.finishGame(server, game, false);
        }
        else {
            this.advanceGame(server, game, player);
        }
        // Save the game in jsonpad
        const updatedGameItem = await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData({
            ...game,
            lastEventData: {
                ...move,
                ...((_d = game.lastEventData) !== null && _d !== void 0 ? _d : {}),
            },
        }));
        // Handle jsonpad rate limiting
        if (server.options.jsonpadRateLimit) {
            await (0, sleep_1.default)(server.options.jsonpadRateLimit);
        }
        // Update existing player data in jsonpad
        await (0, async_1.asyncForEach)(game.players, async (p) => {
            var _a;
            if (p.id !== player.id) {
                if (updatedHiddenStates[p.id] &&
                    JSON.stringify(p.hiddenState) !== originalHiddenStates[p.id]) {
                    await server.jsonpad.replaceItemData(server.options.jsonpadPlayersList, p.id, (_a = updatedHiddenStates[p.id]) !== null && _a !== void 0 ? _a : {}, {
                        pointer: '/state',
                    });
                    // Handle jsonpad rate limiting
                    if (server.options.jsonpadRateLimit) {
                        await (0, sleep_1.default)(server.options.jsonpadRateLimit);
                    }
                }
            }
        });
        // Re-insert hidden state for the moving player into the response
        const result = this.dataToGame(updatedGameItem.id, updatedGameItem.data);
        const playerIndex = result.players.findIndex(p => p.id === player.id);
        result.players[playerIndex].hiddenState = updatedHiddenStates[player.id];
        return result;
    }
    /**
     * Handle turn/round advancement
     */
    static advanceGame(server, game, player) {
        // Handle turn/round advancement
        switch (server.options.mode) {
            case types_1.GameMode.TURNS:
                // Current player has finished their turn
                player.status = types_1.PlayerStatus.WAITING_FOR_TURN;
                // Advance to the next turn
                let nextPlayer;
                if (game.players.some(p => p.status === types_1.PlayerStatus.WAITING_FOR_TURN)) {
                    const currentPlayerIndex = game.players.findIndex(p => p.id === player.id);
                    for (let i = 1; i < game.players.length; i++) {
                        const currentIndex = (currentPlayerIndex + i) % game.players.length;
                        // Increment the round if we pass the end of the player list
                        if (currentIndex >= game.players.length) {
                            game.round++;
                        }
                        if (game.players[currentIndex].status ===
                            types_1.PlayerStatus.WAITING_FOR_TURN) {
                            nextPlayer = game.players[currentIndex];
                            nextPlayer.status = types_1.PlayerStatus.TAKING_TURN;
                            break;
                        }
                    }
                }
                // Sanity check: if all players are waiting for their turn, something went wrong
                // In this case, we'll just set the first player to taking their turn
                if (game.players.every(p => p.status === types_1.PlayerStatus.WAITING_FOR_TURN)) {
                    nextPlayer = game.players[0];
                    nextPlayer.status = types_1.PlayerStatus.TAKING_TURN;
                }
                // If a turn time limit is defined, set a timeout for the current player
                if (server.options.turnTimeLimit) {
                    const timeLimit = server.options.turnTimeLimit * constants.MS;
                    if (TURN_TIMEOUTS[player.id]) {
                        clearTimeout(TURN_TIMEOUTS[player.id]);
                    }
                    TURN_TIMEOUTS[player.id] = setTimeout(async () => {
                        game.lastEventType = 'timed-out';
                        const updatedGame = this.advanceGame(server, game, nextPlayer);
                        await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(updatedGame));
                    }, timeLimit);
                    game.turnFinishesAt = new Date(Date.now() + timeLimit);
                }
                break;
            case types_1.GameMode.ROUNDS:
                // Current player has finished their turn
                player.status = types_1.PlayerStatus.WAITING_FOR_TURN;
                // If all players have finished their turn, advance to the next round
                if (game.players.every(p => p.status === types_1.PlayerStatus.WAITING_FOR_TURN)) {
                    game.round++;
                    game.players.forEach(p => {
                        p.status = types_1.PlayerStatus.TAKING_TURN;
                    });
                    // If a round time limit is defined, set a timeout for the current round
                    if (server.options.roundTimeLimit) {
                        const timeLimit = server.options.roundTimeLimit * constants.MS;
                        if (ROUND_TIMEOUTS[game.id]) {
                            clearTimeout(ROUND_TIMEOUTS[game.id]);
                        }
                        ROUND_TIMEOUTS[game.id] = setTimeout(async () => {
                            game.lastEventType = 'timed-out';
                            game.players.forEach(p => {
                                p.status = types_1.PlayerStatus.WAITING_FOR_TURN;
                            });
                            const updatedGame = this.advanceGame(server, game, player);
                            await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(updatedGame));
                        }, timeLimit);
                        game.roundFinishesAt = new Date(Date.now() + timeLimit);
                    }
                }
                break;
            case types_1.GameMode.FREE:
                break;
        }
        return game;
    }
    /**
     * Finish a game
     */
    static async finishGame(server, game, save = true) {
        var _a, _b, _c;
        game.status = types_1.GameStatus.FINISHED;
        game.finishedAt = new Date();
        game.lastEventType = 'game-finished';
        // Call finishGame hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.finishGame) === null || _b === void 0 ? void 0 : _b.call(_a, game)))) !== null && _c !== void 0 ? _c : game;
        // Invalidate all player tokens for this game
        await (0, async_1.asyncForEach)(game.players, async (p) => {
            await server.jsonpad.deleteItem(server.options.jsonpadPlayersList, p.id);
            // Handle jsonpad rate limiting
            if (server.options.jsonpadRateLimit) {
                await (0, sleep_1.default)(server.options.jsonpadRateLimit);
            }
        });
        // Remove timeouts for this game
        for (const player of game.players) {
            if (TURN_TIMEOUTS[player.id]) {
                clearTimeout(TURN_TIMEOUTS[player.id]);
            }
        }
        if (ROUND_TIMEOUTS[game.id]) {
            clearTimeout(ROUND_TIMEOUTS[game.id]);
        }
        if (GAME_TIMEOUTS[game.id]) {
            clearTimeout(GAME_TIMEOUTS[game.id]);
        }
        // Save the game in jsonpad
        if (save) {
            const updatedGameItem = await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(game));
            return this.dataToGame(updatedGameItem.id, updatedGameItem.data);
        }
        return game;
    }
}
exports.default = GameService;
//# sourceMappingURL=game-service.js.map