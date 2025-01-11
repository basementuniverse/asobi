import { asyncForEach } from '@basementuniverse/async';
import { clamp, exclude } from '@basementuniverse/utils';
import { v4 as uuid } from 'uuid';
import * as constants from './constants';
import ServerError from './error';
import { Server } from './server';
import {
  Game,
  GameMode,
  GameStatus,
  Move,
  Player,
  PlayerStatus,
} from './types';
import generateToken from './utilities/generate-token';
import sleep from './utilities/sleep';

const TURN_TIMEOUTS: Record<string, NodeJS.Timeout> = {};
const ROUND_TIMEOUTS: Record<string, NodeJS.Timeout> = {};
const GAME_TIMEOUTS: Record<string, NodeJS.Timeout> = {};

export default class GameService {
  /**
   * Convert a game to serialisable data
   */
  public static gameToData(game: Game): Record<string, any> {
    const data: Record<string, any> = {
      ...exclude(game, 'id'),
      moves: game.moves.map(move => ({
        ...move,
        movedAt: move.movedAt.toISOString(),
      })),
      startedAt: game.startedAt?.toISOString() || null,
      finishedAt: game.finishedAt?.toISOString() || null,
    };

    // Convert the movedAt date if present
    // (for 'player-moved' events, lastEventData will contain move data)
    if (game.lastEventData?.movedAt) {
      data.lastEventData = {
        ...game.lastEventData,
        movedAt: game.lastEventData.movedAt.toISOString(),
      };
    }

    // Remove hidden state from player data if any remains
    // (it should have been removed already, but just in case...)
    data.players.forEach((player: Record<string, any>) => {
      if (player.hiddenState) {
        delete player.hiddenState;
      }
    });

    return data;
  }

  /**
   * Convert serialised data to a game
   */
  public static dataToGame(id: string, data: Record<string, any>): Game {
    const game: Game = {
      id,
      ...data,
      moves: data.moves.map(
        (move: Record<string, any>): Move =>
          ({
            ...move,
            movedAt: new Date(move.movedAt),
          } as Move)
      ),
      startedAt: data.startedAt ? new Date(data.startedAt) : null,
      finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
    } as Game;

    // Convert the movedAt date if present
    // (for 'player-moved' events, lastEventData will contain move data)
    if (data.lastEventData?.movedAt) {
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
  public static async createGame(
    server: Server,
    playerName: string,
    playerData?: Record<string, any>,
    gameData?: Record<string, any>,
    numPlayers?: number
  ): Promise<[Game, string]> {
    // Prepare public player data for the new player
    const player = {
      id: uuid(),
      name: playerName || 'Player 1',
      status: PlayerStatus.WAITING_FOR_TURN,
      state: playerData ?? {},
    };

    // Calculate how many players are required for this game session
    const actualNumPlayers = clamp(
      numPlayers || server.options.minPlayers,
      server.options.minPlayers,
      server.options.maxPlayers
    );

    // Create initial game data
    let game: Game = {
      id: '',
      status: GameStatus.WAITING_TO_START,
      startedAt: null,
      finishedAt: null,
      lastEventType: 'game-created',
      lastEventData: null,
      numPlayers: actualNumPlayers,
      players: [player],
      moves: [],
      round: 0,
      state: gameData ?? {},
    };

    // If we've got enough players, start the game
    if (game.players.length >= game.numPlayers) {
      this.startGame(server, game);
    }

    // Call createGame hook if one is defined
    game = (await server.options.hooks?.createGame?.(game, player)) ?? game;

    // Extract hidden state
    let hiddenState: any = undefined;
    if (game.players[0].hiddenState) {
      hiddenState = game.players[0].hiddenState;
      delete game.players[0].hiddenState;
    }

    // Save the game in jsonpad
    const createdGameItem = await server.jsonpad.createItem(
      server.options.jsonpadGamesList,
      {
        data: this.gameToData(game),
      }
    );

    // Handle jsonpad rate limiting
    if (server.options.jsonpadRateLimit) {
      await sleep(server.options.jsonpadRateLimit);
    }

    // Save player data in jsonpad
    const token = generateToken();
    await server.jsonpad.createItem(server.options.jsonpadPlayersList, {
      data: {
        playerId: player.id,
        gameId: createdGameItem.id,
        token,
        state: hiddenState ?? {},
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
  public static async joinGame(
    server: Server,
    game: Game,
    playerName: string,
    playerData?: Record<string, any>
  ): Promise<[Game, string]> {
    // Check if we've already reached the maximum number of players
    if (game.players.length >= game.numPlayers) {
      throw new ServerError('Game is full', 403);
    }

    // Check if the game has already started
    if (game.status !== GameStatus.WAITING_TO_START) {
      throw new ServerError('Game has already started', 403);
    }

    // Prepare public player data for the joining player
    const player = {
      id: uuid(),
      name: playerName || `Player ${game.players.length + 1}`,
      status: PlayerStatus.WAITING_FOR_TURN,
      state: playerData ?? {},
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
      .reduce((a, [id, state]) => ({ ...a, [id]: state }), {}) as Record<
      string,
      string
    >;

    // Call joinGame hook if one is defined
    game = (await server.options.hooks?.joinGame?.(game, player)) ?? game;

    // Extract hidden state for all players
    const updatedHiddenStates: Record<string, any> = {};
    for (const p of game.players) {
      if (p.hiddenState) {
        updatedHiddenStates[p.id] = p.hiddenState;
        delete p.hiddenState;
      }
    }

    // Save the game in jsonpad
    const updatedGameItem = await server.jsonpad.replaceItemData(
      server.options.jsonpadGamesList,
      game.id,
      this.gameToData({
        ...game,
        lastEventType: 'player-joined',
        lastEventData: player,
      })
    );

    // Handle jsonpad rate limiting
    if (server.options.jsonpadRateLimit) {
      await sleep(server.options.jsonpadRateLimit);
    }

    // Save joining player data in jsonpad
    const token = generateToken();
    await server.jsonpad.createItem(server.options.jsonpadPlayersList, {
      data: {
        playerId: player.id,
        gameId: updatedGameItem.id,
        token,
        state: updatedHiddenStates[player.id] ?? {},
      },
    });

    // Update existing player data in jsonpad
    await asyncForEach(game.players, async p => {
      if (p.id !== player.id) {
        if (
          updatedHiddenStates[p.id] &&
          JSON.stringify(p.hiddenState) !== originalHiddenStates[p.id]
        ) {
          await server.jsonpad.replaceItemData(
            server.options.jsonpadPlayersList,
            p.id,
            updatedHiddenStates[p.id] ?? {},
            {
              pointer: '/state',
            }
          );

          // Handle jsonpad rate limiting
          if (server.options.jsonpadRateLimit) {
            await sleep(server.options.jsonpadRateLimit);
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
  private static startGame(server: Server, game: Game): Game {
    game.status = GameStatus.STARTED;
    game.startedAt = new Date();
    game.round = 1;

    // Handle initial move
    let firstPlayer: Player;
    switch (server.options.mode) {
      case GameMode.TURNS:
        // Player 1 has the first turn
        firstPlayer = game.players[0];
        firstPlayer.status = PlayerStatus.TAKING_TURN;

        // If a turn time limit is defined, set a timeout for the current player
        if (server.options.turnTimeLimit) {
          const timeLimit = Math.max(
            server.options.turnTimeLimit * constants.MS,
            constants.MIN_TIMEOUT
          );

          TURN_TIMEOUTS[firstPlayer.id] = setTimeout(async () => {
            game.lastEventType = 'timed-out';

            const updatedGame = this.advanceGame(server, game, firstPlayer);

            await server.jsonpad.replaceItemData(
              server.options.jsonpadGamesList,
              game.id,
              this.gameToData(updatedGame)
            );
          }, timeLimit);

          game.turnFinishesAt = new Date(Date.now() + timeLimit);
        }
        break;

      case GameMode.ROUNDS:
        // All players are ready to move
        game.players.forEach(p => {
          p.status = PlayerStatus.TAKING_TURN;
        });

        // If a round time limit is defined, set a timeout for the current round
        if (server.options.roundTimeLimit) {
          const timeLimit = Math.max(
            server.options.roundTimeLimit * constants.MS,
            constants.MIN_TIMEOUT
          );

          ROUND_TIMEOUTS[game.id] = setTimeout(async () => {
            game.lastEventType = 'timed-out';
            game.round++;
            game.players.forEach(p => {
              p.status = PlayerStatus.TAKING_TURN;
            });

            await server.jsonpad.replaceItemData(
              server.options.jsonpadGamesList,
              game.id,
              this.gameToData(game)
            );
          }, timeLimit);

          game.roundFinishesAt = new Date(Date.now() + timeLimit);
        }
      case GameMode.FREE:
        // All players are ready to move
        game.players.forEach(p => {
          p.status = PlayerStatus.TAKING_TURN;
        });
        break;
    }

    // If a game time limit is defined, set a timeout for the game
    if (server.options.gameTimeLimit) {
      const timeLimit = Math.max(
        server.options.gameTimeLimit * constants.MS,
        constants.MIN_TIMEOUT
      );

      GAME_TIMEOUTS[game.id] = setTimeout(async () => {
        game.lastEventType = 'timed-out';

        const finishedGame = await this.finishGame(server, game);

        await server.jsonpad.replaceItemData(
          server.options.jsonpadGamesList,
          game.id,
          this.gameToData(finishedGame)
        );
      }, timeLimit);

      game.gameFinishesAt = new Date(Date.now() + timeLimit);
    }

    return game;
  }

  /**
   * Make a move in an existing game
   */
  public static async move(
    server: Server,
    game: Game,
    token: string,
    moveData?: Record<string, any>
  ): Promise<Game> {
    // Check if the game is running
    if (game.status !== GameStatus.STARTED) {
      throw new ServerError('Game is not running', 403);
    }

    // Find out which player is making the move in this game based on the token
    const playerResults = await server.jsonpad.fetchItems(
      server.options.jsonpadPlayersList,
      {
        limit: 1,
        game: game.id,
        token,
        includeData: true,
      }
    );

    if (playerResults.total === 0) {
      // No player found with this token
      throw new ServerError('Invalid player token', 403);
    }

    if (
      playerResults.data[0].data.gameId !== game.id ||
      playerResults.data[0].data.token !== token
    ) {
      // Game id or token doesn't match
      throw new ServerError('Invalid player token', 403);
    }

    // Get the moving player's data from the game
    const playerId = playerResults.data[0].data.playerId;
    const player = game.players.find(p => p.id === playerId);

    if (!player) {
      throw new ServerError('Player not found', 404);
    }

    // Check if it's the player's turn
    if (player.status !== PlayerStatus.TAKING_TURN) {
      throw new ServerError('Not your turn', 403);
    }

    // Add the move to the game's move log
    const move = {
      playerId: player.id,
      movedAt: new Date(),
      data: moveData ?? {},
    };
    game.moves.push(move);
    game.lastEventType = 'player-moved';
    game.lastEventData = null;

    // Hash and cache all player hidden states so we can check later if
    // they've been changed
    const originalHiddenStates = game.players
      .map(p => [p.id, JSON.stringify(p.hiddenState)])
      .reduce((a, [id, state]) => ({ ...a, [id]: state }), {}) as Record<
      string,
      string
    >;

    // Call move hook if one is defined
    game = (await server.options.hooks?.move?.(game, player, move)) ?? game;

    // Extract hidden state for all players
    const updatedHiddenStates: Record<string, any> = {};
    for (const p of game.players) {
      if (p.hiddenState) {
        updatedHiddenStates[p.id] = p.hiddenState;
        delete p.hiddenState;
      }
    }

    // Check if the game has been finished in this move
    if (game.status === GameStatus.FINISHED) {
      game = await this.finishGame(server, game, false);
    } else {
      this.advanceGame(server, game, player);
    }

    // Save the game in jsonpad
    const updatedGameItem = await server.jsonpad.replaceItemData(
      server.options.jsonpadGamesList,
      game.id,
      this.gameToData({
        ...game,
        lastEventData: {
          ...move,
          ...(game.lastEventData ?? {}),
        },
      })
    );

    // Handle jsonpad rate limiting
    if (server.options.jsonpadRateLimit) {
      await sleep(server.options.jsonpadRateLimit);
    }

    // Update existing player data in jsonpad
    await asyncForEach(game.players, async p => {
      if (p.id !== player.id) {
        if (
          updatedHiddenStates[p.id] &&
          JSON.stringify(p.hiddenState) !== originalHiddenStates[p.id]
        ) {
          await server.jsonpad.replaceItemData(
            server.options.jsonpadPlayersList,
            p.id,
            updatedHiddenStates[p.id] ?? {},
            {
              pointer: '/state',
            }
          );

          // Handle jsonpad rate limiting
          if (server.options.jsonpadRateLimit) {
            await sleep(server.options.jsonpadRateLimit);
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
  private static advanceGame(server: Server, game: Game, player: Player): Game {
    // Handle turn/round advancement
    switch (server.options.mode) {
      case GameMode.TURNS:
        // Current player has finished their turn
        player.status = PlayerStatus.WAITING_FOR_TURN;

        // Advance to the next turn
        let nextPlayer: Player;
        if (
          game.players.some(p => p.status === PlayerStatus.WAITING_FOR_TURN)
        ) {
          const currentPlayerIndex = game.players.findIndex(
            p => p.id === player.id
          );
          for (let i = 1; i < game.players.length; i++) {
            const currentIndex = (currentPlayerIndex + i) % game.players.length;

            // Increment the round if we pass the end of the player list
            if (currentIndex >= game.players.length) {
              game.round++;
            }

            if (
              game.players[currentIndex].status ===
              PlayerStatus.WAITING_FOR_TURN
            ) {
              nextPlayer = game.players[currentIndex];
              nextPlayer.status = PlayerStatus.TAKING_TURN;
              break;
            }
          }
        }

        // Sanity check: if all players are waiting for their turn, something went wrong
        // In this case, we'll just set the first player to taking their turn
        if (
          game.players.every(p => p.status === PlayerStatus.WAITING_FOR_TURN)
        ) {
          nextPlayer = game.players[0];
          nextPlayer.status = PlayerStatus.TAKING_TURN;
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

            await server.jsonpad.replaceItemData(
              server.options.jsonpadGamesList,
              game.id,
              this.gameToData(updatedGame)
            );
          }, timeLimit);

          game.turnFinishesAt = new Date(Date.now() + timeLimit);
        }
        break;

      case GameMode.ROUNDS:
        // Current player has finished their turn
        player.status = PlayerStatus.WAITING_FOR_TURN;

        // If all players have finished their turn, advance to the next round
        if (
          game.players.every(p => p.status === PlayerStatus.WAITING_FOR_TURN)
        ) {
          game.round++;
          game.players.forEach(p => {
            p.status = PlayerStatus.TAKING_TURN;
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
                p.status = PlayerStatus.WAITING_FOR_TURN;
              });

              const updatedGame = this.advanceGame(server, game, player);

              await server.jsonpad.replaceItemData(
                server.options.jsonpadGamesList,
                game.id,
                this.gameToData(updatedGame)
              );
            }, timeLimit);

            game.roundFinishesAt = new Date(Date.now() + timeLimit);
          }
        }
        break;

      case GameMode.FREE:
        break;
    }

    return game;
  }

  /**
   * Finish a game
   */
  public static async finishGame(
    server: Server,
    game: Game,
    save: boolean = true
  ): Promise<Game> {
    game.status = GameStatus.FINISHED;
    game.finishedAt = new Date();
    game.lastEventType = 'game-finished';

    // Call finishGame hook if one is defined
    game = (await server.options.hooks?.finishGame?.(game)) ?? game;

    // Invalidate all player tokens for this game
    await asyncForEach(game.players, async p => {
      await server.jsonpad.deleteItem(server.options.jsonpadPlayersList, p.id);

      // Handle jsonpad rate limiting
      if (server.options.jsonpadRateLimit) {
        await sleep(server.options.jsonpadRateLimit);
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
      const updatedGameItem = await server.jsonpad.replaceItemData(
        server.options.jsonpadGamesList,
        game.id,
        this.gameToData(game)
      );

      return this.dataToGame(updatedGameItem.id, updatedGameItem.data);
    }

    return game;
  }
}
