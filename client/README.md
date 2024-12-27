# Asobi - turn-based game framework - client

A multiplayer turn-based game client for browser games.

## Installation

Using NPM (e.g. for server-side Node.js or client-side use with a bundler like Webpack):

```bash
npm install @basementuniverse/asobi-client
```

To use it in the browser, you can include it directly from a local file or CDN.

```html
<script src="https://cdn.jsdelivr.net/npm/@basementuniverse/asobi-client@1.0.0/build/client.js"></script>
```

## Usage

```js
const client = new AsobiClient({
  jsonpadClientToken: '<YOUR JSONPAD TOKEN>',
  jsonpadGamesList: '<YOUR JSONPAD LIST PATHNAME>',
  asobiServerUrl: '<YOUR ASOBI SERVER URL>',
});

// Fetch a list of games
const { page, limit, total, games } = await client.fetchGames({
  page: 1,
  limit: 10,
  order: 'started',
  direction: 'desc',
  status: 'waiting_to_start',
});

// Fetch a game
const game = await client.fetchGame('<GAME ID>');

// Start a new game with the specified initial state, and join the game as Player 1
const [game, myToken] = await client.startGame({
  'My Player Name',
  {
    // my player data
  },
  {
    // game data
  },
  2, // minimum number of players
  2  // maximum number of players
});

// Join an existing game as Player 2+
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
client.addEventListener('game-started', event => {
  const game = event.detail;

  // ...
});

client.addEventListener('player-joined', event => {
  const game = event.detail;

  // ...
});

client.addEventListener('player-moved', event => {
  const game = event.detail;

  // ...
});

client.addEventListener('game-finished', event => {
  const game = event.detail;

  // ...
});
```
