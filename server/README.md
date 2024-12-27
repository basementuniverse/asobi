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

      // lastEventType will be 'game-started'
      // lastEventData will be set to null

      return game;
    },
    joinGame: async (game: Game, player: Player): Promise<Game> => {
      // Handle player joined here...

      // lastEventType will be 'player-joined'
      // lastEventData will be set to the player object

      return game;
    },
    move: async (game: Game, player: Player, move: Move): Promise<Game> => {
      // Handle player move and update game state accordingly here...

      // lastEventType will be 'player-moved'
      // lastEventData will be reset to null before this hook is called
      // then, after this hook returns, the move object will be merged into lastEventData
      // this means we can customize the lastEventData object in this hook

      return game;
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
