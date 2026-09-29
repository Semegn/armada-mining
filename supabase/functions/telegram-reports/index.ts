// @ts-nocheck
// telegram-reports: posts each site's daily report once its daily log is in (30 minutes
// after it's saved, or at 9 am the next morning at the latest) and the weekly summary
// (Sundays 20:05) to the Telegram channel connected to that site, can post the past
// reports, and updates a posted report when its day's entries change.
// Setup and deployment: docs/SETUP.md. Database: docs/migrations/003, 004 and 005.
//
// Actions (POST, JSON body):
//   { action: 'run', kind }                       pg_cron; needs the x-cron-secret header.
//                                                 kind: 'due' | 'morning' | 'weekly' ('daily' = old 8 pm run)
//   { action: 'record_changed', audit_id }        database trigger; needs the x-cron-secret header
//   { action: 'list_channels' }                   super admin: channels the bot was added to
//   { action: 'send_test', site_id }              super admin: posts today's report now (not archived)
//   { action: 'backfill', site_id }               super admin: posts the next batch of past reports
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
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
const BOT_VERSION = 'eee2a2a9ee';

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
// Bookkeeping columns that change on every save and mean nothing to readers.
const IGNORED_FIELDS = new Set(['id', 'site_id', 'created_at', 'updated_at', 'synced_at', 'created_offline',
  'logged_by', 'entered_by', 'updated_by', 'week_start']);
const fieldValue = (key, v) =>
  (v === null || v === undefined || v === '' ? '—' : key === 'amount' ? fmtETB(v) : typeof v === 'number' ? plain(v) : String(v));
const recordSummary = (tableName, r) =>
  (tableName === 'transactions'
    ? `${r.type === 'expense' ? '−' : '+'}${fmtETB(r.amount)} ETB ${r.category}${r.notes ? ` · ${r.notes}` : ''}`
    : `gold ${plain(r.gold_g)} g · hours ${plain(r.cleaning_hrs)}/${plain(r.prep_hrs)}/${plain(r.idle_hrs)} · fuel used ${plain(r.fuel_received_barrels)} bbl${r.notes ? ` · ${r.notes}` : ''}`);

function describeChange(tableName, action, oldRow, newRow) {
  const what = tableName === 'transactions' ? 'Statement' : 'Daily log';
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
  const which = tableName === 'transactions' ? `Statement (${newRow?.category || oldRow?.category})` : 'Daily log';
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
    db.from('sites').select('id, name').eq('id', siteId).maybeSingle(),
    db.from('inputs').select('*').eq('site_id', siteId).maybeSingle(),
    loadAll('daily_logs', siteId),
    loadAll('transactions', siteId),
  ]);
  if (siteRes.error) throw new Error(`sites: ${siteRes.error.message}`);
  if (inputsRes.error) throw new Error(`inputs: ${inputsRes.error.message}`);
  if (!siteRes.data || !inputsRes.data) throw new Error('Site or its Inputs not found.');
  return { site: siteRes.data, inputs: inputsRes.data, logs, txs };
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
  await sendBlocks(channel.chat_id, ['🧪 <b>TEST</b>', ...dailyBlocks(data, todayInEthiopia())]);
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
  const days = [...new Set([...data.logs, ...data.txs].map((r) => r.date))].filter((d) => d && d < today).sort();
  const slots = days.map((day) => ({ kind: 'daily', date: day, order: `${day}|0` }));
  for (const monday of new Set(days.map((d) => weekStart(d)))) {
    const sunday = addDays(monday, 6);
    if (sunday < today) slots.push({ kind: 'weekly', date: monday, order: `${sunday}|1` });
  }
  const todo = slots.filter((s) => !posted.has(`${s.kind}|${s.date}`)).sort((a, b) => a.order.localeCompare(b.order));
  let count = 0;
  for (const slot of todo) {
    if (Date.now() - started > BACKFILL_BUDGET_MS) break;
    const blocks = slot.kind === 'daily' ? dailyBlocks(data, slot.date) : weeklyBlocks(data, slot.date);
    await publish(siteId, channel.chat_id, slot.kind, slot.date, blocks, { gap: BACKFILL_GAP_MS, silent: true });
    count++;
  }
  return { posted: count, remaining: todo.length - count, done: count === todo.length };
}

// The days whose daily report a scheduled run should post for one site:
//   due      every 10 minutes: days whose daily log was saved at least SETTLE_MINUTES ago
//   morning  9 am: yesterday, even without a log (the report then says the log is missing)
//   daily    the old fixed 8 pm run (before migration 005): today
async function daysToPost(kind, siteId, today) {
  if (kind === 'morning') return [addDays(today, -1)];
  if (kind === 'daily') return [today];
  const settledBefore = new Date(Date.now() - SETTLE_MINUTES * 60000).toISOString();
  const { data, error } = await db.from('daily_logs').select('date').eq('site_id', siteId)
    .gte('date', addDays(today, -AUTO_POST_DAYS)).lte('date', today).lte('created_at', settledBefore);
  if (error) throw new Error(`daily_logs: ${error.message}`);
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
      const todo = kind === 'weekly'
        ? [weekStart(day)].filter((monday) => !posted.has(`weekly|${monday}`))
        : (await daysToPost(kind, c.site_id, day)).filter((date) => !posted.has(`daily|${date}`));
      if (todo.length === 0) { results.push({ site_id: c.site_id, ok: true, skipped: 'nothing new' }); continue; }
      const data = await loadSite(c.site_id);
      for (const date of todo) {
        if (kind === 'weekly') await publish(c.site_id, c.chat_id, 'weekly', date, weeklyBlocks(data, date));
        else await publish(c.site_id, c.chat_id, 'daily', date, dailyBlocks(data, date));
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
  if (!audit || !['daily_logs', 'transactions'].includes(audit.table_name)) return { skipped: 'not a log or statement change' };
  const oldRow = audit.old_data || audit.old_value || null;
  const newRow = audit.new_data || audit.new_value || null;
  const siteId = (newRow || oldRow)?.site_id;
  const channel = siteId && (await channelFor(siteId));
  if (!channel) return { skipped: 'no channel' };
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
    if (daily) await rewrite(daily, dailyBlocks(data, day), [...daily.corrections, line]);
    if (weekly) await rewrite(weekly, weeklyBlocks(data, weekStart(day)), [...weekly.corrections, line]);
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
