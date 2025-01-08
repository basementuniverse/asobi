# Asobi - turn-based game framework - client

A multiplayer turn-based game client for browser games.

## Installation

Using NPM (e.g. for server-side Node.js or client-side use with a bundler like Webpack):

```bash
npm install @basementuniverse/asobi-client
```

To use it in the browser, you can include it directly from a local file or CDN.

```html
<script src="https://cdn.jsdelivr.net/npm/@basementuniverse/asobi-client@1.2.0/build/client.js"></script>
```

## Usage

```js
// First we need to create an instance of the client...
const client = new AsobiClient({
  /**
   * Your client-side token for jsonpad.io
   *
   * This will be publically visible to anyone who plays your game, so it
   * should be secure
   *
   * i.e. it should have read-only permissions for the games list
   */
  jsonpadClientToken: '<YOUR JSONPAD TOKEN>',

  /**
   * The id or pathname of the jsonpad.io list which will contain game sessions
   */
  jsonpadGamesList: '<YOUR JSONPAD LIST PATHNAME>',

  /**
   * The URL of the Asobi server that this client should connect to
   */
  asobiServerUrl: '<YOUR ASOBI SERVER URL>',
});

// Fetch a list of games
const { page, limit, total, games } = await client.fetchGames({
  // these fields are all optional
  page: 1,
  limit: 10,

  // valid values are: started, finished, status
  order: 'started',

  // valid values are: asc, desc
  direction: 'desc',

  // valid values are: waiting_to_start, started, finished
  status: 'waiting_to_start',
});

// Fetch a game
const game = await client.fetchGame('<GAME ID>');

// Create a new game with the specified initial state, and join the game
// as the first player
const [game, myToken] = await client.createGame({
  'My Player Name',
  {
    // my player data
  },
  {
    // game data
  },
  2  // number of players
});

// Join an existing game as the 2nd, 3rd, 4th etc. player
// (up to the max number of players)
const [game, myToken] = await client.joinGame(
  '<GAME ID>',
  'My Player Name',
  {
    // my player data
  }
);

// Make a move in a game
const game = await client.move(
  '<GAME ID>',
  myToken,
  {
    // move data
  }
);

// Handle events
client.addEventListener('game-created', event => {
  const game = event.detail;

  // A new game was started
  // game.lastEventType will be 'game-created'
  // game.lastEventData will be set to null
});

client.addEventListener('player-joined', event => {
  const game = event.detail;

  // A player joined a game
  // game.id will contain the id of the game that the player joined
  // game.lastEventType will be 'player-joined'
  // game.lastEventData will be set to the player object
});

client.addEventListener('player-moved', event => {
  const game = event.detail;

  // A player made a move in a game
  // game.id will contain the id of the game in which the move was made
  // game.lastEventType will usually be 'player-moved', but might be 'game-finished' if the
  // last move caused the game to finish
  // game.lastEventData will be an object containing the move data
  // The server might add further data to lastEventData depending on how it's configured
});

client.addEventListener('timed-out', event => {
  const game = event.detail;

  // The game has been configured with turn or round timeouts, and the time limit has been reached
  // game.id will contain the id of the game in which the turn or round timed out
  // game.lastEventType will 'timed-out'
  // game.lastEventData will be set to null
});

client.addEventListener('game-finished', event => {
  const game = event.detail;

  // A game has finished
  // game.id will contain the id of the game that finished
  // game.lastEventType will be 'game-finished'
  // game.lastEventData will be an object containing the move data
  // The server might add further data to lastEventData depending on how it's configured
});
```
