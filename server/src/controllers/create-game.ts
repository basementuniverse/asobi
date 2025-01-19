import { Request, Response } from 'express';
import { validate } from 'jsonschema';
import ServerError from '../error';
import { Server } from '../server';
import GameService from '../services/game-service';

export async function createGame(
  server: Server,
  request: Request,
  response: Response
) {
  const { playerName, playerData, gameData } = request.body as {
    playerName: string;
    playerData?: Record<string, any>;
    gameData?: Record<string, any>;
  };

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

  // Validate game data
  if (gameData && server.options.gameSchema) {
    const validationResult = validate(gameData, server.options.gameSchema);
    if (validationResult.errors) {
      throw new ServerError(
        `Validation error (${validationResult.errors
          .map(e => e.message)
          .join(', ')})`,
        400
      );
    }
  }

  const [game, token] = await GameService.createGame(
    server,
    playerName,
    playerData,
    gameData
  );

  response.status(201).json({ game, token });
}
