import { Server } from './server';
import { Game } from './types';
export default class GameService {
    /**
     * Generate and cache a player token
     */
    private static addToken;
    /**
     * Remove a player token from the cache
     */
    private static removeToken;
    /**
     * Check if a player token is valid
     */
    static verifyToken(server: Server, gameId: string, playerId: string, token: string): Promise<boolean>;
    /**
     * Generate a new token value
     */
    private static generateToken;
    /**
     * Convert a game to serialisable data
     */
    static gameToData(game: Game): Record<string, any>;
    /**
     * Convert serialised data to a game
     */
    static dataToGame(id: string, data: Record<string, any>): Game;
    /**
     * Create a new game with the specified player as Player 1
     */
    static createGame(server: Server, playerName: string, playerData?: Record<string, any>, gameData?: Record<string, any>, numPlayers?: number): Promise<[Game, string]>;
    /**
     * Join an existing game as Player 2+
     */
    static joinGame(server: Server, game: Game, playerName: string, playerData?: Record<string, any>): Promise<[Game, string]>;
    /**
     * Start a game
     */
    private static startGame;
    /**
     * Make a move in an existing game
     */
    static move(server: Server, game: Game, token: string, moveData?: Record<string, any>): Promise<Game>;
    /**
     * Handle turn/round advancement
     */
    private static advanceGame;
    /**
     * Finish a game
     */
    static finishGame(server: Server, game: Game, save?: boolean): Promise<Game>;
}
