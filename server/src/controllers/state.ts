import { Request, Response } from 'express';
import * as constants from '../constants';
import ServerError from '../error';
import { Server } from '../server';
import GameService from '../services/game-service';
import { SerialisedGame } from '../types';
import sleep from '../utilities/sleep';

export async function state(
  server: Server,
  request: Request,
  response: Response
) {
  let token = request.headers['authorization'];
  const gameId = request.params.gameId;

  if (!gameId) {
    throw new ServerError('Game id is required', 400);
  }

  if (!token) {
    throw new ServerError('Token is required', 400);
  }

  if (token.startsWith(constants.TOKEN_PREFIX)) {
    token = token.slice(constants.TOKEN_PREFIX.length);
  }

  // Fetch the game from jsonpad
  const game = GameService.dataToGame(
    gameId,
    await server.jsonpad.fetchItemData<SerialisedGame>(
      server.options.jsonpadGamesList,
      gameId
    )
  );

  // Handle jsonpad rate limiting
  if (server.options.jsonpadRateLimit) {
    await sleep(server.options.jsonpadRateLimit);
  }

  const gameState = await GameService.state(server, game, token);

  response.status(200).json({ game: gameState });
}
