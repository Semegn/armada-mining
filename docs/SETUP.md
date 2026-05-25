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
