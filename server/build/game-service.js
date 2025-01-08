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
const crypto = __importStar(require("crypto"));
const uuid_1 = require("uuid");
const constants = __importStar(require("./constants"));
const error_1 = __importDefault(require("./error"));
const types_1 = require("./types");
const PLAYER_TOKENS = {};
const TURN_TIMEOUTS = {};
const ROUND_TIMEOUTS = {};
const GAME_TIMEOUTS = {};
class GameService {
    /**
     * Generate and cache a player token
     */
    static async addToken(server, gameId, playerId) {
        const token = this.generateToken();
        if (server.options.jsonpadPlayersList !== null) {
            await server.jsonpad.createItem(server.options.jsonpadPlayersList, {
                data: {
                    playerId,
                    gameId,
                    token,
                },
            });
        }
        else {
            PLAYER_TOKENS[playerId] = {
                gameId,
                token,
            };
        }
        return token;
    }
    /**
     * Remove a player token from the cache
     */
    static async removeToken(server, gameId, playerId) {
        if (server.options.jsonpadPlayersList !== null) {
            await server.jsonpad.deleteItem(server.options.jsonpadPlayersList, playerId);
        }
        else if (PLAYER_TOKENS[playerId] &&
            PLAYER_TOKENS[playerId].gameId === gameId) {
            delete PLAYER_TOKENS[playerId];
        }
    }
    /**
     * Check if a player token is valid
     */
    static async verifyToken(server, gameId, playerId, token) {
        let playerToken;
        if (server.options.jsonpadPlayersList !== null) {
            playerToken = await server.jsonpad.fetchItemData(server.options.jsonpadPlayersList, playerId);
        }
        else {
            playerToken = PLAYER_TOKENS[playerId];
        }
        return (playerToken &&
            playerToken.gameId === gameId &&
            playerToken.token === token);
    }
    /**
     * Generate a new token value
     */
    static generateToken() {
        return crypto
            .randomBytes(constants.TOKEN_LENGTH)
            .toString('hex')
            .slice(0, constants.TOKEN_LENGTH);
    }
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
        if ((_c = game.lastEventData) === null || _c === void 0 ? void 0 : _c.movedAt) {
            data.lastEventData = {
                ...game.lastEventData,
                movedAt: game.lastEventData.movedAt.toISOString(),
            };
        }
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
        const player = {
            id: (0, uuid_1.v4)(),
            name: playerName || 'Player 1',
            status: types_1.PlayerStatus.WAITING_FOR_TURN,
            state: playerData,
        };
        // Calculate how many players are required for this game
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
            state: gameData,
        };
        // If we've got enough players, start the game
        if (game.players.length >= game.numPlayers) {
            this.startGame(server, game);
        }
        // Call createGame hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.createGame) === null || _b === void 0 ? void 0 : _b.call(_a, game, player)))) !== null && _c !== void 0 ? _c : game;
        // Save the game in jsonpad
        const createdGameItem = await server.jsonpad.createItem(server.options.jsonpadGamesList, {
            data: this.gameToData(game),
        });
        // Generate and cache a token for this player in this game
        const token = await this.addToken(server, createdGameItem.id, player.id);
        return [this.dataToGame(createdGameItem.id, createdGameItem.data), token];
    }
    /**
     * Join an existing game as Player 2+
     */
    static async joinGame(server, game, playerName, playerData) {
        var _a, _b, _c;
        // Check if we've already reached the maximum number of players
        if (game.players.length >= game.numPlayers) {
            throw new error_1.default('Game is full', 403);
        }
        // Check if the game has already started
        if (game.status !== types_1.GameStatus.WAITING_TO_START) {
            throw new error_1.default('Game has already started', 403);
        }
        const player = {
            id: (0, uuid_1.v4)(),
            name: playerName || `Player ${game.players.length + 1}`,
            status: types_1.PlayerStatus.WAITING_FOR_TURN,
            state: playerData,
        };
        // Add player to the game
        game.players.push(player);
        // If we've got enough players, start the game
        if (game.players.length >= game.numPlayers) {
            this.startGame(server, game);
        }
        // Call joinGame hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.joinGame) === null || _b === void 0 ? void 0 : _b.call(_a, game, player)))) !== null && _c !== void 0 ? _c : game;
        // Save the game in jsonpad
        const updatedGameItem = await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData({
            ...game,
            lastEventType: 'player-joined',
            lastEventData: player,
        }));
        // Generate and cache a token for this player in this game
        const token = await this.addToken(server, game.id, player.id);
        return [this.dataToGame(updatedGameItem.id, updatedGameItem.data), token];
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
                    const timeLimit = server.options.turnTimeLimit * constants.MS;
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
                    const timeLimit = server.options.roundTimeLimit * constants.MS;
                    if (ROUND_TIMEOUTS[game.id]) {
                        clearTimeout(ROUND_TIMEOUTS[game.id]);
                    }
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
            const timeLimit = server.options.gameTimeLimit * constants.MS;
            if (GAME_TIMEOUTS[game.id]) {
                clearTimeout(GAME_TIMEOUTS[game.id]);
            }
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
        // Find the player making the move
        const player = await (0, async_1.asyncFind)(game.players, p => this.verifyToken(server, game.id, p.id, token));
        if (!player) {
            throw new error_1.default('Invalid player token', 403);
        }
        // Check if it's the player's turn
        if (player.status !== types_1.PlayerStatus.TAKING_TURN) {
            throw new error_1.default('Not your turn', 403);
        }
        // Add the move to the game's move log
        const move = {
            playerId: player.id,
            movedAt: new Date(),
            data: moveData,
        };
        game.moves.push(move);
        game.lastEventType = 'player-moved';
        game.lastEventData = null;
        // Call move hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.move) === null || _b === void 0 ? void 0 : _b.call(_a, game, player, move)))) !== null && _c !== void 0 ? _c : game;
        // Check if the game has been finished in this move
        if (game.status === types_1.GameStatus.FINISHED) {
            game = await this.finishGame(server, game, false);
        }
        this.advanceGame(server, game, player);
        // Save the game in jsonpad
        const updatedGameItem = await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData({
            ...game,
            lastEventData: {
                ...move,
                ...((_d = game.lastEventData) !== null && _d !== void 0 ? _d : {}),
            },
        }));
        return this.dataToGame(updatedGameItem.id, updatedGameItem.data);
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
        await (0, async_1.asyncForEach)(game.players, p => this.removeToken(server, game.id, p.id));
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