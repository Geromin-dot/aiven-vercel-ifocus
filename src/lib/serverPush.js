import webpush from 'web-push';
import { prisma } from './prisma';
import { createPresencePushService, jobToken } from './presencePushService';

export function getPushConfig() {
  const config = {
    publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT, appUrl: process.env.PUSH_APP_URL,
    token: process.env.QSTASH_TOKEN, qstashUrl: process.env.QSTASH_URL || 'https://qstash.upstash.io',
    secret: process.env.NEXTAUTH_SECRET,
  };
  const missing = ['publicKey', 'privateKey', 'subject', 'appUrl', 'token', 'secret'].filter(key => !config[key]);
  let valid = true;
  try {
    const url = new URL(config.appUrl);
    valid = url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
    const scheduler = new URL(config.qstashUrl);
    valid &&= scheduler.protocol === 'https:' && scheduler.hostname.endsWith('.upstash.io');
  } catch { valid = false; }
  valid &&= /^[A-Za-z0-9_-]{87}$/.test(config.publicKey || '') && /^[A-Za-z0-9_-]{43}$/.test(config.privateKey || '') &&
    /^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(config.subject || '');
  return { ...config, configured: missing.length === 0 && valid };
}

export async function sendWebPush(subscription, payload) {
  const config = getPushConfig();
  if (!config.configured) throw new Error('Background notifications need server setup');
  return webpush.sendNotification({ endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload), {
    vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
    TTL: 15 * 60, urgency: 'high', timeout: 10000,
  });
}

export const presencePushService = createPresencePushService({
  db: prisma, send: sendWebPush,
  publish: async job => {
    const config = getPushConfig();
    if (!config.configured) throw new Error('Background notifications need server setup');
    const destination = new URL('/api/push/deliver', config.appUrl).href;
    const response = await fetch(`${config.qstashUrl.replace(/\/$/, '')}/v2/publish/${destination}`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json',
        'Upstash-Forward-Authorization': `Bearer ${jobToken(config.secret, job.subscriptionId, job.generation)}`,
        'Upstash-Not-Before': String(Math.ceil(Number(job.dueAt) / 1000)),
        'Upstash-Deduplication-Id': job.generation, 'Upstash-Retries': '5', 'Upstash-Timeout': '20s',
      },
      body: JSON.stringify({ subscriptionId: job.subscriptionId, generation: job.generation }),
    });
    if (!response.ok) throw new Error(`Push scheduler returned ${response.status}`);
  },
});
