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
const constants = __importStar(require("../constants"));
const error_1 = __importDefault(require("../error"));
const types_1 = require("../types");
const generate_token_1 = __importDefault(require("../utilities/generate-token"));
const sleep_1 = __importDefault(require("../utilities/sleep"));
const queue_service_1 = __importDefault(require("./queue-service"));
class GameService {
    /**
     * Convert a game to serialisable data
     */
    static gameToData(game) {
        var _a, _b, _c, _d, _e, _f, _g;
        const data = {
            ...(0, utils_1.exclude)(game, 'id'),
            moves: game.moves.map(move => ({
                ...move,
                movedAt: move.movedAt.toISOString(),
            })),
            startedAt: ((_a = game.startedAt) === null || _a === void 0 ? void 0 : _a.toISOString()) || null,
            finishedAt: ((_b = game.finishedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || null,
            startsAt: ((_c = game.startsAt) === null || _c === void 0 ? void 0 : _c.toISOString()) || undefined,
            finishesAt: ((_d = game.finishesAt) === null || _d === void 0 ? void 0 : _d.toISOString()) || undefined,
            turnFinishesAt: ((_e = game.turnFinishesAt) === null || _e === void 0 ? void 0 : _e.toISOString()) || undefined,
            roundFinishesAt: ((_f = game.roundFinishesAt) === null || _f === void 0 ? void 0 : _f.toISOString()) || undefined,
        };
        // Convert the movedAt date if present
        // (for 'player-moved' events, lastEventData will contain move data)
        if ((_g = game.lastEventData) === null || _g === void 0 ? void 0 : _g.movedAt) {
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
            startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
            finishesAt: data.finishesAt ? new Date(data.finishesAt) : undefined,
            turnFinishesAt: data.turnFinishesAt
                ? new Date(data.turnFinishesAt)
                : undefined,
            roundFinishesAt: data.roundFinishesAt
                ? new Date(data.roundFinishesAt)
                : undefined,
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
        // Call createGame hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.createGame) === null || _b === void 0 ? void 0 : _b.call(_a, game, player)))) !== null && _c !== void 0 ? _c : game;
        // If we've got enough players (i.e. this is a 1-player game), then start
        // the game immediately
        if (game.players.length >= game.numPlayers) {
            await this.startGame(server, game);
        }
        // Extract hidden state
        let hiddenState = undefined;
        if (game.players[0].hiddenState) {
            hiddenState = game.players[0].hiddenState;
            delete game.players[0].hiddenState;
        }
        // If a join time limit is defined, set a startsAt time
        let timeLimit = 0;
        let startsAt = undefined;
        if (server.options.joinTimeLimit) {
            timeLimit = Math.max(server.options.joinTimeLimit * constants.MS, constants.MIN_TIMEOUT);
            startsAt = new Date(Date.now() + timeLimit);
            game.startsAt = startsAt;
        }
        // Save the game in jsonpad
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
        const createdGameItem = await server.jsonpad.createItem(server.options.jsonpadGamesList, {
            data: this.gameToData(game),
        });
        // If a join time limit is defined, set a timeout for the game to start
        // automatically if there are enough players
        if (server.options.joinTimeLimit) {
            this.joinTimeouts[createdGameItem.id] = setTimeout(async () => {
                // Handle join time limit using a queue to avoid race conditions
                queue_service_1.default.add(createdGameItem.id, async () => {
                    // Fetch the current game
                    server.options.jsonpadRateLimit &&
                        (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                    const game = this.dataToGame(createdGameItem.id, await server.jsonpad.fetchItemData(server.options.jsonpadGamesList, createdGameItem.id));
                    // Handle the edge case where the game has already started
                    if (game.status !== types_1.GameStatus.WAITING_TO_START) {
                        return;
                    }
                    // Populate player hidden state
                    server.options.jsonpadRateLimit &&
                        (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                    const players = await server.jsonpad.fetchItemsData(server.options.jsonpadPlayersList, {
                        game: createdGameItem.id,
                    });
                    const playersMap = players.data.reduce((a, p) => ({
                        ...a,
                        [p.playerId]: p.state,
                    }), {});
                    for (const player of game.players) {
                        player.hiddenState = playersMap[player.id];
                    }
                    if (game.players.length >= server.options.minPlayers) {
                        game.numPlayers = game.players.length;
                        const updatedGame = await this.startGame(server, game);
                        server.options.jsonpadRateLimit &&
                            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                        await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, createdGameItem.id, this.gameToData(updatedGame));
                    }
                    delete this.joinTimeouts[createdGameItem.id];
                });
            }, timeLimit);
        }
        // Save player data in jsonpad
        const token = (0, generate_token_1.default)();
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
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
        // Hash and cache all player hidden states so we can check later if
        // they've been changed
        const originalHiddenStates = game.players
            .map(p => [p.id, JSON.stringify(p.hiddenState)])
            .reduce((a, [id, state]) => ({ ...a, [id]: state }), {});
        // Call joinGame hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.joinGame) === null || _b === void 0 ? void 0 : _b.call(_a, game, player)))) !== null && _c !== void 0 ? _c : game;
        // If we've got enough players, start the game
        if (game.players.length >= game.numPlayers) {
            await this.startGame(server, game);
            // Otherwise, if the game has a join timeout which has passed and we've
            // got at least the minimum number of players, then start the game
        }
        else if (server.options.joinTimeLimit &&
            game.startsAt &&
            game.startsAt < new Date() &&
            game.players.length >= server.options.minPlayers) {
            game.numPlayers = game.players.length;
            await this.startGame(server, game);
        }
        // Extract hidden state for all players
        const updatedHiddenStates = {};
        for (const p of game.players) {
            if (p.hiddenState) {
                updatedHiddenStates[p.id] = p.hiddenState;
                delete p.hiddenState;
            }
        }
        // Save the game in jsonpad
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
        const updatedGameItem = await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData({
            ...game,
            lastEventType: 'player-joined',
            lastEventData: player,
        }));
        // Save joining player data in jsonpad
        const token = (0, generate_token_1.default)();
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
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
            // We can skip the player who just joined because we just updated their
            // data and hidden state above
            if (p.id !== player.id) {
                if (updatedHiddenStates[p.id] &&
                    JSON.stringify(p.hiddenState) !== originalHiddenStates[p.id]) {
                    server.options.jsonpadRateLimit &&
                        (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                    await server.jsonpad.replaceItemData(server.options.jsonpadPlayersList, p.id, (_a = updatedHiddenStates[p.id]) !== null && _a !== void 0 ? _a : {}, {
                        pointer: '/state',
                    });
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
    static async startGame(server, game) {
        var _a, _b, _c;
        game.status = types_1.GameStatus.STARTED;
        game.startedAt = new Date();
        game.round = 1;
        // Call round hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.round) === null || _b === void 0 ? void 0 : _b.call(_a, game)))) !== null && _c !== void 0 ? _c : game;
        // If there's an auto-start timeout for this game, clear it
        if (this.joinTimeouts[game.id]) {
            clearTimeout(this.joinTimeouts[game.id]);
            delete this.joinTimeouts[game.id];
        }
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
                    this.turnTimeouts[firstPlayer.id] = setTimeout(async () => {
                        // Handle turn time limit using a queue to avoid race conditions
                        queue_service_1.default.add(game.id, async () => {
                            game.lastEventType = 'timed-out';
                            const updatedGame = await this.advanceGame(server, game, firstPlayer);
                            server.options.jsonpadRateLimit &&
                                (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                            await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(updatedGame));
                            delete this.turnTimeouts[firstPlayer.id];
                        });
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
                    this.roundTimeouts[game.id] = setTimeout(async () => {
                        // Handle round time limit using a queue to avoid race conditions
                        queue_service_1.default.add(game.id, async () => {
                            var _a, _b, _c;
                            game.lastEventType = 'timed-out';
                            game.round++;
                            game.players.forEach(p => {
                                p.status = types_1.PlayerStatus.TAKING_TURN;
                            });
                            // Call round hook if one is defined
                            game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.round) === null || _b === void 0 ? void 0 : _b.call(_a, game)))) !== null && _c !== void 0 ? _c : game;
                            server.options.jsonpadRateLimit &&
                                (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                            await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(game));
                            delete this.roundTimeouts[game.id];
                        });
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
            this.gameTimeouts[game.id] = setTimeout(async () => {
                // Handle game time limit using a queue to avoid race conditions
                queue_service_1.default.add(game.id, async () => {
                    game.lastEventType = 'timed-out';
                    const finishedGame = await this.finishGame(server, game);
                    server.options.jsonpadRateLimit &&
                        (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                    await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(finishedGame));
                    delete this.gameTimeouts[game.id];
                });
            }, timeLimit);
            game.finishesAt = new Date(Date.now() + timeLimit);
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
        // Find out which player is making the move in this game based on which
        // token is being used
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
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
        // Check if the game has been finished in this move
        if (game.status === types_1.GameStatus.FINISHED) {
            game = await this.finishGame(server, game, false);
        }
        else {
            game = await this.advanceGame(server, game, player);
        }
        // Extract hidden state for all players
        const updatedHiddenStates = {};
        for (const p of game.players) {
            if (p.hiddenState) {
                updatedHiddenStates[p.id] = p.hiddenState;
                delete p.hiddenState;
            }
        }
        // Save the game in jsonpad
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
        const updatedGameItem = await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData({
            ...game,
            lastEventData: {
                ...move,
                ...((_d = game.lastEventData) !== null && _d !== void 0 ? _d : {}),
            },
        }));
        // Update all player data in jsonpad
        await (0, async_1.asyncForEach)(game.players, async (p) => {
            var _a;
            if (updatedHiddenStates[p.id] &&
                JSON.stringify(p.hiddenState) !== originalHiddenStates[p.id]) {
                server.options.jsonpadRateLimit &&
                    (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                await server.jsonpad.replaceItemData(server.options.jsonpadPlayersList, p.id, (_a = updatedHiddenStates[p.id]) !== null && _a !== void 0 ? _a : {}, {
                    pointer: '/state',
                });
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
    static async advanceGame(server, game, player) {
        var _a, _b, _c;
        const currentRound = game.round;
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
                        let currentIndex = currentPlayerIndex + i;
                        // Increment the round if we pass the end of the player list
                        if (currentIndex >= game.players.length) {
                            game.round++;
                        }
                        currentIndex = currentIndex % game.players.length;
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
                    const timeLimit = Math.max(server.options.turnTimeLimit * constants.MS, constants.MIN_TIMEOUT);
                    if (this.turnTimeouts[player.id]) {
                        clearTimeout(this.turnTimeouts[player.id]);
                        delete this.turnTimeouts[player.id];
                    }
                    this.turnTimeouts[player.id] = setTimeout(async () => {
                        // Handle turn time limit using a queue to vaoid race conditions
                        queue_service_1.default.add(game.id, async () => {
                            game.lastEventType = 'timed-out';
                            const updatedGame = await this.advanceGame(server, game, nextPlayer);
                            server.options.jsonpadRateLimit &&
                                (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                            await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(updatedGame));
                            delete this.turnTimeouts[player.id];
                        });
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
                        const timeLimit = Math.max(server.options.roundTimeLimit * constants.MS, constants.MIN_TIMEOUT);
                        if (this.roundTimeouts[game.id]) {
                            clearTimeout(this.roundTimeouts[game.id]);
                            delete this.roundTimeouts[game.id];
                        }
                        this.roundTimeouts[game.id] = setTimeout(async () => {
                            // Handle round time limit using a queue to avoid race conditions
                            queue_service_1.default.add(game.id, async () => {
                                game.lastEventType = 'timed-out';
                                game.players.forEach(p => {
                                    p.status = types_1.PlayerStatus.WAITING_FOR_TURN;
                                });
                                const updatedGame = await this.advanceGame(server, game, player);
                                server.options.jsonpadRateLimit &&
                                    (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                                await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(updatedGame));
                                delete this.roundTimeouts[game.id];
                            });
                        }, timeLimit);
                        game.roundFinishesAt = new Date(Date.now() + timeLimit);
                    }
                }
                break;
            case types_1.GameMode.FREE:
                break;
        }
        // Call round hook if one is defined
        if (game.round !== currentRound) {
            game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.round) === null || _b === void 0 ? void 0 : _b.call(_a, game)))) !== null && _c !== void 0 ? _c : game;
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
        // Remove timeouts for this game
        for (const player of game.players) {
            if (this.turnTimeouts[player.id]) {
                clearTimeout(this.turnTimeouts[player.id]);
                delete this.turnTimeouts[player.id];
            }
        }
        if (this.roundTimeouts[game.id]) {
            clearTimeout(this.roundTimeouts[game.id]);
            delete this.roundTimeouts[game.id];
        }
        if (this.gameTimeouts[game.id]) {
            clearTimeout(this.gameTimeouts[game.id]);
            delete this.gameTimeouts[game.id];
        }
        if (this.joinTimeouts[game.id]) {
            clearTimeout(this.joinTimeouts[game.id]);
            delete this.joinTimeouts[game.id];
        }
        // Save the game in jsonpad
        if (save) {
            server.options.jsonpadRateLimit &&
                (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
            const updatedGameItem = await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData(game));
            return this.dataToGame(updatedGameItem.id, updatedGameItem.data);
        }
        return game;
    }
    /**
     * Fetch a game with a player's hidden state attached
     */
    static async state(server, game, token) {
        // Check if the game is running
        if (![types_1.GameStatus.WAITING_TO_START, types_1.GameStatus.STARTED].includes(game.status)) {
            throw new error_1.default('Game is not waiting to start or running', 403);
        }
        // Find out which player is requesting their state in this game based on the token
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
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
        // Get the player's data from the game
        const playerId = playerResults.data[0].data.playerId;
        const player = game.players.find(p => p.id === playerId);
        if (!player) {
            throw new error_1.default('Player not found', 404);
        }
        player.hiddenState = playerResults.data[0].data.state;
        return game;
    }
}
GameService.joinTimeouts = {};
GameService.turnTimeouts = {};
GameService.roundTimeouts = {};
GameService.gameTimeouts = {};
exports.default = GameService;
//# sourceMappingURL=game-service.js.map