const { AsobiServer } = require('@basementuniverse/asobi-server');
const { range, ind } = require('@basementuniverse/utils');
const { vec2 } = require('@basementuniverse/vec');

const DEFAULT_WIDTH = 7;
const DEFAULT_HEIGHT = 6;
const DEFAULT_WINNING_RUN = 4;

function isSlotOccupied(board, width, position) {
  return board[ind(position.x, position.y, width)] !== null;
}

function isColumnFull(board, width, height, column) {
  return range(height).every(
    row => isSlotOccupied(board, width, vec2(column, row))
  );
}

function findEmptySlot(board, width, height, column) {
  for (let row = height; row--;) {
    if (!isSlotOccupied(board, width, vec2(column, row))) {
      return row;
    }
  }
  return -1;
}

function positionInBounds(position, width, height) {
  return (
    position.x >= 0 &&
    position.x < width &&
    position.y >= 0 &&
    position.y < height
  );
}

function findWinningRun(board, width, height, winningRun, colour, positions) {
  let count = 0;
  for (const position of positions) {
    if (!positionInBounds(position, width, height)) {
      count = 0;
      continue;
    }

    if (board[ind(position.x, position.y, width)] === colour) {
      count++;
    } else {
      count = 0;
    }

    if (count >= winningRun) {
      return true;
    }
  }

  return false;
}

function checkWinAtPosition(board, width, height, winningRun, colour, position) {
  // Horizontal
  if (
    findWinningRun(
      board,
      width,
      height,
      winningRun,
      colour,
      range(winningRun * 2 + 1)
        .map(x => x - (winningRun - 1))
        .map(x => vec2(position.x + x, position.y))
    )
  ) {
    return true;
  }

  // Vertical
  if (
    findWinningRun(
      board,
      width,
      height,
      winningRun,
      colour,
      range(winningRun * 2 + 1)
        .map(y => y - (winningRun - 1))
        .map(y => vec2(position.x, position.y + y))
    )
  ) {
    return true;
  }

  // Diagonals
  if (
    findWinningRun(
      board,
      width,
      height,
      winningRun,
      colour,
      range(winningRun * 2 + 1)
        .map(xy => xy - (winningRun - 1))
        .map(xy => vec2(position.x + xy, position.y + xy))
    ) ||
    findWinningRun(
      board,
      width,
      height,
      winningRun,
      colour,
      range(winningRun * 2 + 1)
        .map(xy => xy - (winningRun - 1))
        .map(xy => vec2(position.x + xy, position.y - xy))
    )
  ) {
    return true;
  }

  return false;
}

const server = new AsobiServer({
  jsonpadServerToken: '<YOUR JSONPAD SERVER TOKEN>',
  jsonpadGamesList: '<YOUR JSONPAD GAMES LIST PATH NAME>',
  hooks: {
    startGame: async (game, player) => {
      if (!game.state) {
        game.state = {};
      }

      if (!game.state.width) {
        game.state.width = DEFAULT_WIDTH;
      }

      if (!game.state.height) {
        game.state.height = DEFAULT_HEIGHT;
      }

      if (!game.state.winningRun) {
        game.state.winningRun = DEFAULT_WINNING_RUN;
      }

      game.state.board = new Array(
        game.state.width * game.state.height
      ).fill(null);

      player.state = {
        colour: 'red',
      };

      return game;
    },
    joinGame: async (game, player) => {
      player.state = {
        colour: 'yellow',
      };

      return game;
    },
    move: async (game, player, move) => {
      const column = move.data.column;

      if (column === undefined || column < 0 || column >= game.state.width) {
        throw new Error('Invalid move');
      }

      if (isColumnFull(
        game.state.board,
        game.state.width,
        game.state.height,
        column
      )) {
        throw new Error('Column full');
      }

      const row = findEmptySlot(
        game.state.board,
        game.state.width,
        game.state.height,
        column
      );

      if (row === -1) {
        throw new Error('Column full');
      }

      game.state.board[ind(column, row, game.state.width)] = player.state.colour;
      game.lastEventData = {
        column,
        row,
        colour: player.state.colour,
      };

      if (checkWinAtPosition(
        game.state.board,
        game.state.width,
        game.state.height,
        game.state.winningRun,
        player.state.colour,
        vec2(column, row)
      )) {
        game.state.winner = player.id;
        game.players.forEach(p => {
          p.status = 'finished';
        });
      }

      return game;
    },
  },
});

server.start();
