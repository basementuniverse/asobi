# Basic Game Example (Mode: Turns)

2 player game where each player takes turns to increment a counter. The counter increments by a small random number on each turn. The player who reaches the target number first wins.

## Setup

See [jsonpad.md](../jsonpad.md) for instructions on setting up JSONPad.

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
