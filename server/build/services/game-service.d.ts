import { Server } from '../server';
import { Game } from '../types';
export default class GameService {
    /**
     * Create a new game with the specified player as Player 1
     */
    static createGame(server: Server, playerName: string, playerData?: Record<string, any>, gameData?: Record<string, any>): Promise<[Game, string]>;
    /**
     * Join an existing game as Player 2+
     */
    static joinGame(server: Server, gameId: string, playerName: string, playerData?: Record<string, any>): Promise<[Game, string]>;
    /**
     * Make a move in an existing game
     */
    static move(server: Server, gameId: string, token: string, moveData?: Record<string, any>): Promise<Game>;
    /**
     * Fetch a game with a player's hidden state attached
     */
    static state(server: Server, gameId: string, token: string): Promise<Game>;
    /**
     * Convert a game to serialisable data
     */
    private static gameToData;
    /**
     * Convert serialised data to a game
     */
    private static dataToGame;
    /**
     * Fetch a game from jsonpad
     */
    private static fetchGame;
    /**
     * Populate player data including hidden state for all players in a game
     */
    private static populatePlayerHiddenState;
    /**
     * Get a map of player hidden states in a game
     *
     * This is used to check if a player's hidden state has changed
     */
    private static getPlayerHiddenStateMap;
    /**
     * Persist an existing game to jsonpad
     *
     * This also persists any player hidden states that have changed
     */
    private static persistGame;
    /**
     * Calculate the actual joinTimeout / turnTimeout / roundTimeout / gameTimeout
     * for a game based on the server configuration and the value optionally
     * specified by the host player when creating a new game session
     */
    private static calculateTimeLimitSetting;
    /**
     * Start a game
     */
    private static startGame;
    /**
     * Handle turn/round advancement
     */
    private static advanceGame;
    /**
     * Finish a game
     */
    private static finishGame;
}
