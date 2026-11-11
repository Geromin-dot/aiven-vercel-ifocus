import { createHmac } from 'node:crypto';

export function deletedAccountDigest(identifier) {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET)
    .update(identifier.trim().toLowerCase())
    .digest('hex');
}
