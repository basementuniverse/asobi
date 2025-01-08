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

  // This is a 3-player game
  minPlayers: 3,
  maxPlayers: 3,

  // Players can make turns in any order, and rounds progress once all players have made a move
  // in any given round
  mode: 'rounds',

  // Define hooks that will be called at various points in the game's lifecycle
  hooks: {

    // A new game was started by a player
    // The player will be "Player 1"
    createGame: async (game, player) => {
      game.state = {
        roundTarget: Math.floor(Math.random() * 10) + 1,
        targetScore: 5,
      };

      player.state = {
        score: 0,
        currentGuess: null,
      };

      return game;
    },

    // A player joined an existing game
    // Since this is a 3-player game, the joining player will be "Player 2" or "Player 3"
    joinGame: async (game, player) => {
      player.state = {
        score: 0,
        currentGuess: null,
      };

      return game;
    },

    // A player made a move
    move: async (game, player, move) => {
      player.state.currentGuess = move.data.n;

      // We can infer if this is the last player to make a move in the current round if they're the only player
      // with "taking_turn" status and all other players are "waiting_for_turn"
      if (
        game.players.every(p =>
          (p.id === player.id && p.status === 'taking_turn') ||
          (p.id !== player.id && p.status === 'waiting_for_turn')
        )
      ) {
        // Find the player with the closest guess to the round target
        const closestPlayer = game.players.reduce((closest, p) => {
          if (closest === null) {
            return p;
          }

          if (
            Math.abs(p.state.currentGuess - game.state.roundTarget) <
            Math.abs(closest.state.currentGuess - game.state.roundTarget)) {
            return p;
          }

          return closest;
        }, null);

        // Increment the score of the closest player
        closestPlayer.state.score++;

        // Generate a new round target
        game.state.roundTarget = Math.floor(Math.random() * 10) + 1;
      }

      // Check if the player has reached the target with this move
      if (player.state.score >= game.state.targetScore) {
        game.state.winner = player.id;
        game.status = 'finished';
      }

      return game;
    },
  },
});

server.start();
