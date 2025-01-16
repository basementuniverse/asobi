export default class QueueService {
    private static queues;
    private static processing;
    private static checkInterval;
    /**
     * Add a function to the specified queue
     */
    static add(gameId: string, fn: () => Promise<void>): void;
    /**
     * Clear the queue for the specified game
     */
    static clear(gameId: string): void;
    /**
     * Process the queue for the specified game
     */
    private static processQueue;
    /**
     * Setup an interval to check the queues every N seconds
     */
    static startCheck(): void;
    /**
     * Stop the interval checking the queues
     */
    static stopCheck(): void;
    /**
     * Check all queues to make sure they are being processed if they have items
     * to process
     *
     * Any queue that is not being processed and has items to process will be
     * processed
     */
    private static checkQueues;
}
