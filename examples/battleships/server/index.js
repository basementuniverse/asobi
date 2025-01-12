const { AsobiServer } = require('@basementuniverse/asobi-server');
const { vec2 } = require('@basementuniverse/vec');
const { times, shuffle, pos, ind } = require('@basementuniverse/utils');

const JSONPAD_SERVER_TOKEN = '<YOUR JSONPAD SERVER TOKEN>';
const JSONPAD_GAMES_LIST = '<YOUR JSONPAD GAMES LIST PATH NAME>';
const JSONPAD_PLAYERS_LIST = '<YOUR JSONPAD PLAYERS LIST PATH NAME>';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 10;

const SHIP_LENGTHS = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

// Get an empty grid with a side length of some multiple of the board size
function emptyGrid(n = 1) {
  return times(i => null, (BOARD_WIDTH * n) * (BOARD_HEIGHT * n));
}

// Prepare an individual player's grid
function preparePlayerGrid(ships) {
  const shipBoundingBoxes = Object
    .entries(ships)
    .map(
      ([ship, data]) => ({
        ship,
        bb: shipBoundingBox(ship, data.position, data.orientation),
      })
    );

  const grid = emptyGrid();
  for (const { ship, bb } of shipBoundingBoxes) {
    for (let x = bb.x1; x < bb.x2; x++) {
      for (let y = bb.y1; y < bb.y2; y++) {
        grid[ind(x, y, BOARD_WIDTH)] = ship;
      }
    }
  }

  return grid;
}

// Assign each player to a region on the global grid
function assignRegions(players) {
  const offsets = shuffle([
    vec2(0, 0),
    vec2(1, 0),
    vec2(0, 1),
    vec2(1, 1),
  ]);

  players.forEach((p, i) => {
    p.state.offset = offsets[i];
  });
}

// Prepare the global grid containing all players
function prepareGlobalGrid(players) {
  const grid = emptyGrid(2);
  for (const player of players) {
    const offset = vec2(
      player.state.offset.x * BOARD_WIDTH,
      player.state.offset.y * BOARD_HEIGHT
    );

    for (const [i, ship] of player.hiddenState.grid.entries()) {
      if (ship !== null) {
        const p = vec2.add(
          vec2.fromComponents(pos(i, BOARD_WIDTH)),
          offset
        );
        grid[ind(p.x, p.y, BOARD_WIDTH * 2)] = {
          player: player.id,
          ship,
        };
      }
    }
  }

  return grid;
}

// Get the bounding box for a ship at position p with orientation o
function shipBoundingBox(ship, p, o) {
  if (o === 'h') {
    return {
      x1: p.x,
      x2: p.x + SHIP_LENGTHS[ship],
      y1: p.y,
      y2: p.y + 1,
    };
  }

  return {
    x1: p.x,
    x2: p.x + 1,
    y1: p.y,
    y2: p.y + SHIP_LENGTHS[ship],
  };
}

const server = new AsobiServer({
  jsonpadServerToken: JSONPAD_SERVER_TOKEN,
  jsonpadGamesList: JSONPAD_GAMES_LIST,
  jsonpadPlayersList: JSONPAD_PLAYERS_LIST,
  jsonpadRateLimit: null,
  hooks: {
    createGame: async (game, player) => {
      player.hiddenState = {
        grid: preparePlayerGrid(player.state.ships),
      };
      player.state = {
        offset: null,
        remainingTiles: Object.values(SHIP_LENGTHS).reduce((a, b) => a + b, 0),
        remainingShips: Object.keys(SHIP_LENGTHS),
        remainingTilesPerShip: { ...SHIP_LENGTHS },
        eliminated: false,
      };

      // We'll store hits/misses in the game state
      game.state.shots = [];

      return game;
    },
    joinGame: async (game, player) => {
      player.hiddenState = {
        grid: preparePlayerGrid(player.state.ships),
      };

      // If all players have joined the game now, we can assign each player to a region on the global grid
      if (game.players.length === game.numPlayers) {
        assignRegions(game.players);
      }

      player.state = {
        offset: game.players.find(p => p.id === player.id).state.offset,
        remainingTiles: Object.values(SHIP_LENGTHS).reduce((a, b) => a + b, 0),
        remainingShips: Object.keys(SHIP_LENGTHS),
        remainingTilesPerShip: { ...SHIP_LENGTHS },
        eliminated: false,
      };

      return game;
    },
    move: async (game, player, move) => {
      const position = vec2(move.data.x, move.data.y);

      // Make sure the move is valid
      if (
        position.x < 0 ||
        position.x >= BOARD_WIDTH * 2 ||
        position.y < 0 ||
        position.y >= BOARD_HEIGHT * 2
      ) {
        console.error('Move out of bounds');
        return game;
      }

      // We can't shoot more than once at the same position
      if (
        game.state.shots.some(h => (
          h.position.x === position.x &&
          h.position.y === position.y
        ))
      ) {
        console.error('Already shot at this position');
        return game;
      }

      // Check if the move is a hit
      const globalGrid = prepareGlobalGrid(game.players);
      const hit = globalGrid[ind(position.x, position.y, BOARD_WIDTH * 2)];
      let hitPlayer = null;
      let hitShip = null;
      let sunkShip = null;
      if (hit !== null) {
        hitPlayer = game.players.find(
          p => p.id === hit.player
        );

        if (!hitPlayer) {
          console.error('Hit player not found');
          return game;
        }
        hitShip = hit.ship;

        // Update the hit player's hidden state
        hitPlayer.hiddenState.grid[ind(
          position.x - hitPlayer.state.offset.x * BOARD_WIDTH,
          position.y - hitPlayer.state.offset.y * BOARD_HEIGHT,
          BOARD_WIDTH
        )] = null;

        // Update the hit player's public state
        hitPlayer.state.remainingTiles--;
        hitPlayer.state.remainingTilesPerShip[hit.ship]--;

        // Check if we sunk a ship
        if (hitPlayer.state.remainingTilesPerShip[hit.ship] <= 0) {
          hitPlayer.state.remainingShips = hitPlayer.state.remainingShips.filter(
            s => s !== hit.ship
          );
          sunkShip = hit.ship;
        }

        // Check if this player has been eliminated
        if (hitPlayer.state.remainingTiles === 0) {
          hitPlayer.state.eliminated = true;
        }
      }

      // Check if the game is over
      let winningPlayer = null;
      if (game.players.filter(p => !p.state.eliminated).length <= 1) {
        game.state.winner = game.players.find(p => !p.state.eliminated).id;
        game.status = 'finished';
      }

      // Record move data so it can be displayed in the client
      game.lastEventData = {
        winningPlayer,
        shootingPlayer: player.id,
        hitPlayer: hit?.player ? hitPlayer.id : null,
        hitShip,
        sunkShip,
      };
      game.state.shots.push({
        position,
        shootingPlayer: player.id,
        hitPlayer: hit?.player ? hitPlayer.id : null,
        hitShip,
        sunkShip,
      });

      return game;
    },
  },
});

server.start();
