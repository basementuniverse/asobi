import { Game } from '../types';

export class TimedOutEvent extends CustomEvent<any> {
  constructor(detail: Game) {
    super('timed-out', { detail });
  }
}
