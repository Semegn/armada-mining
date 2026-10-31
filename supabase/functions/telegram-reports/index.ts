// @ts-nocheck
// telegram-reports: posts each site's daily report once its daily log is in (30 minutes
// after it's saved, or at 9 am the next morning at the latest) and the weekly summary
// (Sundays 20:05) to the Telegram channel connected to that site, can post the past
// reports, and updates a posted report when its day's entries change.
// Primary (hard-rock) sites get their own reports: the bot works out the figures, Claude
// (Anthropic) writes them up in plain words, the exact key figures follow as a table, and
// the day's sample photos are posted after it. Without the AI the figures are posted alone.
// Setup and deployment: docs/SETUP.md. Database: docs/migrations/003, 004, 005 and 008.
//
// Actions (POST, JSON body):
//   { action: 'run', kind }                       pg_cron; needs the x-cron-secret header.
//                                                 kind: 'due' | 'morning' | 'weekly' ('daily' = old 8 pm run)
//   { action: 'record_changed', audit_id }        database trigger; needs the x-cron-secret header
//   { action: 'list_channels' }                   super admin: channels the bot was added to
//   { action: 'send_test', site_id }              super admin: posts today's report now (not archived)
//   { action: 'backfill', site_id }               super admin: posts the next batch of past reports
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const AI_MODEL = 'claude-opus-5-5';
const TIME_ZONE = 'Africa/Addis_Ababa';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MESSAGE_LIMIT = 4000;         // Telegram allows 4,096 characters per message
const LIVE_GAP_MS = 1100;           // at most one post per second in a channel
const BACKFILL_GAP_MS = 3200;       // Telegram allows about 20 posts a minute in one channel
const BACKFILL_BUDGET_MS = 90000;   // stop a batch well inside the Edge Function time limit
const SETTLE_MINUTES = 30;          // post a day's report this long after its daily log is saved
const AUTO_POST_DAYS = 3;           // only logs from the last few days are posted automatically
// The app compares this with its TELEGRAM_BOT_VERSION to warn when this bot needs redeploying.
// scripts/check-telegram-calc.mjs says what it must be after any change to this file.
const BOT_VERSION = 'fcd1c55df1';

// ---- Copied verbatim from src/App.jsx so the reports match the app exactly. ----
// ---- Do not edit here. After changing them in App.jsx, copy them again and run ----
// ---- `node scripts/check-telegram-calc.mjs`, which fails if the copies differ.  ----
const weekStart = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const ws = new Date(d.setDate(diff));
  return ws.toISOString().slice(0, 10);
};

const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const fmtETB = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
};

const fmtNum = (n, d = 1) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
};

const fmtBarrels = (n) => {
  const tenths = Math.round(Number(n) * 10) / 10;
  return fmtNum(n, Number.isInteger(tenths) ? 0 : 1);
};

function weeklySnap(inputs, logs, transactions, selectedWeek) {
  if (!inputs || !selectedWeek) return null;
  const weekEnd = addDays(selectedWeek, 6);
  const snapLogs = logs.filter((l) => l.date <= weekEnd);
  const snapTxs = transactions.filter((t) => t.date <= weekEnd);

  // Fuel is counted in barrels: in = Barrels Received on Fuel purchases, out = Fuel Used in daily logs
  const fuelReceivedBarrels = snapTxs.filter(t => t.type === 'expense' && t.category === 'Fuel').reduce((s, t) => s + (Number(t.fuel_barrels_topped_up) || 0), 0);
  const cleaningHrs = snapLogs.reduce((s, l) => s + (Number(l.cleaning_hrs) || 0), 0);
  const prepHrs = snapLogs.reduce((s, l) => s + (Number(l.prep_hrs) || 0), 0);
  const idleHrs = snapLogs.reduce((s, l) => s + (Number(l.idle_hrs) || 0), 0);
  const totalHrs = cleaningHrs + prepHrs + idleHrs;

  const fuelUsedBarrels = snapLogs.reduce((s, l) => s + (Number(l.fuel_received_barrels) || 0), 0);
  const fuelRemainingBarrels = Number(inputs.fuel_barrels_opening) + fuelReceivedBarrels - fuelUsedBarrels;
  const machineHrsToppedUpTxs = snapTxs.filter(t => t.type === 'expense' && t.category === 'Machine Rental').reduce((s, t) => s + (Number(t.machine_hrs_topped_up) || 0), 0);
  const machineHrsRemaining = Number(inputs.machine_hrs_opening) + machineHrsToppedUpTxs - totalHrs;

  const grossGold = snapLogs.reduce((s, l) => s + (Number(l.gold_g) || 0), 0);
  const netSaleableGold = grossGold * (1 - Number(inputs.landowner_share));

  // Operating costs exclude Loan Return — loans only touch cash, not P&L
  const totalCosts = snapTxs.filter((t) => t.type === 'expense' && t.category !== 'Profit Share' && t.category !== 'Loan Return').reduce((s, t) => s + Number(t.amount), 0);
  const profitSharePaid = snapTxs.filter((t) => t.type === 'expense' && t.category === 'Profit Share').reduce((s, t) => s + Number(t.amount), 0);
  const loanReturns = snapTxs.filter((t) => t.type === 'expense' && t.category === 'Loan Return').reduce((s, t) => s + Number(t.amount), 0);
  const totalCredits = snapTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0);

  // Actual gold sales (cash received + grams sold)
  const goldSalesTxs = snapTxs.filter((t) => t.type === 'credit' && t.category === 'Gold Sale');
  const goldSold = goldSalesTxs.reduce((s, t) => s + (Number(t.gold_grams_sold) || 0), 0);
  const goldSaleRevenue = goldSalesTxs.reduce((s, t) => s + Number(t.amount), 0);
  const goldOnHand = Math.max(0, netSaleableGold - goldSold);

  const profit = goldSaleRevenue - totalCosts - profitSharePaid;
  // Cash: all credits in (incl. loans) minus operating costs, loan repayments, and profit share
  const cashOnHand = Number(inputs.opening_cash) + totalCredits - totalCosts - loanReturns - profitSharePaid;
  const costPerGram = netSaleableGold > 0 ? totalCosts / netSaleableGold : 0;

  const reasons = [];
  if (cashOnHand < Number(inputs.target_cash_reserve)) reasons.push('Cash');
  if (fuelRemainingBarrels < 7) reasons.push('Fuel');
  if (machineHrsRemaining < 100) reasons.push('Machine Hrs');
  if (profit < 0) reasons.push('Profit');

  let status = 'healthy';
  if (fuelRemainingBarrels < 7 || machineHrsRemaining < 100 || cashOnHand < Number(inputs.target_cash_reserve)) status = 'caution';
  if (fuelRemainingBarrels < 3 || machineHrsRemaining < 50 || profit < 0) status = 'critical';

  return {
    weekEnd, status, reasons,
    fuelRemainingBarrels, machineHrsRemaining,
    grossGold, netSaleableGold, goldSold, goldOnHand, cleaningHrs, prepHrs, totalHrs,
    avgGperHr: totalHrs > 0 ? grossGold / totalHrs : 0,
    goldSaleRevenue, totalCosts, profitSharePaid, profit, costPerGram, cashOnHand,
    logCount: snapLogs.length, txCount: snapTxs.length,
  };
}
// ---- End of copied code. ----

// The copied primary-site code below asks for "today"; for the bot that is today in Ethiopia.
const todayISO = () => todayInEthiopia();

// ---- Also copied verbatim from src/App.jsx (primary sites); same rule as above. ----
// The exploration/production switches of a pit or shaft, oldest first. Older rows that only
// have production_from count as one switch to production on that date.
const phaseHistory = (shaft) => {
  const h = Array.isArray(shaft?.phase_history) ? shaft.phase_history : [];
  if (h.length > 0) return [...h].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  return shaft?.production_from ? [{ phase: 'production', from: shaft.production_from }] : [];
};
// A result has the phase its pit or shaft was in on the result's date.
const resultPhase = (shaft, date) => phaseHistory(shaft).reduce((p, c) => (date >= c.from ? c.phase : p), 'exploration');
const VEIN_STATES = ['found', 'lost', 'not_reached'];
// Latest depth and vein from the daily entries, and how many days the vein has been lost.
const pitProgress = (shaftId, sackCounts) => {
  const own = sackCounts.filter((c) => c.shaft_id === shaftId).sort(byNewest);
  const withDepth = own.find((c) => c.depth_m !== null && c.depth_m !== undefined && c.depth_m !== '');
  const withVein = own.find((c) => c.vein);
  const lastFound = own.find((c) => c.vein === 'found');
  const lostSince = withVein?.vein === 'lost'
    ? own.filter((c) => c.vein === 'lost' && (!lastFound || c.date > lastFound.date)).map((c) => c.date).sort()[0]
    : null;
  return { depth: withDepth ? Number(withDepth.depth_m) : null, vein: withVein?.vein || null, lostSince };
};
const sumOf = (rows, key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
const byNewest = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
const openFirst = (a, b) => (Number(!!a.closed_on) - Number(!!b.closed_on)) || a.name.localeCompare(b.name);
const EXCAVATOR_FIELDS = ['exploration_hrs', 'production_hrs', 'idle_hrs', 'excavator_fuel_barrels', 'mill_fuel_barrels'];

// Sacks, gold and readiness for production, per pit or shaft.
function shaftStats(shafts, sackCounts, results, cutoff) {
  return shafts.map((s) => {
    const own = results.filter((r) => r.shaft_id === s.id);
    const dug = sumOf(sackCounts.filter((c) => c.shaft_id === s.id), 'sacks');
    const milled = sumOf(own, 'sacks_milled');
    const gold = sumOf(own, 'gold_g');
    // Readiness looks at the last 3 results, so one lucky sack doesn't decide it.
    const last3 = [...own].sort(byNewest).slice(0, 3);
    const last3Sacks = sumOf(last3, 'sacks_milled');
    const last3Gps = last3Sacks > 0 ? sumOf(last3, 'gold_g') / last3Sacks : 0;
    return {
      shaft: s, dug, milled, waiting: dug - milled, gold,
      gPerSack: milled > 0 ? gold / milled : null,
      last3Gps,
      ready: resultPhase(s, todayISO()) === 'exploration' && !s.closed_on && last3.length === 3 && last3Gps >= cutoff,
    };
  });
}

function primarySnap(inputs, shafts, sackCounts, results, excavatorLogs, transactions) {
  if (!inputs) return null;
  const excavatorOn = !!inputs.excavator_on;

  // Gold, money, fuel and machine hours come from weeklySnap, the formulas the alluvial sites use.
  // Milling results carry the gold; excavator days carry the hours and fuel used, in the fields weeklySnap reads.
  const rows = [
    ...results.map((r) => ({ date: r.date, gold_g: r.gold_g })),
    ...excavatorLogs.map((l) => ({
      date: l.date, cleaning_hrs: l.exploration_hrs, prep_hrs: l.production_hrs, idle_hrs: l.idle_hrs,
      fuel_received_barrels: (Number(l.excavator_fuel_barrels) || 0) + (Number(l.mill_fuel_barrels) || 0),
    })),
  ];
  const latest = (list) => list.map((r) => r.date).filter(Boolean).reduce((a, b) => (a > b ? a : b), '');
  const lastEntryDate = latest([...rows, ...sackCounts]);
  // weeklySnap counts everything dated up to 6 days after the date it gets, so the latest date counts it all.
  const snap = weeklySnap(inputs, rows, transactions, latest([...rows, ...sackCounts, ...transactions]) || todayISO());

  const perShaft = shaftStats(shafts, sackCounts, results, Number(inputs.cutoff_g_per_sack));
  const shaftById = Object.fromEntries(shafts.map((s) => [s.id, s]));
  let explorationGold = 0;
  let productionGold = 0;
  results.forEach((r) => {
    if (resultPhase(shaftById[r.shaft_id], r.date) === 'production') productionGold += Number(r.gold_g) || 0;
    else explorationGold += Number(r.gold_g) || 0;
  });
  const source = (kind) => {
    const list = perShaft.filter((p) => p.shaft.kind === kind);
    return { count: list.length, dug: sumOf(list, 'dug'), milled: sumOf(list, 'milled'), gold: sumOf(list, 'gold') };
  };

  const sacksDug = sumOf(sackCounts, 'sacks');
  const sacksMilled = sumOf(results, 'sacks_milled');
  const gPerSack = sacksMilled > 0 ? snap.grossGold / sacksMilled : 0;
  const sackTonnes = Number(inputs.sack_kg) / 1000;

  // Days left use the last 7 excavator days, as the alluvial Dashboard does with its logs.
  const perDay = {};
  excavatorLogs.forEach((l) => {
    const d = perDay[l.date] || (perDay[l.date] = { fuel: 0, hrs: 0 });
    d.fuel += (Number(l.excavator_fuel_barrels) || 0) + (Number(l.mill_fuel_barrels) || 0);
    d.hrs += (Number(l.exploration_hrs) || 0) + (Number(l.production_hrs) || 0);
  });
  const last7 = Object.keys(perDay).sort().reverse().slice(0, 7).map((d) => perDay[d]);
  const avgDailyFuel = last7.length > 0 ? sumOf(last7, 'fuel') / last7.length : 0;
  const avgDailyHrs = last7.length > 0 ? sumOf(last7, 'hrs') / last7.length : 0;

  // Without an excavator there is no fuel or machine-hour stock to watch: cash and profit only.
  let { status, reasons } = snap;
  if (!excavatorOn) {
    const lowCash = snap.cashOnHand < Number(inputs.target_cash_reserve);
    reasons = [...(lowCash ? ['Cash'] : []), ...(snap.profit < 0 ? ['Profit'] : [])];
    status = snap.profit < 0 ? 'critical' : lowCash ? 'caution' : 'healthy';
  }

  return {
    ...snap, status, reasons, excavatorOn, lastEntryDate,
    landownerGold: snap.grossGold - snap.netSaleableGold,
    explorationGold, productionGold,
    sacksDug, sacksMilled, sacksWaiting: sacksDug - sacksMilled,
    gPerSack, gPerTonne: sackTonnes > 0 ? gPerSack / sackTonnes : 0,
    costPerSack: sacksMilled > 0 ? snap.totalCosts / sacksMilled : 0,
    perShaft, pits: source('pit'), handDug: source('shaft'),
    explorationHrs: sumOf(excavatorLogs, 'exploration_hrs'),
    productionHrs: sumOf(excavatorLogs, 'production_hrs'),
    idleHrs: sumOf(excavatorLogs, 'idle_hrs'),
    fuelRunwayDays: avgDailyFuel > 0 ? snap.fuelRemainingBarrels / avgDailyFuel : null,
    machineRunwayDays: avgDailyHrs > 0 ? snap.machineHrsRemaining / avgDailyHrs : null,
  };
}
const daysBetween = (from, to) => Math.round((new Date(to) - new Date(from)) / 86400000);
// ---- End of copied code. ----

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS_LABEL = { healthy: 'HEALTHY', caution: 'CAUTION', critical: 'CRITICAL' };
const STATUS_DOT = { healthy: '🟢', caution: '🟡', critical: '🔴' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const todayInEthiopia = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
const prettyDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const ethiopiaDateTime = (timestamp) => {
  const at = new Date(timestamp);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(at);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  return `${prettyDate(day)} ${time}`;
};
// Log values as entered: up to 2 decimals, no trailing zeros.
const plain = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0);
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const statusText = (snap) => `${STATUS_LABEL[snap.status]}${snap.reasons.length > 0 ? ` (${snap.reasons.join(', ')})` : ''}`;

// ---------- Report template: same sections, labels and warning limits as the app ----------

// A monospace line, like one of the app's tiles: label, value, unit, and ⚠ when the tile is red.
const row = (label, value, unit = '', alert = false) =>
  `${label.padEnd(15)}${String(value).padStart(11)} ${unit}${alert ? ' ⚠' : ''}`.trimEnd();
const table = (title, rows) => `<b>${title}</b>\n<pre>${escapeHtml(rows.join('\n'))}</pre>`;

// Notes up to ~3,000 characters stay with their entry; longer ones become their own pieces.
const noteChunks = (text) => {
  const chunks = [];
  let current = '';
  for (const ch of String(text)) {
    const escaped = escapeHtml(ch);
    if (current.length + escaped.length > 3500) { chunks.push(current); current = ''; }
    current += escaped;
  }
  if (current) chunks.push(current);
  return chunks.map((c, i) => (i === 0 ? `📝 ${c}` : c));
};
const withNote = (block, note) => {
  if (!note) return [block];
  const chunks = noteChunks(note);
  return chunks.length === 1 && chunks[0].length <= 3000 ? [`${block}\n${chunks[0]}`] : [block, ...chunks];
};

const txHead = (t) => {
  let extra = '';
  if (t.category === 'Gold Sale' && Number(t.gold_grams_sold) > 0) extra = ` (${plain(t.gold_grams_sold)} g)`;
  if (t.category === 'Fuel' && Number(t.fuel_barrels_topped_up) > 0) extra = ` (+${plain(t.fuel_barrels_topped_up)} barrels)`;
  if (t.category === 'Machine Rental' && Number(t.machine_hrs_topped_up) > 0) extra = ` (+${plain(t.machine_hrs_topped_up)} hrs)`;
  return `<code>${t.type === 'expense' ? '−' : '+'}${escapeHtml(fmtETB(t.amount))} ETB</code> ${escapeHtml(`${t.category}${extra}`)}`;
};

// The position at the end of `day`: the app's weekly snapshot of everything dated up to that day.
const endOfDay = ({ inputs, logs, txs }, day) => {
  const upTo = (rows) => rows.filter((r) => r.date <= day);
  return weeklySnap(inputs, upTo(logs), upTo(txs), weekStart(day));
};

function dailyBlocks(data, day) {
  const { site, inputs, logs, txs } = data;
  const snap = endOfDay(data, day);
  const log = logs.find((l) => l.date === day);
  const entries = txs
    .filter((t) => t.date === day)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  const blocks = [
    `${STATUS_DOT[snap.status]} <b>${escapeHtml(site.name.toUpperCase())}</b> · DAILY REPORT\n` +
      `<b>${prettyDate(day)}</b> · ${escapeHtml(statusText(snap))}`,
  ];
  if (log) {
    blocks.push(...withNote(table('DAILY LOG', [
      row('Gold produced', plain(log.gold_g), 'g'),
      row('Clean hours', plain(log.cleaning_hrs), 'hrs'),
      row('Prep hours', plain(log.prep_hrs), 'hrs'),
      row('Idle hours', plain(log.idle_hrs), 'hrs'),
      row('Fuel used', plain(log.fuel_received_barrels), 'bbl'),
    ]), log.notes));
  } else {
    blocks.push('<b>DAILY LOG</b>\n⚠ No daily log entered for this day.');
  }
  if (entries.length === 0) blocks.push('<b>STATEMENT</b>\nNo entries.');
  entries.forEach((t, i) => blocks.push(...withNote(`${i === 0 ? '<b>STATEMENT</b>\n' : ''}${txHead(t)}`, t.notes)));
  blocks.push(table('WORKING CAPITAL · end of day', [
    row('Cash on hand', fmtETB(snap.cashOnHand), 'ETB', snap.cashOnHand < Number(inputs.target_cash_reserve)),
    row('Gold on hand', fmtNum(snap.goldOnHand, 1), 'g'),
    row('Fuel remaining', fmtBarrels(snap.fuelRemainingBarrels), 'bbl', snap.fuelRemainingBarrels < 7),
    row('Machine hours', fmtNum(snap.machineHrsRemaining, 0), 'hrs', snap.machineHrsRemaining < 100),
  ]));
  blocks.push(table('PRODUCTION · to date', [
    row('Gold produced', fmtNum(snap.grossGold, 1), 'g'),
    row('Efficiency', fmtNum(snap.avgGperHr, 2), 'g/hr', snap.avgGperHr < Number(inputs.efficiency_threshold) && snap.totalHrs > 0),
  ]));
  return blocks;
}

// Same figures as the Weekly tab for the week that starts on `monday`.
function weeklyBlocks({ site, inputs, logs, txs }, monday) {
  const snap = weeklySnap(inputs, logs, txs, monday);
  return [
    `${STATUS_DOT[snap.status]} <b>${escapeHtml(site.name.toUpperCase())}</b> · WEEKLY SUMMARY\n` +
      `<b>${prettyDate(monday)} – ${prettyDate(snap.weekEnd)}</b>\n` +
      `End-of-week status: ${escapeHtml(statusText(snap))}\n` +
      `${snap.logCount} logs · ${snap.txCount} statement entries · through ${snap.weekEnd}`,
    table('WORKING CAPITAL', [
      row('Cash on hand', fmtETB(snap.cashOnHand), 'ETB', snap.cashOnHand < Number(inputs.target_cash_reserve)),
      row('Gold on hand', fmtNum(snap.goldOnHand, 1), 'g'),
      row('Gold sold', fmtNum(snap.goldSold, 1), 'g'),
      row('Fuel remaining', fmtBarrels(snap.fuelRemainingBarrels), 'bbl', snap.fuelRemainingBarrels < 7),
      row('Machine hours', fmtNum(snap.machineHrsRemaining, 0), 'hrs', snap.machineHrsRemaining < 100),
    ]),
    table('PRODUCTION · cumulative to week end', [
      row('Gold produced', fmtNum(snap.grossGold, 1), 'g'),
      row('Net saleable', fmtNum(snap.netSaleableGold, 1), 'g'),
      row('Total hours', fmtNum(snap.totalHrs, 0), 'hrs'),
      row('Clean / prep', `${fmtNum(snap.cleaningHrs, 0)} / ${fmtNum(snap.prepHrs, 0)}`, 'hrs'),
      row('Efficiency', fmtNum(snap.avgGperHr, 2), 'g/hr', snap.avgGperHr < Number(inputs.efficiency_threshold) && snap.totalHrs > 0),
    ]),
    table('FINANCIALS · cumulative to week end', [
      row('Revenue', fmtETB(snap.goldSaleRevenue), 'ETB'),
      row('Operating costs', fmtETB(snap.totalCosts), 'ETB', snap.costPerGram > Number(inputs.gold_price)),
      row('Cost per gram', fmtETB(snap.costPerGram), 'ETB/g'),
      row('Profit share', fmtETB(snap.profitSharePaid), 'ETB'),
      row('Net profit', fmtETB(snap.profit), 'ETB', snap.profit < 0),
    ]),
  ];
}

// ---------- Primary sites: figures, AI write-up and sample photos ----------

const VEIN_WORDS = { found: 'vein found', lost: 'vein lost', not_reached: 'not reached' };
const SAMPLE_WORDS = { quartz: 'Quartz', stone: 'Stone', other: 'Other' };
const round = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? null : Number(Number(n).toFixed(d)));
const datedUpTo = (rows, day) => rows.filter((r) => r.date <= day);
const datedIn = (rows, from, to) => rows.filter((r) => r.date >= from && r.date <= to);
const isOpenOn = (s, day) => (!s.opened_on || s.opened_on <= day) && (!s.closed_on || s.closed_on > day);
const pitLine = (name, text) => `${String(name).slice(0, 12).padEnd(13)}${text}`;

// The position at the end of `day`: the app's primary snapshot of everything dated up to it.
const primaryEndOf = (data, day) => primarySnap(data.inputs, data.shafts, datedUpTo(data.sacks, day),
  datedUpTo(data.results, day), datedUpTo(data.exc, day), datedUpTo(data.txs, day));

// Everything the write-up may use. Claude gets these facts and nothing else.
function primaryFacts(data, from, to) {
  const { site, inputs, shafts, sacks, results, exc, samples, txs } = data;
  const snap = primaryEndOf(data, to);
  const nameOf = Object.fromEntries(shafts.map((s) => [s.id, s.name]));
  const shaftOf = Object.fromEntries(shafts.map((s) => [s.id, s]));
  const statsOf = Object.fromEntries(snap.perShaft.map((p) => [p.shaft.id, p]));
  const soFar = datedUpTo(sacks, to);
  const pits = shafts.filter((s) => isOpenOn(s, to) || datedIn(sacks, from, to).some((c) => c.shaft_id === s.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => {
      const entries = datedIn(sacks, from, to).filter((c) => c.shaft_id === s.id);
      const progress = pitProgress(s.id, soFar);
      const st = statsOf[s.id];
      return {
        name: s.name, kind: s.kind === 'pit' ? 'excavator pit' : 'hand-dug shaft', phase: resultPhase(s, to),
        closed: !!s.closed_on && s.closed_on <= to,
        sacks_in_period: entries.length > 0 ? sumOf(entries, 'sacks') : null,
        depth_m: progress.depth, vein: progress.vein,
        vein_lost_days: progress.lostSince ? daysBetween(progress.lostSince, to) : 0,
        grams_per_sack_to_date: round(st?.gPerSack), grams_per_sack_last_3_results: round(st?.last3Gps),
        ready_for_production: !!st?.ready, sacks_waiting_to_mill: st?.waiting ?? 0,
        entry_notes: entries.map((c) => c.notes).filter(Boolean),
      };
    });
  const excRows = datedIn(exc, from, to);
  return {
    site: site.name, period: from === to ? { day: to } : { from, to },
    status: snap.status, status_reasons: snap.reasons,
    cutoff_grams_per_sack: Number(inputs.cutoff_g_per_sack), sack_kg: Number(inputs.sack_kg),
    landowner_share: Number(inputs.landowner_share),
    pits_and_shafts: pits,
    milling_results: datedIn(results, from, to).map((r) => ({
      date: r.date, pit: nameOf[r.shaft_id], sacks_milled: Number(r.sacks_milled), gold_g: Number(r.gold_g),
      grams_per_sack: round(Number(r.gold_g) / Number(r.sacks_milled)), phase: resultPhase(shaftOf[r.shaft_id], r.date),
      notes: r.notes || null,
    })),
    excavator: snap.excavatorOn ? {
      exploration_hrs: sumOf(excRows, 'exploration_hrs'), production_hrs: sumOf(excRows, 'production_hrs'),
      idle_hrs: sumOf(excRows, 'idle_hrs'), excavator_fuel_barrels: sumOf(excRows, 'excavator_fuel_barrels'),
      mill_fuel_barrels: sumOf(excRows, 'mill_fuel_barrels'), notes: excRows.map((l) => l.notes).filter(Boolean),
    } : null,
    samples: datedIn(samples, from, to).map((x) => ({
      date: x.date, pit: nameOf[x.shaft_id], type: x.sample_type, depth_m: x.depth_m === null ? null : Number(x.depth_m),
      visible_gold: !!x.visible_gold, description: x.description, photos: (x.photo_paths || []).length,
    })),
    statement_entries: datedIn(txs, from, to).map((t) => ({
      date: t.date, type: t.type, category: t.category, amount_etb: Number(t.amount), notes: t.notes || null,
    })),
    finance_to_date: {
      cash_on_hand_etb: Math.round(snap.cashOnHand), target_cash_reserve_etb: Number(inputs.target_cash_reserve),
      gold_on_hand_g: round(snap.goldOnHand, 1), gold_sold_g: round(snap.goldSold, 1),
      landowner_gold_g: round(snap.landownerGold, 1), investors_gold_g: round(snap.netSaleableGold, 1),
      revenue_etb: Math.round(snap.goldSaleRevenue), operating_costs_etb: Math.round(snap.totalCosts),
      net_profit_etb: Math.round(snap.profit), cost_per_sack_milled_etb: Math.round(snap.costPerSack),
      ...(snap.excavatorOn ? {
        fuel_left_barrels: round(snap.fuelRemainingBarrels, 1), fuel_days_left: round(snap.fuelRunwayDays, 0),
        machine_hours_left: round(snap.machineHrsRemaining, 0), machine_days_left: round(snap.machineRunwayDays, 0),
      } : {}),
    },
    geology_to_date: {
      gold_total_g: round(snap.grossGold, 1), gold_exploration_g: round(snap.explorationGold, 1),
      gold_production_g: round(snap.productionGold, 1), grams_per_sack: round(snap.gPerSack),
      grams_per_tonne: round(snap.gPerTonne, 1), sacks_dug: snap.sacksDug, sacks_milled: snap.sacksMilled,
      sacks_waiting: snap.sacksWaiting,
    },
  };
}

// The exact figures, posted under the write-up (or alone when the AI is not available).
function primaryFigureBlocks(data, from, to, title) {
  const { site, inputs } = data;
  const snap = primaryEndOf(data, to);
  const f = primaryFacts(data, from, to);
  const blocks = [
    `${STATUS_DOT[snap.status]} <b>${escapeHtml(site.name.toUpperCase())}</b> · ${title}\n` +
      `<b>${from === to ? prettyDate(to) : `${prettyDate(from)} – ${prettyDate(to)}`}</b> · ${escapeHtml(statusText(snap))}`,
  ];
  const dug = f.pits_and_shafts.filter((p) => p.sacks_in_period !== null);
  if (from === to && dug.length === 0) blocks.push('<b>DAILY ENTRY</b>\n⚠ No daily entry for this day.');
  if (f.pits_and_shafts.length > 0) {
    blocks.push(`<b>PITS & SHAFTS</b>\n<pre>${escapeHtml(f.pits_and_shafts.map((p) => pitLine(p.name,
      `${p.sacks_in_period === null ? '–' : plain(p.sacks_in_period)} sk · ${p.depth_m === null ? '–' : plain(p.depth_m)} m · ` +
      `${p.vein ? VEIN_WORDS[p.vein] : '–'}${p.vein_lost_days >= 3 ? ' ⚠' : ''}${p.ready_for_production ? ' ⭐' : ''}`)).join('\n'))}</pre>`);
  }
  if (f.milling_results.length > 0) {
    blocks.push(`<b>RESULTS</b>\n<pre>${escapeHtml(f.milling_results.map((r) => pitLine(r.pit,
      `${plain(r.gold_g)} g / ${plain(r.sacks_milled)} sk = ${plain(r.grams_per_sack)} g/sk${r.phase === 'production' ? ' (prod)' : ''}`)).join('\n'))}</pre>`);
  }
  if (f.excavator) {
    const e = f.excavator;
    blocks.push(table('EXCAVATOR', [
      row('Expl / prod', `${plain(e.exploration_hrs)} / ${plain(e.production_hrs)}`, 'hrs'),
      row('Idle', plain(e.idle_hrs), 'hrs'),
      row('Fuel exc / mill', `${plain(e.excavator_fuel_barrels)} / ${plain(e.mill_fuel_barrels)}`, 'bbl'),
    ]));
  }
  if (from === to) {
    const entries = datedIn(data.txs, from, to).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    if (entries.length === 0) blocks.push('<b>STATEMENT</b>\nNo entries.');
    entries.forEach((t, i) => blocks.push(...withNote(`${i === 0 ? '<b>STATEMENT</b>\n' : ''}${txHead(t)}`, t.notes)));
  }
  blocks.push(table('FINANCE · to date', [
    row('Cash on hand', fmtETB(snap.cashOnHand), 'ETB', snap.cashOnHand < Number(inputs.target_cash_reserve)),
    row('Gold on hand', fmtNum(snap.goldOnHand, 1), 'g'),
    row('Landowner', fmtNum(snap.landownerGold, 1), 'g'),
    row('Investors', fmtNum(snap.netSaleableGold, 1), 'g'),
    row('Costs', fmtETB(snap.totalCosts), 'ETB'),
    row('Net profit', fmtETB(snap.profit), 'ETB', snap.profit < 0),
    ...(snap.excavatorOn ? [
      row('Fuel left', fmtBarrels(snap.fuelRemainingBarrels), 'bbl', snap.fuelRemainingBarrels < 7),
      row('Machine hours', fmtNum(snap.machineHrsRemaining, 0), 'hrs', snap.machineHrsRemaining < 100),
    ] : []),
  ]));
  blocks.push(table('GEOLOGY · to date', [
    row('Gold', fmtNum(snap.grossGold, 1), 'g'),
    row('Expl / prod', `${fmtNum(snap.explorationGold, 1)} / ${fmtNum(snap.productionGold, 1)}`, 'g'),
    row('Grade', fmtNum(snap.gPerSack, 2), 'g/sack'),
    row('Sacks waiting', plain(snap.sacksWaiting), 'sacks'),
  ]));
  return blocks;
}

const AI_INSTRUCTIONS = `You write the report a gold mining company posts to its private Telegram channel for its partners and investors. The site is a primary (hard-rock) gold mine in Ethiopia: ore is dug from excavator pits and hand-dug shafts, carried in sacks, and milled at the company's own mill. All gold is split between the landowner and the investors by the landowner share.

You receive the facts for one day or one week as JSON. Write the report from those facts:
- Use only the numbers and facts in the JSON. Never estimate, add up or invent a figure that is not given. If something is missing, say so plainly.
- Start with one or two sentences on the most important thing that happened.
- Then the pits and shafts: digging progress, depth, whether the vein was found or lost, grades from the mill, which ones look promising and which are worrying. A vein lost for 3 days or more, or a pit marked ready_for_production, deserves a mention.
- Describe the samples in your own words from their descriptions, saying which pit and depth they came from and whether gold was visible.
- Then money: cash, costs, the landowner and investors' gold, and fuel and machine hours if they are given. Point out anything below its target.
- Finish with one short line on what to watch next.
- Plain, warm, professional English for business partners. No headings, no bullet lists, no markdown, no emoji. Short paragraphs. At most 1,200 characters.
- Grams per sack against the production cut-off is what decides exploration versus production.`;

let ai = null;
// Claude writes the report from the facts. Returns null (figures only) when it can't.
async function aiStory(facts) {
  if (!ANTHROPIC_KEY) return null;
  try {
    ai ??= new Anthropic({ apiKey: ANTHROPIC_KEY, timeout: 60000, maxRetries: 1 });
    const response = await ai.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [{ type: 'text', text: AI_INSTRUCTIONS, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: JSON.stringify(facts) }],
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return text ? text.slice(0, 3000) : null;
  } catch (e) {
    console.error(`telegram-reports AI: ${safe(e)}`);
    return null;
  }
}

async function primaryBlocks(data, from, to, title) {
  const figures = primaryFigureBlocks(data, from, to, title);
  const story = await aiStory(primaryFacts(data, from, to));
  if (!story) return figures;
  return [figures[0], `✍️ ${escapeHtml(story)}`, ...figures.slice(1)];
}
const primaryDailyBlocks = (data, day) => primaryBlocks(data, day, day, 'DAILY REPORT');
const primaryWeeklyBlocks = (data, monday) => primaryBlocks(data, monday, addDays(monday, 6), 'WEEKLY SUMMARY');

// Either kind of site: the report blocks for a day, or for the week starting `monday`.
const reportDaily = (data, day) => (data.primary ? primaryDailyBlocks(data, day) : dailyBlocks(data, day));
const reportWeekly = (data, monday) => (data.primary ? primaryWeeklyBlocks(data, monday) : weeklyBlocks(data, monday));

// The day's sample photos, after the report: one album per sample, its description as the caption.
async function sendSamplePhotos(chatId, data, day, { silent = false, gap = LIVE_GAP_MS } = {}) {
  if (!data.primary) return;
  const nameOf = Object.fromEntries(data.shafts.map((s) => [s.id, s.name]));
  for (const x of data.samples.filter((s) => s.date === day && (s.photo_paths || []).length > 0)) {
    const { data: links, error } = await db.storage.from('samples').createSignedUrls(x.photo_paths.slice(0, 10), 3600);
    if (error) { console.error(`telegram-reports photos: ${error.message}`); continue; }
    const urls = links.map((l) => l.signedUrl).filter(Boolean);
    if (urls.length === 0) continue;
    const caption = `🪨 <b>${escapeHtml(SAMPLE_WORDS[x.sample_type] || x.sample_type)} · ${escapeHtml(nameOf[x.shaft_id] || '')}` +
      `${x.depth_m !== null && x.depth_m !== undefined ? ` · ${plain(x.depth_m)} m` : ''}</b>${x.visible_gold ? ' · visible gold ✨' : ''}\n` +
      escapeHtml(String(x.description).slice(0, 900));
    try {
      if (urls.length === 1) {
        await telegram('sendPhoto', { chat_id: chatId, photo: urls[0], caption, parse_mode: 'HTML', disable_notification: silent });
      } else {
        await telegram('sendMediaGroup', {
          chat_id: chatId, disable_notification: silent,
          media: urls.map((u, i) => ({ type: 'photo', media: u, ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}) })),
        });
      }
    } catch (e) {
      console.error(`telegram-reports photos: ${safe(e)}`);
    }
    await sleep(gap);
  }
}

const withCorrections = (blocks, corrections) =>
  corrections.length > 0 ? [...blocks, corrections.map((c) => `✏️ ${escapeHtml(c)}`).join('\n')] : blocks;

// Pack blocks into messages under the limit, splitting only between blocks so HTML tags stay whole.
const pack = (blocks) => {
  const messages = [];
  let current = '';
  for (const block of blocks) {
    if (current && current.length + 2 + block.length > MESSAGE_LIMIT) { messages.push(current); current = block; }
    else current = current ? `${current}\n\n${block}` : block;
  }
  if (current) messages.push(current);
  return messages;
};

// ---------- What changed, in words (for corrections) ----------

const FIELD_LABELS = {
  daily_logs: {
    date: ['Date', ''], gold_g: ['Gold produced', 'g'], cleaning_hrs: ['Clean hours', 'hrs'], prep_hrs: ['Prep hours', 'hrs'],
    idle_hrs: ['Idle hours', 'hrs'], fuel_received_barrels: ['Fuel used', 'bbl'], notes: ['Notes', ''],
  },
  transactions: {
    date: ['Date', ''], type: ['Type', ''], category: ['Category', ''], amount: ['Amount', 'ETB'],
    gold_grams_sold: ['Grams sold', 'g'], fuel_barrels_topped_up: ['Barrels received', 'bbl'],
    machine_hrs_topped_up: ['Machine hours added', 'hrs'], paid_by: ['Paid by', ''], notes: ['Notes', ''],
  },
};
// Primary sites: what changed, with pit/shaft names put in by recordChanged.
Object.assign(FIELD_LABELS, {
  sack_counts: { date: ['Date', ''], pit: ['Pit', ''], sacks: ['Sacks', ''], depth_m: ['Depth', 'm'], vein: ['Vein', ''], notes: ['Notes', ''] },
  milling_results: { date: ['Date', ''], pit: ['Pit', ''], sacks_milled: ['Sacks milled', ''], gold_g: ['Gold', 'g'], notes: ['Notes', ''] },
  excavator_logs: {
    date: ['Date', ''], exploration_hrs: ['Exploration hours', 'hrs'], production_hrs: ['Production hours', 'hrs'], idle_hrs: ['Idle hours', 'hrs'],
    excavator_fuel_barrels: ['Excavator fuel', 'bbl'], mill_fuel_barrels: ['Mill fuel', 'bbl'], notes: ['Notes', ''],
  },
  shaft_samples: {
    date: ['Date', ''], pit: ['Pit', ''], depth_m: ['Depth', 'm'], sample_type: ['Type', ''], visible_gold: ['Visible gold', ''],
    description: ['Description', ''], photo_paths: ['Photos', ''],
  },
});
const WATCHED_TABLES = ['daily_logs', 'transactions', 'sack_counts', 'milling_results', 'excavator_logs', 'shaft_samples'];
const TABLE_WORDS = {
  daily_logs: 'Daily log', transactions: 'Statement', sack_counts: 'Daily entry', milling_results: 'Result',
  excavator_logs: 'Excavator day', shaft_samples: 'Sample',
};
const PRIMARY_SUMMARY = {
  sack_counts: (r) => `${r.pit} · ${plain(r.sacks)} sacks${r.depth_m !== null && r.depth_m !== undefined ? ` · ${plain(r.depth_m)} m` : ''}${r.vein ? ` · ${VEIN_WORDS[r.vein]}` : ''}`,
  milling_results: (r) => `${r.pit} · ${plain(r.gold_g)} g from ${plain(r.sacks_milled)} sacks`,
  excavator_logs: (r) => `hours ${plain(r.exploration_hrs)}/${plain(r.production_hrs)}/${plain(r.idle_hrs)} · fuel ${plain(r.excavator_fuel_barrels)}/${plain(r.mill_fuel_barrels)} bbl`,
  shaft_samples: (r) => `${r.pit} · ${SAMPLE_WORDS[r.sample_type] || r.sample_type}: ${String(r.description || '').slice(0, 120)}`,
};

// Bookkeeping columns that change on every save and mean nothing to readers.
const IGNORED_FIELDS = new Set(['id', 'site_id', 'created_at', 'updated_at', 'synced_at', 'created_offline',
  'logged_by', 'entered_by', 'updated_by', 'week_start', 'shaft_id']);
const fieldValue = (key, v) =>
  (v === null || v === undefined || v === '' ? '—' : key === 'amount' ? fmtETB(v) : typeof v === 'number' ? plain(v)
    : key === 'photo_paths' && Array.isArray(v) ? String(v.length) : String(v));
const recordSummary = (tableName, r) =>
  (PRIMARY_SUMMARY[tableName] ? PRIMARY_SUMMARY[tableName](r) : tableName === 'transactions'
    ? `${r.type === 'expense' ? '−' : '+'}${fmtETB(r.amount)} ETB ${r.category}${r.notes ? ` · ${r.notes}` : ''}`
    : `gold ${plain(r.gold_g)} g · hours ${plain(r.cleaning_hrs)}/${plain(r.prep_hrs)}/${plain(r.idle_hrs)} · fuel used ${plain(r.fuel_received_barrels)} bbl${r.notes ? ` · ${r.notes}` : ''}`);

function describeChange(tableName, action, oldRow, newRow) {
  const what = TABLE_WORDS[tableName] || 'Daily log';
  if (action === 'insert') return { icon: '➕', title: 'LATE ENTRY', text: `${what} added: ${recordSummary(tableName, newRow)}` };
  if (action === 'delete') return { icon: '🗑', title: 'REMOVED', text: `${what} removed: ${recordSummary(tableName, oldRow)}` };
  const labels = FIELD_LABELS[tableName] || {};
  const keys = [...new Set([...Object.keys(labels), ...Object.keys({ ...oldRow, ...newRow })])].filter((k) => !IGNORED_FIELDS.has(k));
  const changes = keys
    .filter((k) => JSON.stringify(oldRow?.[k] ?? null) !== JSON.stringify(newRow?.[k] ?? null))
    .map((k) => {
      const [label, unit] = labels[k] || [k, ''];
      return `${label} ${fieldValue(k, oldRow?.[k])} → ${fieldValue(k, newRow?.[k])}${unit ? ` ${unit}` : ''}`;
    });
  if (changes.length === 0) return null;
  const which = tableName === 'transactions' ? `Statement (${newRow?.category || oldRow?.category})`
    : PRIMARY_SUMMARY[tableName] && (newRow?.pit || oldRow?.pit) ? `${TABLE_WORDS[tableName]} (${newRow?.pit || oldRow?.pit})`
    : TABLE_WORDS[tableName] || 'Daily log';
  return { icon: '✏️', title: 'CORRECTION', text: `${which}: ${changes.join('; ')}` };
}

// ---------- Telegram ----------

// Never let the bot token appear in an error message or log.
const safe = (e) => String(e?.message || e).replaceAll(BOT_TOKEN || '\u0000', '***');

async function telegram(method, payload) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set in the Edge Function secrets.');
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (_) {
      throw new Error('Could not reach Telegram.');
    }
    const body = await res.json().catch(() => null);
    if (body?.ok) return body.result;
    const retryAfter = body?.parameters?.retry_after;
    if (res.status === 429 && retryAfter && attempt < 3) { await sleep((retryAfter + 1) * 1000); continue; }
    throw new Error(`Telegram: ${body?.description || `HTTP ${res.status}`}`);
  }
}

const sendText = (chatId, text, extra = {}) =>
  telegram('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra });

async function editText(chatId, messageId, text) {
  try {
    await telegram('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  } catch (e) {
    if (!String(e.message).includes('message is not modified')) throw e;
  }
}

async function sendBlocks(chatId, blocks, { gap = LIVE_GAP_MS, silent = false } = {}) {
  const ids = [];
  for (const text of pack(blocks)) {
    ids.push((await sendText(chatId, text, { disable_notification: silent })).message_id);
    await sleep(gap);
  }
  return ids;
}

// ---------- Data ----------

async function loadAll(tableName, siteId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(tableName).select('*').eq('site_id', siteId).order('id').range(from, from + 999);
    if (error) throw new Error(`${tableName}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function loadSite(siteId) {
  const [siteRes, inputsRes, logs, txs] = await Promise.all([
    db.from('sites').select('*').eq('id', siteId).maybeSingle(),
    db.from('inputs').select('*').eq('site_id', siteId).maybeSingle(),
    loadAll('daily_logs', siteId),
    loadAll('transactions', siteId),
  ]);
  if (siteRes.error) throw new Error(`sites: ${siteRes.error.message}`);
  if (inputsRes.error) throw new Error(`inputs: ${inputsRes.error.message}`);
  if (!siteRes.data || !inputsRes.data) throw new Error('Site or its Inputs not found.');
  if (siteRes.data.site_type !== 'primary') return { site: siteRes.data, inputs: inputsRes.data, logs, txs };
  const [shafts, sacks, results, exc, samples] = await Promise.all(
    ['shafts', 'sack_counts', 'milling_results', 'excavator_logs', 'shaft_samples'].map((t) => loadAll(t, siteId)));
  return { site: siteRes.data, inputs: inputsRes.data, logs, txs, primary: true, shafts, sacks, results, exc, samples };
}

async function channelFor(siteId) {
  const { data, error } = await db.from('site_telegram').select('chat_id, chat_title').eq('site_id', siteId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Reports already in the channel, keyed "daily|2026-09-27" or "weekly|<monday>".
async function postedReports(siteId, chatId) {
  const { data, error } = await db.from('telegram_posts').select('*').eq('site_id', siteId).eq('chat_id', chatId);
  if (error) throw new Error(`telegram_posts: ${error.message}`);
  return new Map(data.map((p) => [`${p.kind}|${p.report_date}`, p]));
}

async function publish(siteId, chatId, kind, reportDate, blocks, options) {
  const ids = await sendBlocks(chatId, blocks, options);
  const { error } = await db.from('telegram_posts')
    .insert({ site_id: siteId, kind, report_date: reportDate, chat_id: chatId, message_ids: ids });
  if (error) throw new Error(`telegram_posts: ${error.message}`);
}

// Re-render a posted report in place, with its list of corrections at the bottom.
async function rewrite(post, blocks, corrections) {
  const texts = pack(withCorrections(blocks, corrections));
  const ids = [...post.message_ids];
  for (let i = 0; i < Math.max(ids.length, texts.length); i++) {
    if (i < ids.length && i < texts.length) await editText(post.chat_id, ids[i], texts[i]);
    else if (i >= ids.length) ids.push((await sendText(post.chat_id, texts[i], { reply_parameters: { message_id: ids[0], allow_sending_without_reply: true } })).message_id);
    else await editText(post.chat_id, ids[i], '⤴️ (moved into the message above)');
    await sleep(LIVE_GAP_MS);
  }
  const { error } = await db.from('telegram_posts')
    .update({ message_ids: ids, corrections, edited_at: new Date().toISOString() }).eq('id', post.id);
  if (error) throw new Error(`telegram_posts: ${error.message}`);
}

// ---------- Actions ----------

async function isScheduledCall(req) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret) return false;
  const { data, error } = await db.rpc('telegram_cron_secret_ok', { p_secret: secret });
  return !error && data === true;
}

async function isSuperAdmin(req) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return false;
  const { data: profile } = await db.from('users').select('role').eq('id', data.user.id).maybeSingle();
  return profile?.role === 'super_admin';
}

// Channels (and groups) the bot has been added to or has seen posts in recently.
async function listChannels() {
  const updates = await telegram('getUpdates', { timeout: 0 });
  const chats = new Map();
  for (const u of updates) {
    const member = u.my_chat_member;
    const chat = member?.chat || u.channel_post?.chat || u.message?.chat;
    if (!chat || !['channel', 'supergroup', 'group'].includes(chat.type)) continue;
    if (member && ['left', 'kicked'].includes(member.new_chat_member?.status)) { chats.delete(chat.id); continue; }
    chats.set(chat.id, { id: chat.id, title: chat.title || String(chat.id), type: chat.type });
  }
  return [...chats.values()].sort((a, b) => (a.type === 'channel' ? 0 : 1) - (b.type === 'channel' ? 0 : 1));
}

async function sendTest(siteId) {
  const channel = await channelFor(siteId);
  if (!channel) throw new Error('No channel is connected to this site yet.');
  const data = await loadSite(siteId);
  await sendBlocks(channel.chat_id, ['🧪 <b>TEST</b>', ...(await reportDaily(data, todayInEthiopia()))]);
  await sendSamplePhotos(channel.chat_id, data, todayInEthiopia());
  return { ok: true, channel: channel.chat_title };
}

// Posts the next batch of past reports, oldest first: each day with entries, and each
// finished week's summary after its last day. Silent, and never posts a report twice.
async function backfill(siteId) {
  const started = Date.now();
  const channel = await channelFor(siteId);
  if (!channel) throw new Error('No channel is connected to this site yet.');
  const data = await loadSite(siteId);
  const today = todayInEthiopia();
  const posted = await postedReports(siteId, channel.chat_id);
  const dated = data.primary ? [...data.sacks, ...data.results, ...data.exc, ...data.samples, ...data.txs] : [...data.logs, ...data.txs];
  const days = [...new Set(dated.map((r) => r.date))].filter((d) => d && d < today).sort();
  const slots = days.map((day) => ({ kind: 'daily', date: day, order: `${day}|0` }));
  for (const monday of new Set(days.map((d) => weekStart(d)))) {
    const sunday = addDays(monday, 6);
    if (sunday < today) slots.push({ kind: 'weekly', date: monday, order: `${sunday}|1` });
  }
  const todo = slots.filter((s) => !posted.has(`${s.kind}|${s.date}`)).sort((a, b) => a.order.localeCompare(b.order));
  let count = 0;
  for (const slot of todo) {
    if (Date.now() - started > BACKFILL_BUDGET_MS) break;
    const blocks = slot.kind === 'daily' ? await reportDaily(data, slot.date) : await reportWeekly(data, slot.date);
    await publish(siteId, channel.chat_id, slot.kind, slot.date, blocks, { gap: BACKFILL_GAP_MS, silent: true });
    if (slot.kind === 'daily') await sendSamplePhotos(channel.chat_id, data, slot.date, { silent: true, gap: BACKFILL_GAP_MS });
    count++;
  }
  return { posted: count, remaining: todo.length - count, done: count === todo.length };
}

// The days whose daily report a scheduled run should post for one site:
//   due      every 10 minutes: days whose daily log (primary sites: daily entry) was saved
//            at least SETTLE_MINUTES ago
//   morning  9 am: yesterday, even without a log (the report then says the log is missing)
//   daily    the old fixed 8 pm run (before migration 005): today
async function daysToPost(kind, siteId, today, primary) {
  if (kind === 'morning') return [addDays(today, -1)];
  if (kind === 'daily') return [today];
  const settledBefore = new Date(Date.now() - SETTLE_MINUTES * 60000).toISOString();
  const entries = primary ? 'sack_counts' : 'daily_logs';
  const { data, error } = await db.from(entries).select('date').eq('site_id', siteId)
    .gte('date', addDays(today, -AUTO_POST_DAYS)).lte('date', today).lte('created_at', settledBefore);
  if (error) throw new Error(`${entries}: ${error.message}`);
  return [...new Set(data.map((l) => l.date))].sort();
}

async function runScheduled(kind) {
  const day = todayInEthiopia();
  const { data: channels, error } = await db.from('site_telegram').select('site_id, chat_id').eq('enabled', true);
  if (error) throw new Error(error.message);
  const results = [];
  for (const c of channels) {
    try {
      const posted = await postedReports(c.site_id, c.chat_id);
      const { data: site } = await db.from('sites').select('*').eq('id', c.site_id).maybeSingle();
      const todo = kind === 'weekly'
        ? [weekStart(day)].filter((monday) => !posted.has(`weekly|${monday}`))
        : (await daysToPost(kind, c.site_id, day, site?.site_type === 'primary')).filter((date) => !posted.has(`daily|${date}`));
      if (todo.length === 0) { results.push({ site_id: c.site_id, ok: true, skipped: 'nothing new' }); continue; }
      const data = await loadSite(c.site_id);
      for (const date of todo) {
        if (kind === 'weekly') await publish(c.site_id, c.chat_id, 'weekly', date, await reportWeekly(data, date));
        else {
          await publish(c.site_id, c.chat_id, 'daily', date, await reportDaily(data, date));
          await sendSamplePhotos(c.chat_id, data, date);
        }
      }
      results.push({ site_id: c.site_id, ok: true, posted: todo });
    } catch (e) {
      console.error(`telegram-reports ${kind} ${c.site_id}: ${safe(e)}`);
      results.push({ site_id: c.site_id, ok: false, error: safe(e) });
    }
  }
  return { kind, day, results };
}

// A daily log or statement entry changed. If its day's report (or that week's summary)
// is already in the channel: update it in place, and post a short notice so readers see it.
async function recordChanged(auditId) {
  const { data: audit, error } = await db.from('audit_log').select('*').eq('id', auditId).maybeSingle();
  if (error) throw new Error(`audit_log: ${error.message}`);
  if (!audit || !WATCHED_TABLES.includes(audit.table_name)) return { skipped: 'not a log or statement change' };
  const oldRow = audit.old_data || audit.old_value || null;
  const newRow = audit.new_data || audit.new_value || null;
  const siteId = (newRow || oldRow)?.site_id;
  const channel = siteId && (await channelFor(siteId));
  if (!channel) return { skipped: 'no channel' };
  if (siteId && (newRow?.shaft_id || oldRow?.shaft_id)) {
    const { data: shaft } = await db.from('shafts').select('name').eq('id', (newRow || oldRow).shaft_id).maybeSingle();
    if (newRow) newRow.pit = shaft?.name || '?';
    if (oldRow) oldRow.pit = shaft?.name || '?';
  }
  const change = describeChange(audit.table_name, audit.action, oldRow, newRow);
  if (!change) return { skipped: 'no visible change' };

  let who = 'Supabase (outside the app)';
  if (audit.changed_by) {
    const { data: person } = await db.from('users').select('name').eq('id', audit.changed_by).maybeSingle();
    who = person?.name || 'Unknown user';
  }
  const when = ethiopiaDateTime(audit.created_at || new Date().toISOString());
  const posted = await postedReports(siteId, channel.chat_id);
  const data = await loadSite(siteId);
  const updated = [];
  for (const day of [...new Set([oldRow?.date, newRow?.date].filter(Boolean))].sort()) {
    const daily = posted.get(`daily|${day}`);
    const weekly = posted.get(`weekly|${weekStart(day)}`);
    if (!daily && !weekly) continue;
    const line = `Edited ${when} by ${who}: ${change.text}`;
    if (daily) await rewrite(daily, await reportDaily(data, day), [...daily.corrections, line]);
    if (weekly) await rewrite(weekly, await reportWeekly(data, weekStart(day)), [...weekly.corrections, line]);
    const notice = `${change.icon} <b>${change.title}</b> · ${daily ? 'report of' : 'entry for'} ${prettyDate(day)}\n` +
      `${escapeHtml(change.text)}\n<i>by ${escapeHtml(who)} · ${when}</i>`;
    const replyTo = (daily || weekly).message_ids[0];
    await sendText(channel.chat_id, notice, { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } });
    updated.push(day);
  }
  return { updated };
}

const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'run' || body.action === 'record_changed') {
      if (!(await isScheduledCall(req))) return reply({ error: 'Not allowed.' }, 401);
      if (body.action === 'run') return reply(await runScheduled(['weekly', 'due', 'morning'].includes(body.kind) ? body.kind : 'daily'));
      return reply(await recordChanged(body.audit_id));
    }
    if (!(await isSuperAdmin(req))) return reply({ error: 'Only the super admin can do this.' }, 403);
    if (body.action === 'version') return reply({ version: BOT_VERSION });
    if (body.action === 'list_channels') return reply({ channels: await listChannels() });
    if (body.action === 'send_test') return reply(await sendTest(body.site_id));
    if (body.action === 'backfill') return reply(await backfill(body.site_id));
    return reply({ error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error(`telegram-reports: ${safe(e)}`);
    return reply({ error: safe(e) }, 500);
  }
});
