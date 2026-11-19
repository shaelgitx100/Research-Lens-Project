import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../Config/env.js';

export function generateToken(userId: string, expiresIn: SignOptions['expiresIn'] = '8h'): string {
  if (!env.jwtSecret || env.jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn });
}
