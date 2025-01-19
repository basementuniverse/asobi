const { AsobiServer } = require('@basementuniverse/asobi-server');

// Create an instance of the server...
const server = new AsobiServer({

  // Provide the server token (this allows the server to read and modify games)
  jsonpadServerToken: '<YOUR JSONPAD SERVER TOKEN>',

  // Provide the id or path name of the JSONPad list which will store the games
  jsonpadGamesList: '<YOUR JSONPAD GAMES LIST PATH NAME>',

  // Optionally provide the id or path name of the JSONPad list which will store player tokens
  // (if this is not provided, the server will store tokens in memory)
  jsonpadPlayersList: '<YOUR JSONPAD PLAYERS LIST PATH NAME>',

  // This game can be played by 4 to 6 players
  minPlayers: 4,
  maxPlayers: 6,

  // Players can make moves at any time and in any order
  mode: 'free',

  // Each game lasts a maximum of 5 minutes
  gameTimeLimit: 300,

  // Define hooks that will be called at various points in the game's lifecycle
  hooks: {
    // A new game was started by a player
    // The player will be "Player 1"
    createGame: async (game, player) => {
      game.state = {
        target: Math.floor(Math.random() * 50) + 1,
      };

      return game;
    },

    // A player made a move
    move: async (game, player, move) => {
      // Check if the player has guessed correctly
      if (move.data.n === game.state.target) {
        game.state.winner = player.id;
        game.status = 'finished';
      }

      return game;
    },
  },
});

server.start();
