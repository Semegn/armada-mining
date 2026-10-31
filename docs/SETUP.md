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

## Primary sites

A site is either **alluvial** (excavator, washing, daily logs) or **primary** (hard rock:
pits and shafts, sacks, our own mill). Every existing site is alluvial and works as before.

1. Run `docs/migrations/006_primary_mining.sql`, then `docs/migrations/007_pit_details_and_samples.sql`,
   once each in Supabase → SQL Editor. Every check row must say `true`. 007 also creates the
   private `samples` storage folder for sample photos.
2. As super admin, choose **+ New Site → Site Type → Primary**. Assign site managers and
   partners to the site the same way as for any other site.
3. In **Inputs**, set the gold price, landowner share, opening cash, target cash reserve,
   **Sack Weight** (25 kg) and **Production Cut-off** (0.4 g per sack).
4. If the site uses an excavator, tick **Excavator on this site** and enter the opening
   fuel stock (barrels) and opening machine hours. This adds the **Excavator** tab, the
   fuel and machine-hour tiles and warnings, and the **Fuel** (barrels received) and
   **Machine Rental** (hours added) expense types. The excavator and the mill share one
   fuel stock: all fuel is bought as Fuel, and each day's barrels used by the excavator and
   the mill are entered on the Excavator tab.

How the site is run in the app:
- **Site Setup** (super admin and site managers): add each excavator pit or hand-dug shaft.
  Its GPS position is required (stand at the pit and press **Use my location**, or type the
  numbers); a map link is optional. Pits without GPS show a "GPS missing" flag. Each starts in exploration. **Switch to
  Production** and **Back to Exploration** record their dates, so every result keeps the phase
  of its own date. The app suggests switching when the last 3 results average the cut-off or
  more, and warns when the vein has been lost for 3 days or more. Each card has **Samples**
  (dated quartz/stone samples with depth, a written description, visible gold yes/no and
  photos) and a **Cross-section** drawn from the daily depths, vein, results and samples, with
  a depth vs grade graph.
  A pit or shaft with entries, results or samples can't be deleted; close it instead.
- **Daily Entry**: tap a pit or shaft, enter sacks, depth reached (m) and the vein (found /
  lost / not reached), save, then the next one.
- **Results**: sacks milled and the grams of gold they gave. The app shows grams per sack,
  g/t and the phase before saving, and asks first if more sacks are milled than are waiting.
- **Statement**: as on alluvial sites, with expense types for primary mining.
- The Dashboard has two views. **Finance**: cash, unsold gold, costs, profit, the landowner /
  investors split, and fuel and machine hours when the excavator is on. **Geology**: gold
  produced (exploration / production), average grade, sacks waiting, each open pit's phase,
  depth, vein and grade, and the pit comparison graph. Excavator hours are on the Excavator tab.
- Sample photos are shrunk on the phone (about 200–400 KB each) and stored privately; only
  people assigned to the site can see them. Photos can't be added in Demo Mode.
- All gold, exploration and production, is split landowner / investors by the landowner
  share in Inputs (0.30 = 30%), the same as on alluvial sites.

Who can do what: site managers and the super admin add pits, shafts, sack counts, results
and excavator days. A site manager can change only their own entries (and any pit or shaft
at their site, to switch or close it). Only the super admin can delete. Financial leads add
statement entries only; partners can only look. The database enforces all of this.

Telegram reports are not built for primary sites yet, so the Telegram section is hidden in
their Inputs. Cloning is not offered for primary sites.

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
