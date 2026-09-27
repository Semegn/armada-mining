// @ts-nocheck
// telegram-reports: posts each site's daily report (20:00 Ethiopia time) and weekly
// summary (Sundays 20:05) to the Telegram channel connected to that site.
// Setup and deployment: docs/SETUP.md. Schedules: docs/migrations/003_telegram_reports.sql.
//
// Actions (POST, JSON body):
//   { action: 'run', kind: 'daily' | 'weekly' }  from pg_cron; needs the x-cron-secret header
//   { action: 'list_channels' }                   super admin only: channels the bot was added to
//   { action: 'send_test', site_id }              super admin only: posts today's report now
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

function weeklySnap(inputs, logs, transactions, selectedWeek) {
  if (!inputs || !selectedWeek) return null;
  const weekEnd = addDays(selectedWeek, 6);
  const snapLogs = logs.filter((l) => l.date <= weekEnd);
  const snapTxs = transactions.filter((t) => t.date <= weekEnd);

  const fuelFromDailyLogs = snapLogs.reduce((s, l) => s + (Number(l.fuel_received_barrels) || 0), 0);
  const fuelFromTxs = snapTxs.filter(t => t.type === 'expense' && t.category === 'Fuel').reduce((s, t) => s + (Number(t.fuel_barrels_topped_up) || 0), 0);
  const fuelReceivedBarrels = fuelFromDailyLogs + fuelFromTxs;
  const cleaningHrs = snapLogs.reduce((s, l) => s + (Number(l.cleaning_hrs) || 0), 0);
  const prepHrs = snapLogs.reduce((s, l) => s + (Number(l.prep_hrs) || 0), 0);
  const idleHrs = snapLogs.reduce((s, l) => s + (Number(l.idle_hrs) || 0), 0);
  const totalHrs = cleaningHrs + prepHrs + idleHrs;

  const fuelConsumedL = cleaningHrs * Number(inputs.cleaning_fuel_rate) + prepHrs * Number(inputs.prep_fuel_rate);
  const fuelRemainingBarrels = (Number(inputs.fuel_barrels_opening) * Number(inputs.fuel_per_barrel) + fuelReceivedBarrels * Number(inputs.fuel_per_barrel) - fuelConsumedL) / Number(inputs.fuel_per_barrel);
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

const todayInEthiopia = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
const prettyDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
// Log values as entered: up to 2 decimals, no trailing zeros.
const plain = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0);
const warn = (flag) => (flag ? ' ⚠' : '');
const statusLine = (label, snap) =>
  `${label}: ${STATUS_LABEL[snap.status]}${snap.reasons.length > 0 ? ` (${snap.reasons.join(', ')})` : ''}`;

const txLine = (t) => {
  let extra = '';
  if (t.category === 'Gold Sale' && Number(t.gold_grams_sold) > 0) extra = ` (${plain(t.gold_grams_sold)} g)`;
  if (t.category === 'Fuel' && Number(t.fuel_barrels_topped_up) > 0) extra = ` (+${plain(t.fuel_barrels_topped_up)} barrels)`;
  if (t.category === 'Machine Rental' && Number(t.machine_hrs_topped_up) > 0) extra = ` (+${plain(t.machine_hrs_topped_up)} hrs)`;
  const sign = t.type === 'expense' ? '−' : '+';
  return `${sign} ${fmtETB(t.amount)} ETB · ${t.category}${extra}${t.notes ? ` · ${t.notes}` : ''}`;
};

// Everything recorded so far, like the Dashboard: the snapshot of the latest week with data.
const allTimeSnap = (inputs, logs, txs, day) => {
  const latest = [day, ...logs.map((l) => l.date), ...txs.map((t) => t.date)].sort().pop();
  return weeklySnap(inputs, logs, txs, weekStart(latest));
};

function dailyReport({ site, inputs, logs, txs }, day) {
  const snap = allTimeSnap(inputs, logs, txs, day);
  const log = logs.find((l) => l.date === day);
  const todays = txs
    .filter((t) => t.date === day)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  const lines = [`⛏ ${site.name} — Daily report · ${prettyDate(day)}`, statusLine('Status', snap), '', "Today's log"];
  if (log) {
    lines.push(
      `Gold: ${plain(log.gold_g)} g`,
      `Hours: cleaning ${plain(log.cleaning_hrs)} · prep ${plain(log.prep_hrs)} · idle ${plain(log.idle_hrs)}`,
      `Fuel received: ${plain(log.fuel_received_barrels)} barrels`,
    );
    if (log.notes) lines.push(`Notes: ${log.notes}`);
  } else {
    lines.push('⚠ No daily log entered for today.');
  }
  lines.push('', "Today's statement");
  if (todays.length > 0) todays.forEach((t) => lines.push(txLine(t)));
  else lines.push('No entries today.');
  lines.push(
    '',
    'Position now',
    `Cash on hand: ${fmtETB(snap.cashOnHand)} ETB${warn(snap.cashOnHand < Number(inputs.target_cash_reserve))}`,
    `Gold on hand: ${fmtNum(snap.goldOnHand, 1)} g`,
    `Fuel remaining: ${fmtNum(snap.fuelRemainingBarrels, 1)} barrels${warn(snap.fuelRemainingBarrels < 7)}`,
    `Machine hours left: ${fmtNum(snap.machineHrsRemaining, 0)}${warn(snap.machineHrsRemaining < 100)}`,
    `Efficiency: ${fmtNum(snap.avgGperHr, 2)} g/hr${warn(snap.avgGperHr < Number(inputs.efficiency_threshold) && snap.totalHrs > 0)}`,
  );
  return lines.join('\n');
}

// Same figures as the Weekly tab for the week (Monday to Sunday) that contains `day`.
function weeklyReport({ site, inputs, logs, txs }, day) {
  const snap = weeklySnap(inputs, logs, txs, weekStart(day));
  return [
    `📊 ${site.name} — Weekly summary · ${prettyDate(weekStart(day))} – ${prettyDate(snap.weekEnd)}`,
    statusLine('End-of-week status', snap),
    `${snap.logCount} logs · ${snap.txCount} statement entries · through ${snap.weekEnd}`,
    '',
    'Working capital',
    `Cash on hand: ${fmtETB(snap.cashOnHand)} ETB${warn(snap.cashOnHand < Number(inputs.target_cash_reserve))}`,
    `Gold on hand: ${fmtNum(snap.goldOnHand, 1)} g (${fmtNum(snap.goldSold, 1)} g sold)`,
    `Fuel remaining: ${fmtNum(snap.fuelRemainingBarrels, 1)} barrels${warn(snap.fuelRemainingBarrels < 7)}`,
    `Machine hours left: ${fmtNum(snap.machineHrsRemaining, 0)}${warn(snap.machineHrsRemaining < 100)}`,
    '',
    'Production (to week end)',
    `Gold produced: ${fmtNum(snap.grossGold, 1)} g`,
    `Net saleable: ${fmtNum(snap.netSaleableGold, 1)} g (after landowner share)`,
    `Total hours: ${fmtNum(snap.totalHrs, 0)} (cleaning ${fmtNum(snap.cleaningHrs, 0)} · prep ${fmtNum(snap.prepHrs, 0)})`,
    `Efficiency: ${fmtNum(snap.avgGperHr, 2)} g/hr${warn(snap.avgGperHr < Number(inputs.efficiency_threshold) && snap.totalHrs > 0)}`,
    '',
    'Financials (to week end)',
    `Revenue: ${fmtETB(snap.goldSaleRevenue)} ETB (from gold sales)`,
    `Operating costs: ${fmtETB(snap.totalCosts)} ETB (${fmtETB(snap.costPerGram)} ETB/g)${warn(snap.costPerGram > Number(inputs.gold_price))}`,
    `Profit share: ${fmtETB(snap.profitSharePaid)} ETB`,
    `Net profit: ${fmtETB(snap.profit)} ETB${warn(snap.profit < 0)}`,
  ].join('\n');
}

// Telegram allows 4,096 characters per message. Split between lines; only a single
// line longer than the limit is cut, and nothing is dropped.
const splitMessage = (text, limit = 4000) => {
  const parts = [];
  let current = '';
  for (const line of text.split('\n')) {
    let rest = line;
    while (rest.length > limit) {
      if (current) { parts.push(current); current = ''; }
      parts.push(rest.slice(0, limit));
      rest = rest.slice(limit);
    }
    if (current && current.length + 1 + rest.length > limit) { parts.push(current); current = rest; }
    else current = current ? `${current}\n${rest}` : rest;
  }
  if (current) parts.push(current);
  return parts;
};

// Never let the bot token appear in an error message or log.
const safe = (e) => String(e?.message || e).replaceAll(BOT_TOKEN || '\u0000', '***');

async function telegram(method, payload) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not set in the Edge Function secrets.');
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
  if (!body?.ok) throw new Error(`Telegram: ${body?.description || `HTTP ${res.status}`}`);
  return body.result;
}

async function post(chatId, text) {
  for (const part of splitMessage(text)) {
    await telegram('sendMessage', { chat_id: chatId, text: part, link_preview_options: { is_disabled: true } });
  }
}

async function loadAll(table, siteId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').eq('site_id', siteId).order('id').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
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
  const { data: setting, error } = await db.from('site_telegram').select('chat_id, chat_title').eq('site_id', siteId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!setting) throw new Error('No channel is connected to this site yet.');
  const data = await loadSite(siteId);
  await post(setting.chat_id, `🧪 Test\n${dailyReport(data, todayInEthiopia())}`);
  return { ok: true, channel: setting.chat_title };
}

async function runScheduled(kind) {
  const day = todayInEthiopia();
  const { data: settings, error } = await db.from('site_telegram').select('site_id, chat_id').eq('enabled', true);
  if (error) throw new Error(error.message);
  const results = [];
  for (const s of settings) {
    try {
      const data = await loadSite(s.site_id);
      await post(s.chat_id, kind === 'weekly' ? weeklyReport(data, day) : dailyReport(data, day));
      results.push({ site_id: s.site_id, ok: true });
    } catch (e) {
      console.error(`telegram-reports ${kind} ${s.site_id}: ${safe(e)}`);
      results.push({ site_id: s.site_id, ok: false, error: safe(e) });
    }
  }
  return { kind, day, results };
}

const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'run') {
      if (!(await isScheduledCall(req))) return reply({ error: 'Not allowed.' }, 401);
      return reply(await runScheduled(body.kind === 'weekly' ? 'weekly' : 'daily'));
    }
    if (!(await isSuperAdmin(req))) return reply({ error: 'Only the super admin can do this.' }, 403);
    if (body.action === 'list_channels') return reply({ channels: await listChannels() });
    if (body.action === 'send_test') return reply(await sendTest(body.site_id));
    return reply({ error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error(`telegram-reports: ${safe(e)}`);
    return reply({ error: safe(e) }, 500);
  }
});
