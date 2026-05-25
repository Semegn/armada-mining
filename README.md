# Armada Mining Operations

A modern Progressive Web App for multi-site gold mining operations. Built for partners and field teams.

**Live:** https://inquisitive-blancmange-1b90b3.netlify.app

## Features

- **Daily Operations Log** — Site team logs hours, gold produced, fuel deliveries, machine hours
- **Financial Statement** — Every transaction tracked by category
- **Live Dashboard** — Real-time working capital, production, profitability
- **Multi-site & Multi-partner** — Designed for multiple mining sites with different partnership structures
- **Role-based Access** — Super Admin / Site Manager / Financial Lead / Partner (read-only)
- **Offline-capable PWA** — Works on Android, iOS, and desktop; installs to home screen
- **Real-time Collaboration** — All users see updated data instantly via Supabase

## Quick Start

### Development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

### Build & Deploy

```bash
npm run build
```

Output is in `dist/`. Deploy to:
- **Netlify:** Drag `dist/` to https://app.netlify.app/drop (or connect GitHub)
- **Vercel:** Same process
- **Any static host:** Just serve the `dist/` folder

## How It Works

### Architecture

```
┌─────────────────────────────────────┐
│  React PWA (Vite + Tailwind)        │
│  Installs on Android / iOS / Web    │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│  Supabase Backend                   │
│  • PostgreSQL database              │
│  • Row-Level Security (RLS)         │
│  • Authentication                   │
│  • Real-time subscriptions          │
└─────────────────────────────────────┘
```

### Database

Core tables:
- `organizations` — tenant container
- `sites` — mining sites
- `users` — extends auth.users
- `site_users` — assigns users to sites with roles
- `inputs` — per-site assumptions (gold price, fuel price, royalty, etc.)
- `daily_logs` — daily production: hours, gold, fuel, machine hours
- `transactions` — financial register: every ETB in/out
- `rotation` — bi-weekly operational rotation (per partnership agreement)
- `audit_log` — change tracking for transparency

**Row-Level Security:** Enforces at the database level. Super admin sees all. Site managers / leads see only their site. Partners see only their assigned sites.

### Formulas (The Math)

See `docs/formulas.md` for the complete algorithm. Key calculations:

```
Gross Gold = sum of daily gold_g
Net Saleable Gold = Gross Gold × (1 - landowner_share)
Gross Revenue = Net Saleable Gold × gold_price
Royalty = Gross Revenue × royalty_rate
Net Revenue = Gross Revenue - Royalty
Total Costs = sum of expense transactions
Profit = Net Revenue - Total Costs
Cost per Gram = Total Costs / Net Saleable Gold
```

**Working Capital:**
```
Fuel Remaining = opening + received - consumed
Machine Hours Remaining = opening + topped_up - used
Cash on Hand = opening_cash + credits - expenses
```

Runway calculations:
```
Daily Fuel Consumption = cleaning_hrs × cleaning_fuel_rate + prep_hrs × prep_fuel_rate
Fuel Runway (days) = fuel_remaining_liters / avg_daily_consumption
Machine Runway (days) = machine_hrs_remaining / avg_daily_hours
```

## Configuration

Supabase credentials are in `src/App.jsx`:

```javascript
const supabase = createClient(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_ANON_KEY'
);
```

The anon key is **safe to commit** — Supabase's Row-Level Security enforces all access control at the database level.

## Mobile Installation

### Android (Chrome)
1. Open the app in Chrome
2. Tap menu ⋮ → **Install app**
3. App installs to home screen
4. Tap to launch — opens full-screen, no browser UI

### iOS (Safari)
1. Open the app in Safari
2. Tap share ↗ → **Add to Home Screen**
3. App installs to home screen
4. Tap to launch

Works offline for already-loaded screens; syncs to Supabase when online.

## User Roles

| Role | Can | Cannot |
|------|-----|--------|
| **Super Admin** | Everything — edit inputs, create users, override data, see audit log | — |
| **Site Manager** | Enter daily logs, view dashboard, view transactions at their site | Edit inputs, see other sites |
| **Financial Lead** | Enter transactions, view dashboard at their site | Edit inputs, enter logs |
| **Partner** | View dashboard (read-only) | Enter any data |

## Adding Users

Create new users in Supabase Authentication, then link them in the `users` table with their role and site assignment.

Eventually we'll add a user-management UI to the app. For now, it's SQL.

## Roadmap

- [ ] In-app user management UI
- [ ] Weekly aggregation view
- [ ] Partner profit distribution calculator (per agreement Section 7)
- [ ] Capital recovery tracker
- [ ] Telegram bot notifications (daily + weekly)
- [ ] CSV/PDF export for accounting
- [ ] Multi-site portfolio dashboard
- [ ] Offline sync improvements

## Stack

- **React 18** — UI
- **Vite** — Build tool
- **Tailwind CSS** — Styling
- **Supabase** — Backend (Postgres + Auth + RLS)
- **vite-plugin-pwa** — Service worker + offline
- **Workbox** — Service worker caching strategy

## Development

### Tech Stack Requirements

- Node.js 18+
- npm (comes with Node)

### Project Structure

```
.
├── src/
│   ├── App.jsx         — Main app component, all logic
│   ├── main.jsx        — React entry point
│   └── index.css       — Global styles + Tailwind
├── public/
│   ├── logo-shield.png — Armada logo (SVG also available)
│   ├── pwa-icon-*.png  — App icons
│   └── favicon.ico     — Browser favicon
├── index.html          — HTML entry point
├── vite.config.js      — Vite + PWA plugin config
├── tailwind.config.js  — Tailwind CSS config
├── package.json        — Dependencies
└── netlify.toml        — Netlify deployment config
```

## Deployment

### Netlify (Recommended)

1. Connect your GitHub repo to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy

Or manually:
1. Run `npm run build`
2. Drag `dist/` to https://app.netlify.com/drop

### Vercel

```bash
npm i -g vercel
vercel
```

### Custom Server

```bash
npm run build
# Serve the dist/ folder with any static server
```

## Performance

- **App Shell:** ~380 KB JS, ~12 KB CSS (gzipped ~110 KB)
- **Cold Load:** ~2s (first time, no cache)
- **Warm Load:** ~500ms (cached, offline-capable)
- **Interaction:** Instant (all UI in React)
- **Data:** Network-first with 5s timeout; falls back to cache offline

## Security

- **Authentication:** Supabase Auth handles passwords securely
- **Authorization:** Row-Level Security at the database level enforces all access
- **Data Encryption:** Supabase uses TLS in transit, encryption at rest
- **Audit Log:** All changes tracked by user and timestamp

## Troubleshooting

### App won't install on Android
- Make sure you've deployed to HTTPS (Netlify/Vercel do this automatically)
- Open in Chrome (not Firefox or other browsers)
- Manifest must be valid (vite-plugin-pwa generates it)

### Offline mode not working
- Service worker must be installed (opens in Chrome, not private browsing)
- PWA plugin automatically caches the app shell on first visit
- Next time you load without internet, it loads from cache

### Supabase connection error
- Check your HTTPS URL and anon key in `src/App.jsx`
- Confirm RLS policies are enabled on all tables
- Check browser console for specific error message

## Contributing

This is the internal operations tool for Armada Mining. If you're a partner or team member, changes should be discussed before pushing.

## License

Internal use only.

---

Built with ❤️ for the Armada Mining partnership.

Questions? Check the formulas in `docs/formulas.md` or the database schema.
