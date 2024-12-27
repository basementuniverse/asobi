import JSONPad from '@basementuniverse/jsonpad-sdk';
import 'express-async-errors';
import { ServerOptions } from './types';
export declare class Server {
    private static readonly defaultOptions;
    private api;
    private server;
    options: ServerOptions;
    jsonpad: JSONPad;
    constructor(options?: Partial<ServerOptions>);
    /**
     * Start the server
     */
    start(port?: number): void;
    /**
     * Stop the server
     */
    stop(): void;
}
