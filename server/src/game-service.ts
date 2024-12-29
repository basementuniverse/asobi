import { asyncFind, asyncForEach } from '@basementuniverse/async';
import { clamp, exclude } from '@basementuniverse/utils';
import * as crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import * as constants from './constants';
import ServerError from './error';
import { Server } from './server';
import { Game, GameStatus, Move, PlayerStatus } from './types';

const PLAYER_TOKENS: Record<
  string,
  {
    gameId: string;
    token: string;
  }
> = {};

export default class GameService {
  /**
   * Generate and cache a player token
   */
  private static async addToken(
    server: Server,
    gameId: string,
    playerId: string
  ): Promise<string> {
    const token = this.generateToken();

    if (server.options.jsonpadPlayersList !== null) {
      await server.jsonpad.createItem(server.options.jsonpadPlayersList, {
        data: {
          playerId,
          gameId,
          token,
        },
      });
    } else {
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
  private static async removeToken(
    server: Server,
    gameId: string,
    playerId: string
  ): Promise<void> {
    if (server.options.jsonpadPlayersList !== null) {
      await server.jsonpad.deleteItem(
        server.options.jsonpadPlayersList,
        playerId
      );
    } else if (
      PLAYER_TOKENS[playerId] &&
      PLAYER_TOKENS[playerId].gameId === gameId
    ) {
      delete PLAYER_TOKENS[playerId];
    }
  }

  /**
   * Check if a player token is valid
   */
  public static async verifyToken(
    server: Server,
    gameId: string,
    playerId: string,
    token: string
  ): Promise<boolean> {
    let playerToken: {
      gameId: string;
      token: string;
    };

    if (server.options.jsonpadPlayersList !== null) {
      playerToken = await server.jsonpad.fetchItemData(
        server.options.jsonpadPlayersList,
        playerId
      );
    } else {
      playerToken = PLAYER_TOKENS[playerId];
    }

    return (
      playerToken &&
      playerToken.gameId === gameId &&
      playerToken.token === token
    );
  }

  /**
   * Generate a new token value
   */
  private static generateToken(): string {
    return crypto
      .randomBytes(constants.TOKEN_LENGTH)
      .toString('hex')
      .slice(0, constants.TOKEN_LENGTH);
  }

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

    if (game.lastEventData?.movedAt) {
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

    if (data.lastEventData?.movedAt) {
      game.lastEventData = {
        ...data.lastEventData,
        movedAt: new Date(data.lastEventData.movedAt),
      };
    }

    return game;
  }

  /**
   * Start a new game with the specified player as Player 1
   */
  public static async startGame(
    server: Server,
    playerName: string,
    playerData?: Record<string, any>,
    gameData?: Record<string, any>,
    numPlayers?: number
  ): Promise<[Game, string]> {
    const player = {
      id: uuid(),
      name: playerName,
      status: PlayerStatus.WAITING_FOR_TURN,
      state: playerData,
    };

    // Calculate how many players are required for this game
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
      lastEventType: 'game-started',
      lastEventData: null,
      numPlayers: actualNumPlayers,
      players: [player],
      moves: [],
      round: 0,
      state: gameData,
    };

    // If we've got enough players, start the game
    if (game.players.length >= game.numPlayers) {
      game.status = GameStatus.STARTED;
      game.startedAt = new Date();
      game.round = 1;

      // Player 1 has the first turn
      game.players[0].status = PlayerStatus.TAKING_TURN;
    }

    // Call startGame hook if one is defined
    game = (await server.options.hooks?.startGame?.(game, player)) ?? game;

    // Save the game in jsonpad
    const createdGameItem = await server.jsonpad.createItem(
      server.options.jsonpadGamesList,
      {
        data: this.gameToData(game),
      }
    );

    // Generate and cache a token for this player in this game
    const token = await this.addToken(server, createdGameItem.id, player.id);

    return [this.dataToGame(createdGameItem.id, createdGameItem.data), token];
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

    const player = {
      id: uuid(),
      name: playerName,
      status: PlayerStatus.WAITING_FOR_TURN,
      state: playerData,
    };

    // Add player to the game
    game.players.push(player);

    // If we've got enough players, start the game
    if (game.players.length >= game.numPlayers) {
      game.status = GameStatus.STARTED;
      game.startedAt = new Date();
      game.round = 1;

      // Player 1 has the first turn
      game.players[0].status = PlayerStatus.TAKING_TURN;
    }

    // Call joinGame hook if one is defined
    game = (await server.options.hooks?.joinGame?.(game, player)) ?? game;

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

    // Generate and cache a token for this player in this game
    const token = await this.addToken(server, game.id, player.id);

    return [this.dataToGame(updatedGameItem.id, updatedGameItem.data), token];
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

    // Find the player making the move
    const player = await asyncFind(game.players, p =>
      this.verifyToken(server, game.id, p.id, token)
    );
    if (!player) {
      throw new ServerError('Invalid player token', 403);
    }

    // Check if it's the player's turn
    if (player.status !== PlayerStatus.TAKING_TURN) {
      throw new ServerError('Not your turn', 403);
    }

    // Add the move to the game's move log
    const move = {
      playerId: player.id,
      movedAt: new Date(),
      data: moveData,
    };
    game.moves.push(move);
    game.lastEventData = null;

    // Call move hook if one is defined
    game = (await server.options.hooks?.move?.(game, player, move)) ?? game;

    // Check if the game has been completed
    // This will occur if all other players have finished
    let lastEventType: string = 'player-moved';
    if (
      game.players.every(
        p => p.id === player.id || p.status === PlayerStatus.FINISHED
      )
    ) {
      lastEventType = 'game-finished';
      game.status = GameStatus.COMPLETED;
      game.finishedAt = new Date();

      // Invalidate all player tokens for this game
      await asyncForEach(game.players, p =>
        this.removeToken(server, game.id, p.id)
      );
    }

    // Current player has finished their turn
    player.status = PlayerStatus.WAITING_FOR_TURN;

    // Advance to the next turn
    if (game.players.some(p => p.status === PlayerStatus.WAITING_FOR_TURN)) {
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
          game.players[currentIndex].status === PlayerStatus.WAITING_FOR_TURN
        ) {
          game.players[currentIndex].status = PlayerStatus.TAKING_TURN;
          break;
        }
      }
    }

    // Sanity check: if all players are waiting for their turn, something went wrong
    // In this case, we'll just set the first player to taking their turn
    if (game.players.every(p => p.status === PlayerStatus.WAITING_FOR_TURN)) {
      game.players[0].status = PlayerStatus.TAKING_TURN;
    }

    // Save the game in jsonpad
    const updatedGameItem = await server.jsonpad.replaceItemData(
      server.options.jsonpadGamesList,
      game.id,
      this.gameToData({
        ...game,

        // @ts-ignore
        lastEventType,
        lastEventData: {
          ...move,
          ...(game.lastEventData ?? {}),
        },
      })
    );

    return this.dataToGame(updatedGameItem.id, updatedGameItem.data);
  }
}
