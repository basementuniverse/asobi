# Basic Game Example (Mode: Rounds)

3 player game where each player picks a number between 1 and 10 on each round. The player who picks the number closest to a random target number (generated at the beginning of each round) gets a point. The first player to reach the target number of points wins the game.

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
