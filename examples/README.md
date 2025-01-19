# Asobi Examples

This directory contains examples of how to use the Asobi library.

### [Basic Turns Game](./basic-turns)

This demonstrates basic usage of Asobi with the default number of players (2), turn time limits, and turns mode.

### [Basic Rounds Game](./basic-rounds)

This demonstrates games using rounds mode and round time limits.

### [Basic Free Game](./basic-free)

This demonstrates games with a variable number of players, game time limits, and free mode.

### [Connect 4](./connect4)

This is a more detailed demonstration of how to run a basic 2-player turn-based game with Asobi.

### [Battleships](./battleships)

This demonstrates more advanced usage of Asobi with a variable number of players, rounds mode, and hidden player state.

## Notes

The examples load the Asobi client from a CDN without specifying a version number. This is not recommended, as it may cause your application to break if a new version of Asobi is released. You should always specify a version number when loading the Asobi client from a CDN in a production application.

Similarly, the Asobi server version (and other dependencies) are set as "*" in `package.json`. You should always specify a version number for your dependencies in a production application, or things might break unexpectedly.

In order to run these demos, you will need to set up a JSONPad account and create the necessary lists, indexes, and tokens. Check [jsonpad.md](./jsonpad.md) for instructions.
