# Deployment Guide for Armada Mining App

This guide explains how to build and deploy the Armada Mining app for your site managers.

## What You're Deploying

The Armada Mining app is a **Progressive Web App (PWA)** — a modern web app that:
- Works offline with automatic sync when online
- Installs to Android home screen like a native app
- Requires zero setup from site managers (just tap "Install")
- Automatically updates when you deploy new versions
- Works on any device with Chrome (Android, iPhone, Desktop)

## Quick Start: Deploy to Netlify (Recommended)

Netlify is free, handles HTTPS automatically, and scales to any number of users.

### Step 1: Build the App

```bash
npm install
npm run build
```

Output is in `dist/` — this is what we deploy.

### Step 2: Deploy to Netlify

**Option A: Drag & Drop (Fastest)**

1. Open https://app.netlify.app/drop
2. Drag the `dist/` folder into the page
3. Done! Your app is live at a public URL

**Option B: Connect GitHub (Auto-deploy on Push)**

1. Create a GitHub repository from your code
2. Go to https://app.netlify.com
3. Click **"New site from Git"**
4. Connect your GitHub repo
5. Set build command: `npm run build`
6. Set publish directory: `dist`
7. Click **"Deploy site"**
8. Every time you push to `main`, Netlify auto-deploys

### Step 3: Share with Site Managers

Once deployed, you get a URL like: `https://your-site.netlify.app`

Send site managers:
- The URL
- The **Android Installation Guide** (see `ANDROID_INSTALLATION.md`)

---

## Deployment Options

### Option 1: Netlify (Recommended for Easy Setup) ⭐

**Pros:**
- Free
- Automatic HTTPS
- Auto-deploys on every GitHub push
- Global CDN for fast loading
- One-click rollback

**Cons:**
- Depends on external service

**Cost:** Free tier handles unlimited traffic for this use case

**Setup:** 5 minutes (see Quick Start above)

---

### Option 2: Vercel (Also Recommended)

**Pros:**
- Free
- Automatic HTTPS
- Slightly faster for global users
- Better preview deployments

**Cons:**
- Similar to Netlify (pick either)

**Cost:** Free tier sufficient

**Setup:**
```bash
npm i -g vercel
vercel
# Follow the prompts, connects to GitHub
```

---

### Option 3: Your Own Server

If you have a server (AWS EC2, DigitalOcean, VPS, etc.):

**Prerequisites:**
- Domain name (e.g., `armada-mining.com`)
- HTTPS certificate (free via Let's Encrypt)
- Linux web server (Nginx/Apache)

**Setup:**

```bash
# On your development machine:
npm run build

# Transfer dist/ to your server:
scp -r dist/* user@your-server:/var/www/armada-mining/

# On the server, configure Nginx to serve it
# (see Nginx config below)
```

**Nginx Configuration:**

```nginx
server {
    listen 443 ssl http2;
    server_name armada-mining.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /var/www/armada-mining;
    index index.html;

    # SPA routing — all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Service worker — never cache
    location /sw.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0";
    }

    # API/manifest — cache slightly
    location /manifest.webmanifest {
        add_header Cache-Control "public, max-age=3600";
    }

    # Assets — long cache (they have hashes in filenames)
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

---

## Continuous Deployment (Auto-Deploy on Push)

### Using Netlify (Recommended)

Once you've connected GitHub (see Quick Start above), every time you:

```bash
git push origin main
```

Netlify automatically:
1. Pulls your code
2. Runs `npm run build`
3. Deploys to production
4. Your site managers see the update (no action needed)

### Using Vercel

Same as Netlify — connect GitHub, auto-deploys on every push.

### Using Your Own Server (Manual)

Create a deploy script (`deploy.sh`):

```bash
#!/bin/bash
npm run build
scp -r dist/* user@your-server:/var/www/armada-mining/
echo "✓ Deployed!"
```

Then:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Monitoring & Maintenance

### Check Deployment Status

**Netlify:**
- Visit your site dashboard
- Click **"Deploys"** tab
- See all deployment history and status

**Vercel:**
- Visit https://vercel.com/dashboard
- See deployment history

**Your Server:**
- Check server logs: `tail -f /var/log/nginx/access.log`
- Monitor disk/CPU: `top`, `df -h`

### Update the App

To push an update:

1. Make code changes in `src/`
2. Commit: `git add . && git commit -m "..."`
3. Push: `git push origin main`
4. Netlify/Vercel auto-deploys or run `./deploy.sh` manually
5. Site managers see update automatically (no action needed)

### Rollback

**Netlify:** Go to Deploys tab, click **"Restore"** on a previous version

**Vercel:** Same — click a previous deployment, click **"Promote to Production"**

---

## Testing Before Deploy

### Local Testing

```bash
npm run dev
# Opens at http://localhost:5173
# Test all features before pushing
```

### Testing Offline

1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Service Workers**
4. Check **"Offline"**
5. Reload page
6. App still works offline ✓

### Performance Check

```bash
npm run build
# Check size:
du -sh dist/
# Should be ~500KB-1MB total
```

---

## Environment Variables (Supabase Credentials)

### Current Setup

Your Supabase credentials are in `src/App.jsx`:

```javascript
const supabase = createClient(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_ANON_KEY'
);
```

**This is safe to commit** because:
- The anon key only allows unauthenticated access
- Row-Level Security policies in Supabase enforce access control
- Users can only see data for sites they're assigned to

### If You Want to Use Environment Variables

Create `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Update `src/App.jsx`:

```javascript
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

Set env vars on Netlify/Vercel:
- **Netlify:** Site Settings → Build & Deploy → Environment
- **Vercel:** Project Settings → Environment Variables

---

## SSL/HTTPS (Required for PWA)

All modern hosting services provide HTTPS automatically:

- ✅ **Netlify** — automatic
- ✅ **Vercel** — automatic
- ✅ **Your own server** — use Let's Encrypt (free): `certbot`

Without HTTPS, PWA installation won't work.

---

## CDN & Performance

### Netlify & Vercel

Both use global CDN automatically. Your app loads fast everywhere.

### Your Own Server

Add CloudFlare (free):
1. Point domain to CloudFlare
2. CloudFlare points to your server
3. CloudFlare edge servers cache your app globally
4. Site managers load from server nearest them

---

## Debugging Deployment Issues

### App won't load

**Check:**
1. URL is HTTPS (not HTTP)
2. Server returns 200 for all routes (SPA routing)
3. Browser console for errors (F12)

### PWA won't install

**Check:**
1. App loads in Chrome
2. URL is HTTPS
3. `manifest.webmanifest` is valid (F12 → Application → Manifest)
4. Service worker installed (F12 → Application → Service Workers)

### Supabase not connecting

**Check:**
1. URL and API key in `src/App.jsx` are correct
2. Supabase project is active
3. Browser console shows network error (if any)
4. Database Row-Level Security policies allow access

---

## Scaling Considerations

This app can handle:
- **100s of site managers** logging data daily
- **Multiple concurrent users** per site
- **Offline sync** with manual conflict resolution
- **Real-time updates** via Supabase subscriptions

Supabase free tier handles this; paid plan for enterprise use.

---

## Backup & Data Safety

### Database Backups

- **Supabase** handles automatic daily backups (included in free tier)
- To restore: contact Supabase support

### App Code Backups

- Keep GitHub repository as source of truth
- Use GitHub branches for staging before production
- Always test in dev before deploying

---

## Next Steps

1. **Choose hosting:** Netlify (easiest) or Vercel or your own server
2. **Deploy:** `npm run build` + upload to your host
3. **Share URL:** Send site managers the app URL + `ANDROID_INSTALLATION.md`
4. **Monitor:** Check deployment logs for any issues
5. **Update:** Push code changes → auto-deploys (with Netlify/Vercel)

---

## Support & Troubleshooting

### For Site Managers

Share the **Android Installation Guide** (`ANDROID_INSTALLATION.md`)

### For Admins/Developers

- Check `README.md` for app architecture
- Check `docs/formulas.md` for calculation algorithms
- Review `src/App.jsx` for main app logic

---

**Version:** 1.0.0  
**Last Updated:** May 2026
