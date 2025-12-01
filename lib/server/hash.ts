import { createHash } from 'crypto';

export const hashPassword = (pass: string) => {
  return createHash('sha256').update(pass).digest('hex');
};
