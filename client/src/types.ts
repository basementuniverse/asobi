export type ClientOptions = {
  jsonpadClientToken: string;
  jsonpadGamesList: string;
  asobiServerUrl: string;
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
  data: any;
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
  minPlayers: number;
  maxPlayers: number;
  players: Player[];
  moves: Move[];
  round: number;
  state: any;
};

export type SerialisedGame = Omit<Game, 'id' | 'startedAt' | 'finishedAt'> & {
  startedAt: string;
  finishedAt: string;
};
