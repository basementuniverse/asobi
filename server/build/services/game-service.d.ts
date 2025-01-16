import { Server } from '../server';
import { Game } from '../types';
export default class GameService {
    private static joinTimeouts;
    private static turnTimeouts;
    private static roundTimeouts;
    private static gameTimeouts;
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
    /**
     * Fetch a game with a player's hidden state attached
     */
    static state(server: Server, game: Game, token: string): Promise<Game>;
}
