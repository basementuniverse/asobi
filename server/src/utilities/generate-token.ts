import * as crypto from 'crypto';
import * as constants from '../constants';

export default function generateToken(): string {
  return crypto
    .randomBytes(constants.TOKEN_LENGTH)
    .toString('hex')
    .slice(0, constants.TOKEN_LENGTH);
}
