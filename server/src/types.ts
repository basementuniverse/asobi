export type ServerOptions = {
  jsonpadServerToken: string;
  jsonpadGamesList: string;
  minPlayers: number;
  maxPlayers: number;
  gameSchema: any;
  playerSchema: any;
  moveSchema: any;
  hooks: Partial<{
    startGame: (game: Game, player: Player) => Promise<Game>;
    joinGame: (game: Game, player: Player) => Promise<Game>;
    move: (game: Game, player: Player, move: Move) => Promise<Game>;
  }>;
};

export enum GameStatus {
  WAITING_TO_START = 'waiting_to_start',
  STARTED = 'started',
  COMPLETED = 'completed',
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
    | 'game-started'
    | 'player-joined'
    | 'player-moved'
    | 'game-finished';
  lastEventData: any;
  numPlayers: number;
  players: Player[];
  moves: Move[];
  round: number;
  state: any;
};

export type SerialisedGame = Omit<Game, 'id' | 'startedAt' | 'finishedAt'> & {
  startedAt: string;
  finishedAt: string;
};
