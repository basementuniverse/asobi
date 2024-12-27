import { Game } from '../types';

export class GameStartedEvent extends CustomEvent<any> {
  constructor(detail: Game) {
    super('game-started', { detail });
  }
}
