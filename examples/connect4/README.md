# Connect4 Example

2 player game where each player takes turns dropping coloured tokens into a column of a 6-row by 7-column grid. These tokens drop to the lowest available row in the column. The player who gets 4 tokens of their colour in a row (horizontally, vertically, or diagonally) wins.

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
