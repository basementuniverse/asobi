import { Game } from '../types';

export class GameCreatedEvent extends CustomEvent<any> {
  constructor(detail: Game) {
    super('game-created', { detail });
  }
}
