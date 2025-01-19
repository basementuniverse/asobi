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
const scheduler_service_1 = __importDefault(require("./scheduler-service"));
class GameService {
    /**
     * Create a new game with the specified player as Player 1
     */
    static async createGame(server, playerName, playerData, gameData) {
        var _a, _b, _c;
        // Prepare public player data for the new player
        const player = {
            id: (0, uuid_1.v4)(),
            name: playerName || 'Player 1',
            status: types_1.PlayerStatus.WAITING_FOR_TURN,
            state: playerData !== null && playerData !== void 0 ? playerData : {},
        };
        // Calculate how many players are required for this game session
        const actualNumPlayers = (0, utils_1.clamp)((gameData === null || gameData === void 0 ? void 0 : gameData.numPlayers) || server.options.minPlayers, server.options.minPlayers, server.options.maxPlayers);
        // Calculate the actual join time limit for this game session
        const actualJoinTimeLimit = this.calculateTimeLimitSetting(gameData === null || gameData === void 0 ? void 0 : gameData.joinTimeLimit, server.options.joinTimeLimit);
        // Calculate the actual turn time limit for this game session
        const actualTurnTimeLimit = this.calculateTimeLimitSetting(gameData === null || gameData === void 0 ? void 0 : gameData.turnTimeLimit, server.options.turnTimeLimit);
        // Calculate the actual round time limit for this game session
        const actualRoundTimeLimit = this.calculateTimeLimitSetting(gameData === null || gameData === void 0 ? void 0 : gameData.roundTimeLimit, server.options.roundTimeLimit);
        // Calculate the actual game time limit for this game session
        const actualGameTimeLimit = this.calculateTimeLimitSetting(gameData === null || gameData === void 0 ? void 0 : gameData.gameTimeLimit, server.options.gameTimeLimit);
        // Create initial game data
        let game = {
            id: '',
            status: types_1.GameStatus.WAITING_TO_START,
            startedAt: null,
            finishedAt: null,
            lastEventType: 'game-created',
            lastEventData: null,
            joinTimeLimit: actualJoinTimeLimit,
            turnTimeLimit: actualTurnTimeLimit,
            roundTimeLimit: actualRoundTimeLimit,
            gameTimeLimit: actualGameTimeLimit,
            numPlayers: actualNumPlayers,
            players: [player],
            moves: [],
            round: 0,
            state: gameData !== null && gameData !== void 0 ? gameData : {},
        };
        // Call createGame hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.createGame) === null || _b === void 0 ? void 0 : _b.call(_a, game, player)))) !== null && _c !== void 0 ? _c : game;
        // Extract hidden state
        let hiddenState = undefined;
        if (game.players[0].hiddenState) {
            hiddenState = game.players[0].hiddenState;
            delete game.players[0].hiddenState;
        }
        // If a join time limit is defined, set a startsAt time
        let timeLimit = 0;
        let startsAt = undefined;
        if (game.joinTimeLimit) {
            timeLimit = Math.max(game.joinTimeLimit * constants.MS, constants.MIN_TIMEOUT);
            startsAt = new Date(Date.now() + timeLimit);
            game.startsAt = startsAt;
        }
        // Save the game in jsonpad
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
        const createdGameItem = await server.jsonpad.createItem(server.options.jsonpadGamesList, {
            data: this.gameToData(game),
        });
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
        // If a join time limit is defined, set a timeout for the game to start
        // automatically if there are enough players
        if (game.joinTimeLimit) {
            scheduler_service_1.default.schedule(createdGameItem.id, '', 'join-timeout', async () => {
                // Fetch the current game with player hidden state attached
                const currentGame = await this.populatePlayerHiddenState(server, await this.fetchGame(server, createdGameItem.id));
                // Handle an edge case where the game has already started
                if (currentGame.status !== types_1.GameStatus.WAITING_TO_START) {
                    return;
                }
                // If we've got enough players to automatically start the game, then
                // start the game immediately
                const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(game);
                if (currentGame.players.length >= server.options.minPlayers) {
                    currentGame.numPlayers = currentGame.players.length;
                    const updatedGame = await this.startGame(server, currentGame);
                    await this.persistGame(server, updatedGame, {}, originalPlayerHiddenStates);
                }
            }, timeLimit);
        }
        // Re-insert hidden state for the host player into the response
        const result = this.dataToGame(createdGameItem.id, createdGameItem.data);
        result.players[0].hiddenState = hiddenState;
        return [result, token];
    }
    /**
     * Join an existing game as Player 2+
     */
    static async joinGame(server, gameId, playerName, playerData) {
        var _a, _b, _c, _d;
        let game = await this.populatePlayerHiddenState(server, await this.fetchGame(server, gameId));
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
        // Fetch all player hidden states so we can check later if they've changed
        const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(game);
        // Call joinGame hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.joinGame) === null || _b === void 0 ? void 0 : _b.call(_a, game, player)))) !== null && _c !== void 0 ? _c : game;
        // If we've got enough players, start the game
        if (game.players.length >= game.numPlayers) {
            await this.startGame(server, game);
            // Otherwise, if the game has a join timeout which has passed and we've
            // got at least the minimum number of players, then we should start the
            // game immediately
        }
        else if (game.joinTimeLimit &&
            game.startsAt &&
            game.startsAt < new Date() &&
            game.players.length >= server.options.minPlayers) {
            game.numPlayers = game.players.length;
            await this.startGame(server, game);
        }
        // Store the joining player's hidden state
        const joiningPlayerHiddenState = (_d = game.players.find(p => p.id === player.id)) === null || _d === void 0 ? void 0 : _d.hiddenState;
        // Save the game in jsonpad
        const updatedGame = await this.persistGame(server, game, {
            lastEventType: 'player-joined',
            lastEventData: player,
        }, originalPlayerHiddenStates, undefined, player.id);
        // Save joining player data in jsonpad
        const token = (0, generate_token_1.default)();
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
        await server.jsonpad.createItem(server.options.jsonpadPlayersList, {
            data: {
                playerId: player.id,
                gameId: updatedGame.id,
                token,
                state: joiningPlayerHiddenState !== null && joiningPlayerHiddenState !== void 0 ? joiningPlayerHiddenState : {},
            },
        });
        // Re-insert hidden state for the joining player into the response
        // (because we created the joining player above, their hidden state won't be
        // automatically inserted by persistGame(), so we should do it manually here)
        const joiningPlayer = updatedGame.players.find(p => p.id === player.id);
        if (joiningPlayer && joiningPlayerHiddenState) {
            joiningPlayer.hiddenState = joiningPlayerHiddenState;
        }
        return [updatedGame, token];
    }
    /**
     * Make a move in an existing game
     */
    static async move(server, gameId, token, moveData) {
        var _a, _b, _c, _d;
        let game = await this.populatePlayerHiddenState(server, await this.fetchGame(server, gameId));
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
        // Cache all player hidden states so we can check later if they've changed
        const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(game);
        // Call move hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.move) === null || _b === void 0 ? void 0 : _b.call(_a, game, player, move)))) !== null && _c !== void 0 ? _c : game;
        // Check if the game has been finished in this move
        if (game.status === types_1.GameStatus.FINISHED) {
            game = await this.finishGame(server, game, false);
        }
        else {
            game = await this.advanceGame(server, game, player);
        }
        // Save the game in jsonpad
        const updatedGame = await this.persistGame(server, game, {
            lastEventData: {
                ...move,
                ...((_d = game.lastEventData) !== null && _d !== void 0 ? _d : {}),
            },
        }, originalPlayerHiddenStates, player.id);
        return updatedGame;
    }
    /**
     * Fetch a game with a player's hidden state attached
     */
    static async state(server, gameId, token) {
        const game = await this.populatePlayerHiddenState(server, await this.fetchGame(server, gameId));
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
     * Fetch a game from jsonpad
     */
    static async fetchGame(server, gameId) {
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
        const gameData = await server.jsonpad.fetchItemData(server.options.jsonpadGamesList, gameId);
        if (!gameData) {
            throw new error_1.default('Game not found', 404);
        }
        return this.dataToGame(gameId, gameData);
    }
    /**
     * Populate player data including hidden state for all players in a game
     */
    static async populatePlayerHiddenState(server, game) {
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
        const players = await server.jsonpad.fetchItemsData(server.options.jsonpadPlayersList, {
            game: game.id,
        });
        const playersMap = players.data.reduce((a, p) => ({
            ...a,
            [p.playerId]: p.state,
        }), {});
        for (const player of game.players) {
            player.hiddenState = playersMap[player.id];
        }
        return game;
    }
    /**
     * Get a map of player hidden states in a game
     *
     * This is used to check if a player's hidden state has changed
     */
    static getPlayerHiddenStateMap(game) {
        return game.players
            .map(p => [p.id, JSON.stringify(p.hiddenState)])
            .reduce((a, [id, state]) => ({ ...a, [id]: state }), {});
    }
    /**
     * Persist an existing game to jsonpad
     *
     * This also persists any player hidden states that have changed
     */
    static async persistGame(server, game, data, originalPlayerHiddenStates, reinsertHiddenStateForPlayerId, skipPersistingHiddenStateForPlayerId) {
        const currentPlayerHiddenStates = {};
        // If we've got some original player states to compare against, then we'll
        // need to cache the current player hidden states to check if they've changed
        if (originalPlayerHiddenStates) {
            for (const p of game.players) {
                if (p.hiddenState) {
                    currentPlayerHiddenStates[p.id] = p.hiddenState;
                    // Remove player hidden state before saving the game so that we don't
                    // end up exposing hidden state when returning game data to the client
                    delete p.hiddenState;
                }
            }
        }
        // Persist the game data
        server.options.jsonpadRateLimit &&
            (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
        const updatedGameItem = await server.jsonpad.replaceItemData(server.options.jsonpadGamesList, game.id, this.gameToData({
            ...game,
            ...data,
        }));
        const updatedGame = this.dataToGame(updatedGameItem.id, updatedGameItem.data);
        // Check if any player hidden states have changed and update them if needed
        if (originalPlayerHiddenStates) {
            await (0, async_1.asyncForEach)(game.players, async (p) => {
                var _a;
                // We might want to skip persisting hidden state for a specific player
                if (skipPersistingHiddenStateForPlayerId &&
                    p.id === skipPersistingHiddenStateForPlayerId) {
                    return;
                }
                // Otherwise, check if the player's hidden state has changed and if so,
                // update it in jsonpad
                if (currentPlayerHiddenStates[p.id] &&
                    JSON.stringify(currentPlayerHiddenStates[p.id]) !==
                        originalPlayerHiddenStates[p.id]) {
                    server.options.jsonpadRateLimit &&
                        (await (0, sleep_1.default)(server.options.jsonpadRateLimit));
                    await server.jsonpad.replaceItemData(server.options.jsonpadPlayersList, p.id, (_a = currentPlayerHiddenStates[p.id]) !== null && _a !== void 0 ? _a : {}, {
                        pointer: '/state',
                    });
                }
            });
        }
        // Re-insert hidden state for a specific player if needed
        if (reinsertHiddenStateForPlayerId) {
            const player = game.players.find(p => p.id === reinsertHiddenStateForPlayerId);
            if (player && currentPlayerHiddenStates[player.id]) {
                player.hiddenState = currentPlayerHiddenStates[player.id];
            }
        }
        return updatedGame;
    }
    /**
     * Calculate the actual joinTimeout / turnTimeout / roundTimeout / gameTimeout
     * for a game based on the server configuration and the value optionally
     * specified by the host player when creating a new game session
     */
    static calculateTimeLimitSetting(value, setting) {
        var _a, _b;
        // The server is configured with null for this time limit, so it is disabled
        // and not configurable on a per-game basis
        if (setting === null) {
            return null;
        }
        // The server is configured with a fixed number for this time limit, so use
        // the configured value (it is not configurable on a per-game basis)
        if (typeof setting === 'number') {
            return setting;
        }
        // Otherwise, the server is configured with a TimeLimitSettings object
        // Make sure the default value is valid
        if (setting.default === null ||
            setting.default === undefined ||
            isNaN(+setting.default)) {
            throw new error_1.default('Invalid time limit setting', 500);
        }
        // If a (non-zero) value has been specified by the host player when creating
        // a new game session, we should use that value (clamped between min and max)
        if (value) {
            const min = Math.max(0, (_a = setting.min) !== null && _a !== void 0 ? _a : 0);
            const max = (_b = setting.max) !== null && _b !== void 0 ? _b : constants.MAX_TIME_LIMIT;
            const clamped = (0, utils_1.clamp)(value, min, max);
            if (clamped === 0) {
                return null; // A time limit of 0 implicitly means no time limit
            }
            return clamped;
        }
        // Otherwise, use the default value
        return setting.default;
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
        // If there's a join timeout for this game, clear it
        scheduler_service_1.default.clear(game.id, '', 'join-timeout');
        // Handle initial move
        let firstPlayer;
        switch (server.options.mode) {
            case types_1.GameMode.TURNS:
                // Player 1 has the first turn
                firstPlayer = game.players[0];
                firstPlayer.status = types_1.PlayerStatus.TAKING_TURN;
                // If a turn time limit is defined, set a timeout for the current player
                if (game.turnTimeLimit) {
                    const timeLimit = Math.max(game.turnTimeLimit * constants.MS, constants.MIN_TIMEOUT);
                    scheduler_service_1.default.schedule(game.id, firstPlayer.id, 'turn-timeout', async () => {
                        // Fetch the current game
                        const currentGame = await this.populatePlayerHiddenState(server, await this.fetchGame(server, game.id));
                        currentGame.lastEventType = 'timed-out';
                        // Cache all player hidden states so we can check later if they've
                        // been changed
                        const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(currentGame);
                        // Advance the game to the next turn
                        const updatedGame = await this.advanceGame(server, currentGame, firstPlayer);
                        // Save the game in jsonpad
                        await this.persistGame(server, updatedGame, {}, originalPlayerHiddenStates);
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
                if (game.roundTimeLimit) {
                    const timeLimit = Math.max(game.roundTimeLimit * constants.MS, constants.MIN_TIMEOUT);
                    scheduler_service_1.default.schedule(game.id, '', 'round-timeout', async () => {
                        // Fetch the current game
                        const currentGame = await this.populatePlayerHiddenState(server, await this.fetchGame(server, game.id));
                        currentGame.lastEventType = 'timed-out';
                        // Cache all player hidden states so we can check later if they've
                        // been changed
                        const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(currentGame);
                        // Advance the game to the next round
                        const updatedGame = await this.advanceGame(server, currentGame, undefined, true);
                        // Save the game in jsonpad
                        await this.persistGame(server, updatedGame, {}, originalPlayerHiddenStates);
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
        if (game.gameTimeLimit) {
            const timeLimit = Math.max(game.gameTimeLimit * constants.MS, constants.MIN_TIMEOUT);
            scheduler_service_1.default.schedule(game.id, '', 'game-timeout', async () => {
                // Fetch the current game
                const currentGame = await this.populatePlayerHiddenState(server, await this.fetchGame(server, game.id));
                currentGame.lastEventType = 'timed-out';
                // Cache all player hidden states so we can check later if they've
                // been changed
                const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(currentGame);
                // Finish the game
                const finishedGame = await this.finishGame(server, currentGame);
                // Save the game in jsonpad
                await this.persistGame(server, finishedGame, {}, originalPlayerHiddenStates);
            }, timeLimit);
            game.finishesAt = new Date(Date.now() + timeLimit);
        }
        return game;
    }
    /**
     * Handle turn/round advancement
     */
    static async advanceGame(server, game, player, forceAdvanceRound = false) {
        var _a, _b, _c;
        const currentRound = game.round;
        // Handle turn/round advancement
        switch (server.options.mode) {
            case types_1.GameMode.TURNS:
                // Current player has finished their turn
                player && (player.status = types_1.PlayerStatus.WAITING_FOR_TURN);
                // Advance to the next turn
                let nextPlayer = undefined;
                if (player &&
                    game.players.some(p => p.status === types_1.PlayerStatus.WAITING_FOR_TURN)) {
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
                // Sanity check: if all players are waiting for their turn, something
                // went wrong; in this case, we'll just reset to the first player
                if (game.players.every(p => p.status === types_1.PlayerStatus.WAITING_FOR_TURN)) {
                    nextPlayer = game.players[0];
                    nextPlayer.status = types_1.PlayerStatus.TAKING_TURN;
                }
                // If a turn time limit is defined, set a timeout for the next player
                // to move
                if (game.turnTimeLimit) {
                    const timeLimit = Math.max(game.turnTimeLimit * constants.MS, constants.MIN_TIMEOUT);
                    // Clear any turn timeouts for this player
                    if (player) {
                        scheduler_service_1.default.clear(game.id, player.id, 'turn-timeout');
                    }
                    if (nextPlayer) {
                        scheduler_service_1.default.schedule(game.id, nextPlayer.id, 'turn-timeout', async () => {
                            // Fetch the current game
                            const currentGame = await this.populatePlayerHiddenState(server, await this.fetchGame(server, game.id));
                            currentGame.lastEventType = 'timed-out';
                            // Cache all player hidden states so we can check later if they've
                            // been changed
                            const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(currentGame);
                            // Advance the game to the next turn
                            const updatedGame = await this.advanceGame(server, currentGame, nextPlayer);
                            // Save the game in jsonpad
                            await this.persistGame(server, updatedGame, {}, originalPlayerHiddenStates);
                        }, timeLimit);
                    }
                    game.turnFinishesAt = new Date(Date.now() + timeLimit);
                }
                break;
            case types_1.GameMode.ROUNDS:
                // Current player has finished their turn
                player && (player.status = types_1.PlayerStatus.WAITING_FOR_TURN);
                // If all players have finished their turn (or have finished the game),
                // advance to the next round
                // We can also force round advancement if needed (e.g. if a round time
                // limit has been reached)
                if (forceAdvanceRound ||
                    game.players.every(p => [types_1.PlayerStatus.WAITING_FOR_TURN, types_1.PlayerStatus.FINISHED].includes(p.status))) {
                    game.round++;
                    game.players.forEach(p => {
                        if (p.status === types_1.PlayerStatus.FINISHED) {
                            return;
                        }
                        p.status = types_1.PlayerStatus.TAKING_TURN;
                    });
                    // If a round time limit is defined, set a timeout for the current round
                    if (game.roundTimeLimit) {
                        const timeLimit = Math.max(game.roundTimeLimit * constants.MS, constants.MIN_TIMEOUT);
                        // Clear any round timeouts for this game
                        scheduler_service_1.default.clear(game.id, '', 'round-timeout');
                        scheduler_service_1.default.schedule(game.id, '', 'round-timeout', async () => {
                            // Fetch the current game
                            const currentGame = await this.populatePlayerHiddenState(server, await this.fetchGame(server, game.id));
                            currentGame.lastEventType = 'timed-out';
                            // Cache all player hidden states so we can check later if they've
                            // been changed
                            const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(currentGame);
                            // Advance the game to the next round
                            const updatedGame = await this.advanceGame(server, currentGame, undefined, true);
                            // Save the game in jsonpad
                            await this.persistGame(server, updatedGame, {}, originalPlayerHiddenStates);
                        }, timeLimit);
                        game.roundFinishesAt = new Date(Date.now() + timeLimit);
                    }
                }
                break;
            case types_1.GameMode.FREE:
                // Games don't advance in the usual way in free mode; players can take
                // turns at any time and in any order, so turns and rounds never advance
                break;
        }
        // Call round hook if one is defined and the round has changed
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
        // Cache all player hidden states so we can check later if they've changed
        const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(game);
        // Call finishGame hook if one is defined
        game = (_c = (await ((_b = (_a = server.options.hooks) === null || _a === void 0 ? void 0 : _a.finishGame) === null || _b === void 0 ? void 0 : _b.call(_a, game)))) !== null && _c !== void 0 ? _c : game;
        // Remove timeouts for this game
        scheduler_service_1.default.clear(game.id);
        // Make sure there are no more queued functions for this game
        queue_service_1.default.clear(game.id);
        // Save the game in jsonpad
        if (save) {
            return await this.persistGame(server, game, {}, originalPlayerHiddenStates);
        }
        return game;
    }
}
exports.default = GameService;
//# sourceMappingURL=game-service.js.map