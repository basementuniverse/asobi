export default class SchedulerService {
    private static timeouts;
    /**
     * Schedule a function to be queued after a certain amount of time
     */
    static schedule(gameId: string, playerId: string, type: 'join-timeout' | 'turn-timeout' | 'round-timeout' | 'game-timeout', fn: () => void, ms: number): void;
    /**
     * Cancel a scheduled function
     */
    static clear(gameId: string, playerId?: string, type?: string): void;
}
