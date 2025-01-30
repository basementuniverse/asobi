import { Request, Response } from 'express';
import { validate } from 'jsonschema';
import * as constants from '../constants';
import { ServerError } from '../error';
import { Server } from '../server';
import GameService from '../services/game-service';
import QueueService from '../services/queue-service';

export async function move(
  server: Server,
  request: Request,
  response: Response
) {
  let token = request.headers['authorization'];
  const gameId = request.params.gameId;
  const { moveData } = request.body as {
    moveData?: Record<string, any>;
  };

  if (!gameId) {
    throw new ServerError('Game id is required', 400);
  }

  if (!token) {
    throw new ServerError('Token is required', 400);
  }

  if (token.startsWith(constants.TOKEN_PREFIX)) {
    token = token.slice(constants.TOKEN_PREFIX.length);
  }

  // Validate move data
  if (moveData && server.options.moveSchema) {
    const { valid, errors } = validate(moveData, server.options.moveSchema);
    if (!valid) {
      throw new ServerError(
        `Validation error (${errors.map(e => e.message).join(', ')})`,
        400
      );
    }
  }

  // Handle player moves using a queue to avoid race conditions
  QueueService.add(gameId, async () => {
    const updatedGame = await GameService.move(server, gameId, token, moveData);

    response.status(200).json({ game: updatedGame });
  });
}
