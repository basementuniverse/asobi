import { Game } from '../types';

export class GameFinishedEvent extends CustomEvent<any> {
  constructor(detail: Game) {
    super('game-finished', { detail });
  }
}
