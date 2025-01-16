import QueueService from './queue-service';

export default class SchedulerService {
  private static timeouts: Record<string, NodeJS.Timeout> = {};

  /**
   * Schedule a function to be queued after a certain amount of time
   */
  public static schedule(
    gameId: string,
    playerId: string,
    type: 'join-timeout' | 'turn-timeout' | 'round-timeout' | 'game-timeout',
    fn: () => void,
    ms: number
  ) {
    const actualId = `${gameId}-${playerId}-${type}`;
    if (this.timeouts[actualId]) {
      clearTimeout(this.timeouts[actualId]);
    }

    this.timeouts[actualId] = setTimeout(() => {
      QueueService.add(gameId, async () => {
        fn();
        delete this.timeouts[actualId];
      });
    }, ms);
  }

  /**
   * Cancel a scheduled function
   */
  public static clear(gameId: string, playerId?: string, type?: string) {
    // If no playerId or type is provided, clear all timeouts for the game
    // regardless of which player or type they are for
    if (playerId === undefined || type === undefined) {
      for (const key in this.timeouts) {
        if (key.startsWith(gameId)) {
          clearTimeout(this.timeouts[key]);
          delete this.timeouts[key];
        }
      }
      return;
    }

    // Otherwise clear only the specified timeout, if it exists
    const actualId = `${gameId}-${playerId}-${type}`;
    if (this.timeouts[actualId]) {
      clearTimeout(this.timeouts[actualId]);
      delete this.timeouts[actualId];
    }
  }
}
