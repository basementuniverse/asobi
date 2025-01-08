export type ServerOptions = {
  jsonpadServerToken: string;
  jsonpadGamesList: string;
  jsonpadPlayersList: string | null;
  minPlayers: number;
  maxPlayers: number;
  mode: GameMode;
  turnTimeLimit: number | null;
  roundTimeLimit: number | null;
  gameTimeLimit: number | null;
  gameSchema: any;
  playerSchema: any;
  moveSchema: any;
  hooks: Partial<{
    createGame: (game: Game, player: Player) => Promise<Game>;
    joinGame: (game: Game, player: Player) => Promise<Game>;
    move: (game: Game, player: Player, move: Move) => Promise<Game>;
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
  state?: any;
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
  players: Player[];
  moves: Move[];
  round: number;
  state: any;
  turnFinishesAt?: Date | null;
  roundFinishesAt?: Date | null;
  gameFinishesAt?: Date | null;
};

export type SerialisedGame = Omit<Game, 'id' | 'startedAt' | 'finishedAt'> & {
  startedAt: string;
  finishedAt: string;
};
