export type ClientOptions = {
  jsonpadClientToken: string;
  jsonpadGamesList: string;
  asobiServerUrl: string;
};

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
  hiddenState?: any;
  [key: string]: any;
};

export type Move = {
  playerId: string;
  movedAt: Date;
  data: any;
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

export type SerialisedGame = Omit<Game, 'id' | 'startedAt' | 'finishedAt'> & {
  startedAt: string;
  finishedAt: string;
};
