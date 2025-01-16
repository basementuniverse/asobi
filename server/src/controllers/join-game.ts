import { Request, Response } from 'express';
import { validate } from 'jsonschema';
import ServerError from '../error';
import { Server } from '../server';
import GameService from '../services/game-service';
import QueueService from '../services/queue-service';

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

  // Handle player joining using a queue to avoid race conditions
  QueueService.add(gameId, async () => {
    const [updatedGame, token] = await GameService.joinGame(
      server,
      gameId,
      playerName,
      playerData
    );

    response.status(200).json({ game: updatedGame, token });
  });
}
