import { asyncForEach } from '@basementuniverse/async';
import { clamp, exclude } from '@basementuniverse/utils';
import { v4 as uuid } from 'uuid';
import * as constants from '../constants';
import ServerError from '../error';
import { Server } from '../server';
import {
  Game,
  GameMode,
  GameStatus,
  Move,
  Player,
  PlayerStatus,
} from '../types';
import generateToken from '../utilities/generate-token';
import sleep from '../utilities/sleep';
import QueueService from './queue-service';

export default class GameService {
  private static joinTimeouts: Record<string, NodeJS.Timeout> = {};
  private static turnTimeouts: Record<string, NodeJS.Timeout> = {};
  private static roundTimeouts: Record<string, NodeJS.Timeout> = {};
  private static gameTimeouts: Record<string, NodeJS.Timeout> = {};

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
      startsAt: game.startsAt?.toISOString() || undefined,
      finishesAt: game.finishesAt?.toISOString() || undefined,
      turnFinishesAt: game.turnFinishesAt?.toISOString() || undefined,
      roundFinishesAt: game.roundFinishesAt?.toISOString() || undefined,
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
      startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
      finishesAt: data.finishesAt ? new Date(data.finishesAt) : undefined,
      turnFinishesAt: data.turnFinishesAt
        ? new Date(data.turnFinishesAt)
        : undefined,
      roundFinishesAt: data.roundFinishesAt
        ? new Date(data.roundFinishesAt)
        : undefined,
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

    // Call createGame hook if one is defined
    game = (await server.options.hooks?.createGame?.(game, player)) ?? game;

    // If we've got enough players (i.e. this is a 1-player game), then start
    // the game immediately
    if (game.players.length >= game.numPlayers) {
      await this.startGame(server, game);
    }

    // Extract hidden state
    let hiddenState: any = undefined;
    if (game.players[0].hiddenState) {
      hiddenState = game.players[0].hiddenState;
      delete game.players[0].hiddenState;
    }

    // If a join time limit is defined, set a startsAt time
    let timeLimit = 0;
    let startsAt: Date | undefined = undefined;
    if (server.options.joinTimeLimit) {
      timeLimit = Math.max(
        server.options.joinTimeLimit * constants.MS,
        constants.MIN_TIMEOUT
      );
      startsAt = new Date(Date.now() + timeLimit);
      game.startsAt = startsAt;
    }

    // Save the game in jsonpad
    server.options.jsonpadRateLimit &&
      (await sleep(server.options.jsonpadRateLimit));
    const createdGameItem = await server.jsonpad.createItem(
      server.options.jsonpadGamesList,
      {
        data: this.gameToData(game),
      }
    );

    // If a join time limit is defined, set a timeout for the game to start
    // automatically if there are enough players
    if (server.options.joinTimeLimit) {
      this.joinTimeouts[createdGameItem.id] = setTimeout(async () => {
        // Handle join time limit using a queue to avoid race conditions
        QueueService.add(createdGameItem.id, async () => {
          // Fetch the current game
          server.options.jsonpadRateLimit &&
            (await sleep(server.options.jsonpadRateLimit));
          const game = this.dataToGame(
            createdGameItem.id,
            await server.jsonpad.fetchItemData(
              server.options.jsonpadGamesList,
              createdGameItem.id
            )
          );

          // Handle the edge case where the game has already started
          if (game.status !== GameStatus.WAITING_TO_START) {
            return;
          }

          // Populate player hidden state
          server.options.jsonpadRateLimit &&
            (await sleep(server.options.jsonpadRateLimit));
          const players = await server.jsonpad.fetchItemsData(
            server.options.jsonpadPlayersList,
            {
              game: createdGameItem.id,
            }
          );
          const playersMap = players.data.reduce(
            (a, p) => ({
              ...a,
              [p.playerId]: p.state,
            }),
            {}
          );
          for (const player of game.players) {
            player.hiddenState = playersMap[player.id];
          }

          if (game.players.length >= server.options.minPlayers) {
            game.numPlayers = game.players.length;

            const updatedGame = await this.startGame(server, game);

            server.options.jsonpadRateLimit &&
              (await sleep(server.options.jsonpadRateLimit));
            await server.jsonpad.replaceItemData(
              server.options.jsonpadGamesList,
              createdGameItem.id,
              this.gameToData(updatedGame)
            );
          }

          delete this.joinTimeouts[createdGameItem.id];
        });
      }, timeLimit);
    }

    // Save player data in jsonpad
    const token = generateToken();
    server.options.jsonpadRateLimit &&
      (await sleep(server.options.jsonpadRateLimit));
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

    // If we've got enough players, start the game
    if (game.players.length >= game.numPlayers) {
      await this.startGame(server, game);

      // Otherwise, if the game has a join timeout which has passed and we've
      // got at least the minimum number of players, then start the game
    } else if (
      server.options.joinTimeLimit &&
      game.startsAt &&
      game.startsAt < new Date() &&
      game.players.length >= server.options.minPlayers
    ) {
      game.numPlayers = game.players.length;

      await this.startGame(server, game);
    }

    // Extract hidden state for all players
    const updatedHiddenStates: Record<string, any> = {};
    for (const p of game.players) {
      if (p.hiddenState) {
        updatedHiddenStates[p.id] = p.hiddenState;
        delete p.hiddenState;
      }
    }

    // Save the game in jsonpad
    server.options.jsonpadRateLimit &&
      (await sleep(server.options.jsonpadRateLimit));
    const updatedGameItem = await server.jsonpad.replaceItemData(
      server.options.jsonpadGamesList,
      game.id,
      this.gameToData({
        ...game,
        lastEventType: 'player-joined',
        lastEventData: player,
      })
    );

    // Save joining player data in jsonpad
    const token = generateToken();
    server.options.jsonpadRateLimit &&
      (await sleep(server.options.jsonpadRateLimit));
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
      // We can skip the player who just joined because we just updated their
      // data and hidden state above
      if (p.id !== player.id) {
        if (
          updatedHiddenStates[p.id] &&
          JSON.stringify(p.hiddenState) !== originalHiddenStates[p.id]
        ) {
          server.options.jsonpadRateLimit &&
            (await sleep(server.options.jsonpadRateLimit));
          await server.jsonpad.replaceItemData(
            server.options.jsonpadPlayersList,
            p.id,
            updatedHiddenStates[p.id] ?? {},
            {
              pointer: '/state',
            }
          );
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
  private static async startGame(server: Server, game: Game): Promise<Game> {
    game.status = GameStatus.STARTED;
    game.startedAt = new Date();
    game.round = 1;

    // Call round hook if one is defined
    game = (await server.options.hooks?.round?.(game)) ?? game;

    // If there's an auto-start timeout for this game, clear it
    if (this.joinTimeouts[game.id]) {
      clearTimeout(this.joinTimeouts[game.id]);
      delete this.joinTimeouts[game.id];
    }

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

          this.turnTimeouts[firstPlayer.id] = setTimeout(async () => {
            // Handle turn time limit using a queue to avoid race conditions
            QueueService.add(game.id, async () => {
              game.lastEventType = 'timed-out';

              const updatedGame = await this.advanceGame(
                server,
                game,
                firstPlayer
              );

              server.options.jsonpadRateLimit &&
                (await sleep(server.options.jsonpadRateLimit));
              await server.jsonpad.replaceItemData(
                server.options.jsonpadGamesList,
                game.id,
                this.gameToData(updatedGame)
              );

              delete this.turnTimeouts[firstPlayer.id];
            });
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

          this.roundTimeouts[game.id] = setTimeout(async () => {
            // Handle round time limit using a queue to avoid race conditions
            QueueService.add(game.id, async () => {
              game.lastEventType = 'timed-out';
              game.round++;
              game.players.forEach(p => {
                p.status = PlayerStatus.TAKING_TURN;
              });

              // Call round hook if one is defined
              game = (await server.options.hooks?.round?.(game)) ?? game;

              server.options.jsonpadRateLimit &&
                (await sleep(server.options.jsonpadRateLimit));
              await server.jsonpad.replaceItemData(
                server.options.jsonpadGamesList,
                game.id,
                this.gameToData(game)
              );

              delete this.roundTimeouts[game.id];
            });
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

      this.gameTimeouts[game.id] = setTimeout(async () => {
        // Handle game time limit using a queue to avoid race conditions
        QueueService.add(game.id, async () => {
          game.lastEventType = 'timed-out';

          const finishedGame = await this.finishGame(server, game);

          server.options.jsonpadRateLimit &&
            (await sleep(server.options.jsonpadRateLimit));
          await server.jsonpad.replaceItemData(
            server.options.jsonpadGamesList,
            game.id,
            this.gameToData(finishedGame)
          );

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

    // Find out which player is making the move in this game based on which
    // token is being used
    server.options.jsonpadRateLimit &&
      (await sleep(server.options.jsonpadRateLimit));
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

    // Check if the game has been finished in this move
    if (game.status === GameStatus.FINISHED) {
      game = await this.finishGame(server, game, false);
    } else {
      game = await this.advanceGame(server, game, player);
    }

    // Extract hidden state for all players
    const updatedHiddenStates: Record<string, any> = {};
    for (const p of game.players) {
      if (p.hiddenState) {
        updatedHiddenStates[p.id] = p.hiddenState;
        delete p.hiddenState;
      }
    }

    // Save the game in jsonpad
    server.options.jsonpadRateLimit &&
      (await sleep(server.options.jsonpadRateLimit));
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

    // Update all player data in jsonpad
    await asyncForEach(game.players, async p => {
      if (
        updatedHiddenStates[p.id] &&
        JSON.stringify(p.hiddenState) !== originalHiddenStates[p.id]
      ) {
        server.options.jsonpadRateLimit &&
          (await sleep(server.options.jsonpadRateLimit));
        await server.jsonpad.replaceItemData(
          server.options.jsonpadPlayersList,
          p.id,
          updatedHiddenStates[p.id] ?? {},
          {
            pointer: '/state',
          }
        );
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
  private static async advanceGame(
    server: Server,
    game: Game,
    player: Player
  ): Promise<Game> {
    const currentRound = game.round;

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
            let currentIndex = currentPlayerIndex + i;

            // Increment the round if we pass the end of the player list
            if (currentIndex >= game.players.length) {
              game.round++;
            }

            currentIndex = currentIndex % game.players.length;

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
          const timeLimit = Math.max(
            server.options.turnTimeLimit * constants.MS,
            constants.MIN_TIMEOUT
          );

          if (this.turnTimeouts[player.id]) {
            clearTimeout(this.turnTimeouts[player.id]);
            delete this.turnTimeouts[player.id];
          }

          this.turnTimeouts[player.id] = setTimeout(async () => {
            // Handle turn time limit using a queue to vaoid race conditions
            QueueService.add(game.id, async () => {
              game.lastEventType = 'timed-out';

              const updatedGame = await this.advanceGame(
                server,
                game,
                nextPlayer
              );

              server.options.jsonpadRateLimit &&
                (await sleep(server.options.jsonpadRateLimit));
              await server.jsonpad.replaceItemData(
                server.options.jsonpadGamesList,
                game.id,
                this.gameToData(updatedGame)
              );

              delete this.turnTimeouts[player.id];
            });
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
            const timeLimit = Math.max(
              server.options.roundTimeLimit * constants.MS,
              constants.MIN_TIMEOUT
            );

            if (this.roundTimeouts[game.id]) {
              clearTimeout(this.roundTimeouts[game.id]);
              delete this.roundTimeouts[game.id];
            }

            this.roundTimeouts[game.id] = setTimeout(async () => {
              // Handle round time limit using a queue to avoid race conditions
              QueueService.add(game.id, async () => {
                game.lastEventType = 'timed-out';
                game.players.forEach(p => {
                  p.status = PlayerStatus.WAITING_FOR_TURN;
                });

                const updatedGame = await this.advanceGame(
                  server,
                  game,
                  player
                );

                server.options.jsonpadRateLimit &&
                  (await sleep(server.options.jsonpadRateLimit));
                await server.jsonpad.replaceItemData(
                  server.options.jsonpadGamesList,
                  game.id,
                  this.gameToData(updatedGame)
                );

                delete this.roundTimeouts[game.id];
              });
            }, timeLimit);

            game.roundFinishesAt = new Date(Date.now() + timeLimit);
          }
        }
        break;

      case GameMode.FREE:
        break;
    }

    // Call round hook if one is defined
    if (game.round !== currentRound) {
      game = (await server.options.hooks?.round?.(game)) ?? game;
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
        (await sleep(server.options.jsonpadRateLimit));
      const updatedGameItem = await server.jsonpad.replaceItemData(
        server.options.jsonpadGamesList,
        game.id,
        this.gameToData(game)
      );

      return this.dataToGame(updatedGameItem.id, updatedGameItem.data);
    }

    return game;
  }

  /**
   * Fetch a game with a player's hidden state attached
   */
  public static async state(
    server: Server,
    game: Game,
    token: string
  ): Promise<Game> {
    // Check if the game is running
    if (
      ![GameStatus.WAITING_TO_START, GameStatus.STARTED].includes(game.status)
    ) {
      throw new ServerError('Game is not waiting to start or running', 403);
    }

    // Find out which player is requesting their state in this game based on the token
    server.options.jsonpadRateLimit &&
      (await sleep(server.options.jsonpadRateLimit));
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

    // Get the player's data from the game
    const playerId = playerResults.data[0].data.playerId;
    const player = game.players.find(p => p.id === playerId);

    if (!player) {
      throw new ServerError('Player not found', 404);
    }

    player.hiddenState = playerResults.data[0].data.state;

    return game;
  }
}
