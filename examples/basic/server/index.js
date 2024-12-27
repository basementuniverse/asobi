const { AsobiServer } = require('@basementuniverse/asobi-server');

// Create an instance of the server...
const server = new AsobiServer({

  // Provide the server token (this allows the server to read and modify games)
  jsonpadServerToken: '<YOUR JSONPAD SERVER TOKEN>',

  // Provide the path name of the JSONPad list which will store the games
  jsonpadGamesList: '<YOUR JSONPAD GAMES LIST PATH NAME>',

  // Define hooks that will be called at various points in the game's lifecycle
  hooks: {

    // A new game was started by a player
    // The player will be "Player 1"
    startGame: async (game, player) => {
      game.state = {
        targetScore: 30,
      };

      player.state = {
        score: 0,
      };

      return game;
    },

    // A player joined an existing game
    // Since this is a 2-player game, the joining player will be "Player 2"
    joinGame: async (game, player) => {
      player.state = {
        score: 0,
      };

      return game;
    },

    // A player made a move
    // For this example, the move doesn't require any player-defined data
    move: async (game, player, move) => {
      const increment = Math.floor(Math.random() * 5) + 1;

      player.state.score += increment;

      // Check if the player has reached the target with this move
      if (player.state.score >= game.state.targetScore) {
        game.state.winner = player.id;

        // One method of ending the game is to set the status of all players to "finished"
        game.players.forEach(p => {
          p.status = 'finished';
        });
      }

      return game;
    },
  },
});

server.start();