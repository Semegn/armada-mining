import React, { useState, useEffect, useMemo, useContext, useCallback, createContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import logoShield from './assets/logo-shield.png';

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

const CREDIT_CATEGORIES = ['Gold Sale', 'Loan', 'Investment', 'Other Income'];

// ============================================================
// LOCALIZATION
// ============================================================
const EN_STRINGS = {
  // Brand
  'brand.name': 'Armada Mining', 'brand.tagline': 'SITE OPERATIONS PLATFORM', 'brand.version': 'v1.0 · ARMADA MINING',
  // Auth
  'auth.email': 'Email', 'auth.password': 'Password', 'auth.signIn': 'Sign in', 'auth.signingIn': 'Signing in…',
  // Nav
  'nav.dashboard': 'Dashboard', 'nav.daily': 'Daily Logs', 'nav.statement': 'Statement',
  'nav.weekly': 'Weekly', 'nav.inputs': 'Inputs', 'nav.language': 'Language',
  'nav.logout': 'Logout', 'nav.currentSite': 'Current Site',
  // Status
  'status.siteStatus': 'Site Status', 'status.endOfWeekStatus': 'End-of-Week Status',
  'status.healthy': 'HEALTHY', 'status.caution': 'CAUTION', 'status.critical': 'CRITICAL',
  'status.lastLog': 'Last log', 'status.noLogsYet': 'No logs yet', 'status.logs': 'logs', 'status.transactions': 'transactions',
  // Sections
  'section.workingCapital': 'Working Capital',
  'section.production': 'Production (All-Time)', 'section.financials': 'Financials (All-Time)',
  'section.productionWeek': 'Production (Cumulative to Week End)', 'section.financialsWeek': 'Financials (Cumulative to Week End)',
  // Tiles
  'tile.cashOnHand': 'Cash on Hand', 'tile.fuelRemaining': 'Fuel Remaining', 'tile.machineHours': 'Machine Hours',
  'tile.goldProduced': 'Gold Produced', 'tile.netSaleable': 'Net Saleable', 'tile.totalHours': 'Total Hours',
  'tile.efficiency': 'Efficiency', 'tile.netRevenue': 'Net Revenue', 'tile.operatingCosts': 'Operating Costs',
  'tile.profitShare': 'Profit Share', 'tile.netProfit': 'Net Profit',
  'tile.goldOnHand': 'Gold on Hand', 'tile.goldSold': 'sold', 'tile.revenue': 'Revenue',
  'tile.afterRoyalty': 'after royalty', 'tile.afterLandownerShare': 'after landowner share',
  'tile.fromSales': 'from gold sales', 'tile.unsold': 'unsold',
  'tile.barrels': 'barrels', 'tile.hours': 'hours', 'tile.grams': 'grams', 'tile.days': 'days', 'tile.asOf': 'as of',
  // Daily Logs
  'daily.title': 'Daily Logs', 'daily.entries': 'entries', 'daily.newLog': '+ New Log', 'daily.cancel': 'Cancel',
  'daily.date': 'Date', 'daily.goldProduced': 'Gold Produced (g)', 'daily.cleaningHours': 'Cleaning Hours',
  'daily.prepHours': 'Prep Hours', 'daily.fuelReceived': 'Fuel Received (barrels)',
  'daily.machineTopUp': 'Machine Hrs Topped Up', 'daily.notes': 'Notes',
  'daily.saveLog': 'Save Log', 'daily.saving': 'Saving…', 'daily.noLogs': 'No logs yet',
  'daily.colDate': 'Date', 'daily.colClean': 'Clean', 'daily.colPrep': 'Prep', 'daily.colGold': 'Gold (g)',
  'daily.colFuelIn': 'Fuel In', 'daily.colTopUp': 'Hrs Top-up', 'daily.colNotes': 'Notes',
  // Transactions
  'tx.title': 'Statement', 'tx.newTx': '+ New Transaction', 'tx.cancel': 'Cancel',
  'tx.date': 'Date', 'tx.type': 'Type', 'tx.expenseDebit': 'Expense (Debit)', 'tx.creditIncome': 'Credit (Income / Inflow)',
  'tx.amount': 'Amount (ETB)', 'tx.category': 'Category', 'tx.paidBy': 'Paid By', 'tx.notes': 'Notes',
  'tx.saveTx': 'Save Transaction', 'tx.saving': 'Saving…', 'tx.noTx': 'No transactions yet',
  'tx.colDate': 'Date', 'tx.colCategory': 'Category', 'tx.colType': 'Type',
  'tx.colAmount': 'Amount', 'tx.colPaidBy': 'Paid By', 'tx.colNotes': 'Notes',
  'tx.expense': 'expense', 'tx.credit': 'credit',
  'tx.gramsSold': 'Grams Sold', 'tx.goldSale': 'Gold Sale', 'tx.loan': 'Loan',
  'tx.investment': 'Investment', 'tx.otherIncome': 'Other Income',
  'tx.barrelsReceived': 'Barrels Received', 'tx.hrsAdded': 'Machine Hours Added',
  // Weekly
  'weekly.selectWeek': 'Select Week', 'weekly.noData': 'No log data yet — add daily logs first.',
  'weekly.noSelection': 'Select a highlighted week to view snapshot.', 'weekly.through': 'through',
  // Inputs
  'inputs.title': 'Inputs', 'inputs.subtitle': 'Master assumptions — super admin only',
  'inputs.saveAll': 'Save All Inputs', 'inputs.saving': 'Saving…',
  'inputs.pricingRoyalty': 'Pricing & Royalty', 'inputs.operatingCosts': 'Operating Costs',
  'inputs.openingPosition': 'Opening Position', 'inputs.alertThresholds': 'Alert Thresholds',
  // Language admin
  'lang.title': 'Language & Translations', 'lang.subtitle': 'Auto-translate and edit strings per locale',
  'lang.editLang': 'Edit Language', 'lang.autoTranslate': 'Auto-Translate All',
  'lang.translating': 'Translating', 'lang.save': 'Save Translations', 'lang.saving': 'Saving…',
  'lang.english': 'English', 'lang.key': 'Key', 'lang.loading': 'Loading translations…',
  'lang.saved': 'Saved', 'lang.noData': 'No translations loaded yet. Click Auto-Translate or type manually.',
};

const SUPPORTED_LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'am', name: 'አማርኛ' },
  { code: 'om', name: 'Afaan Oromoo' },
  { code: 'ti', name: 'ትግርኛ' },
  { code: 'so', name: 'Soomaali' },
  { code: 'ar', name: 'العربية' },
  { code: 'fr', name: 'Français' },
  { code: 'zh', name: '中文' },
  { code: 'pt', name: 'Português' },
];

const LocaleContext = createContext({ t: (k) => EN_STRINGS[k] || k, locale: 'en', setLocale: () => {} });
const useT = () => useContext(LocaleContext);

function LocaleProvider({ children }) {
  const [locale, setLocale] = useState('en');
  const [strings, setStrings] = useState(EN_STRINGS);
  const [localeLoading, setLocaleLoading] = useState(false);

  useEffect(() => {
    if (locale === 'en') { setStrings(EN_STRINGS); return; }
    setLocaleLoading(true);
    supabase.from('translations').select('key,value').eq('locale', locale).then(({ data }) => {
      if (data && data.length > 0) {
        const loaded = Object.fromEntries(data.map((r) => [r.key, r.value]));
        setStrings({ ...EN_STRINGS, ...loaded });
      } else {
        setStrings(EN_STRINGS);
      }
      setLocaleLoading(false);
    });
  }, [locale]);

  const t = useCallback((key) => strings[key] || EN_STRINGS[key] || key, [strings]);
  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, strings, localeLoading }}>
      {localeLoading ? (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Loading language…
        </div>
      ) : children}
    </LocaleContext.Provider>
  );
}

async function autoTranslate(targetLocale, onProgress) {
  const entries = Object.entries(EN_STRINGS);
  const results = {};
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(value)}&langpair=en|${targetLocale}`);
      const data = await res.json();
      const tx = data.responseData?.translatedText;
      results[key] = (tx && tx !== value && !tx.startsWith('PLEASE SELECT')) ? tx : value;
    } catch { results[key] = value; }
    if (onProgress) onProgress(Math.round(((i + 1) / entries.length) * 100));
  }
  return results;
}

// ============================================================
// TRANSLATIONS ADMIN
// ============================================================
function TranslationsAdmin({ profile }) {
  const { t, locale, setLocale } = useT();
  const [editLocale, setEditLocale] = useState(SUPPORTED_LOCALES[1].code);
  const [edits, setEdits] = useState({});
  const [dbStrings, setDbStrings] = useState({});
  const [loadingTx, setLoadingTx] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    setLoadingTx(true); setEdits({}); setDbStrings({});
    supabase.from('translations').select('key,value').eq('locale', editLocale).then(({ data }) => {
      if (data) { const m = Object.fromEntries(data.map((r) => [r.key, r.value])); setDbStrings(m); setEdits(m); }
      setLoadingTx(false);
    });
  }, [editLocale]);

  const handleAutoTranslate = async () => {
    setTranslating(true); setProgress(0);
    const result = await autoTranslate(editLocale, setProgress);
    setEdits(result); setTranslating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const rows = Object.entries(edits)
      .filter(([, v]) => v.trim())
      .map(([key, value]) => ({ locale: editLocale, key, value, updated_by: profile.id }));
    await supabase.from('translations').upsert(rows, { onConflict: 'locale,key' });
    setSaving(false); setSavedAt(new Date());
    if (locale === editLocale) { setLocale('en'); setTimeout(() => setLocale(editLocale), 50); }
  };

  const localeName = SUPPORTED_LOCALES.find((l) => l.code === editLocale)?.name || editLocale;
  const isDirty = Object.keys(edits).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('lang.title')}</div>
          <div className="text-sm text-stone-600">{t('lang.subtitle')}</div>
        </div>
        {savedAt && <div className="text-[10px] text-emerald-700 uppercase tracking-widest">{t('lang.saved')} {savedAt.toLocaleTimeString()}</div>}
      </div>

      <div className="bg-white border border-stone-200 p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">{t('lang.editLang')}</label>
            <select value={editLocale} onChange={(e) => setEditLocale(e.target.value)}
              className="border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700">
              {SUPPORTED_LOCALES.filter((l) => l.code !== 'en').map((l) => (
                <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>
          <button onClick={handleAutoTranslate} disabled={translating}
            className="bg-stone-900 text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-amber-700 disabled:bg-stone-400 transition-colors">
            {translating ? `${t('lang.translating')}… ${progress}%` : t('lang.autoTranslate')}
          </button>
          <button onClick={handleSave} disabled={saving || !isDirty}
            className="bg-amber-700 text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-amber-800 disabled:bg-stone-400 transition-colors">
            {saving ? t('lang.saving') : t('lang.save')}
          </button>
        </div>

        {loadingTx ? (
          <div className="text-xs text-stone-500 py-4">{t('lang.loading')}</div>
        ) : (
          <div className="overflow-x-auto border border-stone-200">
            <table className="w-full text-xs">
              <thead className="bg-stone-100 border-b border-stone-200">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-widest text-stone-500 w-36">{t('lang.key')}</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-widest text-stone-500 w-64">{t('lang.english')}</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-widest text-stone-500">{localeName}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(EN_STRINGS).map(([key, en]) => (
                  <tr key={key} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="px-3 py-2 text-[10px] text-stone-400 font-mono whitespace-nowrap">{key}</td>
                    <td className="px-3 py-2 text-stone-500">{en}</td>
                    <td className="px-3 py-2">
                      <input type="text" value={edits[key] || ''} placeholder={en}
                        onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
                        className={`w-full bg-transparent border-b py-0.5 text-sm focus:outline-none focus:border-amber-700 transition-colors ${
                          edits[key] && edits[key] !== dbStrings[key] ? 'border-amber-400 text-stone-900' : 'border-stone-200 text-stone-700'
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LOGIN
// ============================================================
function Login({ onLogin }) {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError(''); setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else onLogin(data.user);
  };

  return (
    <div className="h-full bg-stone-50 flex items-center justify-center px-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <img src={logoShield} alt={t('brand.name')} className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-xl tracking-widest text-stone-900 uppercase font-semibold">{t('brand.name')}</h1>
          <p className="text-xs text-stone-500 mt-2 tracking-wider">{t('brand.tagline')}</p>
        </div>
        <div className="bg-white border border-stone-200 p-6">
          <label className="block text-xs uppercase tracking-wider text-stone-600 mb-1">{t('auth.email')}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-stone-300 px-3 py-2 mb-4 text-sm focus:outline-none focus:border-amber-700"
            placeholder="you@example.com" />
          <label className="block text-xs uppercase tracking-wider text-stone-600 mb-1">{t('auth.password')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full border border-stone-300 px-3 py-2 mb-4 text-sm focus:outline-none focus:border-amber-700"
            placeholder="••••••••" />
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 mb-4">{error}</div>}
          <button onClick={handleLogin} disabled={loading || !email || !password}
            className="w-full bg-stone-900 text-white py-2.5 text-xs uppercase tracking-widest hover:bg-amber-700 disabled:bg-stone-400 transition-colors">
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </div>
        <p className="text-center text-xs text-stone-400 mt-6 tracking-wider">{t('brand.version')}</p>
      </div>
    </div>
  );
}

// ============================================================
// LAYOUT / NAV
// ============================================================
function Shell({ user, profile, site, sites, onSiteChange, page, setPage, onLogout, children }) {
  const { t, locale, setLocale } = useT();

  const tabs = [
    { id: 'dashboard', label: t('nav.dashboard') },
    { id: 'daily', label: t('nav.daily') },
    { id: 'transactions', label: t('nav.statement') },
    { id: 'weekly', label: t('nav.weekly') },
    ...(profile?.role === 'super_admin' ? [
      { id: 'inputs', label: t('nav.inputs') },
      { id: 'language', label: t('nav.language') },
    ] : []),
  ];

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <header className="bg-stone-900 text-stone-100 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoShield} alt="" className="w-7 h-7" />
            <div className="text-sm tracking-widest uppercase font-semibold">{t('brand.name')}</div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <select value={locale} onChange={(e) => setLocale(e.target.value)}
              className="bg-stone-800 border border-stone-700 px-2 py-1 text-stone-100 text-xs">
              {SUPPORTED_LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
            {sites.length > 1 && (
              <select value={site?.id || ''} onChange={(e) => onSiteChange(e.target.value)}
                className="bg-stone-800 border border-stone-700 px-2 py-1 text-stone-100 text-xs">
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <div className="hidden sm:block text-stone-400">{profile?.name}</div>
            <span className="hidden sm:block text-[10px] uppercase tracking-widest bg-amber-700 px-2 py-0.5">{profile?.role?.replace('_', ' ')}</span>
            <button onClick={onLogout} className="text-stone-400 hover:text-amber-500 uppercase tracking-wider">{t('nav.logout')}</button>
          </div>
        </div>
      </header>

      {/* Site name + tabs */}
      <div className="bg-white border-b border-stone-200 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4">
          <div className="py-3 border-b border-stone-100">
            <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('nav.currentSite')}</div>
            <div className="text-base font-semibold text-stone-900">{site?.name || '—'}</div>
            <div className="text-xs text-stone-500">{site?.location}</div>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setPage(tab.id)}
                className={`px-4 py-3 text-xs uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors ${
                  page === tab.id ? 'border-amber-700 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
      </main>
    </div>
  );
}

// ============================================================
// WEEK CALENDAR + WEEKLY REPORT
// ============================================================
const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function WeekCalendar({ logs, transactions, selectedWeek, onSelectWeek }) {
  const dataWeeks = useMemo(() => {
    const s = new Set();
    logs.forEach((l) => s.add(weekStart(l.date)));
    transactions.forEach((t) => s.add(weekStart(t.date)));
    return s;
  }, [logs, transactions]);

  const dataDays = useMemo(() => {
    const s = new Set();
    logs.forEach((l) => s.add(l.date));
    transactions.forEach((t) => s.add(t.date));
    return s;
  }, [logs, transactions]);

  const initYear = selectedWeek ? Number(selectedWeek.slice(0, 4)) : new Date().getFullYear();
  const initMonth = selectedWeek ? Number(selectedWeek.slice(5, 7)) - 1 : new Date().getMonth();
  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);

  const prevMonth = () => viewMonth === 0 ? (setViewMonth(11), setViewYear((y) => y - 1)) : setViewMonth((m) => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewMonth(0), setViewYear((y) => y + 1)) : setViewMonth((m) => m + 1);

  const calWeeks = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const start = new Date(first);
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
    const end = new Date(last);
    const edow = end.getDay();
    if (edow !== 0) end.setDate(end.getDate() + (7 - edow));
    const rows = [];
    const cur = new Date(start);
    while (cur <= end) {
      const row = [];
      for (let i = 0; i < 7; i++) {
        row.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`);
        cur.setDate(cur.getDate() + 1);
      }
      rows.push(row);
    }
    return rows;
  }, [viewYear, viewMonth]);

  const today = todayISO();

  return (
    <div className="bg-white border border-stone-200 select-none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
        <button onClick={prevMonth} className="text-stone-500 hover:text-amber-700 text-lg px-1 leading-none transition-colors">‹</button>
        <span className="text-xs font-semibold uppercase tracking-widest text-stone-700">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="text-stone-500 hover:text-amber-700 text-lg px-1 leading-none transition-colors">›</button>
      </div>

      <div className="grid grid-cols-7 border-b border-stone-100">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2 text-center text-[10px] uppercase tracking-widest text-stone-400">{d}</div>
        ))}
      </div>

      {calWeeks.map((week) => {
        const ws = weekStart(week[0]);
        const isSelected = selectedWeek === ws;
        const hasData = dataWeeks.has(ws);
        return (
          <div
            key={ws}
            onClick={() => hasData && onSelectWeek(ws)}
            className={`grid grid-cols-7 border-b border-stone-100 last:border-0 transition-colors ${
              isSelected ? 'bg-amber-50 border-l-2 border-l-amber-700' :
              hasData ? 'hover:bg-stone-50 cursor-pointer' : 'cursor-default'
            }`}
          >
            {week.map((day) => {
              const inMonth = Number(day.slice(5, 7)) - 1 === viewMonth;
              const isToday = day === today;
              const hasDot = dataDays.has(day) && inMonth;
              return (
                <div key={day} className="py-3 flex flex-col items-center gap-0.5">
                  <span className={`text-xs leading-none ${
                    isToday ? 'bg-amber-700 text-white rounded-full w-5 h-5 flex items-center justify-center' :
                    isSelected && inMonth ? 'text-amber-800 font-semibold' :
                    inMonth ? 'text-stone-700' : 'text-stone-300'
                  }`}>
                    {Number(day.slice(8, 10))}
                  </span>
                  {hasDot && <span className="w-1 h-1 rounded-full bg-amber-500" />}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

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
  const totalHrs = cleaningHrs + prepHrs;

  const fuelConsumedL = cleaningHrs * Number(inputs.cleaning_fuel_rate) + prepHrs * Number(inputs.prep_fuel_rate);
  const fuelRemainingBarrels = (Number(inputs.fuel_barrels_opening) * Number(inputs.fuel_per_barrel) + fuelReceivedBarrels * Number(inputs.fuel_per_barrel) - fuelConsumedL) / Number(inputs.fuel_per_barrel);
  const machineHrsToppedUpLogs = snapLogs.reduce((s, l) => s + (Number(l.machine_hrs_topped_up) || 0), 0);
  const machineHrsToppedUpTxs = snapTxs.filter(t => t.type === 'expense' && t.category === 'Machine Rental').reduce((s, t) => s + (Number(t.machine_hrs_topped_up) || 0), 0);
  const machineHrsRemaining = Number(inputs.machine_hrs_opening) + machineHrsToppedUpLogs + machineHrsToppedUpTxs - totalHrs;

  const grossGold = snapLogs.reduce((s, l) => s + (Number(l.gold_g) || 0), 0);
  const netSaleableGold = grossGold * (1 - Number(inputs.landowner_share));

  const totalCosts = snapTxs.filter((t) => t.type === 'expense' && t.category !== 'Profit Share').reduce((s, t) => s + Number(t.amount), 0);
  const profitSharePaid = snapTxs.filter((t) => t.type === 'expense' && t.category === 'Profit Share').reduce((s, t) => s + Number(t.amount), 0);
  const totalCredits = snapTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0);

  // Actual gold sales (cash received + grams sold)
  const goldSalesTxs = snapTxs.filter((t) => t.type === 'credit' && t.category === 'Gold Sale');
  const goldSold = goldSalesTxs.reduce((s, t) => s + (Number(t.gold_grams_sold) || 0), 0);
  const goldSaleRevenue = goldSalesTxs.reduce((s, t) => s + Number(t.amount), 0);
  const goldOnHand = Math.max(0, netSaleableGold - goldSold);

  const profit = goldSaleRevenue - totalCosts - profitSharePaid;
  const cashOnHand = Number(inputs.opening_cash) + totalCredits - totalCosts - profitSharePaid;
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

const STATUS_COLORS = {
  healthy: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'HEALTHY' },
  caution:  { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   dot: 'bg-amber-500',   label: 'CAUTION'  },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-800',     dot: 'bg-red-500',     label: 'CRITICAL' },
};

function WeeklyReport({ inputs, logs, transactions }) {
  const { t } = useT();
  const dataWeeks = useMemo(() => {
    const s = new Set();
    logs.forEach((l) => s.add(weekStart(l.date)));
    transactions.forEach((t) => s.add(weekStart(t.date)));
    return [...s].sort();
  }, [logs, transactions]);

  const [selectedWeek, setSelectedWeek] = useState(null);
  useEffect(() => {
    if (dataWeeks.length > 0 && !selectedWeek) setSelectedWeek(dataWeeks[dataWeeks.length - 1]);
  }, [dataWeeks]);

  const snap = useMemo(() => weeklySnap(inputs, logs, transactions, selectedWeek), [inputs, logs, transactions, selectedWeek]);

  if (!inputs) return <div className="text-sm text-stone-500">Loading…</div>;
  if (dataWeeks.length === 0) return <div className="text-sm text-stone-500 py-8 text-center">{t('weekly.noData')}</div>;

  const sc = snap ? STATUS_COLORS[snap.status] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Calendar column */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-stone-500 px-1">{t('weekly.selectWeek')}</div>
        <WeekCalendar logs={logs} transactions={transactions} selectedWeek={selectedWeek} onSelectWeek={setSelectedWeek} />
        {selectedWeek && (
          <div className="text-[10px] text-stone-400 uppercase tracking-widest px-1">
            {selectedWeek} — {addDays(selectedWeek, 6)}
          </div>
        )}
      </div>

      {/* Snapshot column */}
      <div className="lg:col-span-2 space-y-4">
        {!snap ? (
          <div className="text-sm text-stone-500">{t('weekly.noSelection')}</div>
        ) : (
          <>
            {/* Status banner */}
            <div className={`${sc.bg} ${sc.border} border-l-4 px-4 py-3 flex items-center gap-3`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
              <div>
                <div className={`text-xs uppercase tracking-widest font-semibold ${sc.text}`}>
                  {t('status.endOfWeekStatus')}: {t(`status.${snap.status}`)}
                  {snap.reasons.length > 0 && ` (${snap.reasons.join(', ')})`}
                </div>
                <div className="text-xs text-stone-600 mt-0.5">
                  {snap.logCount} {t('status.logs')} · {snap.txCount} {t('status.transactions')} · {t('weekly.through')} {snap.weekEnd}
                </div>
              </div>
            </div>

            {/* Working Capital */}
            <Section title={t('section.workingCapital')}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200">
                <Tile label={t('tile.cashOnHand')} value={fmtETB(snap.cashOnHand)} unit="ETB" />
                <Tile label={t('tile.goldOnHand')} value={fmtNum(snap.goldOnHand, 1)} unit={t('tile.grams')}
                  sub={`${fmtNum(snap.goldSold, 1)}g sold`} />
                <Tile label={t('tile.fuelRemaining')} value={fmtNum(snap.fuelRemainingBarrels, 1)} unit={t('tile.barrels')}
                  sub={`${t('tile.asOf')} ${snap.weekEnd}`} alert={snap.fuelRemainingBarrels < 7} />
                <Tile label={t('tile.machineHours')} value={fmtNum(snap.machineHrsRemaining, 0)} unit={t('tile.hours')}
                  sub={`${t('tile.asOf')} ${snap.weekEnd}`} alert={snap.machineHrsRemaining < 100} />
              </div>
            </Section>

            {/* Production */}
            <Section title={t('section.productionWeek')}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone-200">
                <Tile label={t('tile.goldProduced')} value={fmtNum(snap.grossGold, 1)} unit={t('tile.grams')} />
                <Tile label={t('tile.netSaleable')} value={fmtNum(snap.netSaleableGold, 1)} unit={t('tile.grams')} sub={t('tile.afterLandownerShare')} />
                <Tile label={t('tile.totalHours')} value={fmtNum(snap.totalHrs, 0)} unit="hrs"
                  sub={`Clean ${fmtNum(snap.cleaningHrs, 0)} · Prep ${fmtNum(snap.prepHrs, 0)}`} />
                <Tile label={t('tile.efficiency')} value={fmtNum(snap.avgGperHr, 2)} unit="g/hr"
                  alert={snap.avgGperHr < Number(inputs.efficiency_threshold) && snap.totalHrs > 0} />
              </div>
            </Section>

            {/* Financials */}
            <Section title={t('section.financialsWeek')}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone-200">
                <Tile label={t('tile.revenue')} value={fmtETB(snap.goldSaleRevenue)} unit="ETB" sub={t('tile.fromSales')} />
                <Tile label={t('tile.operatingCosts')} value={fmtETB(snap.totalCosts)} unit="ETB"
                  sub={`${fmtETB(snap.costPerGram)} ETB/g`} alert={snap.costPerGram > Number(inputs.gold_price)} />
                <Tile label={t('tile.profitShare')} value={fmtETB(snap.profitSharePaid)} unit="ETB" />
                <Tile label={t('tile.netProfit')} value={fmtETB(snap.profit)} unit="ETB" alert={snap.profit < 0} />
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ site, inputs, logs, transactions }) {
  const { t } = useT();
  const calc = useMemo(() => {
    if (!inputs) return null;

    // Latest log date
    const latestLog = logs[0];

    // Cumulative fuel & machine hours
    const fuelFromDailyLogs = logs.reduce((s, l) => s + (Number(l.fuel_received_barrels) || 0), 0);
    const fuelFromTxs = transactions.filter(t => t.type === 'expense' && t.category === 'Fuel').reduce((s, t) => s + (Number(t.fuel_barrels_topped_up) || 0), 0);
    const fuelReceivedBarrels = fuelFromDailyLogs + fuelFromTxs;
    const cleaningHrs = logs.reduce((s, l) => s + (Number(l.cleaning_hrs) || 0), 0);
    const prepHrs = logs.reduce((s, l) => s + (Number(l.prep_hrs) || 0), 0);
    const totalHrs = cleaningHrs + prepHrs;

    // Fuel consumed (liters) using per-hour rates
    const fuelConsumedL = cleaningHrs * Number(inputs.cleaning_fuel_rate) + prepHrs * Number(inputs.prep_fuel_rate);
    const fuelOpeningL = Number(inputs.fuel_barrels_opening) * Number(inputs.fuel_per_barrel);
    const fuelReceivedL = fuelReceivedBarrels * Number(inputs.fuel_per_barrel);
    const fuelRemainingL = fuelOpeningL + fuelReceivedL - fuelConsumedL;
    const fuelRemainingBarrels = fuelRemainingL / Number(inputs.fuel_per_barrel);

    // Machine hours — opening + all top-ups (daily logs + Machine Rental expense transactions) − used
    const machineHrsToppedUpLogs = logs.reduce((s, l) => s + (Number(l.machine_hrs_topped_up) || 0), 0);
    const machineHrsToppedUpTxs = transactions.filter(t => t.type === 'expense' && t.category === 'Machine Rental').reduce((s, t) => s + (Number(t.machine_hrs_topped_up) || 0), 0);
    const machineHrsRemaining = Number(inputs.machine_hrs_opening) + machineHrsToppedUpLogs + machineHrsToppedUpTxs - totalHrs;

    // Gold totals
    const grossGold = logs.reduce((s, l) => s + (Number(l.gold_g) || 0), 0);
    const netSaleableGold = grossGold * (1 - Number(inputs.landowner_share));

    // Costs
    const totalCosts = transactions
      .filter((t) => t.type === 'expense' && t.category !== 'Profit Share')
      .reduce((s, t) => s + Number(t.amount), 0);
    const profitSharePaid = transactions
      .filter((t) => t.type === 'expense' && t.category === 'Profit Share')
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalCredits = transactions
      .filter((t) => t.type === 'credit')
      .reduce((s, t) => s + Number(t.amount), 0);

    // Actual gold sales (cash received + grams sold)
    const goldSalesTxs = transactions.filter((t) => t.type === 'credit' && t.category === 'Gold Sale');
    const goldSold = goldSalesTxs.reduce((s, t) => s + (Number(t.gold_grams_sold) || 0), 0);
    const goldSaleRevenue = goldSalesTxs.reduce((s, t) => s + Number(t.amount), 0);
    const goldOnHand = Math.max(0, netSaleableGold - goldSold);

    const profit = goldSaleRevenue - totalCosts - profitSharePaid;
    const costPerGram = netSaleableGold > 0 ? totalCosts / netSaleableGold : 0;
    const cashOnHand = Number(inputs.opening_cash) + totalCredits - totalCosts - profitSharePaid;

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

    // Status + reasons
    const reasons = [];
    if (cashOnHand < Number(inputs.target_cash_reserve)) reasons.push('Cash');
    if (fuelRemainingBarrels < 7) reasons.push('Fuel');
    if (machineHrsRemaining < 100) reasons.push('Machine Hrs');
    if (profit < 0) reasons.push('Profit');

    let status = 'healthy';
    if (fuelRemainingBarrels < 7 || machineHrsRemaining < 100 || cashOnHand < Number(inputs.target_cash_reserve)) status = 'caution';
    if (fuelRemainingBarrels < 3 || machineHrsRemaining < 50 || profit < 0) status = 'critical';

    return {
      latestLogDate: latestLog?.date,
      grossGold, netSaleableGold, goldSold, goldOnHand,
      goldSaleRevenue, totalCosts, profitSharePaid, profit, costPerGram,
      cashOnHand, fuelRemainingBarrels, machineHrsRemaining,
      fuelRunwayDays, machineRunwayDays, wcRunway,
      totalHrs, cleaningHrs, prepHrs,
      avgGperHr: totalHrs > 0 ? grossGold / totalHrs : 0,
      status, reasons,
      logCount: logs.length,
      txCount: transactions.length,
    };
  }, [inputs, logs, transactions]);

  if (!inputs) return <div className="text-sm text-stone-500">Loading inputs…</div>;
  if (!calc) return null;

  const sc = STATUS_COLORS[calc.status];

  return (
    <div className="space-y-4">
      <div className={`${sc.bg} ${sc.border} border-l-4 px-4 py-3 flex items-center gap-3`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
        <div>
          <div className={`text-xs uppercase tracking-widest font-semibold ${sc.text}`}>
            {t('status.siteStatus')}: {t(`status.${calc.status}`)}
            {calc.reasons.length > 0 && ` (${calc.reasons.join(', ')})`}
          </div>
          <div className="text-xs text-stone-600 mt-0.5">
            {t('status.lastLog')}: {calc.latestLogDate || t('status.noLogsYet')} · {calc.logCount} {t('status.logs')} · {calc.txCount} {t('status.transactions')}
          </div>
        </div>
      </div>

      <Section title={t('section.workingCapital')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200">
          <Tile label={t('tile.cashOnHand')} value={fmtETB(calc.cashOnHand)} unit="ETB" />
          <Tile label={t('tile.goldOnHand')} value={fmtNum(calc.goldOnHand, 1)} unit={t('tile.grams')}
            sub={`${fmtNum(calc.goldSold, 1)}g ${t('tile.goldSold') || 'sold'}`} />
          <Tile label={t('tile.fuelRemaining')} value={fmtNum(calc.fuelRemainingBarrels, 1)} unit={t('tile.barrels')}
            sub={calc.fuelRunwayDays !== null ? `${fmtNum(calc.fuelRunwayDays, 1)} ${t('tile.days')}` : '—'}
            alert={calc.fuelRemainingBarrels < 7} />
          <Tile label={t('tile.machineHours')} value={fmtNum(calc.machineHrsRemaining, 0)} unit={t('tile.hours')}
            sub={calc.machineRunwayDays !== null ? `${fmtNum(calc.machineRunwayDays, 1)} ${t('tile.days')}` : '—'}
            alert={calc.machineHrsRemaining < 100} />
        </div>
      </Section>

      <Section title={t('section.production')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone-200">
          <Tile label={t('tile.goldProduced')} value={fmtNum(calc.grossGold, 1)} unit={t('tile.grams')} />
          <Tile label={t('tile.netSaleable')} value={fmtNum(calc.netSaleableGold, 1)} unit={t('tile.grams')} sub={t('tile.afterLandownerShare')} />
          <Tile label={t('tile.totalHours')} value={fmtNum(calc.totalHrs, 0)} unit="hrs" sub={`Clean ${fmtNum(calc.cleaningHrs,0)} · Prep ${fmtNum(calc.prepHrs,0)}`} />
          <Tile label={t('tile.efficiency')} value={fmtNum(calc.avgGperHr, 2)} unit="g/hr" alert={calc.avgGperHr < Number(inputs.efficiency_threshold) && calc.totalHrs > 0} />
        </div>
      </Section>

      <Section title={t('section.financials')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone-200">
          <Tile label={t('tile.revenue')} value={fmtETB(calc.goldSaleRevenue)} unit="ETB" sub={t('tile.fromSales')} />
          <Tile label={t('tile.operatingCosts')} value={fmtETB(calc.totalCosts)} unit="ETB" sub={`${fmtETB(calc.costPerGram)} ETB/g`} alert={calc.costPerGram > Number(inputs.gold_price)} />
          <Tile label={t('tile.profitShare')} value={fmtETB(calc.profitSharePaid)} unit="ETB" />
          <Tile label={t('tile.netProfit')} value={fmtETB(calc.profit)} unit="ETB" alert={calc.profit < 0} />
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
  const { t } = useT();
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
          <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('daily.title')}</div>
          <div className="text-sm text-stone-600">{logs.length} {t('daily.entries')}</div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-stone-900 text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-amber-700 transition-colors"
        >
          {showForm ? t('daily.cancel') : t('daily.newLog')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-stone-200 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('daily.date')} type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <Field label={t('daily.goldProduced')} type="number" value={form.gold_g} onChange={(v) => setForm({ ...form, gold_g: v })} />
            <Field label={t('daily.cleaningHours')} type="number" value={form.cleaning_hrs} onChange={(v) => setForm({ ...form, cleaning_hrs: v })} />
            <Field label={t('daily.prepHours')} type="number" value={form.prep_hrs} onChange={(v) => setForm({ ...form, prep_hrs: v })} />
            <Field label={t('daily.fuelReceived')} type="number" value={form.fuel_received_barrels} onChange={(v) => setForm({ ...form, fuel_received_barrels: v })} />
            <Field label={t('daily.machineTopUp')} type="number" value={form.machine_hrs_topped_up} onChange={(v) => setForm({ ...form, machine_hrs_topped_up: v })} />
          </div>
          <div className="mt-3">
            <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">{t('daily.notes')}</label>
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
            {saving ? t('daily.saving') : t('daily.saveLog')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-stone-100 text-stone-600 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">{t('daily.colDate')}</th>
              <th className="px-3 py-2 text-right">{t('daily.colClean')}</th>
              <th className="px-3 py-2 text-right">{t('daily.colPrep')}</th>
              <th className="px-3 py-2 text-right">{t('daily.colGold')}</th>
              <th className="px-3 py-2 text-right">{t('daily.colFuelIn')}</th>
              <th className="px-3 py-2 text-right">{t('daily.colTopUp')}</th>
              <th className="px-3 py-2 text-left">{t('daily.colNotes')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan="7" className="px-3 py-8 text-center text-stone-400">{t('daily.noLogs')}</td></tr>
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
  const { t } = useT();
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { date: todayISO(), amount: '', type: 'expense', category: 'Fuel', paid_by: '', notes: '', gold_grams_sold: '', fuel_barrels_topped_up: '', machine_hrs_topped_up: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleTypeChange = (newType) => {
    setForm({ ...form, type: newType, category: newType === 'credit' ? 'Gold Sale' : 'Fuel', gold_grams_sold: '' });
  };

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
      gold_grams_sold: (form.type === 'credit' && form.category === 'Gold Sale' && form.gold_grams_sold)
        ? Number(form.gold_grams_sold) : null,
      fuel_barrels_topped_up: (form.type === 'expense' && form.category === 'Fuel' && form.fuel_barrels_topped_up)
        ? Number(form.fuel_barrels_topped_up) : null,
      machine_hrs_topped_up: (form.type === 'expense' && form.category === 'Machine Rental' && form.machine_hrs_topped_up)
        ? Number(form.machine_hrs_topped_up) : null,
    };
    const { error } = await supabase.from('transactions').insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setShowForm(false);
    setForm(emptyForm);
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
          <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('tx.title')}</div>
          <div className="text-sm text-stone-600">{transactions.length} {t('status.transactions')} · Expense {fmtETB(totals.exp)} · Credit {fmtETB(totals.cr)} ETB</div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-stone-900 text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-amber-700 transition-colors"
        >
          {showForm ? t('tx.cancel') : t('tx.newTx')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-stone-200 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('tx.date')} type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">{t('tx.type')}</label>
              <select
                value={form.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700"
              >
                <option value="expense">{t('tx.expenseDebit')}</option>
                <option value="credit">{t('tx.creditIncome')}</option>
              </select>
            </div>
            <Field label={t('tx.amount')} type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">{t('tx.category')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700"
              >
                {(form.type === 'credit' ? CREDIT_CATEGORIES : CATEGORIES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {form.type === 'credit' && form.category === 'Gold Sale' && (
              <Field label={t('tx.gramsSold')} type="number" value={form.gold_grams_sold}
                onChange={(v) => setForm({ ...form, gold_grams_sold: v })} />
            )}
            {form.type === 'expense' && form.category === 'Fuel' && (
              <Field label={t('tx.barrelsReceived')} type="number" value={form.fuel_barrels_topped_up}
                onChange={(v) => setForm({ ...form, fuel_barrels_topped_up: v })} />
            )}
            {form.type === 'expense' && form.category === 'Machine Rental' && (
              <Field label={t('tx.hrsAdded')} type="number" value={form.machine_hrs_topped_up}
                onChange={(v) => setForm({ ...form, machine_hrs_topped_up: v })} />
            )}
            <Field label={t('tx.paidBy')} value={form.paid_by} onChange={(v) => setForm({ ...form, paid_by: v })} />
          </div>
          <div className="mt-3">
            <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">{t('tx.notes')}</label>
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
            {saving ? t('tx.saving') : t('tx.saveTx')}
          </button>
        </div>
      )}

      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-stone-100 text-stone-600 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">{t('tx.colDate')}</th>
              <th className="px-3 py-2 text-left">{t('tx.colCategory')}</th>
              <th className="px-3 py-2 text-left">{t('tx.colType')}</th>
              <th className="px-3 py-2 text-right">{t('tx.colAmount')}</th>
              <th className="px-3 py-2 text-left">{t('tx.colPaidBy')}</th>
              <th className="px-3 py-2 text-left">{t('tx.colNotes')}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr><td colSpan="6" className="px-3 py-8 text-center text-stone-400">{t('tx.noTx')}</td></tr>
            )}
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-t border-stone-100">
                <td className="px-3 py-2 text-stone-900 font-medium">{tx.date}</td>
                <td className="px-3 py-2">
                  {tx.category}
                  {tx.category === 'Gold Sale' && tx.gold_grams_sold > 0 && (
                    <span className="ml-1 text-[10px] text-amber-700">({fmtNum(tx.gold_grams_sold, 1)}g)</span>
                  )}
                  {tx.category === 'Fuel' && tx.fuel_barrels_topped_up > 0 && (
                    <span className="ml-1 text-[10px] text-blue-700">(+{fmtNum(tx.fuel_barrels_topped_up, 0)} bbl)</span>
                  )}
                  {tx.category === 'Machine Rental' && tx.machine_hrs_topped_up > 0 && (
                    <span className="ml-1 text-[10px] text-violet-700">(+{fmtNum(tx.machine_hrs_topped_up, 0)} hrs)</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${tx.type === 'expense' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {tx.type === 'expense' ? t('tx.expense') : t('tx.credit')}
                  </span>
                </td>
                <td className={`px-3 py-2 text-right font-medium ${tx.type === 'expense' ? 'text-red-700' : 'text-emerald-700'}`}>
                  {tx.type === 'expense' ? '−' : '+'}{fmtETB(tx.amount)}
                </td>
                <td className="px-3 py-2 text-stone-500">{tx.paid_by || '—'}</td>
                <td className="px-3 py-2 text-stone-500">{tx.notes || '—'}</td>
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
  const { t } = useT();
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
      titleKey: 'inputs.pricingRoyalty',
      fields: [
        { key: 'gold_price', label: 'Gold Price', unit: 'ETB/g' },
        { key: 'royalty_rate', label: 'Royalty Rate', unit: 'decimal (0.07 = 7%)' },
        { key: 'landowner_share', label: 'Landowner Share', unit: 'decimal (0.30 = 30%)' },
      ],
    },
    {
      titleKey: 'inputs.operatingCosts',
      fields: [
        { key: 'fuel_price', label: 'Fuel Price', unit: 'ETB/L' },
        { key: 'rental_rate', label: 'Machine Rental', unit: 'ETB/hr' },
        { key: 'cleaning_fuel_rate', label: 'Cleaning Fuel Rate', unit: 'L/hr' },
        { key: 'prep_fuel_rate', label: 'Prep Fuel Rate', unit: 'L/hr' },
        { key: 'fuel_per_barrel', label: 'Litres per Barrel', unit: 'L' },
      ],
    },
    {
      titleKey: 'inputs.openingPosition',
      fields: [
        { key: 'opening_cash', label: 'Opening Cash', unit: 'ETB' },
        { key: 'machine_hrs_opening', label: 'Opening Machine Hours', unit: 'hrs' },
        { key: 'fuel_barrels_opening', label: 'Opening Fuel Stock', unit: 'barrels' },
      ],
    },
    {
      titleKey: 'inputs.alertThresholds',
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
          <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('inputs.title')}</div>
          <div className="text-sm text-stone-600">{t('inputs.subtitle')}</div>
        </div>
        {savedAt && <div className="text-[10px] text-emerald-700 uppercase tracking-widest">{t('lang.saved')} {savedAt.toLocaleTimeString()}</div>}
      </div>

      {groups.map((g) => (
        <div key={g.titleKey} className="bg-white border border-stone-200">
          <div className="bg-stone-100 px-4 py-2 text-[10px] uppercase tracking-widest text-stone-600 font-semibold">{t(g.titleKey)}</div>
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
        {saving ? t('inputs.saving') : t('inputs.saveAll')}
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
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <LocaleProvider>
        <Login onLogin={() => {}} />
      </LocaleProvider>
    );
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
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        Loading profile…
      </div>
    );
  }

  return (
    <LocaleProvider>
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
        {page === 'weekly' && <WeeklyReport inputs={inputs} logs={logs} transactions={transactions} />}
        {page === 'inputs' && profile.role === 'super_admin' && <Inputs site={site} inputs={inputs} profile={profile} onRefresh={refreshSiteData} />}
        {page === 'language' && profile.role === 'super_admin' && <TranslationsAdmin profile={profile} />}
      </Shell>
    </LocaleProvider>
  );
}
