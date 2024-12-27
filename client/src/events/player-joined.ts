import { Game } from '../types';

export class PlayerJoinedEvent extends CustomEvent<any> {
  constructor(detail: Game) {
    super('player-joined', { detail });
  }
}
