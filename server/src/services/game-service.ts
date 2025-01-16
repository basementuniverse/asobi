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
  SerialisedGame,
} from '../types';
import generateToken from '../utilities/generate-token';
import sleep from '../utilities/sleep';
import QueueService from './queue-service';
import SchedulerService from './scheduler-service';

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
   * Fetch a game from jsonpad
   */
  private static async fetchGame(
    server: Server,
    gameId: string
  ): Promise<Game> {
    server.options.jsonpadRateLimit &&
      (await sleep(server.options.jsonpadRateLimit));
    const gameData = await server.jsonpad.fetchItemData<SerialisedGame>(
      server.options.jsonpadGamesList,
      gameId
    );

    if (!gameData) {
      throw new ServerError('Game not found', 404);
    }

    return this.dataToGame(gameId, gameData);
  }

  /**
   * Populate player data including hidden state for all players in a game
   */
  private static async populatePlayerHiddenState(
    server: Server,
    game: Game
  ): Promise<Game> {
    server.options.jsonpadRateLimit &&
      (await sleep(server.options.jsonpadRateLimit));
    const players = await server.jsonpad.fetchItemsData(
      server.options.jsonpadPlayersList,
      {
        game: game.id,
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

    return game;
  }

  /**
   * Get a map of player hidden states in a game
   *
   * This is used to check if a player's hidden state has changed
   */
  private static getPlayerHiddenStateMap(game: Game): Record<string, string> {
    return game.players
      .map(p => [p.id, JSON.stringify(p.hiddenState)])
      .reduce((a, [id, state]) => ({ ...a, [id]: state }), {}) as Record<
      string,
      string
    >;
  }

  /**
   * Persist an existing game to jsonpad
   *
   * This also persists any player hidden states that have changed
   */
  private static async persistGame(
    server: Server,
    game: Game,
    data: Record<string, any>,
    originalPlayerHiddenStates?: Record<string, string>,
    reinsertHiddenStateForPlayerId?: string,
    skipPersistingHiddenStateForPlayerId?: string
  ): Promise<Game> {
    const currentPlayerHiddenStates: Record<string, any> = {};

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
      (await sleep(server.options.jsonpadRateLimit));
    const updatedGameItem = await server.jsonpad.replaceItemData(
      server.options.jsonpadGamesList,
      game.id,
      this.gameToData({
        ...game,
        ...data,
      })
    );
    const updatedGame = this.dataToGame(
      updatedGameItem.id,
      updatedGameItem.data
    );

    // Check if any player hidden states have changed and update them if needed
    if (originalPlayerHiddenStates) {
      await asyncForEach(game.players, async p => {
        // We might want to skip persisting hidden state for a specific player
        if (
          skipPersistingHiddenStateForPlayerId &&
          p.id === skipPersistingHiddenStateForPlayerId
        ) {
          return;
        }

        // Otherwise, check if the player's hidden state has changed and if so,
        // update it in jsonpad
        if (
          currentPlayerHiddenStates[p.id] &&
          JSON.stringify(currentPlayerHiddenStates[p.id]) !==
            originalPlayerHiddenStates[p.id]
        ) {
          server.options.jsonpadRateLimit &&
            (await sleep(server.options.jsonpadRateLimit));
          await server.jsonpad.replaceItemData(
            server.options.jsonpadPlayersList,
            p.id,
            currentPlayerHiddenStates[p.id] ?? {},
            {
              pointer: '/state',
            }
          );
        }
      });
    }

    // Re-insert hidden state for a specific player if needed
    if (reinsertHiddenStateForPlayerId) {
      const player = game.players.find(
        p => p.id === reinsertHiddenStateForPlayerId
      );
      if (player && currentPlayerHiddenStates[player.id]) {
        player.hiddenState = currentPlayerHiddenStates[player.id];
      }
    }

    return updatedGame;
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

    // If a join time limit is defined, set a timeout for the game to start
    // automatically if there are enough players
    if (server.options.joinTimeLimit) {
      SchedulerService.schedule(
        createdGameItem.id,
        '',
        'join-timeout',
        async () => {
          // Fetch the current game with player hidden state attached
          const currentGame = await this.populatePlayerHiddenState(
            server,
            await this.fetchGame(server, createdGameItem.id)
          );

          // Handle an edge case where the game has already started
          if (currentGame.status !== GameStatus.WAITING_TO_START) {
            return;
          }

          // If we've got enough players to automatically start the game, then
          // start the game immediately
          const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(game);
          if (currentGame.players.length >= server.options.minPlayers) {
            currentGame.numPlayers = currentGame.players.length;

            const updatedGame = await this.startGame(server, currentGame);

            await this.persistGame(
              server,
              updatedGame,
              {},
              originalPlayerHiddenStates
            );
          }
        },
        timeLimit
      );
    }

    // Re-insert hidden state for the host player into the response
    const result = this.dataToGame(createdGameItem.id, createdGameItem.data);
    result.players[0].hiddenState = hiddenState;

    return [result, token];
  }

  /**
   * Join an existing game as Player 2+
   */
  public static async joinGame(
    server: Server,
    gameId: string,
    playerName: string,
    playerData?: Record<string, any>
  ): Promise<[Game, string]> {
    let game = await this.populatePlayerHiddenState(
      server,
      await this.fetchGame(server, gameId)
    );

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

    // Fetch all player hidden states so we can check later if they've changed
    const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(game);

    // Call joinGame hook if one is defined
    game = (await server.options.hooks?.joinGame?.(game, player)) ?? game;

    // If we've got enough players, start the game
    if (game.players.length >= game.numPlayers) {
      await this.startGame(server, game);

      // Otherwise, if the game has a join timeout which has passed and we've
      // got at least the minimum number of players, then we should start the
      // game immediately
    } else if (
      server.options.joinTimeLimit &&
      game.startsAt &&
      game.startsAt < new Date() &&
      game.players.length >= server.options.minPlayers
    ) {
      game.numPlayers = game.players.length;

      await this.startGame(server, game);
    }

    // Store the joining player's hidden state
    const joiningPlayerHiddenState = game.players.find(
      p => p.id === player.id
    )?.hiddenState;

    // Save the game in jsonpad
    const updatedGame = await this.persistGame(
      server,
      game,
      {
        lastEventType: 'player-joined',
        lastEventData: player,
      },
      originalPlayerHiddenStates,
      undefined,
      player.id
    );

    // Save joining player data in jsonpad
    const token = generateToken();
    server.options.jsonpadRateLimit &&
      (await sleep(server.options.jsonpadRateLimit));
    await server.jsonpad.createItem(server.options.jsonpadPlayersList, {
      data: {
        playerId: player.id,
        gameId: updatedGame.id,
        token,
        state: joiningPlayerHiddenState ?? {},
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
   * Start a game
   */
  private static async startGame(server: Server, game: Game): Promise<Game> {
    game.status = GameStatus.STARTED;
    game.startedAt = new Date();
    game.round = 1;

    // Call round hook if one is defined
    game = (await server.options.hooks?.round?.(game)) ?? game;

    // If there's a join timeout for this game, clear it
    SchedulerService.clear(game.id, '', 'join-timeout');

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

          SchedulerService.schedule(
            game.id,
            firstPlayer.id,
            'turn-timeout',
            async () => {
              // Fetch the current game
              const currentGame = await this.populatePlayerHiddenState(
                server,
                await this.fetchGame(server, game.id)
              );
              currentGame.lastEventType = 'timed-out';

              // Cache all player hidden states so we can check later if they've
              // been changed
              const originalPlayerHiddenStates =
                this.getPlayerHiddenStateMap(currentGame);

              // Advance the game to the next turn
              const updatedGame = await this.advanceGame(
                server,
                currentGame,
                firstPlayer
              );

              // Save the game in jsonpad
              await this.persistGame(
                server,
                updatedGame,
                {},
                originalPlayerHiddenStates
              );
            },
            timeLimit
          );

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

          SchedulerService.schedule(
            game.id,
            '',
            'round-timeout',
            async () => {
              // Fetch the current game
              const currentGame = await this.populatePlayerHiddenState(
                server,
                await this.fetchGame(server, game.id)
              );
              currentGame.lastEventType = 'timed-out';

              // Cache all player hidden states so we can check later if they've
              // been changed
              const originalPlayerHiddenStates =
                this.getPlayerHiddenStateMap(currentGame);

              // Advance the game to the next round
              const updatedGame = await this.advanceGame(
                server,
                currentGame,
                undefined,
                true
              );

              // Save the game in jsonpad
              await this.persistGame(
                server,
                updatedGame,
                {},
                originalPlayerHiddenStates
              );
            },
            timeLimit
          );

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

      SchedulerService.schedule(
        game.id,
        '',
        'game-timeout',
        async () => {
          // Fetch the current game
          const currentGame = await this.populatePlayerHiddenState(
            server,
            await this.fetchGame(server, game.id)
          );
          currentGame.lastEventType = 'timed-out';

          // Cache all player hidden states so we can check later if they've
          // been changed
          const originalPlayerHiddenStates =
            this.getPlayerHiddenStateMap(currentGame);

          // Finish the game
          const finishedGame = await this.finishGame(server, currentGame);

          // Save the game in jsonpad
          await this.persistGame(
            server,
            finishedGame,
            {},
            originalPlayerHiddenStates
          );
        },
        timeLimit
      );

      game.finishesAt = new Date(Date.now() + timeLimit);
    }

    return game;
  }

  /**
   * Make a move in an existing game
   */
  public static async move(
    server: Server,
    gameId: string,
    token: string,
    moveData?: Record<string, any>
  ): Promise<Game> {
    let game = await this.populatePlayerHiddenState(
      server,
      await this.fetchGame(server, gameId)
    );

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

    // Cache all player hidden states so we can check later if they've changed
    const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(game);

    // Call move hook if one is defined
    game = (await server.options.hooks?.move?.(game, player, move)) ?? game;

    // Check if the game has been finished in this move
    if (game.status === GameStatus.FINISHED) {
      game = await this.finishGame(server, game, false);
    } else {
      game = await this.advanceGame(server, game, player);
    }

    // Save the game in jsonpad
    const updatedGame = await this.persistGame(
      server,
      game,
      {
        lastEventData: {
          ...move,
          ...(game.lastEventData ?? {}),
        },
      },
      originalPlayerHiddenStates,
      player.id
    );

    return updatedGame;
  }

  /**
   * Handle turn/round advancement
   */
  private static async advanceGame(
    server: Server,
    game: Game,
    player?: Player,
    forceAdvanceRound: boolean = false
  ): Promise<Game> {
    const currentRound = game.round;

    // Handle turn/round advancement
    switch (server.options.mode) {
      case GameMode.TURNS:
        // Current player has finished their turn
        player && (player.status = PlayerStatus.WAITING_FOR_TURN);

        // Advance to the next turn
        let nextPlayer: Player | undefined = undefined;
        if (
          player &&
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

        // Sanity check: if all players are waiting for their turn, something
        // went wrong; in this case, we'll just reset to the first player
        if (
          game.players.every(p => p.status === PlayerStatus.WAITING_FOR_TURN)
        ) {
          nextPlayer = game.players[0];
          nextPlayer.status = PlayerStatus.TAKING_TURN;
        }

        // If a turn time limit is defined, set a timeout for the next player
        // to move
        if (server.options.turnTimeLimit) {
          const timeLimit = Math.max(
            server.options.turnTimeLimit * constants.MS,
            constants.MIN_TIMEOUT
          );

          // Clear any turn timeouts for this player
          if (player) {
            SchedulerService.clear(game.id, player.id, 'turn-timeout');
          }

          if (nextPlayer) {
            SchedulerService.schedule(
              game.id,
              nextPlayer.id,
              'turn-timeout',
              async () => {
                // Fetch the current game
                const currentGame = await this.populatePlayerHiddenState(
                  server,
                  await this.fetchGame(server, game.id)
                );
                currentGame.lastEventType = 'timed-out';

                // Cache all player hidden states so we can check later if they've
                // been changed
                const originalPlayerHiddenStates =
                  this.getPlayerHiddenStateMap(currentGame);

                // Advance the game to the next turn
                const updatedGame = await this.advanceGame(
                  server,
                  currentGame,
                  nextPlayer
                );

                // Save the game in jsonpad
                await this.persistGame(
                  server,
                  updatedGame,
                  {},
                  originalPlayerHiddenStates
                );
              },
              timeLimit
            );
          }

          game.turnFinishesAt = new Date(Date.now() + timeLimit);
        }
        break;

      case GameMode.ROUNDS:
        // Current player has finished their turn
        player && (player.status = PlayerStatus.WAITING_FOR_TURN);

        // If all players have finished their turn (or have finished the game),
        // advance to the next round
        // We can also force round advancement if needed (e.g. if a round time
        // limit has been reached)
        if (
          forceAdvanceRound ||
          game.players.every(p =>
            [PlayerStatus.WAITING_FOR_TURN, PlayerStatus.FINISHED].includes(
              p.status
            )
          )
        ) {
          game.round++;
          game.players.forEach(p => {
            if (p.status === PlayerStatus.FINISHED) {
              return;
            }
            p.status = PlayerStatus.TAKING_TURN;
          });

          // If a round time limit is defined, set a timeout for the current round
          if (server.options.roundTimeLimit) {
            const timeLimit = Math.max(
              server.options.roundTimeLimit * constants.MS,
              constants.MIN_TIMEOUT
            );

            // Clear any round timeouts for this game
            SchedulerService.clear(game.id, '', 'round-timeout');

            SchedulerService.schedule(
              game.id,
              '',
              'round-timeout',
              async () => {
                // Fetch the current game
                const currentGame = await this.populatePlayerHiddenState(
                  server,
                  await this.fetchGame(server, game.id)
                );
                currentGame.lastEventType = 'timed-out';

                // Cache all player hidden states so we can check later if they've
                // been changed
                const originalPlayerHiddenStates =
                  this.getPlayerHiddenStateMap(currentGame);

                // Advance the game to the next round
                const updatedGame = await this.advanceGame(
                  server,
                  currentGame,
                  undefined,
                  true
                );

                // Save the game in jsonpad
                await this.persistGame(
                  server,
                  updatedGame,
                  {},
                  originalPlayerHiddenStates
                );
              },
              timeLimit
            );

            game.roundFinishesAt = new Date(Date.now() + timeLimit);
          }
        }
        break;

      case GameMode.FREE:
        // Games don't advance in the usual way in free mode; players can take
        // turns at any time and in any order, so turns and rounds never advance
        break;
    }

    // Call round hook if one is defined and the round has changed
    if (game.round !== currentRound) {
      game = (await server.options.hooks?.round?.(game)) ?? game;
    }

    return game;
  }

  /**
   * Finish a game
   */
  private static async finishGame(
    server: Server,
    game: Game,
    save: boolean = true
  ): Promise<Game> {
    game.status = GameStatus.FINISHED;
    game.finishedAt = new Date();
    game.lastEventType = 'game-finished';

    // Cache all player hidden states so we can check later if they've changed
    const originalPlayerHiddenStates = this.getPlayerHiddenStateMap(game);

    // Call finishGame hook if one is defined
    game = (await server.options.hooks?.finishGame?.(game)) ?? game;

    // Remove timeouts for this game
    SchedulerService.clear(game.id);

    // Make sure there are no more queued functions for this game
    QueueService.clear(game.id);

    // Save the game in jsonpad
    if (save) {
      return await this.persistGame(
        server,
        game,
        {},
        originalPlayerHiddenStates
      );
    }

    return game;
  }

  /**
   * Fetch a game with a player's hidden state attached
   */
  public static async state(
    server: Server,
    gameId: string,
    token: string
  ): Promise<Game> {
    const game = await this.populatePlayerHiddenState(
      server,
      await this.fetchGame(server, gameId)
    );

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
