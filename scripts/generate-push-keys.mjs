import { readFile, appendFile } from 'node:fs/promises';
import webpush from 'web-push';

const file = new URL('../.env.local', import.meta.url);
const existing = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
if (/^VAPID_(PUBLIC|PRIVATE)_KEY=/m.test(existing)) {
  throw new Error('VAPID keys already exist in .env.local. Keep the existing keys so installed devices remain subscribed.');
}
const keys = webpush.generateVAPIDKeys();
await appendFile(file, `\n# Web Push keys. Keep the private key out of Git and client bundles.\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`);
console.log('VAPID keys saved to .env.local (ignored by Git). Copy them into Vercel environment variables.');
