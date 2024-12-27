import JSONPad from '@basementuniverse/jsonpad-sdk';
import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import 'express-async-errors';
import http from 'http';
import * as constants from './constants';
import * as controllers from './controllers';
import ServerError from './error';
import { ServerOptions } from './types';

export class Server {
  private static readonly defaultOptions: ServerOptions = {
    jsonpadServerToken: '',
    jsonpadGamesList: '',
    minPlayers: 2,
    maxPlayers: 2,
    gameSchema: {
      type: 'object',
    },
    playerSchema: {
      type: 'object',
    },
    moveSchema: {
      type: 'object',
    },
    hooks: {},
  };

  private api: Express;
  private server: http.Server | null = null;

  public options: ServerOptions;
  public jsonpad: JSONPad;

  public constructor(options?: Partial<ServerOptions>) {
    this.options = Object.assign({}, Server.defaultOptions, options ?? {});

    // Initialise the API
    this.api = express();
    this.api.use(express.json());
    this.api.use(
      cors({
        origin: '*',
        optionsSuccessStatus: 204,
      })
    );

    // API routes
    this.api.post(
      '/start-game',
      async (request: Request, response: Response) => {
        await controllers.startGame(this, request, response);
      }
    );
    this.api.post(
      '/join-game/:gameId',
      async (request: Request, response: Response) => {
        await controllers.joinGame(this, request, response);
      }
    );
    this.api.post(
      '/move/:gameId',
      async (request: Request, response: Response) => {
        await controllers.move(this, request, response);
      }
    );

    // Error handling
    this.api.use(
      (
        error: Error,
        request: Request,
        response: Response,
        next: NextFunction
      ): Response => {
        console.error(error);

        if (error instanceof ServerError) {
          return response.status(error.status ?? 500).send(error.message);
        }

        return response.status(500).send('Unknown error');
      }
    );

    // Initialise jsonpad SDK
    this.jsonpad = new JSONPad(this.options.jsonpadServerToken);
  }

  /**
   * Start the server
   */
  public start(port?: number): void {
    const actualPort = port || constants.DEFAULT_PORT;
    this.server = this.api.listen(actualPort, () => {
      console.log(`Server listening on port ${actualPort}`);
    });
  }

  /**
   * Stop the server
   */
  public stop(): void {
    if (this.server) {
      this.server.close();
      console.log('Server stopped');
    }
  }
}
