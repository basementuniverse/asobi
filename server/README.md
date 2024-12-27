# Asobi - turn-based game framework - server

A multiplayer turn-based game server for Node.js.

## Installation

```bash
npm install @basementuniverse/asobi-server
```

## Usage

```ts
import { AsobiServer, Game } from '@basementuniverse/asobi-server';

const server = new AsobiServer({
  jsonpadServerToken: '<YOUR JSONPAD TOKEN>',
  jsonpadGamesList: '<YOUR JSONPAD LIST PATHNAME>',
  minPlayers: 2,
  maxPlayers: 2,
  gameSchema: {
    type: 'object',
  },
  playerSchema: {
    type: 'object',
  },
  moveSchema: {
    type: 'object',
  },
  hooks: {
    startGame: async (game: Game): Promise<Game> => {
      // Initialize game state here...
      return gameData;
    },
    joinGame: async (game: Game, player: Player): Promise<Game> => {
      // Handle player joined here...
      return gameData;
    },
    move: async (game: Game, player: Player, move: Move): Promise<Game> => {
      // Handle player move and update game state accordingly here...
      return gameData;
    },
  },
});

server.start();
```

## Game data

```ts
type Game = {
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

type Player = {
  id: string;
  name: string;
  status: PlayerStatus;
  state?: any;
};

type Move = {
  playerId: string;
  movedAt: Date;
  data?: any;
};

enum GameStatus {
  WAITING_TO_START = 'waiting_to_start',
  STARTED = 'started',
  COMPLETED = 'completed',
}

enum PlayerStatus {
  WAITING_FOR_TURN = 'waiting_for_turn',
  TAKING_TURN = 'taking_turn',
  FINISHED = 'finished',
}
```
