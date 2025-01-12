import JSONPadRealtime, {
  ItemEvent,
} from '@basementuniverse/jsonpad-realtime-sdk';
import JSONPad from '@basementuniverse/jsonpad-sdk';
import {
  GameCreatedEvent,
  GameFinishedEvent,
  PlayerJoinedEvent,
  PlayerMovedEvent,
  TimedOutEvent,
} from './events';
import { ClientOptions, Game, GameStatus, SerialisedGame } from './types';

export class Client extends EventTarget {
  private static readonly defaultOptions: ClientOptions = {
    jsonpadClientToken: '',
    jsonpadGamesList: '',
    asobiServerUrl: '',
  };

  public options: ClientOptions;
  public jsonpad: JSONPad;
  public jsonpadRealtime: JSONPadRealtime;

  public constructor(options: Partial<ClientOptions>) {
    super();

    this.options = Object.assign({}, Client.defaultOptions, options ?? {});

    // Initialise jsonpad SDK
    this.jsonpad = new JSONPad(this.options.jsonpadClientToken);

    // Initialise jsonpad realtime SDK
    this.jsonpadRealtime = new JSONPadRealtime(this.options.jsonpadClientToken);
    this.jsonpadRealtime.listen(
      ['item-created', 'item-updated'],
      [this.options.jsonpadGamesList],
      ['*']
    );

    // Attach jsonpad realtime event handlers
    this.jsonpadRealtime.addEventListener('item-created', (e: ItemEvent) => {
      const game = {
        id: e.detail.model.id,
        ...e.detail.model.data,
      } as Game;
      this.dispatchEvent(new GameCreatedEvent(game));
    });
    this.jsonpadRealtime.addEventListener('item-updated', (e: ItemEvent) => {
      const game = {
        id: e.detail.model.id,
        ...e.detail.model.data,
      } as Game;
      switch (game.lastEventType) {
        case 'game-created':
          return;

        case 'player-joined':
          this.dispatchEvent(new PlayerJoinedEvent(game));
          return;

        case 'player-moved':
          this.dispatchEvent(new PlayerMovedEvent(game));
          return;

        case 'timed-out':
          this.dispatchEvent(new TimedOutEvent(game));
          return;

        case 'game-finished':
          this.dispatchEvent(new GameFinishedEvent(game));
          return;
      }
    });
  }

  /**
   * Fetch a list of games
   */
  public async fetchGames(parameters: {
    page: number;
    limit: number;
    order: 'status' | 'started' | 'finished';
    direction: 'asc' | 'desc';
    status: GameStatus;
  }): Promise<{
    page: number;
    limit: number;
    total: number;
    games: Game[];
  }> {
    const response = await this.jsonpad.fetchItems(
      this.options.jsonpadGamesList,
      {
        ...parameters,
        includeData: true,
      }
    );

    return {
      page: response.page,
      limit: response.limit,
      total: response.total,
      games: response.data.map(item => ({
        id: item.id,
        ...item.data,
        startedAt: item.data.startedAt ? new Date(item.data.startedAt) : null,
        finishedAt: item.data.finishedAt
          ? new Date(item.data.finishedAt)
          : null,
      })),
    };
  }

  /**
   * Fetch a game
   */
  public async fetchGame(gameId: string): Promise<Game | null> {
    const game = await this.jsonpad.fetchItemData<SerialisedGame>(
      this.options.jsonpadGamesList,
      gameId
    );

    return {
      id: gameId,
      ...game,
      startedAt: game.startedAt ? new Date(game.startedAt) : null,
      finishedAt: game.finishedAt ? new Date(game.finishedAt) : null,
    };
  }

  /**
   * Make a move in a game
   */
  public async fetchState(gameId: string, token: string): Promise<Game> {
    const response = await fetch(
      `${this.options.asobiServerUrl}/state/${gameId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const json = await response.json();

    return {
      ...json.game,
      startedAt: json.game.startedAt ? new Date(json.game.startedAt) : null,
      finishedAt: json.game.finishedAt ? new Date(json.game.finishedAt) : null,
    };
  }

  /**
   * Create a new game with the specified player as Player 1
   */
  public async createGame(
    playerName: string,
    playerData?: Record<string, any>,
    gameData?: Record<string, any>,
    numPlayers?: number
  ): Promise<[Game, string]> {
    const response = await fetch(`${this.options.asobiServerUrl}/create-game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerName,
        playerData,
        gameData,
        numPlayers,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const json = await response.json();

    return [
      {
        ...json.game,
        startedAt: json.game.startedAt ? new Date(json.game.startedAt) : null,
        finishedAt: json.game.finishedAt
          ? new Date(json.game.finishedAt)
          : null,
      },
      json.token,
    ];
  }

  /**
   * Join an existing game as Player 2+
   */
  public async joinGame(
    gameId: string,
    playerName: string,
    playerData?: Record<string, any>
  ): Promise<[Game, string]> {
    const response = await fetch(
      `${this.options.asobiServerUrl}/join-game/${gameId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName,
          playerData,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const json = await response.json();

    return [
      {
        ...json.game,
        startedAt: json.game.startedAt ? new Date(json.game.startedAt) : null,
        finishedAt: json.game.finishedAt
          ? new Date(json.game.finishedAt)
          : null,
      },
      json.token,
    ];
  }

  /**
   * Make a move in a game
   */
  public async move(
    gameId: string,
    token: string,
    moveData: any
  ): Promise<Game> {
    const response = await fetch(
      `${this.options.asobiServerUrl}/move/${gameId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          moveData,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const json = await response.json();

    return {
      ...json.game,
      startedAt: json.game.startedAt ? new Date(json.game.startedAt) : null,
      finishedAt: json.game.finishedAt ? new Date(json.game.finishedAt) : null,
    };
  }
}
