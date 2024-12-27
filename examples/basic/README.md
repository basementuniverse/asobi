# Basic Game Example

2 player game where each player takes turns to increment a counter. The counter increments by a small random number on each turn. The player who reaches the target number first wins.

## Setup

See [jsonpad-schema.md](../jsonpad-schema.md) for instructions on setting up JSONPad.

Install server dependencies:

```bash
cd server
npm install
```

## Running the game

Run the server:

```bash
cd server
npm run start
```

Then open `client/index.html` in a browser.