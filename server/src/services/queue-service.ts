import * as constants from '../constants';

export default class QueueService {
  private static queues: Record<string, (() => Promise<void>)[]> = {};
  private static processing: Record<string, boolean> = {};
  private static checkInterval: NodeJS.Timeout;

  /**
   * Add a function to the specified queue
   */
  public static add(gameId: string, fn: () => Promise<void>): void {
    if (!this.queues[gameId]) {
      this.queues[gameId] = [];
    }

    this.queues[gameId].push(fn);

    if (!this.processing[gameId]) {
      this.processQueue(gameId);
    }
  }

  /**
   * Clear the queue for the specified game
   */
  public static clear(gameId: string) {
    this.queues[gameId] = [];
    this.processing[gameId] = false;

    delete this.queues[gameId];
    delete this.processing[gameId];
  }

  /**
   * Process the queue for the specified game
   */
  private static async processQueue(gameId: string): Promise<void> {
    this.processing[gameId] = true;
    const queue = this.queues[gameId];

    while (queue.length > 0) {
      const fn = queue.shift();
      try {
        await fn?.();
      } catch (error) {
        console.error(
          `Error processing function in queue for game ${gameId}:`,
          error
        );
      }
    }

    this.processing[gameId] = false;
  }

  /**
   * Setup an interval to check the queues every N seconds
   */
  public static startCheck() {
    this.checkInterval = setInterval(
      this.checkQueues,
      constants.QUEUE_CHECK_INTERVAL
    );
  }

  /**
   * Stop the interval checking the queues
   */
  public static stopCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  /**
   * Check all queues to make sure they are being processed if they have items
   * to process
   *
   * Any queue that is not being processed and has items to process will be
   * processed
   */
  private static checkQueues() {
    for (const gameId in this.queues) {
      if (this.queues[gameId].length > 0 && !this.processing[gameId]) {
        this.processQueue(gameId);
      }
    }
  }
}
