import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fweibxyncvjmuxxbqhan.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3ZWlieHluY3ZqbXV4eGJxaGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1OTM5NjAsImV4cCI6MjA5NTE2OTk2MH0.JQxS7MtsZaa_Gb59ZX3Jf4q9DwDTyWfS5TC7qJryA_A'
);

const fmtETB = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
};
const fmtNum = (n, d = 1) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const weekStart = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const ws = new Date(d.setDate(diff));
  return ws.toISOString().slice(0, 10);
};

const CATEGORIES = [
  'Fuel', 'Machine Rental', 'Crew Salaries', 'Accommodation & Food',
  'Vehicle / Site Support', 'Transport', 'Maintenance', 'Other', 'Profit Share'
];

// ============================================================
// LOGIN
// ============================================================
function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else onLogin(data.user);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <img src="/logo-shield.png" alt="Armada Mining" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-xl tracking-widest text-stone-900 uppercase font-semibold">Armada Mining</h1>
          <p className="text-xs text-stone-500 mt-2 tracking-wider">SITE OPERATIONS PLATFORM</p>
        </div>
        <div className="bg-white border border-stone-200 p-6">
          <label className="block text-xs uppercase tracking-wider text-stone-600 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-stone-300 px-3 py-2 mb-4 text-sm focus:outline-none focus:border-amber-700"
            placeholder="you@example.com"
          />
          <label className="block text-xs uppercase tracking-wider text-stone-600 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full border border-stone-300 px-3 py-2 mb-4 text-sm focus:outline-none focus:border-amber-700"
            placeholder="••••••••"
          />
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 mb-4">{error}</div>}
          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full bg-stone-900 text-white py-2.5 text-xs uppercase tracking-widest hover:bg-amber-700 disabled:bg-stone-400 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
        <p className="text-center text-xs text-stone-400 mt-6 tracking-wider">v1.0 · ARMADA MINING</p>
      </div>
    </div>
  );
}

// ============================================================
// LAYOUT / NAV
// ============================================================
function Shell({ user, profile, site, sites, onSiteChange, page, setPage, onLogout, children }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'daily', label: 'Daily Logs' },
    { id: 'transactions', label: 'Statement' },
    ...(profile?.role === 'super_admin' ? [{ id: 'inputs', label: 'Inputs' }] : []),
  ];

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <header className="bg-stone-900 text-stone-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-shield.png" alt="" className="w-7 h-7" />
            <div className="text-sm tracking-widest uppercase font-semibold">Armada Mining</div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {sites.length > 1 && (
              <select
                value={site?.id || ''}
                onChange={(e) => onSiteChange(e.target.value)}
                className="bg-stone-800 border border-stone-700 px-2 py-1 text-stone-100 text-xs"
              >
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <div className="hidden sm:block text-stone-400">{profile?.name}</div>
            <span className="hidden sm:block text-[10px] uppercase tracking-widest bg-amber-700 px-2 py-0.5">{profile?.role?.replace('_', ' ')}</span>
            <button onClick={onLogout} className="text-stone-400 hover:text-amber-500 uppercase tracking-wider">Logout</button>
          </div>
        </div>
      </header>

      {/* Site name + tabs */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="py-3 border-b border-stone-100">
            <div className="text-[10px] uppercase tracking-widest text-stone-500">Current Site</div>
            <div className="text-base font-semibold text-stone-900">{site?.name || '—'}</div>
            <div className="text-xs text-stone-500">{site?.location}</div>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setPage(t.id)}
                className={`px-4 py-3 text-xs uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors ${
                  page === t.id ? 'border-amber-700 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ site, inputs, logs, transactions }) {
  const calc = useMemo(() => {
    if (!inputs) return null;

    // Latest log date
    const latestLog = logs[0];

    // Cumulative fuel & machine hours
    const fuelReceivedBarrels = logs.reduce((s, l) => s + (Number(l.fuel_received_barrels) || 0), 0);
    const machineHrsAdded = logs.reduce((s, l) => s + (Number(l.machine_hrs_topped_up) || 0), 0);
    const cleaningHrs = logs.reduce((s, l) => s + (Number(l.cleaning_hrs) || 0), 0);
    const prepHrs = logs.reduce((s, l) => s + (Number(l.prep_hrs) || 0), 0);
    const totalHrs = cleaningHrs + prepHrs;

    // Fuel consumed (liters) using per-hour rates
    const fuelConsumedL = cleaningHrs * Number(inputs.cleaning_fuel_rate) + prepHrs * Number(inputs.prep_fuel_rate);
    const fuelOpeningL = Number(inputs.fuel_barrels_opening) * Number(inputs.fuel_per_barrel);
    const fuelReceivedL = fuelReceivedBarrels * Number(inputs.fuel_per_barrel);
    const fuelRemainingL = fuelOpeningL + fuelReceivedL - fuelConsumedL;
    const fuelRemainingBarrels = fuelRemainingL / Number(inputs.fuel_per_barrel);

    // Machine hours
    const machineHrsRemaining = Number(inputs.machine_hrs_opening) + machineHrsAdded - totalHrs;

    // Gold totals
    const grossGold = logs.reduce((s, l) => s + (Number(l.gold_g) || 0), 0);
    const netSaleableGold = grossGold * (1 - Number(inputs.landowner_share));

    // Revenue & costs
    const grossRevenue = netSaleableGold * Number(inputs.gold_price);
    const royalty = grossRevenue * Number(inputs.royalty_rate);
    const netRevenue = grossRevenue - royalty;

    const totalCosts = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalCredits = transactions
      .filter((t) => t.type === 'credit')
      .reduce((s, t) => s + Number(t.amount), 0);

    const profit = netRevenue - totalCosts;
    const costPerGram = netSaleableGold > 0 ? totalCosts / netSaleableGold : 0;
    const cashOnHand = Number(inputs.opening_cash) + totalCredits - totalCosts;

    // Runways — use last 7 days of data
    const last7 = logs.slice(0, 7);
    const last7Hrs = last7.reduce((s, l) => s + (Number(l.cleaning_hrs) || 0) + (Number(l.prep_hrs) || 0), 0);
    const last7Fuel = last7.length > 0 ? last7.reduce((s, l) => s + (Number(l.cleaning_hrs) || 0) * Number(inputs.cleaning_fuel_rate) + (Number(l.prep_hrs) || 0) * Number(inputs.prep_fuel_rate), 0) / Math.min(last7.length, 7) : 0;
    const avgDailyHrs = last7.length > 0 ? last7Hrs / Math.min(last7.length, 7) : 0;
    const fuelRunwayDays = last7Fuel > 0 ? fuelRemainingL / last7Fuel : null;
    const machineRunwayDays = avgDailyHrs > 0 ? machineHrsRemaining / avgDailyHrs : null;
    const wcRunway = (fuelRunwayDays !== null && machineRunwayDays !== null)
      ? Math.min(fuelRunwayDays, machineRunwayDays)
      : (fuelRunwayDays ?? machineRunwayDays);

    // Status
    let status = 'healthy';
    if (fuelRemainingBarrels < 7 || machineHrsRemaining < 100 || cashOnHand < Number(inputs.target_cash_reserve)) status = 'caution';
    if (fuelRemainingBarrels < 3 || machineHrsRemaining < 50 || profit < 0) status = 'critical';

    return {
      latestLogDate: latestLog?.date,
      grossGold, netSaleableGold,
      grossRevenue, netRevenue, totalCosts, profit, costPerGram,
      cashOnHand, fuelRemainingBarrels, machineHrsRemaining,
      fuelRunwayDays, machineRunwayDays, wcRunway,
      totalHrs, cleaningHrs, prepHrs,
      avgGperHr: totalHrs > 0 ? grossGold / totalHrs : 0,
      status,
      logCount: logs.length,
      txCount: transactions.length,
    };
  }, [inputs, logs, transactions]);

  if (!inputs) {
    return <div className="text-sm text-stone-500">Loading inputs…</div>;
  }
  if (!calc) return null;

  const statusColors = {
    healthy: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'HEALTHY' },
    caution: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500', label: 'CAUTION' },
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', dot: 'bg-red-500', label: 'CRITICAL' },
  };
  const sc = statusColors[calc.status];

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`${sc.bg} ${sc.border} border-l-4 px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${sc.dot}`}></div>
          <div>
            <div className={`text-xs uppercase tracking-widest font-semibold ${sc.text}`}>Site Status: {sc.label}</div>
            <div className="text-xs text-stone-600 mt-0.5">
              Last log: {calc.latestLogDate || 'No logs yet'} · {calc.logCount} logs · {calc.txCount} transactions
            </div>
          </div>
        </div>
      </div>

      {/* Working Capital */}
      <Section title="Working Capital">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-stone-200">
          <Tile label="Cash on Hand" value={fmtETB(calc.cashOnHand)} unit="ETB" />
          <Tile
            label="Fuel Remaining"
            value={fmtNum(calc.fuelRemainingBarrels, 1)}
            unit="barrels"
            sub={calc.fuelRunwayDays !== null ? `${fmtNum(calc.fuelRunwayDays, 1)} days` : '—'}
            alert={calc.fuelRemainingBarrels < 7}
          />
          <Tile
            label="Machine Hours"
            value={fmtNum(calc.machineHrsRemaining, 0)}
            unit="hours"
            sub={calc.machineRunwayDays !== null ? `${fmtNum(calc.machineRunwayDays, 1)} days` : '—'}
            alert={calc.machineHrsRemaining < 100}
          />
        </div>
      </Section>

      {/* Production */}
      <Section title="Production (All-Time)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone-200">
          <Tile label="Gold Produced" value={fmtNum(calc.grossGold, 1)} unit="grams" />
          <Tile label="Net Saleable" value={fmtNum(calc.netSaleableGold, 1)} unit="grams" sub="after landowner share" />
          <Tile label="Total Hours" value={fmtNum(calc.totalHrs, 0)} unit="hrs" sub={`Clean ${fmtNum(calc.cleaningHrs,0)} · Prep ${fmtNum(calc.prepHrs,0)}`} />
          <Tile label="Efficiency" value={fmtNum(calc.avgGperHr, 2)} unit="g/hr" alert={calc.avgGperHr < Number(inputs.efficiency_threshold) && calc.totalHrs > 0} />
        </div>
      </Section>

      {/* Financials */}
      <Section title="Financials (All-Time)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone-200">
          <Tile label="Net Revenue" value={fmtETB(calc.netRevenue)} unit="ETB" sub="after royalty" />
          <Tile label="Total Costs" value={fmtETB(calc.totalCosts)} unit="ETB" />
          <Tile label="Profit / Loss" value={fmtETB(calc.profit)} unit="ETB" alert={calc.profit < 0} />
          <Tile label="Cost per Gram" value={fmtETB(calc.costPerGram)} unit="ETB/g" sub={`vs ${fmtETB(inputs.gold_price)} sell price`} alert={calc.costPerGram > Number(inputs.gold_price)} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-2 px-1">{title}</div>
      {children}
    </div>
  );
}

function Tile({ label, value, unit, sub, alert }) {
  return (
    <div className={`bg-white px-4 py-3 ${alert ? 'ring-2 ring-red-300' : ''}`}>
      <div className="text-[10px] uppercase tracking-widest text-stone-500">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <div className={`text-xl font-semibold ${alert ? 'text-red-700' : 'text-stone-900'}`}>{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-stone-500">{unit}</div>
      </div>
      {sub && <div className="text-[10px] text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ============================================================
// DAILY LOGS
// ============================================================
function DailyLogs({ site, logs, profile, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: todayISO(),
    cleaning_hrs: '',
    prep_hrs: '',
    gold_g: '',
    fuel_received_barrels: '',
    machine_hrs_topped_up: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    setSaving(true);
    const payload = {
      site_id: site.id,
      logged_by: profile.id,
      date: form.date,
      cleaning_hrs: Number(form.cleaning_hrs) || 0,
      prep_hrs: Number(form.prep_hrs) || 0,
      gold_g: Number(form.gold_g) || 0,
      fuel_received_barrels: Number(form.fuel_received_barrels) || 0,
      machine_hrs_topped_up: Number(form.machine_hrs_topped_up) || 0,
      notes: form.notes || null,
    };
    const { error } = await supabase.from('daily_logs').upsert(payload, { onConflict: 'site_id,date' });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setShowForm(false);
    setForm({ date: todayISO(), cleaning_hrs: '', prep_hrs: '', gold_g: '', fuel_received_barrels: '', machine_hrs_topped_up: '', notes: '' });
    onRefresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-stone-500">Daily Logs</div>
          <div className="text-sm text-stone-600">{logs.length} entries</div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-stone-900 text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-amber-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Log'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-stone-200 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <Field label="Gold Produced (g)" type="number" value={form.gold_g} onChange={(v) => setForm({ ...form, gold_g: v })} />
            <Field label="Cleaning Hours" type="number" value={form.cleaning_hrs} onChange={(v) => setForm({ ...form, cleaning_hrs: v })} />
            <Field label="Prep Hours" type="number" value={form.prep_hrs} onChange={(v) => setForm({ ...form, prep_hrs: v })} />
            <Field label="Fuel Received (barrels)" type="number" value={form.fuel_received_barrels} onChange={(v) => setForm({ ...form, fuel_received_barrels: v })} />
            <Field label="Machine Hrs Topped Up" type="number" value={form.machine_hrs_topped_up} onChange={(v) => setForm({ ...form, machine_hrs_topped_up: v })} />
          </div>
          <div className="mt-3">
            <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700"
              rows={2}
            />
          </div>
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 mt-3">{error}</div>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-3 bg-amber-700 text-white px-6 py-2 text-xs uppercase tracking-widest hover:bg-amber-800 disabled:bg-stone-400"
          >
            {saving ? 'Saving…' : 'Save Log'}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-stone-100 text-stone-600 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-right">Clean</th>
              <th className="px-3 py-2 text-right">Prep</th>
              <th className="px-3 py-2 text-right">Gold (g)</th>
              <th className="px-3 py-2 text-right">Fuel In</th>
              <th className="px-3 py-2 text-right">Hrs Top-up</th>
              <th className="px-3 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan="7" className="px-3 py-8 text-center text-stone-400">No logs yet</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-stone-100">
                <td className="px-3 py-2 text-stone-900 font-medium">{l.date}</td>
                <td className="px-3 py-2 text-right">{fmtNum(l.cleaning_hrs, 1)}</td>
                <td className="px-3 py-2 text-right">{fmtNum(l.prep_hrs, 1)}</td>
                <td className="px-3 py-2 text-right font-medium text-amber-700">{fmtNum(l.gold_g, 1)}</td>
                <td className="px-3 py-2 text-right">{fmtNum(l.fuel_received_barrels, 1)}</td>
                <td className="px-3 py-2 text-right">{fmtNum(l.machine_hrs_topped_up, 0)}</td>
                <td className="px-3 py-2 text-stone-500">{l.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step="any"
        className="w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700"
      />
    </div>
  );
}

// ============================================================
// TRANSACTIONS
// ============================================================
function Transactions({ site, transactions, profile, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: todayISO(),
    amount: '',
    type: 'expense',
    category: 'Fuel',
    paid_by: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    setSaving(true);
    const payload = {
      site_id: site.id,
      entered_by: profile.id,
      date: form.date,
      week_start: weekStart(form.date),
      amount: Number(form.amount),
      type: form.type,
      category: form.category,
      paid_by: form.paid_by || null,
      notes: form.notes || null,
    };
    const { error } = await supabase.from('transactions').insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setShowForm(false);
    setForm({ date: todayISO(), amount: '', type: 'expense', category: 'Fuel', paid_by: '', notes: '' });
    onRefresh();
  };

  const totals = useMemo(() => {
    const exp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const cr = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0);
    return { exp, cr };
  }, [transactions]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-stone-500">Statement</div>
          <div className="text-sm text-stone-600">{transactions.length} transactions · Expense {fmtETB(totals.exp)} · Credit {fmtETB(totals.cr)} ETB</div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-stone-900 text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-amber-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Transaction'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-stone-200 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700"
              >
                <option value="expense">Expense (Debit)</option>
                <option value="credit">Credit (Income / Inflow)</option>
              </select>
            </div>
            <Field label="Amount (ETB)" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Field label="Paid By" value={form.paid_by} onChange={(v) => setForm({ ...form, paid_by: v })} />
          </div>
          <div className="mt-3">
            <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700"
              rows={2}
            />
          </div>
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 mt-3">{error}</div>}
          <button
            onClick={handleSave}
            disabled={saving || !form.amount}
            className="mt-3 bg-amber-700 text-white px-6 py-2 text-xs uppercase tracking-widest hover:bg-amber-800 disabled:bg-stone-400"
          >
            {saving ? 'Saving…' : 'Save Transaction'}
          </button>
        </div>
      )}

      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-stone-100 text-stone-600 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Paid By</th>
              <th className="px-3 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr><td colSpan="6" className="px-3 py-8 text-center text-stone-400">No transactions yet</td></tr>
            )}
            {transactions.map((t) => (
              <tr key={t.id} className="border-t border-stone-100">
                <td className="px-3 py-2 text-stone-900 font-medium">{t.date}</td>
                <td className="px-3 py-2">{t.category}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${t.type === 'expense' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {t.type}
                  </span>
                </td>
                <td className={`px-3 py-2 text-right font-medium ${t.type === 'expense' ? 'text-red-700' : 'text-emerald-700'}`}>
                  {t.type === 'expense' ? '−' : '+'}{fmtETB(t.amount)}
                </td>
                <td className="px-3 py-2 text-stone-500">{t.paid_by || '—'}</td>
                <td className="px-3 py-2 text-stone-500">{t.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// INPUTS (super admin only)
// ============================================================
function Inputs({ site, inputs, profile, onRefresh }) {
  const [form, setForm] = useState(inputs);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { setForm(inputs); }, [inputs]);

  if (!form) return <div className="text-sm text-stone-500">Loading…</div>;

  const handleSave = async () => {
    setError('');
    setSaving(true);
    const { error } = await supabase
      .from('inputs')
      .update({
        gold_price: Number(form.gold_price),
        fuel_price: Number(form.fuel_price),
        rental_rate: Number(form.rental_rate),
        royalty_rate: Number(form.royalty_rate),
        landowner_share: Number(form.landowner_share),
        target_cash_reserve: Number(form.target_cash_reserve),
        efficiency_threshold: Number(form.efficiency_threshold),
        opening_cash: Number(form.opening_cash),
        machine_hrs_opening: Number(form.machine_hrs_opening),
        fuel_barrels_opening: Number(form.fuel_barrels_opening),
        fuel_per_barrel: Number(form.fuel_per_barrel),
        cleaning_fuel_rate: Number(form.cleaning_fuel_rate),
        prep_fuel_rate: Number(form.prep_fuel_rate),
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      })
      .eq('id', form.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setSavedAt(new Date());
    onRefresh();
  };

  const groups = [
    {
      title: 'Pricing & Royalty',
      fields: [
        { key: 'gold_price', label: 'Gold Price', unit: 'ETB/g' },
        { key: 'royalty_rate', label: 'Royalty Rate', unit: 'decimal (0.07 = 7%)' },
        { key: 'landowner_share', label: 'Landowner Share', unit: 'decimal (0.30 = 30%)' },
      ],
    },
    {
      title: 'Operating Costs',
      fields: [
        { key: 'fuel_price', label: 'Fuel Price', unit: 'ETB/L' },
        { key: 'rental_rate', label: 'Machine Rental', unit: 'ETB/hr' },
        { key: 'cleaning_fuel_rate', label: 'Cleaning Fuel Rate', unit: 'L/hr' },
        { key: 'prep_fuel_rate', label: 'Prep Fuel Rate', unit: 'L/hr' },
        { key: 'fuel_per_barrel', label: 'Litres per Barrel', unit: 'L' },
      ],
    },
    {
      title: 'Opening Position',
      fields: [
        { key: 'opening_cash', label: 'Opening Cash', unit: 'ETB' },
        { key: 'machine_hrs_opening', label: 'Opening Machine Hours', unit: 'hrs' },
        { key: 'fuel_barrels_opening', label: 'Opening Fuel Stock', unit: 'barrels' },
      ],
    },
    {
      title: 'Alert Thresholds',
      fields: [
        { key: 'target_cash_reserve', label: 'Target Cash Reserve', unit: 'ETB' },
        { key: 'efficiency_threshold', label: 'Efficiency Threshold', unit: 'g/hr' },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-stone-500">Inputs</div>
          <div className="text-sm text-stone-600">Master assumptions — super admin only</div>
        </div>
        {savedAt && <div className="text-[10px] text-emerald-700 uppercase tracking-widest">Saved {savedAt.toLocaleTimeString()}</div>}
      </div>

      {groups.map((g) => (
        <div key={g.title} className="bg-white border border-stone-200">
          <div className="bg-stone-100 px-4 py-2 text-[10px] uppercase tracking-widest text-stone-600 font-semibold">{g.title}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
            {g.fields.map((f) => (
              <div key={f.key}>
                <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">{f.label}</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    value={form[f.key] ?? ''}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="flex-1 border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700"
                  />
                  <span className="text-[10px] uppercase tracking-wider text-stone-500 w-24">{f.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-amber-700 text-white px-8 py-3 text-xs uppercase tracking-widest hover:bg-amber-800 disabled:bg-stone-400"
      >
        {saving ? 'Saving…' : 'Save All Inputs'}
      </button>
    </div>
  );
}

// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sites, setSites] = useState([]);
  const [site, setSite] = useState(null);
  const [inputs, setInputs] = useState(null);
  const [logs, setLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState('');

  // Auth bootstrap
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load profile and sites when session exists
  useEffect(() => {
    if (!session) {
      setProfile(null); setSites([]); setSite(null);
      return;
    }
    (async () => {
      setBootError('');
      const { data: prof, error: pErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (pErr) { setBootError(pErr.message); return; }
      if (!prof) { setBootError('No profile found for this account. Contact super admin.'); return; }
      setProfile(prof);

      // Load sites (RLS will filter)
      const { data: ss, error: sErr } = await supabase.from('sites').select('*').order('name');
      if (sErr) { setBootError(sErr.message); return; }
      setSites(ss || []);
      if (ss && ss.length > 0) setSite(ss[0]);
    })();
  }, [session]);

  // Load site data
  const refreshSiteData = async () => {
    if (!site) return;
    const [inputsR, logsR, txR] = await Promise.all([
      supabase.from('inputs').select('*').eq('site_id', site.id).maybeSingle(),
      supabase.from('daily_logs').select('*').eq('site_id', site.id).order('date', { ascending: false }),
      supabase.from('transactions').select('*').eq('site_id', site.id).order('date', { ascending: false }),
    ]);
    setInputs(inputsR.data);
    setLogs(logsR.data || []);
    setTransactions(txR.data || []);
  };

  useEffect(() => { refreshSiteData(); }, [site]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null); setSites([]); setSite(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Loading…</div>;
  }

  if (!session) {
    return <Login onLogin={() => {}} />;
  }

  if (bootError) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <div className="max-w-md text-center">
          <div className="text-xs uppercase tracking-widest text-red-700 mb-2">Startup Error</div>
          <div className="text-sm text-stone-700 bg-red-50 border border-red-200 px-4 py-3">{bootError}</div>
          <button onClick={handleLogout} className="mt-4 text-xs uppercase tracking-widest text-stone-600 hover:text-amber-700">Sign out</button>
        </div>
      </div>
    );
  }

  if (!profile || !site) {
    return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Loading profile…</div>;
  }

  return (
    <Shell
      user={session.user}
      profile={profile}
      site={site}
      sites={sites}
      onSiteChange={(id) => setSite(sites.find((s) => s.id === id))}
      page={page}
      setPage={setPage}
      onLogout={handleLogout}
    >
      {page === 'dashboard' && <Dashboard site={site} inputs={inputs} logs={logs} transactions={transactions} />}
      {page === 'daily' && <DailyLogs site={site} logs={logs} profile={profile} onRefresh={refreshSiteData} />}
      {page === 'transactions' && <Transactions site={site} transactions={transactions} profile={profile} onRefresh={refreshSiteData} />}
      {page === 'inputs' && profile.role === 'super_admin' && <Inputs site={site} inputs={inputs} profile={profile} onRefresh={refreshSiteData} />}
    </Shell>
  );
}
