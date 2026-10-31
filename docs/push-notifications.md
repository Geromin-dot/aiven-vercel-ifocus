# iPhone PWA background notifications

The app uses Web Push to wake the service worker and QStash to deliver the next presence alert at its deadline. No browser timer needs to remain running while the phone is locked. Each device opts in separately in Settings.

## One-time setup

1. Create an [Upstash QStash account](https://console.upstash.com/qstash) and copy the QStash token from its console. This feature uses delayed messages; you do not need to create a recurring schedule. Check your account's message allowance before enabling it for users.
2. Run `npm run push:keys`. It saves the public and private VAPID keys in the ignored `.env.local` file. Keep these keys permanently; replacing them requires existing devices to subscribe again. Do not commit or share the private key.
3. Add these environment variables in the Vercel project's **Production** settings:

   | Variable | Value |
   | --- | --- |
   | `VAPID_PUBLIC_KEY` | Generated public key from `.env.local` |
   | `VAPID_PRIVATE_KEY` | Generated private key from `.env.local` |
   | `VAPID_SUBJECT` | A real contact URI, e.g. `mailto:you@your-domain.com` |
   | `PUSH_APP_URL` | The app's canonical production HTTPS URL, without a path |
   | `QSTASH_TOKEN` | Token from the QStash console |
   | `QSTASH_URL` | API URL from the QStash console; defaults to `https://qstash.upstash.io` |

   Preserve the existing `NEXTAUTH_SECRET`; the app uses it to sign each scheduled callback. None of the private values use a `NEXT_PUBLIC_` prefix. Use [.env.push.example](../.env.push.example) as a checklist.

4. With `DATABASE_URL` pointing to the production database, run `npm run push:setup-db` once. This adds only `PushSubscription` and `PresencePushJob`; it does not reset the database or modify existing users. The SQL is repeatable. This project has no Prisma migration history, so do not use `migrate reset` or an unreviewed `db push` for this setup.
5. Redeploy after setting the variables. `/api/push/deliver` must be reachable by QStash over HTTPS. If Vercel Deployment Protection covers this production URL, configure an appropriate Vercel protection exception before testing. The endpoint separately verifies a per-job HMAC token and refuses unsigned requests.
6. On iPhone, add iFocus to the Home Screen, open that installed app, sign in, then open **Settings → Notifications → Enable Background Notifications**. Allow notifications. Tap **Test Server Push** and check Notification Center.

Until setup is complete, Settings displays **Waiting for server setup** and normal in-app timers continue working. The database setup command is intentionally separate from the build so deployments continue to work before the external service is connected. No QStash account, token, or production variables are created automatically by a Git push.

## Device check

1. Select a one-minute presence interval, save preferences, and start a focus session.
2. Check Settings for **Next alert scheduled**, then lock the iPhone before the interval ends.
3. Check that the alert shows the remaining focus time. Tap it to open the paused timer and select **Continue**. On browsers that support notification action buttons, **Pause** and **Continue** also appear in the alert.
4. Continue through another interval; an old alert in Notification Center must not block the new one.
5. Start a fresh interval, pause/reset before its deadline, and lock the phone. The canceled interval must not generate a new alert. Repeat after signing out.
6. Disable background notifications for this device and confirm it no longer receives alerts. This does not change another device's opt-in.

## Behavior and limits

- The notification shows a snapshot of the remaining time when presence pauses. PWA notifications do not contain a continuously ticking lock-screen countdown; the live countdown appears in the app's Settings.
- The server schedules one check at a time. Pause/reset/disabled presence invalidates the old job. Continue schedules the next check. Device and login identities keep old alerts from controlling a different timer.
- QStash retries temporary delivery failures. Delivery leases and check IDs prevent ordinary retries from producing another alert; expired browser subscriptions are removed. Transport delivery is at least once, so a crash immediately after a successful send can still cause a retry; the notification tag replaces the earlier copy.
- Scheduled payloads contain opaque subscription/job IDs, not push endpoints or encryption keys. Callbacks must match the saved generation and current login, and jobs more than 15 minutes late are discarded.
- The phone needs connectivity. Focus modes, notification permissions, and OS policies can delay or hide alerts. A passing automated test does not replace the real iPhone locked-screen check above.

## Validation

Run `npm run test:timer`, `npx prisma validate`, and `npm run build`. Tests exercise scheduling/cancellation, stale checkpoints, signed callbacks, retries/expired subscriptions, notification actions, and exact timer preservation with simulated delivery services. Real QStash/APNs delivery requires the configured production service and a subscribed device.

References: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [QStash delayed delivery](https://upstash.com/docs/qstash/features/delay), [Web Push on iOS](https://webkit.org/blog/13878/).
