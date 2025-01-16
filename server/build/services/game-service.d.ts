import { Server } from '../server';
import { Game } from '../types';
export default class GameService {
    /**
     * Convert a game to serialisable data
     */
    static gameToData(game: Game): Record<string, any>;
    /**
     * Convert serialised data to a game
     */
    static dataToGame(id: string, data: Record<string, any>): Game;
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
     * Create a new game with the specified player as Player 1
     */
    static createGame(server: Server, playerName: string, playerData?: Record<string, any>, gameData?: Record<string, any>, numPlayers?: number): Promise<[Game, string]>;
    /**
     * Join an existing game as Player 2+
     */
    static joinGame(server: Server, gameId: string, playerName: string, playerData?: Record<string, any>): Promise<[Game, string]>;
    /**
     * Start a game
     */
    private static startGame;
    /**
     * Make a move in an existing game
     */
    static move(server: Server, gameId: string, token: string, moveData?: Record<string, any>): Promise<Game>;
    /**
     * Handle turn/round advancement
     */
    private static advanceGame;
    /**
     * Finish a game
     */
    private static finishGame;
    /**
     * Fetch a game with a player's hidden state attached
     */
    static state(server: Server, gameId: string, token: string): Promise<Game>;
}
