# Mining Ops — Gold Mining Operations Platform

A multi-site operations dashboard for gold mining partnerships, connected to Supabase.

## Two ways to deploy

### Fastest: Drag-and-drop the `dist/` folder to Netlify

1. Go to https://app.netlify.com/drop
2. Drag the `dist/` folder onto the page
3. Done — Netlify gives you a live URL like `https://random-name.netlify.app`
4. (Optional) Rename the site under Site settings → Change site name

The app is pre-configured with your Supabase backend. Log in with the account you set up in Supabase Auth.

### Better long-term: Connect via GitHub

1. Push this entire folder (not just `dist/`) to a GitHub repo
2. In Netlify: Add new site → Import an existing project → GitHub
3. Pick your repo
4. Build command: `npm run build` (already in netlify.toml)
5. Publish directory: `dist` (already in netlify.toml)
6. Deploy

Every git push will trigger a new deploy automatically.

## Local development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Stack

- Vite + React
- Tailwind CSS
- Supabase (auth + Postgres + RLS)

## Backend

Already configured to connect to:
`https://fweibxyncvjmuxxbqhan.supabase.co`

Credentials are in `src/App.jsx`. The anon key is safe to commit — RLS policies in Supabase enforce access control.

## Roles

- **super_admin** — full access, can edit Inputs and all data
- **site_manager** — can enter Daily Logs at their site
- **financial_lead** — can enter Transactions at their site
- **partner** — read-only dashboard for their assigned sites
