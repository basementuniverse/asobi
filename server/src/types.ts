import { Express } from 'express';

export type ServerOptions = {
  jsonpadServerToken: string;
  jsonpadGamesList: string;
  jsonpadPlayersList: string;
  jsonpadRateLimit: number | null;
  mode: GameMode;
  minPlayers: number;
  maxPlayers: number;
  joinTimeLimit: number | TimeLimitSettings | null;
  turnTimeLimit: number | TimeLimitSettings | null;
  roundTimeLimit: number | TimeLimitSettings | null;
  gameTimeLimit: number | TimeLimitSettings | null;
  gameSchema: any;
  playerSchema: any;
  moveSchema: any;
  hooks: Partial<{
    setup: (api: Express) => void;
    createGame: (game: Game, player: Player) => Promise<Game>;
    joinGame: (game: Game, player: Player) => Promise<Game>;
    move: (game: Game, player: Player, move: Move) => Promise<Game>;
    round: (game: Game) => Promise<Game>;
    finishGame: (game: Game) => Promise<Game>;
  }>;
};

export enum GameMode {
  TURNS = 'turns',
  ROUNDS = 'rounds',
  FREE = 'free',
}

export enum GameStatus {
  WAITING_TO_START = 'waiting_to_start',
  STARTED = 'started',
  FINISHED = 'finished',
}

export enum PlayerStatus {
  WAITING_FOR_TURN = 'waiting_for_turn',
  TAKING_TURN = 'taking_turn',
  FINISHED = 'finished',
}

export type Player = {
  id: string;
  name: string;
  status: PlayerStatus;
  state: any;
  hiddenState?: any;
  [key: string]: any;
};

export type Move = {
  playerId: string;
  movedAt: Date;
  data?: any;
};

export type Game = {
  id: string;
  status: GameStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastEventType:
    | 'game-created'
    | 'player-joined'
    | 'player-moved'
    | 'timed-out'
    | 'game-finished';
  lastEventData: any;
  numPlayers: number;
  joinTimeLimit: number | null;
  turnTimeLimit: number | null;
  roundTimeLimit: number | null;
  gameTimeLimit: number | null;
  players: Player[];
  moves: Move[];
  round: number;
  state: any;
  startsAt?: Date | null;
  finishesAt?: Date | null;
  turnFinishesAt?: Date | null;
  roundFinishesAt?: Date | null;
  [key: string]: any;
};

export type SerialisedGame = Omit<
  Game,
  | 'id'
  | 'startedAt'
  | 'finishedAt'
  | 'startsAt'
  | 'finishesAt'
  | 'turnFinishesAt'
  | 'roundFinishesAt'
> & {
  startedAt: string;
  finishedAt: string;
  startsAt?: string | null;
  finishesAt?: string | null;
  turnFinishesAt?: string | null;
  roundFinishesAt?: string | null;
};

export type TimeLimitSettings = {
  default: number;
  min: number | null;
  max: number | null;
};
