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
