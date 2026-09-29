# Setup Guide

## Prerequisites

- Node.js 18+ (https://nodejs.org)
- A Supabase project (https://supabase.com)
- Netlify or Vercel account for deployment

## Local Development

### 1. Clone the repo

```bash
git clone https://github.com/Semegn/armada-mining.git
cd armada-mining
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Supabase

Edit `src/App.jsx` and replace the Supabase URL and key with your own.

Get these from Supabase → Settings → API.

### 4. Set up the database

Run the schema SQL (`docs/schema.sql`) in your Supabase SQL Editor.

### 5. Create your super admin account

In Supabase Authentication, create a user and insert into `users` table with `super_admin` role.

### 6. Run dev server

```bash
npm run dev
```

## Database changes

Changes to the live database are kept as numbered SQL files in `docs/migrations/`
(for example `001_lock_record_changes.sql`).

1. Run each new file once, in number order, in Supabase → SQL Editor.
2. Each file ends with a check query. Confirm the result matches the comment above it.
3. Never edit a file that has already been run. Add a new numbered file instead.
4. Each file ends with commented-out UNDO steps in case a change has to be reversed.

## Telegram reports

Each site can post a daily report and a weekly summary (Sundays, 8 pm) to its own
private Telegram channel. A day's report is posted 30 minutes after that day's daily log
is saved, whatever the hour. If a day still has no log by 9 am the next morning (Ethiopia
time), a report saying the log is missing is posted instead. The bot runs as the Supabase
Edge Function `telegram-reports` (`supabase/functions/telegram-reports/index.ts`).
Its key lives only in Supabase secrets, never in the code.

One-time setup:

1. **Create the bot.** In Telegram, open @BotFather, send `/newbot`, choose a name,
   and copy the token it gives you.
2. **Store the token.** Supabase → Edge Functions → Secrets → add a secret named
   `TELEGRAM_BOT_TOKEN` with the token as its value.
3. **Deploy the bot.** Supabase → Edge Functions → Deploy a new function → Via Editor.
   Name it `telegram-reports`, replace the example code with the contents of
   `supabase/functions/telegram-reports/index.ts`, and deploy. Then open the function's
   settings and turn **off** "Enforce JWT verification"; the function checks who is
   calling itself. With the Supabase CLI instead:
   `supabase functions deploy telegram-reports --no-verify-jwt`.
4. **Schedule it.** Run `docs/migrations/003_telegram_reports.sql`, then
   `docs/migrations/004_telegram_history.sql`, then `docs/migrations/005_telegram_daily_on_save.sql`
   (see "Database changes").
5. **Create the channels.** For each site, create a **private** Telegram channel and
   add the bot as an administrator that can post messages.
6. **Connect them.** In the app, sign in as super admin, open the site, go to Inputs →
   Telegram Reports → Find channels → Connect, then press Send test report.

7. **Post the history (optional).** Press Send past reports. It posts a report for every
   earlier day with entries, plus each finished week's summary, oldest first and without
   notifications. Keep the page open until it says it's done. It never posts a report
   twice, so it's safe to press again if it stops.

If a channel doesn't appear under Find channels, post any message in it and try again.
Telegram only shows the bot the last 24 hours of activity.

Corrections: when a daily log or statement entry changes for a day whose report is
already in the channel, that report (and its week's summary) is updated in place with an
"Edited … by …" line at the bottom. A short correction notice is also posted as a reply,
because Telegram doesn't notify readers of edits. Later reports aren't rewritten; the next
daily report shows the corrected totals.

Whenever `supabase/functions/telegram-reports/index.ts` changes, paste the new version into
the function in Supabase and deploy again. The Telegram Reports section in the app shows a
warning, with a link to the latest file, whenever the bot in Supabase is missing or out of date.

Before deploying a changed version of the bot, run `node scripts/check-telegram-calc.mjs`.
The bot carries copies of the app's calculations so the reports match the app, and this
check fails if the copies no longer match `src/App.jsx`. It also says what the bot's version
number (`BOT_VERSION` in the bot, `TELEGRAM_BOT_VERSION` in `src/App.jsx`) must be after
any change to the bot.

## Deployment

### Netlify

```bash
npm run build
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

Or connect GitHub for auto-deploys.

### Vercel

```bash
npm run build
vercel --prod
```

## Troubleshooting

Service worker not installing? Make sure:
- You're on HTTPS (localhost is OK)
- Using Chrome
- Check browser console for errors

RLS policy denies access? Confirm:
- You're logged in
- You're assigned to the site
- Your role has permission for that action
