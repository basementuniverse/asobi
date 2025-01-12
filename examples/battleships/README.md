# Battleships Example

2, 3, or 4 player game where each player takes turns shooting at each other's ships. Players set up their game-board first by positioning their ships.

When all of a player's ships are destroyed, the player is eliminated. The last player standing wins.

## Setup

See [jsonpad-schema.md](../jsonpad-schema.md) for instructions on setting up JSONPad.

Install server dependencies:

```bash
cd server
npm install
```

Paste JSONPad list path names and tokens into `client/index.html` and `server/index.js`.

## Running the game

Run the server:

```bash
cd server
npm run start
```

Then open `client/index.html` in a browser.
