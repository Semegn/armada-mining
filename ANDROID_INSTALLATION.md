# Armada Mining — Android Installation Guide

This guide shows site managers how to install and use the Armada Mining app on Android devices.

## Option 1: Install as Progressive Web App (PWA) — Easiest ⭐ Recommended

The app works as a full native-like app on Android without needing to download anything from Google Play Store.

### For Site Managers

1. **Open the app in Chrome**
   - Navigate to: `https://YOUR_DEPLOYMENT_URL`
   - Replace `YOUR_DEPLOYMENT_URL` with your actual app URL (e.g., from Netlify, Vercel, or your own server)

2. **Install to Home Screen**
   - Tap the menu icon (⋮) in the top-right corner
   - Select **"Install app"** or **"Add to Home Screen"**
   - Confirm the dialog
   - The app appears on your home screen as a native app icon

3. **Launch the App**
   - Tap the Armada Mining icon on your home screen
   - Opens full-screen, no browser UI
   - Looks and feels like a native Android app

4. **Offline Capability**
   - The app works **offline** for any screens you've already viewed
   - Enter daily logs and transactions while offline
   - When back online, all changes sync automatically to Supabase
   - File conflicts are handled manually in the UI

### Why This Method is Better

- ✅ **No installation needed** — just tap "Install"
- ✅ **Instant updates** — app updates automatically when deployed
- ✅ **Full offline support** — works without internet
- ✅ **Lightweight** — ~5MB vs 50-80MB for native APK
- ✅ **Works on all devices** — no special Android version required
- ✅ **Easy for site managers** — familiar app-like interface

---

## Option 2: Download APK File (If Direct Installation Needed)

For devices that don't have Google Chrome or for direct distribution, we can build a native APK.

### How It Works

An APK wraps your web app in a lightweight Android container. It:
- Runs the exact same web app (React + Supabase)
- Supports offline-first with sync when online
- Handles file conflicts manually
- Installs like any Android app

### Installation Steps

1. **Download the APK**
   - Admin provides a download link to `armada-mining-release.apk`
   - Or transfer via USB to the device

2. **Enable Unknown Sources** (if needed)
   - Go to Settings → Security
   - Toggle **"Unknown Sources"** or **"Install Unknown Apps"** → Chrome (or your browser)
   - (This is only needed once)

3. **Install the APK**
   - Open the file manager or download folder
   - Tap `armada-mining-release.apk`
   - Tap **"Install"**
   - Wait for installation to complete

4. **Launch the App**
   - App appears on home screen
   - Tap to open
   - Works the same as the PWA version

---

## How to Use the App

### Daily Workflow

1. **Enter Today's Data**
   - Tap **Daily Log** tab
   - Enter: hours worked, gold produced, fuel received/consumed, machine hours
   - All entries saved locally (works offline)

2. **Record Transactions**
   - Tap **Transactions** tab
   - Log every ETB in/out: salaries, fuel purchases, equipment, repairs, gold sales
   - Filter by date or category

3. **View Dashboard**
   - Tap **Dashboard** tab
   - See: production, revenue, costs, working capital
   - All calculations update in real-time

4. **When Internet Available**
   - Data automatically syncs to Supabase
   - You'll see a sync indicator (📡 icon)
   - All users see updated data

### Offline → Online Sync

**You can use the app fully offline:**

```
Offline Mode:
├─ Enter daily logs ✓
├─ Record transactions ✓
├─ View all existing data ✓
└─ All stored locally

When Back Online:
├─ App syncs with Supabase
├─ All your entries uploaded
├─ You see updated dashboard
└─ If conflicts → resolve manually in UI
```

### Manual Conflict Resolution

If two people enter data for the same time period offline:

1. You'll see a **"Conflict"** badge on the log entry
2. Tap to view both versions
3. Choose which data to keep or merge manually
4. Confirm — both entries sync to Supabase

---

## Deployment & Distribution

### For Admins: Deploy the App

The app is built and ready to deploy. Choose one:

#### Option A: Free Hosting (Netlify/Vercel)

```bash
npm run build
# Output in dist/
```

Then:
- **Netlify**: Drag `dist/` to https://app.netlify.app/drop
- **Vercel**: Connect GitHub repo, auto-deploys on push

Both provide HTTPS (required for PWA) automatically.

#### Option B: Your Own Server

```bash
npm run build
# Copy dist/ contents to your web server
# Ensure HTTPS enabled
# Point site managers to your URL
```

---

## Troubleshooting

### "Install app" option doesn't appear

- **Chrome required** — Open in Chrome, not Firefox or Safari
- **HTTPS required** — Ensure URL starts with `https://` (not `http://`)
- **Clear cache** — Close Chrome, clear data, reopen

### App won't work offline

- **First visit required** — Open app once online to cache it
- **Private browsing** — Disable, PWA won't install in private mode
- **Storage full** — Check device storage; may need to clear space

### Data not syncing

- **Check internet** — Try opening a website to confirm connection
- **Check Supabase** — Verify credentials in `src/App.jsx`
- **Check permissions** — Confirm your user role in database

### APK installation fails

- **Unknown sources** — Enable in Settings → Security
- **Antivirus** — Some antivirus apps block APK. Temporarily disable or whitelist.
- **Storage** — Need ~100MB free space for APK + app data
- **Android version** — APK requires Android 7.0+ (most devices have this)

---

## Architecture & Security

### How It Works

```
Site Manager's Phone
    ↓
Chrome Browser (or APK wrapper)
    ↓
React App (Offline-First PWA)
    ↓
Service Worker (Caches app + data)
    ↓
Supabase Backend (PostgreSQL + Auth)
```

### Security

- **Credentials safe** — Supabase public credentials are safe; RLS policies enforce access
- **Only your site data** — Database-level security ensures users see only assigned sites
- **Offline data secure** — Stored encrypted in device local storage
- **No third parties** — Data stays in Supabase, never shared

---

## Updates & Maintenance

### PWA Updates

- Automatic — App checks for updates on each load
- You'll see a notification if new version available
- Tap **"Update"** to refresh

### APK Updates

- Manual — Download new APK and install (overwrites old version)
- No data loss — Your logs and transactions are stored in Supabase

### App Data

- **Stored in Supabase** — No local backup needed
- **Always synced** — Each device pulls latest data
- **Backed up** — Supabase handles database backups

---

## Offline-First Behavior Explained

### What Works Offline

✓ View previously loaded daily logs
✓ View previously loaded transactions
✓ View previously loaded dashboard data
✓ Enter new daily logs
✓ Enter new transactions
✓ Edit draft entries (not yet synced)

### What Requires Internet

✗ Log in (auth check)
✗ Load data for first time
✗ Sync entries to Supabase

### Sync Process

When you go back online:

1. App detects internet connection (automatic)
2. Checks for unsent data
3. Uploads to Supabase
4. Downloads latest from other users
5. Shows updated dashboard
6. You're back in sync

**If offline for days:**
- All entries stay safely on device
- Once online, syncs everything automatically
- No data loss

---

## Contact & Support

For issues or questions:
- Contact your site admin
- Check the troubleshooting section above
- Verify your internet connection (for sync)
- Clear app cache if behaving strangely (Settings → Apps → Armada Mining → Storage → Clear Cache)

---

**Version:** 1.0.0  
**Last Updated:** May 2026  
**Supported:** Android 7.0+, iOS 12+, Desktop Browsers
