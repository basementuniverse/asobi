import { Request, Response } from 'express';
import { validate } from 'jsonschema';
import ServerError from '../error';
import GameService from '../game-service';
import { Server } from '../server';
import { SerialisedGame } from '../types';

export async function joinGame(
  server: Server,
  request: Request,
  response: Response
) {
  const gameId = request.params.gameId;
  const { playerName, playerData } = request.body as {
    playerName: string;
    playerData?: Record<string, any>;
  };

  if (!gameId) {
    throw new ServerError('Game id is required', 400);
  }

  const game = GameService.dataToGame(
    gameId,
    await server.jsonpad.fetchItemData<SerialisedGame>(
      server.options.jsonpadGamesList,
      gameId
    )
  );

  // Validate player data
  if (playerData && server.options.playerSchema) {
    const { valid, errors } = validate(playerData, server.options.playerSchema);
    if (!valid) {
      throw new ServerError(
        `Validation error (${errors.map(e => e.message).join(', ')})`,
        400
      );
    }
  }

  const [updatedGame, token] = await GameService.joinGame(
    server,
    game,
    playerName,
    playerData
  );

  response.status(200).json({ game: updatedGame, token });
}
