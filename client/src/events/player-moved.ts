import { Game } from '../types';

export class PlayerMovedEvent extends CustomEvent<any> {
  constructor(detail: Game) {
    super('player-moved', { detail });
  }
}
