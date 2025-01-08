# Basic Game Example (Mode: Free)

4 player game where each players take turns (in any order and at any time) guessing a number. The first player to guess correctly wins.

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
