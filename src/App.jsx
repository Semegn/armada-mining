import React, { useState, useEffect, useMemo, useContext, useCallback, useRef, createContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import logoShield from './assets/logo-shield.png';

const realSupabase = createClient(
  'https://fweibxyncvjmuxxbqhan.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3ZWlieHluY3ZqbXV4eGJxaGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1OTM5NjAsImV4cCI6MjA5NTE2OTk2MH0.JQxS7MtsZaa_Gb59ZX3Jf4q9DwDTyWfS5TC7qJryA_A'
);

const todayISO = () => new Date().toISOString().slice(0, 10);
const weekStart = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const ws = new Date(d.setDate(diff));
  return ws.toISOString().slice(0, 10);
};

const isDemoActive = () => {
  try {
    if (localStorage.getItem('armada_demo_active') === 'true') return true;
    
    // Auto-detect if user was already logged in as demo user from a previous session
    const key = 'sb-fweibxyncvjmuxxbqhan-auth-token';
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.user?.email === 'demo@armadamining.com') {
        localStorage.setItem('armada_demo_active', 'true');
        return true;
      }
    }
  } catch (_) {}
  return false;
};

class MockQueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orderByField = null;
    this.orderByAsc = true;
  }

  _load() {
    const key = `armada_demo_${this.table}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
    
    let initial = [];
    // Sample entries for the primary demo site are dated relative to today.
    const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const demoUser = 'b05f2b9a-69df-4764-bdda-e80b660808dd';
    const primarySite = 'demo-primary-site-id';
    if (this.table === 'users') {
      initial = [{ id: 'b05f2b9a-69df-4764-bdda-e80b660808dd', name: 'Demo Mode', email: 'demo@armadamining.com', role: 'site_manager' }];
    } else if (this.table === 'sites') {
      initial = [
        { id: 'demo-site-id', name: 'ARMADA Main (Demo)', location: 'Oromia Region' },
        { id: primarySite, name: 'Primary Demo', location: 'Benishangul-Gumuz Region', site_type: 'primary' },
      ];
    } else if (this.table === 'shafts') {
      initial = [
        { id: 'demo-pit-1', site_id: primarySite, logged_by: demoUser, name: 'Pit 1', kind: 'pit', opened_on: daysAgo(20), production_from: daysAgo(10), closed_on: null, notes: 'Main quartz vein, opened by excavator.' },
        { id: 'demo-pit-2', site_id: primarySite, logged_by: demoUser, name: 'Pit 2', kind: 'pit', opened_on: daysAgo(8), production_from: null, closed_on: null, notes: 'Trench across the eastern vein.' },
        { id: 'demo-shaft-1', site_id: primarySite, logged_by: demoUser, name: 'Shaft 1', kind: 'shaft', opened_on: daysAgo(25), production_from: daysAgo(3), phase_history: [{ phase: 'production', from: daysAgo(3) }], closed_on: null, notes: null, latitude: 10.0712, longitude: 34.5423 },
        { id: 'demo-shaft-2', site_id: primarySite, logged_by: demoUser, name: 'Shaft 2', kind: 'shaft', opened_on: daysAgo(12), production_from: null, closed_on: null, notes: 'Low grade so far.' },
      ];
    } else if (this.table === 'sack_counts') {
      const counts = [
        ['demo-pit-1', [[6, 30], [5, 28], [4, 32], [3, 30], [2, 26], [1, 30], [0, 24]]],
        ['demo-pit-2', [[5, 10], [3, 12], [1, 8]]],
        ['demo-shaft-1', [[6, 12], [5, 10], [4, 14], [3, 12], [2, 10], [1, 12], [0, 10]]],
        ['demo-shaft-2', [[6, 6], [4, 5], [2, 4]]],
      ];
      // Depth grows a little each day; the vein is found, lost or not reached yet.
      const depth = { 'demo-pit-1': [8, 0.6, 'found'], 'demo-pit-2': [3, 0.5, 'lost'], 'demo-shaft-1': [12, 1.2, 'found'], 'demo-shaft-2': [6, 0.8, 'not_reached'] };
      initial = counts.flatMap(([shaft_id, days]) => days.map(([n, sacks], i) => (
        { id: `demo-sacks-${shaft_id}-${n}`, site_id: primarySite, logged_by: demoUser, shaft_id, date: daysAgo(n), sacks,
          depth_m: Math.round((depth[shaft_id][0] + (i + 1) * depth[shaft_id][1]) * 10) / 10,
          vein: shaft_id === 'demo-pit-2' && i === 0 ? 'found' : depth[shaft_id][2], notes: null }
      )));
    } else if (this.table === 'shaft_samples') {
      initial = [
        { id: 'demo-sample-1', site_id: primarySite, logged_by: demoUser, shaft_id: 'demo-pit-1', date: daysAgo(4), depth_m: 10.4, sample_type: 'quartz', visible_gold: true, photo_paths: [],
          description: 'Milky white quartz, 20 cm wide, dipping east. Brown iron staining on fractures, some pyrite cubes. Two specks of visible gold.' },
        { id: 'demo-sample-2', site_id: primarySite, logged_by: demoUser, shaft_id: 'demo-pit-2', date: daysAgo(1), depth_m: 4.5, sample_type: 'stone', visible_gold: false, photo_paths: [],
          description: 'Grey schist, no quartz. Vein pinched out at about 4 m. Soft, weathered.' },
      ];
    } else if (this.table === 'milling_results') {
      const results = [
        ['demo-pit-1', [[5, 60, 27.0], [3, 58, 27.8], [1, 56, 25.2]]],
        ['demo-pit-2', [[4, 10, 4.3], [2, 8, 3.5], [0, 8, 3.6]]],
        ['demo-shaft-1', [[5, 20, 7.0], [2, 24, 9.6], [0, 22, 8.8]]],
        ['demo-shaft-2', [[4, 6, 0.9], [1, 5, 0.7]]],
      ];
      initial = results.flatMap(([shaft_id, days]) => days.map(([n, sacks_milled, gold_g]) => (
        { id: `demo-result-${shaft_id}-${n}`, site_id: primarySite, logged_by: demoUser, shaft_id, date: daysAgo(n), sacks_milled, gold_g, notes: null }
      )));
    } else if (this.table === 'excavator_logs') {
      const days = [[6, 3, 7, 1], [5, 2, 8, 0], [4, 4, 6, 1], [3, 2, 8, 1], [2, 3, 7, 0], [1, 1, 9, 1], [0, 2, 6, 1]];
      initial = days.map(([n, exploration_hrs, production_hrs, idle_hrs]) => (
        { id: `demo-excavator-${n}`, site_id: primarySite, logged_by: demoUser, date: daysAgo(n), exploration_hrs, production_hrs, idle_hrs, excavator_fuel_barrels: 2, mill_fuel_barrels: 1, notes: null }
      ));
    } else if (this.table === 'inputs') {
      initial = [{
        id: 'demo-inputs-id',
        site_id: 'demo-site-id',
        gold_price: 8200,
        fuel_price: 130,
        rental_rate: 15000,
        royalty_rate: 0.07,
        landowner_share: 0.30,
        target_cash_reserve: 500000,
        efficiency_threshold: 2,
        opening_cash: 1200000,
        machine_hrs_opening: 450,
        fuel_barrels_opening: 60,
        fuel_per_barrel: 200,
        cleaning_fuel_rate: 25,
        prep_fuel_rate: 20
      }, {
        id: 'demo-primary-inputs-id',
        site_id: primarySite,
        gold_price: 8200,
        fuel_price: 0,
        rental_rate: 0,
        royalty_rate: 0.07,
        landowner_share: 0.30,
        target_cash_reserve: 200000,
        efficiency_threshold: 0,
        opening_cash: 600000,
        machine_hrs_opening: 40,
        fuel_barrels_opening: 12,
        fuel_per_barrel: 200,
        cleaning_fuel_rate: 0,
        prep_fuel_rate: 0,
        sack_kg: 25,
        cutoff_g_per_sack: 0.4,
        excavator_on: true
      }];
    } else if (this.table === 'daily_logs') {
      initial = [
        { id: 'log-1', site_id: 'demo-site-id', logged_by: 'b05f2b9a-69df-4764-bdda-e80b660808dd', date: todayISO(), cleaning_hrs: 6, prep_hrs: 3, idle_hrs: 1, gold_g: 38.5, fuel_received_barrels: 2, notes: "Normal shift. Good gold concentration in the north wash plant." },
        { id: 'log-2', site_id: 'demo-site-id', logged_by: 'b05f2b9a-69df-4764-bdda-e80b660808dd', date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), cleaning_hrs: 7, prep_hrs: 2, idle_hrs: 0, gold_g: 42.1, fuel_received_barrels: 2, notes: "Excavator routine service done." },
        { id: 'log-3', site_id: 'demo-site-id', logged_by: 'b05f2b9a-69df-4764-bdda-e80b660808dd', date: new Date(Date.now() - 172800000).toISOString().slice(0, 10), cleaning_hrs: 5, prep_hrs: 4, idle_hrs: 2, gold_g: 29.8, fuel_received_barrels: 1, notes: "Minor clay blockage in screen box. Idle time due to belt adjustment." },
        { id: 'log-4', site_id: 'demo-site-id', logged_by: 'b05f2b9a-69df-4764-bdda-e80b660808dd', date: new Date(Date.now() - 259200000).toISOString().slice(0, 10), cleaning_hrs: 8, prep_hrs: 1, idle_hrs: 0, gold_g: 45.0, fuel_received_barrels: 2, notes: "Excellent recovery day. Crew working very efficiently." },
        { id: 'log-5', site_id: 'demo-site-id', logged_by: 'b05f2b9a-69df-4764-bdda-e80b660808dd', date: new Date(Date.now() - 345600000).toISOString().slice(0, 10), cleaning_hrs: 6, prep_hrs: 2, idle_hrs: 1, gold_g: 34.2, fuel_received_barrels: 2, notes: "Rain in the evening but did not affect cleaning." }
      ];
    } else if (this.table === 'transactions') {
      initial = [
        { id: 'tx-1', site_id: 'demo-site-id', entered_by: 'b05f2b9a-69df-4764-bdda-e80b660808dd', date: todayISO(), week_start: weekStart(todayISO()), amount: 85000, type: "expense", category: "Crew Salaries", paid_by: "Armada", notes: "Weekly crew wages for Site A team." },
        { id: 'tx-2', site_id: 'demo-site-id', entered_by: 'b05f2b9a-69df-4764-bdda-e80b660808dd', date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), week_start: weekStart(new Date(Date.now() - 86400000).toISOString().slice(0, 10)), amount: 130000, type: "expense", category: "Fuel", paid_by: "Armada", notes: "Fuel delivery payment (5 barrels received).", fuel_barrels_topped_up: 5 },
        { id: 'tx-3', site_id: 'demo-site-id', entered_by: 'b05f2b9a-69df-4764-bdda-e80b660808dd', date: new Date(Date.now() - 172800000).toISOString().slice(0, 10), week_start: weekStart(new Date(Date.now() - 172800000).toISOString().slice(0, 10)), amount: 482000, type: "credit", category: "Gold Sale", paid_by: "Partner B", notes: "Sold 60 grams of gold.", gold_grams_sold: 60 },
        { id: 'tx-4', site_id: 'demo-site-id', entered_by: 'b05f2b9a-69df-4764-bdda-e80b660808dd', date: new Date(Date.now() - 259200000).toISOString().slice(0, 10), week_start: weekStart(new Date(Date.now() - 259200000).toISOString().slice(0, 10)), amount: 45000, type: "expense", category: "Maintenance", paid_by: "Armada", notes: "Excavator hydraulic hose replacement and oil top-up." },
        { id: 'tx-5', site_id: 'demo-site-id', entered_by: 'b05f2b9a-69df-4764-bdda-e80b660808dd', date: new Date(Date.now() - 345600000).toISOString().slice(0, 10), week_start: weekStart(new Date(Date.now() - 345600000).toISOString().slice(0, 10)), amount: 300000, type: "expense", category: "Machine Rental", paid_by: "Armada", notes: "Topped up 20 hours of contracted machine time.", machine_hrs_topped_up: 20 },
        ...[
          [6, 93000, 'expense', 'Fuel', 'Fuel delivery (15 barrels) for the excavator and the mill.', { fuel_barrels_topped_up: 15 }],
          [6, 150000, 'expense', 'Machine Rental', 'Excavator: 100 hours.', { machine_hrs_topped_up: 100 }],
          [3, 18500, 'expense', 'Mill Parts & Maintenance', 'Hammer mill screen and bearings.', {}],
          [2, 24000, 'expense', 'Accommodation & Food', 'Crew food for the week.', {}],
          [1, 492000, 'credit', 'Gold Sale', 'Sold 60 grams of gold.', { gold_grams_sold: 60 }],
          [0, 72000, 'expense', 'Labour (Diggers & Haulers)', 'Weekly wages, diggers and haulers.', {}],
        ].map(([n, amount, type, category, notes, extra]) => (
          { id: `demo-primary-tx-${n}-${category}`, site_id: primarySite, entered_by: demoUser, date: daysAgo(n), week_start: weekStart(daysAgo(n)), amount, type, category, paid_by: 'Armada', notes, ...extra }
        )),
      ];
    }
    
    try {
      localStorage.setItem(key, JSON.stringify(initial));
    } catch (_) {}
    return initial;
  }

  _save(data) {
    const key = `armada_demo_${this.table}`;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (_) {}
  }

  select(fields) {
    return this;
  }

  eq(field, val) {
    this.filters.push((row) => row[field] === val);
    return this;
  }

  order(field, options = {}) {
    this.orderByField = field;
    this.orderByAsc = options.ascending !== false;
    return this;
  }

  maybeSingle() {
    return this.then((res) => {
      return { data: res.data ? res.data[0] || null : null, error: res.error };
    });
  }

  single() {
    return this.then((res) => {
      return { data: res.data ? res.data[0] || null : null, error: res.error };
    });
  }

  async insert(payload) {
    const items = this._load();
    const rows = Array.isArray(payload) ? payload : [payload];
    const newRows = rows.map((r, i) => {
      return {
        id: `demo-${this.table}-${Date.now()}-${i}`,
        created_at: new Date().toISOString(),
        ...r
      };
    });
    items.push(...newRows);
    this._save(items);
    return { data: Array.isArray(payload) ? newRows : newRows[0], error: null };
  }

  async upsert(payload, options = {}) {
    const items = this._load();
    const rows = Array.isArray(payload) ? payload : [payload];
    
    let conflictCols = [];
    if (options.onConflict) {
      conflictCols = options.onConflict.split(',');
    }
    
    const updatedRows = [];
    for (const r of rows) {
      let idx = -1;
      if (conflictCols.length > 0) {
        idx = items.findIndex(item => conflictCols.every(col => String(item[col]) === String(r[col])));
      }
      
      const newRow = {
        id: idx >= 0 ? items[idx].id : `demo-${this.table}-${Date.now()}`,
        created_at: idx >= 0 ? items[idx].created_at : new Date().toISOString(),
        ...r
      };
      
      if (idx >= 0) {
        items[idx] = newRow;
      } else {
        items.push(newRow);
      }
      updatedRows.push(newRow);
    }
    
    this._save(items);
    return { data: Array.isArray(payload) ? updatedRows : updatedRows[0], error: null };
  }

  // Like supabase-js, update() and delete() run when awaited, after the .eq() filters are added.
  update(payload) {
    this.pendingUpdate = payload;
    return this;
  }

  delete() {
    this.pendingDelete = true;
    return this;
  }

  _applyMutation() {
    const items = this._load();
    const changed = [];
    const next = [];
    for (const item of items) {
      if (!this.filters.every(f => f(item))) { next.push(item); continue; }
      if (this.pendingDelete) { changed.push(item); continue; }
      const u = { ...item, ...this.pendingUpdate };
      changed.push(u);
      next.push(u);
    }
    this._save(next);
    return { data: changed, error: null };
  }

  then(onfulfilled) {
    if (this.pendingUpdate || this.pendingDelete) {
      return Promise.resolve(this._applyMutation()).then(onfulfilled);
    }
    let items = this._load();
    
    if (this.filters.length > 0) {
      items = items.filter(item => this.filters.every(f => f(item)));
    }
    
    if (this.orderByField) {
      items.sort((a, b) => {
        const valA = a[this.orderByField];
        const valB = b[this.orderByField];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        
        let cmp = 0;
        if (typeof valA === 'string') {
          cmp = valA.localeCompare(valB);
        } else {
          cmp = valA - valB;
        }
        return this.orderByAsc ? cmp : -cmp;
      });
    }
    
    return Promise.resolve({ data: items, error: null }).then(onfulfilled);
  }
}

const authListeners = new Set();

const supabase = {
  ...realSupabase,
  
  auth: {
    ...realSupabase.auth,
    
    async getSession() {
      if (isDemoActive()) {
        const mockDemoUser = {
          id: 'b05f2b9a-69df-4764-bdda-e80b660808dd',
          email: 'demo@armadamining.com',
          user_metadata: {},
          app_metadata: {}
        };
        const mockDemoSession = {
          access_token: 'mock-demo-token',
          user: mockDemoUser
        };
        return { data: { session: mockDemoSession }, error: null };
      }
      return realSupabase.auth.getSession();
    },
    
    onAuthStateChange(callback) {
      authListeners.add(callback);
      if (isDemoActive()) {
        const mockDemoUser = {
          id: 'b05f2b9a-69df-4764-bdda-e80b660808dd',
          email: 'demo@armadamining.com',
          user_metadata: {},
          app_metadata: {}
        };
        const mockDemoSession = {
          access_token: 'mock-demo-token',
          user: mockDemoUser
        };
        setTimeout(() => callback('SIGNED_IN', mockDemoSession), 0);
      }
      
      const res = realSupabase.auth.onAuthStateChange((event, sess) => {
        if (!isDemoActive()) {
          callback(event, sess);
        }
      });
      
      return {
        data: {
          subscription: {
            unsubscribe() {
              res.data?.subscription?.unsubscribe();
              authListeners.delete(callback);
            }
          }
        }
      };
    },
    
    async signInWithPassword(credentials) {
      if (credentials.email === 'demo@armadamining.com') {
        localStorage.setItem('armada_demo_active', 'true');
        const mockDemoUser = {
          id: 'b05f2b9a-69df-4764-bdda-e80b660808dd',
          email: 'demo@armadamining.com',
          user_metadata: {},
          app_metadata: {}
        };
        const mockDemoSession = {
          access_token: 'mock-demo-token',
          user: mockDemoUser
        };
        authListeners.forEach(listener => listener('SIGNED_IN', mockDemoSession));
        return { data: { user: mockDemoUser, session: mockDemoSession }, error: null };
      }
      
      localStorage.setItem('armada_demo_active', 'false');
      return realSupabase.auth.signInWithPassword(credentials);
    },
    
    async signOut() {
      if (isDemoActive()) {
        localStorage.setItem('armada_demo_active', 'false');
        authListeners.forEach(listener => listener('SIGNED_OUT', null));
        return { error: null };
      }
      return realSupabase.auth.signOut();
    }
  },
  
  from(table) {
    if (isDemoActive()) {
      return new MockQueryBuilder(table);
    }
    return realSupabase.from(table);
  }
};

const fmtETB = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
};
const fmtNum = (n, d = 1) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
};
// Fuel is counted in whole barrels; show a decimal only when part-barrels were entered.
const fmtBarrels = (n) => {
  const tenths = Math.round(Number(n) * 10) / 10;
  return fmtNum(n, Number.isInteger(tenths) ? 0 : 1);
};

const CATEGORIES = [
  'Fuel', 'Machine Rental', 'Crew Salaries', 'Accommodation & Food',
  'Vehicle / Site Support', 'Transport', 'Maintenance',
  'Government', 'Royalty', 'Commission', 'Medical',
  'Utilities', 'Asset Purchase', 'Loan Return',
  'Other', 'Profit Share',
];

const CREDIT_CATEGORIES = ['Gold Sale', 'Loan', 'Investment', 'Other Income'];

// Primary (hard-rock) sites: gold comes from pits and shafts, in sacks, through our own mill.
// Sites without a type are alluvial, so nothing changes for them.
const isPrimarySite = (site) => site?.site_type === 'primary';

const PRIMARY_CATEGORIES = [
  'Labour (Diggers & Haulers)', 'Mill Fuel', 'Mill Parts & Maintenance', 'Mill Operators',
  'Sacks & Tools', 'Timber & Shaft Support', 'Accommodation & Food', 'Transport', 'Water',
  'Security', 'Government', 'Royalty', 'Medical', 'Asset Purchase', 'Loan Return',
  'Other', 'Profit Share',
];
// With the excavator on, all fuel is bought as Fuel (one stock for the excavator and the mill)
// and machine hours as Machine Rental, the same categories the alluvial sites use.
const primaryCategories = (excavatorOn) => (excavatorOn
  ? ['Fuel', 'Machine Rental', ...PRIMARY_CATEGORIES.filter((c) => c !== 'Mill Fuel')]
  : PRIMARY_CATEGORIES);

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
  'daily.prepHours': 'Prep Hours', 'daily.idleHours': 'Idle Hours (charged)',
  'daily.fuelReceived': 'Fuel Used (barrels)', 'daily.notes': 'Notes',
  'daily.saveLog': 'Save Log', 'daily.saving': 'Saving…', 'daily.noLogs': 'No logs yet',
  'daily.colDate': 'Date', 'daily.colClean': 'Clean hrs', 'daily.colPrep': 'Prep hrs',
  'daily.colIdle': 'Idle hrs', 'daily.colTotal': 'Total hrs',
  'daily.colGold': 'Gold (g)', 'daily.colFuelIn': 'Fuel Used', 'daily.colNotes': 'Notes',
  'daily.editing': 'Editing log for', 'daily.dateTaken': 'Another log already exists for this date.',
  'daily.confirmDelete': 'Delete this daily log? The change history keeps a record of it.',
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
  'tx.noBarrelsConfirm': "No barrels entered, so this fuel won't be added to the fuel stock. Save anyway?",
  'tx.editing': 'Editing entry from', 'tx.confirmDelete': 'Delete this statement entry? The change history keeps a record of it.',
  // Editing
  'edit.edit': 'Edit', 'edit.saveChanges': 'Save Changes', 'edit.delete': 'Delete',
  'edit.notSaved': 'Nothing was changed. You may not be allowed to change this entry, or it no longer exists.',
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
  // Change history
  'nav.history': 'History',
  'hist.title': 'Change History', 'hist.subtitle': 'Every added, changed or deleted record at this site. Read-only.',
  'hist.loading': 'Loading history…', 'hist.empty': 'No changes recorded yet.', 'hist.error': 'Could not load history:',
  'hist.showOlder': 'Show older changes',
  'hist.demoNote': 'History is not recorded in Demo Mode. In the live app, every added, changed or deleted record at a site appears here.',
  'hist.added': 'Added', 'hist.changed': 'Changed', 'hist.deleted': 'Deleted',
  'hist.dailyLog': 'Daily log', 'hist.transaction': 'Transaction', 'hist.inputs': 'Inputs',
  'hist.by': 'by', 'hist.system': 'Supabase (outside the app)', 'hist.unknownUser': 'Unknown user',
  'hist.noFieldChanges': 'Saved with no visible changes',
  'hist.f.gold_price': 'Gold Price', 'hist.f.fuel_price': 'Fuel Price', 'hist.f.rental_rate': 'Machine Rental',
  'hist.f.royalty_rate': 'Royalty Rate', 'hist.f.landowner_share': 'Landowner Share',
  'hist.f.target_cash_reserve': 'Target Cash Reserve', 'hist.f.efficiency_threshold': 'Efficiency Threshold',
  'hist.f.opening_cash': 'Opening Cash', 'hist.f.machine_hrs_opening': 'Opening Machine Hours',
  'hist.f.fuel_barrels_opening': 'Opening Fuel Stock', 'hist.f.fuel_per_barrel': 'Litres per Barrel',
  'hist.f.cleaning_fuel_rate': 'Cleaning Fuel Rate', 'hist.f.prep_fuel_rate': 'Prep Fuel Rate',
  // Telegram reports
  'tg.title': 'Telegram Reports',
  'tg.subtitle': "Each day's report is posted to this site's Telegram channel 30 minutes after that day's log is saved. If a day still has no log by 9 am the next morning (Ethiopia time), a report saying the log is missing is posted. A weekly summary follows on Sundays at 8 pm. If a day that was already posted is corrected later, its report is updated and a correction notice is posted.",
  'tg.sendPast': 'Send past reports', 'tg.posting': 'Posting…',
  'tg.confirmPast': 'Post all past reports to the channel? It takes a few seconds per report. Keep this page open until it finishes.',
  'tg.pastProgress': 'Posting past reports…', 'tg.pastDone': 'All past reports are posted.',
  'tg.pastStuck': 'Posting stopped. Press Send past reports again to continue.',
  'tg.connected': 'Posting to:', 'tg.notConnected': 'No channel connected yet.',
  'tg.find': 'Find channels', 'tg.finding': 'Looking…', 'tg.connect': 'Connect',
  'tg.noneFound': 'No channels found. Make sure the bot is an admin of the channel, post any message in the channel, then press Find channels again.',
  'tg.sendTest': 'Send test report', 'tg.sending': 'Sending…', 'tg.testSent': 'Test report sent. Check the channel.',
  'tg.disconnect': 'Disconnect', 'tg.confirmDisconnect': 'Stop posting reports for this site?',
  'tg.saved': 'Channel connected.', 'tg.removed': 'Channel disconnected. No more reports will be posted for this site.',
  'tg.help': 'Before connecting, add the bot to a private channel as an admin that can post messages. Keep the channel private: reports include cash and gold figures.',
  'tg.demoNote': 'Telegram reports are not available in Demo Mode.',
  'tg.outdated': 'The Telegram bot in Supabase is missing or out of date, so some buttons and reports may not work. Paste the latest bot file into Supabase (Edge Functions → telegram-reports) and deploy it again.',
  'tg.openBotFile': 'Open the latest bot file',
  // Primary sites (pits & shafts, sacks, milling, excavator)
  'nav.shafts': 'Site Setup', 'nav.sacks': 'Daily Entry', 'nav.results': 'Results', 'nav.excavator': 'Excavator',
  'site.type': 'Site Type', 'site.alluvial': 'Alluvial — excavator, washing, fuel',
  'site.primary': 'Primary — pits & shafts, sacks, mill', 'site.primaryTag': 'Primary',
  'phase.exploration': 'Exploration', 'phase.production': 'Production',
  'primary.lastEntry': 'Last entry', 'primary.noEntriesYet': 'No entries yet', 'primary.pitsShafts': 'pits & shafts',
  'tile.landowner': 'Landowner', 'tile.investors': 'Investors', 'tile.avgGrade': 'Average Grade',
  'tile.sacksWaiting': 'Sacks Waiting',
  'tile.sacks': 'sacks', 'tile.idle': 'Idle',
  'shafts.title': 'Site Setup — Pits & Shafts', 'shafts.new': '+ New Pit or Shaft', 'common.cancel': 'Cancel',
  'shafts.name': 'Name', 'shafts.kind': 'Type', 'shafts.pit': 'Pit (excavator)', 'shafts.shaft': 'Shaft (hand-dug)',
  'shafts.pitShort': 'Excavator', 'shafts.shaftShort': 'Hand-dug',
  'shafts.openedOn': 'Opened On', 'shafts.productionFrom': 'Production From', 'shafts.closedOn': 'Closed On',
  'shafts.formHint': 'GPS is required: stand at the pit and press Use my location. Leave Start Production empty to start in exploration. The map link is optional.',
  'shafts.editHint': 'Switch between exploration and production with the buttons on the card. Leave Closed On empty while it is open.',
  'shafts.startProduction': 'Start Production From (optional)', 'shafts.latitude': 'Latitude',
  'shafts.longitude': 'Longitude', 'shafts.mapLink': 'Map Link (paste from Google Maps)',
  'shafts.badCoords': 'Latitude must be between −90 and 90, longitude between −180 and 180.',
  'shafts.gpsRequired': 'GPS position is required: enter latitude and longitude, or press Use my location at the pit.',
  'shafts.useLocation': 'Use my location', 'shafts.locating': 'Finding location…',
  'shafts.locationFailed': 'Could not get the phone location. Allow location for this app, or type the numbers.',
  'shafts.gpsMissing': 'GPS missing — add it with Edit',
  'dash.money': 'Finance', 'dash.geology': 'Geology', 'dash.produced': 'produced',
  'dash.explShort': 'Expl', 'dash.prodShort': 'Prod',
  'shafts.openMap': 'Open in map', 'shafts.depth': 'Depth', 'shafts.veinLostFor': 'Vein lost for', 'shafts.since': 'since',
  'shafts.from': 'from', 'shafts.backDate': 'Back to exploration from', 'shafts.backToExploration': 'Back to Exploration',
  'shafts.phaseHistory': 'Phase changes',
  'vein.found': 'Vein found', 'vein.lost': 'Vein lost', 'vein.not_reached': 'Not reached',
  'sacks.depth': 'Depth Reached (m)', 'sacks.vein': 'Vein', 'sacks.notEntered': 'not entered',
  'sacks.lastDepth': 'Last depth:', 'sacks.saveFor': 'Save', 'sacks.colDepth': 'Depth m', 'sacks.colVein': 'Vein',
  'samples.title': 'Samples', 'samples.editing': 'Editing sample from', 'samples.date': 'Date', 'samples.depth': 'Depth (m)',
  'samples.type': 'Type', 'samples.quartz': 'Quartz', 'samples.stone': 'Stone', 'samples.other': 'Other',
  'samples.visibleGold': 'Visible gold', 'samples.description': 'What you see',
  'samples.descriptionHint': 'Colour, texture, vein width and direction, sulphides (pyrite), iron staining, visible gold…',
  'samples.photos': 'Photos', 'samples.demoNoPhotos': 'Photos can not be added in Demo Mode.',
  'samples.save': 'Save Sample', 'samples.saving': 'Saving…', 'samples.none': 'No samples yet.',
  'samples.needDescription': 'Describe what you see.', 'samples.badDepth': 'Depth must be 0 or more.',
  'samples.photoFailed': 'A photo could not be uploaded, so nothing was saved.',
  'samples.confirmDelete': 'Delete this sample and its photos? The change history keeps a record of it.',
  'section.crossSection': 'Cross-section', 'section.noDepth': 'No depths entered yet. Enter Depth Reached in the Daily Entry.',
  'section.resultsLegend': 'milling result (g/sack)', 'section.beforeEntries': 'dug before the first entry', 'section.samplesLegend': 'sample',
  'chart.pitComparison': 'Pit Comparison (g per sack)', 'chart.cutoff': 'cut-off', 'chart.depthGrade': 'Depth vs Grade',
  'chart.noDepthResults': 'No results with a known depth yet for this pit or shaft.',
  'hist.sample': 'Sample',
  'shafts.notes': 'Notes',
  'shafts.save': 'Save', 'shafts.saving': 'Saving…', 'shafts.editing': 'Editing',
  'shafts.none': 'No pits or shafts yet. Add the first one to start counting sacks.',
  'shafts.productionSince': 'Production since', 'shafts.closed': 'Closed',
  'shafts.dug': 'Dug', 'shafts.milled': 'milled', 'shafts.waiting': 'waiting', 'shafts.gold': 'Gold',
  'shafts.readyTitle': 'Ready for production?', 'shafts.readyAvg': 'The last 3 results average',
  'shafts.readyCutoff': 'The cut-off is',
  'shafts.switch': 'Switch to Production', 'shafts.close': 'Close', 'shafts.confirm': 'Confirm',
  'shafts.switchDate': 'Production from', 'shafts.closeDate': 'Closed on',
  'shafts.nameRequired': 'Enter a name.', 'shafts.nameTaken': 'A pit or shaft with this name already exists at this site.',
  'shafts.hasData': "This pit or shaft has sacks or results, so it can't be deleted. Close it instead.",
  'shafts.confirmDelete': 'Delete this pit or shaft? The change history keeps a record of it.',
  'sacks.title': 'Daily Entry', 'sacks.subtitle': 'Tap a pit or shaft, enter its day, save. Then the next one.', 'sacks.entries': 'entries', 'sacks.date': 'Date',
  'sacks.perShaft': 'Sacks dug, per pit or shaft', 'sacks.notes': 'Notes',
  'sacks.save': 'Save Counts', 'sacks.saving': 'Saving…',
  'sacks.noShafts': 'Add a pit or shaft first, on the Pits & Shafts tab.',
  'sacks.noneOpen': 'No pits or shafts are open on this date.',
  'sacks.closedHidden': 'Closed pits and shafts are not listed.',
  'sacks.enterOne': 'Enter at least one count.', 'sacks.whole': 'Enter sacks as whole numbers.',
  'sacks.editPositive': 'Enter a whole number of sacks, more than 0.',
  'sacks.confirmSecond': 'These already have a count for this date:', 'sacks.addAnyway': 'Add these sacks as well?',
  'sacks.editing': 'Editing count from', 'sacks.shaft': 'Pit / Shaft', 'sacks.sacks': 'Sacks',
  'sacks.confirmDelete': 'Delete this sack count? The change history keeps a record of it.',
  'sacks.colDate': 'Date', 'sacks.colShaft': 'Pit / Shaft', 'sacks.colSacks': 'Sacks', 'sacks.colNotes': 'Notes',
  'sacks.none': 'No sack counts yet',
  'results.title': 'Milling Results', 'results.entries': 'results', 'results.date': 'Date',
  'results.shaft': 'Pit / Shaft', 'results.choose': 'Choose…', 'results.waiting': 'waiting',
  'results.sacksMilled': 'Sacks Milled', 'results.gold': 'Gold (g)', 'results.notes': 'Notes',
  'results.perSack': 'g per sack', 'results.save': 'Save Result', 'results.saving': 'Saving…',
  'results.chooseShaft': 'Choose a pit or shaft.',
  'results.enterSacks': 'Enter the number of sacks milled, as a whole number.',
  'results.enterGold': 'Enter the grams of gold, 0 or more.',
  'results.moreThanWaiting': 'That is more sacks than are waiting from this pit or shaft', 'results.saveAnyway': 'Save anyway?',
  'results.editing': 'Editing result from',
  'results.confirmDelete': 'Delete this milling result? The change history keeps a record of it.',
  'results.colDate': 'Date', 'results.colShaft': 'Pit / Shaft', 'results.colSacks': 'Sacks',
  'results.colGold': 'Gold (g)', 'results.colGps': 'g/sack', 'results.colPhase': 'Phase', 'results.colNotes': 'Notes',
  'results.none': 'No results yet',
  'exc.title': 'Excavator', 'exc.entries': 'days', 'exc.date': 'Date',
  'exc.exploration': 'Exploration Hours', 'exc.production': 'Production Hours', 'exc.idle': 'Idle Hours (charged)',
  'exc.fuelExcavator': 'Fuel Used by Excavator (barrels)', 'exc.fuelMill': 'Fuel Used by Mill (barrels)', 'exc.notes': 'Notes',
  'exc.save': 'Save Day', 'exc.saving': 'Saving…',
  'exc.hoursToday': 'hours', 'exc.hoursLeft': 'machine hours left', 'exc.barrelsToday': 'barrels', 'exc.fuelLeft': 'fuel left',
  'exc.enterSomething': 'Enter hours or fuel for the day.', 'exc.noNegative': "Numbers can't be negative.",
  'exc.dateTaken': 'There is already an entry for this date. Add another one?',
  'exc.editing': 'Editing day', 'exc.confirmDelete': 'Delete this excavator day? The change history keeps a record of it.',
  'exc.colDate': 'Date', 'exc.colExpl': 'Expl hrs', 'exc.colProd': 'Prod hrs', 'exc.colIdle': 'Idle hrs',
  'exc.colTotal': 'Total hrs', 'exc.colFuelExc': 'Fuel exc.', 'exc.colFuelMill': 'Fuel mill', 'exc.colNotes': 'Notes',
  'exc.none': 'No excavator days yet',
  'inputs.primaryMining': 'Primary Mining', 'inputs.sackKg': 'Sack Weight', 'inputs.cutoff': 'Production Cut-off',
  'inputs.sackKgPositive': 'Sack weight must be more than 0 kg.',
  'inputs.excavatorOn': 'Excavator on this site',
  'inputs.excavatorHelp': 'Shows the Excavator tab, fuel and machine hours left, and the Fuel and Machine Rental expense types.',
  'hist.shaft': 'Pit or shaft', 'hist.sackCount': 'Sack count', 'hist.millingResult': 'Milling result',
  'hist.excavatorDay': 'Excavator day',
  'hist.f.sack_kg': 'Sack Weight', 'hist.f.cutoff_g_per_sack': 'Production Cut-off', 'hist.f.excavator_on': 'Excavator on this site',
  'common.yes': 'Yes', 'common.no': 'No',
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

  const handleDemoLogin = async () => {
    setError(''); setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: 'demo@armadamining.com', password: 'password123' });
    setLoading(false);
    if (error) setError('Demo account not configured. Admin: Create demo@armadamining.com / password123 in Supabase.');
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

          <div className="mt-6 mb-4 flex items-center">
            <div className="flex-1 border-t border-stone-200"></div>
            <div className="px-3 text-[10px] text-stone-400 uppercase tracking-widest">or</div>
            <div className="flex-1 border-t border-stone-200"></div>
          </div>

          <button onClick={handleDemoLogin} disabled={loading}
            className="w-full bg-white text-stone-700 border border-stone-300 py-2.5 text-xs uppercase tracking-widest hover:bg-stone-50 disabled:bg-stone-100 transition-colors">
            {loading ? 'Entering Demo…' : 'Try Demo Mode'}
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
function Shell({ user, profile, site, sites, onSwitchSite, page, setPage, onLogout, excavatorOn, children }) {
  const { t, locale, setLocale } = useT();

  const tabs = [
    { id: 'dashboard', label: t('nav.dashboard') },
    { id: 'daily', label: t('nav.daily') },
    { id: 'transactions', label: t('nav.statement') },
    { id: 'weekly', label: t('nav.weekly') },
    { id: 'history', label: t('nav.history') },
    ...(profile?.role === 'super_admin' ? [
      { id: 'inputs', label: t('nav.inputs') },
      { id: 'language', label: t('nav.language') },
    ] : []),
  ];
  // Primary sites swap Daily Logs and Weekly for their own tabs; the rest stay the same.
  const siteTabs = !isPrimarySite(site) ? tabs : [
    tabs[0],
    { id: 'sacks', label: t('nav.sacks') },
    { id: 'results', label: t('nav.results') },
    ...(excavatorOn ? [{ id: 'excavator', label: t('nav.excavator') }] : []),
    ...tabs.filter((tab) => ['transactions', 'history'].includes(tab.id)),
    { id: 'shafts', label: t('nav.shafts') },
    ...tabs.filter((tab) => ['inputs', 'language'].includes(tab.id)),
  ];

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Demo Mode Banner */}
      {isDemoActive() && (
        <div className="bg-amber-700 text-stone-100 text-[11px] font-semibold tracking-widest uppercase flex items-center justify-between px-4 py-1.5 border-b border-amber-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
            <span>Demo Mode Sandbox (Role: Site Manager)</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => {
              if (window.confirm("Reset all demo data (logs, transactions) back to initial snapshot?")) {
                localStorage.removeItem('armada_demo_daily_logs');
                localStorage.removeItem('armada_demo_transactions');
                localStorage.removeItem('armada_demo_inputs');
                ['sites', 'shafts', 'sack_counts', 'milling_results', 'excavator_logs', 'shaft_samples']
                  .forEach((table) => localStorage.removeItem(`armada_demo_${table}`));
                window.location.reload();
              }
            }} className="underline bg-amber-800 hover:bg-amber-900 border border-amber-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold transition-colors">
              Reset Data
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-stone-900 text-stone-100 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoShield} alt="" className="w-7 h-7" />
            <div className="text-sm tracking-widest uppercase font-semibold">{t('brand.name')}</div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {(profile?.role === 'super_admin' || sites.length > 1) && (
              <button onClick={onSwitchSite}
                className="bg-stone-800 border border-stone-600 px-3 py-1 text-stone-200 hover:bg-amber-700 hover:border-amber-700 hover:text-white transition-colors uppercase tracking-widest text-[10px]">
                ⇆ Sites
              </button>
            )}
            <select value={locale} onChange={(e) => setLocale(e.target.value)}
              className="bg-stone-800 border border-stone-700 px-2 py-1 text-stone-100 text-xs">
              {SUPPORTED_LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
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
            {site?.location && <div className="text-xs text-stone-500">{site.location}</div>}
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {siteTabs.map((tab) => (
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
                <Tile label={t('tile.fuelRemaining')} value={fmtBarrels(snap.fuelRemainingBarrels)} unit={t('tile.barrels')}
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
// CHANGE HISTORY (read-only, every role)
// ============================================================
const HISTORY_PAGE_SIZE = 50;

// Fields shown per table, in display order, with their translation keys.
const HISTORY_FIELDS = {
  daily_logs: [
    ['date', 'daily.date'], ['gold_g', 'daily.goldProduced'], ['cleaning_hrs', 'daily.cleaningHours'],
    ['prep_hrs', 'daily.prepHours'], ['idle_hrs', 'daily.idleHours'],
    ['fuel_received_barrels', 'daily.fuelReceived'], ['notes', 'daily.notes'],
  ],
  transactions: [
    ['date', 'tx.date'], ['type', 'tx.type'], ['category', 'tx.category'], ['amount', 'tx.amount'],
    ['gold_grams_sold', 'tx.gramsSold'], ['fuel_barrels_topped_up', 'tx.barrelsReceived'],
    ['machine_hrs_topped_up', 'tx.hrsAdded'], ['paid_by', 'tx.paidBy'], ['notes', 'tx.notes'],
  ],
  inputs: [
    'gold_price', 'fuel_price', 'rental_rate', 'royalty_rate', 'landowner_share',
    'target_cash_reserve', 'efficiency_threshold', 'opening_cash', 'machine_hrs_opening',
    'fuel_barrels_opening', 'fuel_per_barrel', 'cleaning_fuel_rate', 'prep_fuel_rate',
    'sack_kg', 'cutoff_g_per_sack', 'excavator_on',
  ].map((key) => [key, `hist.f.${key}`]),
  shafts: [
    ['name', 'shafts.name'], ['kind', 'shafts.kind'], ['opened_on', 'shafts.openedOn'],
    ['production_from', 'shafts.productionFrom'], ['phase_history', 'shafts.phaseHistory'], ['closed_on', 'shafts.closedOn'],
    ['latitude', 'shafts.latitude'], ['longitude', 'shafts.longitude'], ['map_link', 'shafts.mapLink'], ['notes', 'shafts.notes'],
  ],
  sack_counts: [
    ['date', 'sacks.date'], ['shaft_id', 'sacks.shaft'], ['sacks', 'sacks.sacks'], ['depth_m', 'sacks.depth'],
    ['vein', 'sacks.vein'], ['notes', 'sacks.notes'],
  ],
  shaft_samples: [
    ['date', 'samples.date'], ['shaft_id', 'sacks.shaft'], ['depth_m', 'samples.depth'], ['sample_type', 'samples.type'],
    ['visible_gold', 'samples.visibleGold'], ['description', 'samples.description'], ['photo_paths', 'samples.photos'],
  ],
  milling_results: [
    ['date', 'results.date'], ['shaft_id', 'results.shaft'], ['sacks_milled', 'results.sacksMilled'],
    ['gold_g', 'results.gold'], ['notes', 'results.notes'],
  ],
  excavator_logs: [
    ['date', 'exc.date'], ['exploration_hrs', 'exc.exploration'], ['production_hrs', 'exc.production'],
    ['idle_hrs', 'exc.idle'], ['excavator_fuel_barrels', 'exc.fuelExcavator'], ['mill_fuel_barrels', 'exc.fuelMill'],
    ['notes', 'exc.notes'],
  ],
};
// Already in the entry's title line, so not repeated for added or deleted records.
const HISTORY_TITLE_FIELDS = {
  daily_logs: ['date'], transactions: ['date', 'category', 'amount'],
  shafts: ['name'], sack_counts: ['date', 'shaft_id'], shaft_samples: ['date', 'shaft_id'], milling_results: ['date', 'shaft_id'], excavator_logs: ['date'],
};
// Bookkeeping columns that change on every save and mean nothing to readers.
const HISTORY_IGNORED_FIELDS = new Set([
  'id', 'site_id', 'created_at', 'updated_at', 'synced_at', 'created_offline',
  'logged_by', 'entered_by', 'updated_by', 'week_start',
]);

const asRecord = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const fmtHistoryValue = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

function HistoryEntry({ entry, shaftNames = {} }) {
  const { t } = useT();
  const before = asRecord(entry.old_data);
  const after = asRecord(entry.new_data);
  const row = entry.new_data ? after : before;
  const fields = HISTORY_FIELDS[entry.table_name] || [];
  const labelOf = (key) => { const f = fields.find(([k]) => k === key); return f ? t(f[1]) : key; };
  const valueOf = (key, v) => {
    if (key === 'shaft_id' && shaftNames[v]) return shaftNames[v];
    if (key === 'kind' && (v === 'pit' || v === 'shaft')) return t(`shafts.${v}`);
    if ((key === 'excavator_on' || key === 'visible_gold') && typeof v === 'boolean') return t(v ? 'common.yes' : 'common.no');
    if (key === 'vein' && VEIN_STATES.includes(v)) return t(`vein.${v}`);
    if (key === 'sample_type' && v) return t(`samples.${v}`);
    if (key === 'photo_paths' && Array.isArray(v)) return `${v.length}`;
    if (key === 'phase_history' && Array.isArray(v)) return v.map((h) => `${t(`phase.${h.phase}`)} ${h.from}`).join(', ') || '—';
    return key === 'type' && (v === 'expense' || v === 'credit') ? t(`tx.${v}`) : fmtHistoryValue(v);
  };

  let lines;
  if (entry.action === 'update') {
    const known = fields.map(([k]) => k);
    const extra = Object.keys({ ...before, ...after }).filter((k) => !known.includes(k) && !HISTORY_IGNORED_FIELDS.has(k));
    lines = [...known, ...extra]
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => [k, `${labelOf(k)}: ${valueOf(k, before[k])} → ${valueOf(k, after[k])}`]);
  } else {
    const inTitle = HISTORY_TITLE_FIELDS[entry.table_name] || [];
    lines = fields
      .filter(([k]) => !inTitle.includes(k) && row[k] !== null && row[k] !== undefined && row[k] !== '' && row[k] !== 0)
      .map(([k]) => [k, `${labelOf(k)}: ${valueOf(k, row[k])}`]);
  }

  const action = entry.action === 'insert' ? { key: 'hist.added', cls: 'bg-emerald-50 text-emerald-700' }
    : entry.action === 'delete' ? { key: 'hist.deleted', cls: 'bg-red-50 text-red-700' }
    : { key: 'hist.changed', cls: 'bg-amber-50 text-amber-800' };

  let title = entry.table_name;
  if (entry.table_name === 'daily_logs') title = `${t('hist.dailyLog')} · ${row.date || '—'}`;
  if (entry.table_name === 'transactions') {
    title = `${t('hist.transaction')} · ${row.date || '—'} · ${row.category || '—'} · ${fmtETB(Number(row.amount))} ETB`;
  }
  if (entry.table_name === 'inputs') title = t('hist.inputs');
  if (entry.table_name === 'shafts') title = `${t('hist.shaft')} · ${row.name || '—'}`;
  if (entry.table_name === 'sack_counts') title = `${t('hist.sackCount')} · ${row.date || '—'} · ${valueOf('shaft_id', row.shaft_id)}`;
  if (entry.table_name === 'milling_results') title = `${t('hist.millingResult')} · ${row.date || '—'} · ${valueOf('shaft_id', row.shaft_id)}`;
  if (entry.table_name === 'shaft_samples') title = `${t('hist.sample')} · ${row.date || '—'} · ${valueOf('shaft_id', row.shaft_id)}`;
  if (entry.table_name === 'excavator_logs') title = `${t('hist.excavatorDay')} · ${row.date || '—'}`;

  const who = entry.changed_by ? (entry.changed_by_name || t('hist.unknownUser')) : t('hist.system');

  return (
    <div className="bg-white border border-stone-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${action.cls}`}>{t(action.key)}</span>
        <span className="text-[10px] text-stone-500 text-right">{new Date(entry.created_at).toLocaleString()}</span>
      </div>
      <div className="text-sm font-medium text-stone-900 mt-1 break-words">{title}</div>
      <div className="text-xs text-stone-500 mt-0.5">{t('hist.by')} {who}</div>
      {lines.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-stone-700">
          {lines.map(([k, text]) => <li key={k} className="break-words">{text}</li>)}
        </ul>
      ) : entry.action === 'update' ? (
        <div className="mt-2 text-xs text-stone-400">{t('hist.noFieldChanges')}</div>
      ) : null}
    </div>
  );
}

function ChangeHistory({ site, shafts = [] }) {
  const { t } = useT();
  const demo = isDemoActive();
  const shaftNames = useMemo(() => Object.fromEntries(shafts.map((s) => [s.id, s.name])), [shafts]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);

  // `oldest` is the last entry already shown; null loads the newest page.
  const load = useCallback(async (oldest) => {
    setLoading(true); setError('');
    // The supabase wrapper has no rpc(), so call the real client directly.
    // This is never reached in Demo Mode, so demo data can't reach Supabase.
    const { data, error: err } = await realSupabase.rpc('site_change_history', {
      p_site_id: site.id,
      p_before_time: oldest ? oldest.created_at : null,
      p_before_id: oldest ? oldest.id : null,
      p_limit: HISTORY_PAGE_SIZE,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    const rows = data || [];
    setEntries((prev) => (oldest ? [...prev, ...rows] : rows));
    setHasMore(rows.length === HISTORY_PAGE_SIZE);
  }, [site.id]);

  useEffect(() => { if (!demo) load(null); }, [demo, load]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('hist.title')}</div>
        <div className="text-sm text-stone-600">{t('hist.subtitle')}</div>
      </div>

      {demo ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">{t('hist.demoNote')}</div>
      ) : (
        <>
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">{t('hist.error')} {error}</div>}
          {!error && !loading && entries.length === 0 && (
            <div className="bg-white border border-stone-200 px-3 py-8 text-center text-sm text-stone-400">{t('hist.empty')}</div>
          )}
          <div className="space-y-2">
            {entries.map((e) => <HistoryEntry key={e.id} entry={e} shaftNames={shaftNames} />)}
          </div>
          {loading && <div className="text-xs text-stone-500 py-2">{t('hist.loading')}</div>}
          {hasMore && !loading && (
            <button onClick={() => load(entries[entries.length - 1])}
              className="w-full bg-white border border-stone-300 py-3 text-xs uppercase tracking-widest text-stone-600 hover:border-amber-700 hover:text-amber-700 transition-colors">
              {t('hist.showOlder')}
            </button>
          )}
        </>
      )}
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
    // Fuel is counted in barrels: in = Barrels Received on Fuel purchases, out = Fuel Used in daily logs
    const fuelReceivedBarrels = transactions.filter(t => t.type === 'expense' && t.category === 'Fuel').reduce((s, t) => s + (Number(t.fuel_barrels_topped_up) || 0), 0);
    const cleaningHrs = logs.reduce((s, l) => s + (Number(l.cleaning_hrs) || 0), 0);
    const prepHrs = logs.reduce((s, l) => s + (Number(l.prep_hrs) || 0), 0);
    const idleHrs = logs.reduce((s, l) => s + (Number(l.idle_hrs) || 0), 0);
    const totalHrs = cleaningHrs + prepHrs + idleHrs;

    const fuelUsedBarrels = logs.reduce((s, l) => s + (Number(l.fuel_received_barrels) || 0), 0);
    const fuelRemainingBarrels = Number(inputs.fuel_barrels_opening) + fuelReceivedBarrels - fuelUsedBarrels;

    // Machine hours: opening + top-ups from Machine Rental expense transactions − all billable hours
    const machineHrsToppedUpTxs = transactions.filter(t => t.type === 'expense' && t.category === 'Machine Rental').reduce((s, t) => s + (Number(t.machine_hrs_topped_up) || 0), 0);
    const machineHrsRemaining = Number(inputs.machine_hrs_opening) + machineHrsToppedUpTxs - totalHrs;

    // Gold totals
    const grossGold = logs.reduce((s, l) => s + (Number(l.gold_g) || 0), 0);
    const netSaleableGold = grossGold * (1 - Number(inputs.landowner_share));

    // Operating costs exclude Loan Return — loans only touch cash, not P&L
    const totalCosts = transactions
      .filter((t) => t.type === 'expense' && t.category !== 'Profit Share' && t.category !== 'Loan Return')
      .reduce((s, t) => s + Number(t.amount), 0);
    const profitSharePaid = transactions
      .filter((t) => t.type === 'expense' && t.category === 'Profit Share')
      .reduce((s, t) => s + Number(t.amount), 0);
    const loanReturns = transactions
      .filter((t) => t.type === 'expense' && t.category === 'Loan Return')
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
    // Cash: all credits in (incl. loans) minus operating costs, loan repayments, and profit share
    const cashOnHand = Number(inputs.opening_cash) + totalCredits - totalCosts - loanReturns - profitSharePaid;

    // Runways — use last 7 days of data
    const last7 = logs.slice(0, 7);
    const last7Hrs = last7.reduce((s, l) => s + (Number(l.cleaning_hrs) || 0) + (Number(l.prep_hrs) || 0), 0);
    const last7Fuel = last7.length > 0 ? last7.reduce((s, l) => s + (Number(l.fuel_received_barrels) || 0), 0) / Math.min(last7.length, 7) : 0;
    const avgDailyHrs = last7.length > 0 ? last7Hrs / Math.min(last7.length, 7) : 0;
    const fuelRunwayDays = last7Fuel > 0 ? fuelRemainingBarrels / last7Fuel : null;
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
          <Tile label={t('tile.fuelRemaining')} value={fmtBarrels(calc.fuelRemainingBarrels)} unit={t('tile.barrels')}
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
    <div className={`px-4 py-3 transition-colors ${alert ? 'bg-red-50/70 border border-red-200 -m-px z-10 relative' : 'bg-white'}`}>
      <div className="text-[10px] uppercase tracking-widest text-stone-500">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <div className={`text-xl font-semibold ${alert ? 'text-red-700' : 'text-stone-900'}`}>{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-stone-500">{unit}</div>
      </div>
      {sub && <div className={`text-[10px] mt-0.5 ${alert ? 'text-red-600' : 'text-stone-500'}`}>{sub}</div>}
    </div>
  );
}

// ============================================================
// PRIMARY SITES (pits & shafts, sacks, milling results, excavator)
// ============================================================
// Who may add pits, shafts, sacks, results and excavator days (the database checks the same).
const canAddPrimary = (profile) => profile?.role === 'super_admin' || profile?.role === 'site_manager';
// The super admin can change any entry; a site manager only the entries they made (same rule as the database).
const canEditPrimary = (profile, row) => profile.role === 'super_admin' || (profile.role === 'site_manager' && row.logged_by === profile.id);
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

function PhaseBadge({ phase }) {
  const { t } = useT();
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 whitespace-nowrap ${
      phase === 'production' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
      {t(`phase.${phase}`)}
    </span>
  );
}

function ShaftKindBadge({ kind }) {
  const { t } = useT();
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 whitespace-nowrap ${
      kind === 'pit' ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>
      {kind === 'pit' ? t('shafts.pitShort') : t('shafts.shaftShort')}
    </span>
  );
}

const LABEL_CLS = 'block text-[10px] uppercase tracking-widest text-stone-500 mb-1';
const INPUT_CLS = 'w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700';
const SAVE_CLS = 'bg-amber-700 text-white px-6 py-2 text-xs uppercase tracking-widest hover:bg-amber-800 disabled:bg-stone-400';
const DELETE_CLS = 'border border-red-300 text-red-700 px-6 py-2 text-xs uppercase tracking-widest hover:bg-red-50 disabled:opacity-50';
const CANCEL_CLS = 'px-6 py-2 text-xs uppercase tracking-widest text-stone-600 hover:text-stone-900 border border-stone-300';
const EDIT_CLS = 'ml-2 px-2 py-1 border border-stone-300 text-[10px] uppercase tracking-widest text-stone-600 hover:border-amber-700 hover:text-amber-700';
const SMALL_CLS = 'px-3 py-1.5 border border-stone-300 text-[10px] uppercase tracking-widest text-stone-600 hover:border-amber-700 hover:text-amber-700';

function ErrorBox({ error }) {
  return error ? <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 mt-3">{error}</div> : null;
}

function NotesField({ label, value, onChange }) {
  return (
    <div className="mt-3">
      <label className={LABEL_CLS}>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} rows={2} />
    </div>
  );
}

function PrimaryDashboard({ inputs, shafts, sackCounts, results, excavatorLogs, transactions }) {
  const { t } = useT();
  const [view, setView] = useState('money');
  const calc = useMemo(() => primarySnap(inputs, shafts, sackCounts, results, excavatorLogs, transactions),
    [inputs, shafts, sackCounts, results, excavatorLogs, transactions]);

  if (!inputs) return <div className="text-sm text-stone-500">Loading inputs…</div>;
  if (!calc) return null;

  const sc = STATUS_COLORS[calc.status];
  const landownerPct = Math.round(Number(inputs.landowner_share) * 100);
  const sackTonnes = Number(inputs.sack_kg) / 1000;
  const today = todayISO();

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
            {t('primary.lastEntry')}: {calc.lastEntryDate || t('primary.noEntriesYet')} · {shafts.length} {t('primary.pitsShafts')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border border-stone-300">
        {['money', 'geology'].map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`py-2 text-xs uppercase tracking-widest ${view === v ? 'bg-stone-900 text-white' : 'bg-white text-stone-600'}`}>
            {t(`dash.${v}`)}
          </button>
        ))}
      </div>

      {view === 'money' ? (
        <>
          <div className="grid grid-cols-2 gap-px bg-stone-200">
            <Tile label={t('tile.cashOnHand')} value={fmtETB(calc.cashOnHand)} unit="ETB" alert={calc.cashOnHand < Number(inputs.target_cash_reserve)} />
          <Tile label={t('tile.goldOnHand')} value={fmtNum(calc.goldOnHand, 1)} unit={t('tile.grams')}
            sub={`${fmtNum(calc.goldSold, 1)}g ${t('tile.goldSold')}`} />
            <Tile label={t('tile.operatingCosts')} value={fmtETB(calc.totalCosts)} unit="ETB"
              sub={`${fmtETB(calc.costPerGram)} ETB/g`} alert={calc.costPerGram > Number(inputs.gold_price)} />
            <Tile label={t('tile.netProfit')} value={fmtETB(calc.profit)} unit="ETB" alert={calc.profit < 0}
              sub={calc.profitSharePaid > 0 ? `${t('tile.profitShare')} ${fmtETB(calc.profitSharePaid)}` : `${t('tile.revenue')} ${fmtETB(calc.goldSaleRevenue)}`} />
          {calc.excavatorOn && (
            <>
              <Tile label={t('tile.fuelRemaining')} value={fmtBarrels(calc.fuelRemainingBarrels)} unit={t('tile.barrels')}
                  sub={calc.fuelRunwayDays !== null ? `${fmtNum(calc.fuelRunwayDays, 1)} ${t('tile.days')}` : '—'} alert={calc.fuelRemainingBarrels < 7} />
              <Tile label={t('tile.machineHours')} value={fmtNum(calc.machineHrsRemaining, 0)} unit={t('tile.hours')}
                  sub={calc.machineRunwayDays !== null ? `${fmtNum(calc.machineRunwayDays, 1)} ${t('tile.days')}` : '—'} alert={calc.machineHrsRemaining < 100} />
            </>
          )}
        </div>
          <div className="bg-white border border-stone-200 px-4 py-3 text-xs text-stone-700">
            {fmtNum(calc.grossGold, 1)} g {t('dash.produced')} · {t('tile.landowner')} {landownerPct}%: {fmtNum(calc.landownerGold, 1)} g · {t('tile.investors')} {100 - landownerPct}%: {fmtNum(calc.netSaleableGold, 1)} g
        </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px bg-stone-200">
            <Tile label={t('tile.goldProduced')} value={fmtNum(calc.grossGold, 1)} unit="g"
              sub={`${t('dash.explShort')} ${fmtNum(calc.explorationGold, 1)} · ${t('dash.prodShort')} ${fmtNum(calc.productionGold, 1)}`} />
            <Tile label={t('tile.avgGrade')} value={fmtNum(calc.gPerSack, 2)} unit="g/sack" sub={`${fmtNum(calc.gPerTonne, 1)} g/t`} />
            <Tile label={t('tile.sacksWaiting')} value={fmtNum(calc.sacksWaiting, 0)} unit={t('tile.sacks')} alert={calc.sacksWaiting < 0} />
          </div>
          <div className="bg-white border border-stone-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-stone-100 text-stone-600 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-2 py-2 text-left">{t('sacks.colShaft')}</th>
                  <th className="px-2 py-2 text-right">{t('sacks.colDepth')}</th>
                  <th className="px-2 py-2 text-left">{t('sacks.colVein')}</th>
                  <th className="px-2 py-2 text-right">{t('results.colGps')}</th>
                </tr>
              </thead>
              <tbody>
                {[...shafts].filter((s) => !s.closed_on).sort(openFirst).map((s) => {
                  const st = calc.perShaft.find((p) => p.shaft.id === s.id);
                  const pr = pitProgress(s.id, sackCounts);
                  const lost = pr.vein === 'lost' && pr.lostSince && daysBetween(pr.lostSince, today) >= 3;
                  return (
                    <tr key={s.id} className={`border-t border-stone-100 ${lost ? 'bg-red-50/60' : ''}`}>
                      <td className="px-2 py-2">
                        <div className="font-medium text-stone-900 whitespace-nowrap">{s.name}</div>
                        <div className="mt-1"><PhaseBadge phase={resultPhase(s, today)} /></div>
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">{pr.depth !== null ? `${fmtNum(pr.depth, 1)} m` : '—'}</td>
                      <td className="px-2 py-2"><VeinBadge vein={pr.vein} /></td>
                      <td className={`px-2 py-2 text-right ${st?.gPerSack >= Number(inputs.cutoff_g_per_sack) ? 'text-emerald-700 font-semibold' : ''}`}>
                        {st?.gPerSack !== null && st?.gPerSack !== undefined ? fmtNum(st.gPerSack, 2) : '—'}
                      </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PitComparisonChart shafts={shafts} sackCounts={sackCounts} results={results} inputs={inputs} />
        </>
      )}
    </div>
  );
}

const VEIN_CLS = { found: 'bg-amber-100 text-amber-900', lost: 'bg-red-50 text-red-700', not_reached: 'bg-stone-100 text-stone-600' };
const daysBetween = (from, to) => Math.round((new Date(to) - new Date(from)) / 86400000);
const mapUrl = (s) => (s.latitude !== null && s.latitude !== undefined && s.latitude !== '' && s.longitude !== null && s.longitude !== undefined && s.longitude !== ''
  ? `https://www.google.com/maps?q=${s.latitude},${s.longitude}` : (s.map_link || null));

function VeinBadge({ vein }) {
  const { t } = useT();
  if (!vein) return null;
  return <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 whitespace-nowrap ${VEIN_CLS[vein]}`}>{t(`vein.${vein}`)}</span>;
}

// Shrinks a phone photo to at most `maxPx` on its long side, saved as JPEG: 1600 px for the
// photo itself (about 200–400 KB), 240 px for its preview (about 10–20 KB).
const shrinkPhoto = (file, maxPx = 1600, quality = 0.75) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not read the photo.'))), 'image/jpeg', quality);
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the photo.')); };
  img.src = url;
});

// Each photo is stored with a small preview beside it (photo.jpg → photo.thumb.jpg).
const thumbPath = (path) => path.replace(/\.jpg$/, '.thumb.jpg');
const withThumbs = (paths) => paths.flatMap((p) => [p, thumbPath(p)]);

// Sample photos are private files; the app asks Supabase for links that work for an hour.
// The list shows only the previews; the full photo is downloaded when one is tapped.
// Photos saved before previews existed show the full photo instead.
// Photos are never uploaded or read in Demo Mode.
function SamplePhotos({ paths }) {
  const [photos, setPhotos] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (isDemoActive() || !paths || paths.length === 0) { setPhotos([]); return; }
    let live = true;
    realSupabase.storage.from('samples').createSignedUrls(paths.map(thumbPath), 3600).then(({ data }) => {
      if (live) setPhotos(paths.map((p, i) => ({ path: p, thumb: data?.[i]?.signedUrl || null })));
    });
    return () => { live = false; };
  }, [JSON.stringify(paths)]);
  useEffect(() => {
    if (!open || open.full) return;
    let live = true;
    realSupabase.storage.from('samples').createSignedUrl(open.path, 3600).then(({ data }) => {
      if (live && data?.signedUrl) setOpen((o) => (o && o.path === open.path ? { ...o, full: data.signedUrl } : o));
    });
    return () => { live = false; };
  }, [open?.path]);
  if (photos.length === 0) return null;
  return (
    <>
      <div className="flex gap-2 flex-wrap mt-2">
        {photos.map((ph) => (
          <PhotoThumb key={ph.path} photo={ph} onOpen={() => setOpen({ ...ph })} />
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <button type="button" className="absolute top-3 right-4 text-white text-3xl leading-none" onClick={() => setOpen(null)}>✕</button>
          {open.full
            ? <img src={open.full} alt="" className="max-w-full max-h-full object-contain" />
            : <img src={open.thumb || ''} alt="" className="max-w-full max-h-full object-contain opacity-60" />}
        </div>
      )}
    </>
  );
}

// A preview square. Without a stored preview (older photos) it loads the full photo, lazily.
function PhotoThumb({ photo, onOpen }) {
  const [src, setSrc] = useState(photo.thumb);
  useEffect(() => {
    if (photo.thumb) { setSrc(photo.thumb); return; }
    let live = true;
    realSupabase.storage.from('samples').createSignedUrl(photo.path, 3600).then(({ data }) => {
      if (live) setSrc(data?.signedUrl || null);
    });
    return () => { live = false; };
  }, [photo.path, photo.thumb]);
  return (
    <button type="button" onClick={onOpen} className="w-20 h-20 border border-stone-200 bg-stone-100">
      {src && <img src={src} alt="" loading="lazy" className="w-20 h-20 object-cover" />}
    </button>
  );
}

function SamplesPanel({ site, shaft, samples, profile, onRefresh }) {
  const { t } = useT();
  const demo = isDemoActive();
  const blank = { date: todayISO(), depth_m: '', sample_type: 'quartz', visible_gold: false, description: '' };
  const [form, setForm] = useState(blank);
  const [files, setFiles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canAdd = canAddPrimary(profile);
  const own = samples.filter((s) => s.shaft_id === shaft.id).sort(byNewest);

  const reset = () => { setForm(blank); setFiles([]); setEditing(null); setError(''); };
  const startEdit = (s) => {
    setError(''); setFiles([]); setEditing(s);
    setForm({ date: s.date, depth_m: s.depth_m ?? '', sample_type: s.sample_type, visible_gold: !!s.visible_gold, description: s.description || '' });
  };

  const handleSave = async () => {
    setError('');
    if (!form.description.trim()) { setError(t('samples.needDescription')); return; }
    if (form.depth_m !== '' && !(Number(form.depth_m) >= 0)) { setError(t('samples.badDepth')); return; }
    setSaving(true);
    // Photos go up first; the sample is only saved once they are stored.
    const uploaded = [];
    for (const file of files) {
      try {
        const blob = await shrinkPhoto(file);
        const thumb = await shrinkPhoto(file, 240, 0.7);
        const path = `${site.id}/${shaft.id}/${Date.now()}-${uploaded.length}.jpg`;
        const { error: upErr } = await realSupabase.storage.from('samples').upload(path, blob, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        uploaded.push(path);
        const { error: thumbErr } = await realSupabase.storage.from('samples').upload(thumbPath(path), thumb, { contentType: 'image/jpeg' });
        if (thumbErr) throw thumbErr;
      } catch (e) {
        if (uploaded.length > 0) await realSupabase.storage.from('samples').remove(withThumbs(uploaded));
        setSaving(false);
        setError(`${t('samples.photoFailed')} ${e.message || ''}`);
        return;
      }
    }
    const fields = {
      date: form.date, depth_m: form.depth_m === '' ? null : Number(form.depth_m), sample_type: form.sample_type,
      visible_gold: !!form.visible_gold, description: form.description.trim(),
      photo_paths: [...(editing?.photo_paths || []), ...uploaded],
    };
    const { data, error: err } = editing
      ? await supabase.from('shaft_samples').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', editing.id).select()
      : await supabase.from('shaft_samples').insert({ ...fields, site_id: site.id, shaft_id: shaft.id, logged_by: profile.id });
    setSaving(false);
    if (err) {
      if (uploaded.length > 0 && !demo) await realSupabase.storage.from('samples').remove(withThumbs(uploaded));
      setError(err.message);
      return;
    }
    if (editing && (!data || data.length === 0)) { setError(t('edit.notSaved')); return; }
    reset();
    onRefresh();
  };

  const handleDelete = async () => {
    if (!window.confirm(`${t('samples.confirmDelete')}\n${editing.date} · ${shaft.name}`)) return;
    setSaving(true);
    const { data, error: err } = await supabase.from('shaft_samples').delete().eq('id', editing.id).select();
    setSaving(false);
    if (err) { setError(err.message); return; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    if (!demo && editing.photo_paths?.length) await realSupabase.storage.from('samples').remove(withThumbs(editing.photo_paths));
    reset();
    onRefresh();
  };

  return (
    <div className="border-t border-stone-100 mt-3 pt-3">
      <div className={LABEL_CLS}>{t('samples.title')} ({own.length})</div>
      {(canAdd || editing) && (
        <div className="bg-stone-50 border border-stone-200 p-3 mb-3">
          {editing && <div className="text-[10px] uppercase tracking-widest text-amber-800 mb-2">{t('samples.editing')} {editing.date}</div>}
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('samples.date')} type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <Field label={t('samples.depth')} type="number" value={form.depth_m} onChange={(v) => setForm({ ...form, depth_m: v })} />
            <div>
              <label className={LABEL_CLS}>{t('samples.type')}</label>
              <select value={form.sample_type} onChange={(e) => setForm({ ...form, sample_type: e.target.value })} className={INPUT_CLS}>
                {['quartz', 'stone', 'other'].map((k) => <option key={k} value={k}>{t(`samples.${k}`)}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-stone-700 mt-5 cursor-pointer">
              <input type="checkbox" checked={form.visible_gold} onChange={(e) => setForm({ ...form, visible_gold: e.target.checked })} className="w-4 h-4 accent-amber-700" />
              {t('samples.visibleGold')}
            </label>
          </div>
          <div className="mt-2">
            <label className={LABEL_CLS}>{t('samples.description')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('samples.descriptionHint')} className={INPUT_CLS} rows={3} />
          </div>
          <div className="mt-2">
            <label className={LABEL_CLS}>{t('samples.photos')}</label>
            {demo ? (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1">{t('samples.demoNoPhotos')}</div>
            ) : (
              <input type="file" accept="image/*" multiple onChange={(e) => setFiles([...e.target.files])} className="text-xs" />
            )}
          </div>
          <ErrorBox error={error} />
          <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={handleSave} disabled={saving} className={SAVE_CLS}>
              {saving ? t('samples.saving') : editing ? t('edit.saveChanges') : t('samples.save')}
            </button>
            {editing && profile.role === 'super_admin' && <button onClick={handleDelete} disabled={saving} className={DELETE_CLS}>{t('edit.delete')}</button>}
            {editing && <button onClick={reset} className={CANCEL_CLS}>{t('common.cancel')}</button>}
          </div>
        </div>
      )}
      {own.length === 0 && <div className="text-xs text-stone-400">{t('samples.none')}</div>}
      <div className="space-y-2">
        {own.map((s) => (
          <div key={s.id} className="border border-stone-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-semibold text-stone-900">{s.date}</span>
              {s.depth_m !== null && s.depth_m !== undefined && <span className="text-stone-600">{fmtNum(s.depth_m, 1)} m</span>}
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-stone-100 text-stone-600">{t(`samples.${s.sample_type}`)}</span>
              {s.visible_gold && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-amber-100 text-amber-900">{t('samples.visibleGold')}</span>}
              {canEditPrimary(profile, s) && <button onClick={() => startEdit(s)} className={EDIT_CLS}>{t('edit.edit')}</button>}
            </div>
            <div className="text-xs text-stone-700 mt-1 whitespace-pre-wrap">{s.description}</div>
            <SamplePhotos paths={s.photo_paths} />
          </div>
        ))}
      </div>
    </div>
  );
}

// A side view of a pit or shaft drawn from the daily entries: each day's digging is a band
// from the previous depth to the depth reached, coloured by the vein; results and samples are
// marked at the depth the pit had reached on their date.
function CrossSection({ shaft, sackCounts, results, samples }) {
  const { t } = useT();
  const days = sackCounts.filter((c) => c.shaft_id === shaft.id && c.depth_m !== null && c.depth_m !== undefined && c.depth_m !== '')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (days.length === 0) return <div className="text-xs text-stone-400 mt-2">{t('section.noDepth')}</div>;
  const depthOn = (date) => { let d = null; days.forEach((c) => { if (c.date <= date) d = Number(c.depth_m); }); return d; };
  const maxDepth = Math.max(...days.map((c) => Number(c.depth_m)), 1);
  const H = 260; const top = 16; const scale = (H - top - 10) / maxDepth; const y = (d) => top + d * scale;
  const fill = { found: '#EF9F27', lost: '#E8B4B4', not_reached: '#D3D1C7' };
  // Nothing is known about the ground above the first recorded depth, so it is drawn plain.
  const firstDepth = Number(days[0].depth_m);
  let prev = firstDepth;
  const bands = days.slice(1).map((c) => {
    const from = Math.min(prev, Number(c.depth_m)); const to = Number(c.depth_m); prev = Math.max(prev, to);
    return { key: c.id, from, to, vein: c.vein || 'not_reached' };
  });
  const marks = results.filter((r) => r.shaft_id === shaft.id && Number(r.sacks_milled) > 0)
    .map((r) => ({ key: r.id, d: depthOn(r.date), g: r.gold_g / r.sacks_milled })).filter((m) => m.d !== null);
  const sampleMarks = samples.filter((s) => s.shaft_id === shaft.id && s.depth_m !== null && s.depth_m !== undefined);
  const ticks = [0, maxDepth / 2, maxDepth];
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 300 ${H}`} className="w-full max-w-md" role="img" aria-label={t('section.crossSection')}>
        <rect x="0" y={top} width="300" height={H - top} fill="#F1EFE8" />
        <rect x="0" y={top - 5} width="300" height="5" fill="#97C459" />
        {ticks.map((d) => (
          <g key={d}><line x1="30" x2="300" y1={y(d)} y2={y(d)} stroke="#D3D1C7" strokeDasharray="2 3" />
            <text x="2" y={y(d) + 3} fontSize="9" fill="#888780">{fmtNum(d, 0)} m</text></g>
        ))}
        {firstDepth > 0 && <rect x="110" y={y(0)} width="44" height={firstDepth * scale} fill="#FFFFFF" stroke="#B4B2A9" strokeWidth="0.5" strokeDasharray="2 2" />}
        {bands.map((b) => b.to > b.from && (
          <rect key={b.key} x="110" y={y(b.from)} width="44" height={Math.max(1, (b.to - b.from) * scale)} fill={fill[b.vein]} stroke="#B4B2A9" strokeWidth="0.5" />
        ))}
        {marks.map((m) => (
          <g key={m.key}><circle cx="164" cy={y(m.d)} r="3" fill={m.g >= 0.4 ? '#1D9E75' : '#888780'} />
            <text x="170" y={y(m.d) + 3} fontSize="9" fill="#444441">{fmtNum(m.g, 2)} g/sack</text></g>
        ))}
        {sampleMarks.map((s) => (
          <g key={s.id}><rect x="96" y={y(Number(s.depth_m)) - 3} width="6" height="6" fill={s.visible_gold ? '#BA7517' : '#5F5E5A'} />
            <text x="34" y={y(Number(s.depth_m)) + 3} fontSize="9" fill="#5F5E5A">{t(`samples.${s.sample_type}`)}</text></g>
        ))}
      </svg>
      <div className="text-[10px] text-stone-500 flex flex-wrap gap-3 mt-1">
        <span><span className="inline-block w-2 h-2 mr-1" style={{ background: fill.found }} />{t('vein.found')}</span>
        <span><span className="inline-block w-2 h-2 mr-1" style={{ background: fill.lost }} />{t('vein.lost')}</span>
        <span><span className="inline-block w-2 h-2 mr-1" style={{ background: fill.not_reached }} />{t('vein.not_reached')}</span>
        <span><span className="inline-block w-2 h-2 mr-1 border border-dashed border-stone-400" />{t('section.beforeEntries')}</span>
        <span>● {t('section.resultsLegend')}</span><span>■ {t('section.samplesLegend')}</span>
      </div>
    </div>
  );
}

function Shafts({ site, shafts, sackCounts, results, samples, inputs, profile, onRefresh }) {
  const { t } = useT();
  const blank = { name: '', kind: 'shaft', opened_on: todayISO(), start_production: '', closed_on: '', latitude: '', longitude: '', map_link: '', notes: '' };
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  // A quick change from a card: a phase switch or closing, from a chosen date.
  const [quick, setQuick] = useState(null);
  const [open, setOpen] = useState({});
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef(null);
  const canAdd = canAddPrimary(profile);
  const cutoff = Number(inputs?.cutoff_g_per_sack);
  const sackTonnes = Number(inputs?.sack_kg) / 1000;
  const today = todayISO();

  // Fills latitude and longitude from the phone's GPS while standing at the pit.
  const useMyLocation = () => {
    setError('');
    if (!navigator.geolocation) { setError(t('shafts.locationFailed')); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
      },
      () => { setLocating(false); setError(t('shafts.locationFailed')); },
      { enableHighAccuracy: true, timeout: 20000 },
    );
  };
  const stats = useMemo(() => Object.fromEntries(shaftStats(shafts, sackCounts, results, cutoff).map((p) => [p.shaft.id, p])),
    [shafts, sackCounts, results, cutoff]);
  const toggle = (id, part) => setOpen({ ...open, [id]: open[id] === part ? null : part });

  const closeForm = () => { setShowForm(false); setEditing(null); setError(''); setForm(blank); };
  const startEdit = (s) => {
    setError(''); setQuick(null); setEditing(s);
    setForm({
      name: s.name, kind: s.kind, opened_on: s.opened_on || '', start_production: '', closed_on: s.closed_on || '',
      latitude: s.latitude ?? '', longitude: s.longitude ?? '', map_link: s.map_link || '', notes: s.notes || '',
    });
    setShowForm(true);
  };
  useEffect(() => { if (editing) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [editing]);

  // Changes only this one pit or shaft and keeps who originally entered it.
  const update = async (id, changes) => {
    const { data, error: err } = await supabase.from('shafts').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id).select();
    if (err) { setError(err.message); return false; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return false; }
    return true;
  };
  // production_from keeps the first switch to production, for anything that still reads it.
  const withHistory = (history) => ({ phase_history: history, production_from: history.find((h) => h.phase === 'production')?.from || null });

  const handleSave = async () => {
    setError('');
    const name = form.name.trim();
    if (!name) { setError(t('shafts.nameRequired')); return; }
    if (shafts.some((s) => s.id !== editing?.id && s.name.trim().toLowerCase() === name.toLowerCase())) { setError(t('shafts.nameTaken')); return; }
    const lat = form.latitude === '' ? null : Number(form.latitude);
    const lng = form.longitude === '' ? null : Number(form.longitude);
    // Every pit or shaft needs its GPS position, for maps and modelling later.
    if (lat === null || lng === null) { setError(t('shafts.gpsRequired')); return; }
    if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) { setError(t('shafts.badCoords')); return; }
    setSaving(true);
    const fields = {
      name, kind: form.kind, opened_on: form.opened_on || todayISO(), closed_on: form.closed_on || null,
      latitude: lat, longitude: lng, map_link: form.map_link.trim() || null, notes: form.notes || null,
    };
    if (editing) {
      const done = await update(editing.id, fields);
      setSaving(false);
      if (!done) return;
    } else {
      const history = form.start_production ? [{ phase: 'production', from: form.start_production }] : [];
      const { error: err } = await supabase.from('shafts').insert({ ...fields, ...withHistory(history), site_id: site.id, logged_by: profile.id });
      setSaving(false);
      if (err) { setError(err.message); return; }
    }
    closeForm();
    onRefresh();
  };

  const confirmQuick = async () => {
    setError('');
    const s = shafts.find((x) => x.id === quick.id);
    setSaving(true);
    const done = quick.kind === 'close'
      ? await update(s.id, { closed_on: quick.date })
      : await update(s.id, withHistory([...phaseHistory(s), { phase: quick.kind, from: quick.date }]));
    setSaving(false);
    if (!done) return;
    setQuick(null);
    onRefresh();
  };

  const handleDelete = async () => {
    setError('');
    // A pit or shaft with entries, results or samples stays, so every record keeps its source.
    if ([sackCounts, results, samples].some((list) => list.some((r) => r.shaft_id === editing.id))) { setError(t('shafts.hasData')); return; }
    if (!window.confirm(`${t('shafts.confirmDelete')}\n${editing.name}`)) return;
    setSaving(true);
    const { data, error: err } = await supabase.from('shafts').delete().eq('id', editing.id).select();
    setSaving(false);
    if (err) { setError(['23001', '23503'].includes(err.code) ? t('shafts.hasData') : err.message); return; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    closeForm();
    onRefresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('shafts.title')}</div>
          <div className="text-sm text-stone-600">{shafts.length} {t('primary.pitsShafts')}</div>
        </div>
        {canAdd && (
          <button onClick={() => (showForm ? closeForm() : setShowForm(true))}
            className="bg-stone-900 text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-amber-700 transition-colors">
            {showForm ? t('common.cancel') : t('shafts.new')}
          </button>
        )}
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white border border-stone-200 p-4 mb-4">
          {editing && <div className="text-[10px] uppercase tracking-widest text-amber-800 mb-3">{t('shafts.editing')} {editing.name}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('shafts.name')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <div>
              <label className={LABEL_CLS}>{t('shafts.kind')}</label>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={INPUT_CLS}>
                <option value="pit">{t('shafts.pit')}</option>
                <option value="shaft">{t('shafts.shaft')}</option>
              </select>
            </div>
            <Field label={t('shafts.openedOn')} type="date" value={form.opened_on} onChange={(v) => setForm({ ...form, opened_on: v })} />
            {editing
              ? <Field label={t('shafts.closedOn')} type="date" value={form.closed_on} onChange={(v) => setForm({ ...form, closed_on: v })} />
              : <Field label={t('shafts.startProduction')} type="date" value={form.start_production} onChange={(v) => setForm({ ...form, start_production: v })} />}
            <Field label={t('shafts.latitude')} type="number" value={form.latitude} onChange={(v) => setForm({ ...form, latitude: v })} />
            <Field label={t('shafts.longitude')} type="number" value={form.longitude} onChange={(v) => setForm({ ...form, longitude: v })} />
          </div>
          <button type="button" onClick={useMyLocation} disabled={locating} className={`mt-3 ${SMALL_CLS}`}>
            {locating ? t('shafts.locating') : t('shafts.useLocation')}
          </button>
          <div className="mt-3"><Field label={t('shafts.mapLink')} value={form.map_link} onChange={(v) => setForm({ ...form, map_link: v })} /></div>
          <div className="text-[10px] text-stone-500 mt-2">{editing ? t('shafts.editHint') : t('shafts.formHint')}</div>
          <NotesField label={t('shafts.notes')} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <ErrorBox error={error} />
          <div className="flex flex-wrap gap-3 mt-3">
            <button onClick={handleSave} disabled={saving} className={SAVE_CLS}>
              {saving ? t('shafts.saving') : editing ? t('edit.saveChanges') : t('shafts.save')}
            </button>
            {editing && profile.role === 'super_admin' && <button onClick={handleDelete} disabled={saving} className={DELETE_CLS}>{t('edit.delete')}</button>}
          </div>
        </div>
      )}
      {!showForm && error && <div className="mb-4"><ErrorBox error={error} /></div>}

      {shafts.length === 0 && <div className="bg-white border border-stone-200 px-3 py-8 text-center text-sm text-stone-400">{t('shafts.none')}</div>}
      <div className="space-y-2">
        {[...shafts].sort(openFirst).map((s) => {
          const st = stats[s.id];
          const pr = pitProgress(s.id, sackCounts);
          const phase = resultPhase(s, today);
          const link = mapUrl(s);
          const history = phaseHistory(s);
          const lostDays = pr.lostSince ? daysBetween(pr.lostSince, today) : 0;
          return (
            <div key={s.id} className="bg-white border border-stone-200 px-4 py-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${s.closed_on ? 'text-stone-500' : 'text-stone-900'}`}>{s.name}</span>
                  <ShaftKindBadge kind={s.kind} />
                </div>
                {s.closed_on
                  ? <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 whitespace-nowrap bg-stone-100 text-stone-500">{t('shafts.closed')} {s.closed_on}</span>
                  : <PhaseBadge phase={phase} />}
              </div>
              {(s.latitude === null || s.latitude === undefined || s.latitude === '') && (
                <div className="text-[10px] uppercase tracking-wider text-red-700 mt-1">{t('shafts.gpsMissing')}</div>
              )}
              {link && (
                <div className="text-xs mt-1">
                  {s.latitude !== null && s.latitude !== undefined && <span className="text-stone-500">{s.latitude}, {s.longitude} · </span>}
                  <a href={link} target="_blank" rel="noreferrer" className="text-amber-700 underline">{t('shafts.openMap')} ↗</a>
                </div>
              )}
              <div className="text-xs text-stone-600 mt-1 flex items-center gap-2 flex-wrap">
                <span>{t('shafts.depth')} {pr.depth !== null ? `${fmtNum(pr.depth, 1)} m` : '—'}</span>
                <VeinBadge vein={pr.vein} />
              </div>
              {pr.vein === 'lost' && lostDays >= 3 && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 mt-2">
                  {t('shafts.veinLostFor')} {lostDays} {t('tile.days')} ({t('shafts.since')} {pr.lostSince}).
                </div>
              )}
              <div className="text-xs text-stone-600 mt-1">
                {t('shafts.dug')} {fmtNum(st.dug, 0)} · {t('shafts.milled')} {fmtNum(st.milled, 0)} · {t('shafts.waiting')} {fmtNum(st.waiting, 0)}
              </div>
              <div className="text-xs text-stone-600">
                {t('shafts.gold')} {fmtNum(st.gold, 1)} g
                {st.gPerSack !== null && ` · ${fmtNum(st.gPerSack, 2)} g/sack (${fmtNum(st.gPerSack / sackTonnes, 1)} g/t)`}
              </div>
              {history.length > 0 && (
                <div className="text-[10px] text-stone-500 mt-1">
                  {history.map((h) => `${t(`phase.${h.phase}`)} ${t('shafts.from')} ${h.from}`).join(' · ')}
                </div>
              )}
              {s.notes && <div className="text-xs text-stone-500 mt-1">{s.notes}</div>}
              {st.ready && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 mt-2">
                  {t('shafts.readyTitle')} {t('shafts.readyAvg')} {fmtNum(st.last3Gps, 2)} g/sack. {t('shafts.readyCutoff')} {fmtNum(cutoff, 2)}.
                </div>
              )}
              {canAdd && quick?.id === s.id && (
                <div className="flex items-end gap-2 mt-2 flex-wrap">
                  <div>
                    <label className={LABEL_CLS}>
                      {quick.kind === 'close' ? t('shafts.closeDate') : quick.kind === 'production' ? t('shafts.switchDate') : t('shafts.backDate')}
                    </label>
                    <input type="date" value={quick.date} onChange={(e) => setQuick({ ...quick, date: e.target.value })}
                      className="border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700" />
                  </div>
                  <button onClick={confirmQuick} disabled={saving || !quick.date}
                    className="bg-amber-700 text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-amber-800 disabled:bg-stone-400">{t('shafts.confirm')}</button>
                  <button onClick={() => setQuick(null)} className="px-4 py-2 text-xs uppercase tracking-widest text-stone-600 border border-stone-300">{t('common.cancel')}</button>
                </div>
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                {canAdd && quick?.id !== s.id && !s.closed_on && (
                  <button onClick={() => { setError(''); setQuick({ id: s.id, kind: phase === 'production' ? 'exploration' : 'production', date: today }); }}
                    className={st.ready ? 'px-3 py-1.5 bg-amber-700 text-white text-[10px] uppercase tracking-widest hover:bg-amber-800' : SMALL_CLS}>
                    {phase === 'production' ? t('shafts.backToExploration') : t('shafts.switch')}
                  </button>
                )}
                {canAdd && quick?.id !== s.id && !s.closed_on && (
                  <button onClick={() => { setError(''); setQuick({ id: s.id, kind: 'close', date: today }); }} className={SMALL_CLS}>{t('shafts.close')}</button>
                )}
                {canAdd && <button onClick={() => startEdit(s)} className={SMALL_CLS}>{t('edit.edit')}</button>}
                <button onClick={() => toggle(s.id, 'samples')} className={SMALL_CLS}>
                  {t('samples.title')} ({samples.filter((x) => x.shaft_id === s.id).length})
                </button>
                <button onClick={() => toggle(s.id, 'section')} className={SMALL_CLS}>{t('section.crossSection')}</button>
              </div>
              {open[s.id] === 'samples' && <SamplesPanel site={site} shaft={s} samples={samples} profile={profile} onRefresh={onRefresh} />}
              {open[s.id] === 'section' && (
                <>
                  <CrossSection shaft={s} sackCounts={sackCounts} results={results} samples={samples} />
                  <DepthGradeChart shaft={s} sackCounts={sackCounts} results={results} inputs={inputs} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Daily entry: one pit or shaft at a time — sacks dug, depth reached and the vein.
function SackCounts({ site, shafts, sackCounts, profile, onRefresh }) {
  const { t } = useT();
  const [date, setDate] = useState(todayISO());
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editRef = useRef(null);
  const canAdd = canAddPrimary(profile);
  const shaftById = useMemo(() => Object.fromEntries(shafts.map((s) => [s.id, s])), [shafts]);
  const nameOf = (id) => shaftById[id]?.name || '—';
  const byName = [...shafts].sort((a, b) => a.name.localeCompare(b.name));
  // A closed pit or shaft takes no entries after the day it closed.
  const openPits = byName.filter((s) => !s.closed_on || date <= s.closed_on);

  const startEntry = (s) => {
    setError('');
    setEditing(null);
    setOpenId(s.id);
    setForm({ sacks: '', depth_m: '', vein: pitProgress(s.id, sackCounts).vein || '', notes: '' });
  };
  const startEdit = (c) => {
    setError('');
    setOpenId(null);
    setEditing(c);
    setForm({ date: c.date, shaft_id: c.shaft_id, sacks: String(c.sacks ?? ''), depth_m: c.depth_m ?? '', vein: c.vein || '', notes: c.notes || '' });
  };
  const close = () => { setOpenId(null); setEditing(null); setForm(null); setError(''); };
  useEffect(() => { if (editing) editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [editing]);

  const check = () => {
    const sacks = Number(form.sacks);
    if (form.sacks === '' || !Number.isInteger(sacks) || sacks < 0) return t('sacks.whole');
    if (form.depth_m !== '' && !(Number(form.depth_m) >= 0)) return t('samples.badDepth');
    return null;
  };
  const values = () => ({
    sacks: Number(form.sacks), depth_m: form.depth_m === '' ? null : Number(form.depth_m),
    vein: form.vein || null, notes: form.notes || null,
  });

  const saveEntry = async () => {
    setError('');
    const problem = check();
    if (problem) { setError(problem); return; }
    // A second entry for the same pit and day (another shift) is allowed, but asked about first.
    if (sackCounts.some((c) => c.shaft_id === openId && c.date === date)
      && !window.confirm(`${t('sacks.confirmSecond')} ${nameOf(openId)}\n${t('sacks.addAnyway')}`)) return;
    setSaving(true);
    const { error: err } = await supabase.from('sack_counts').insert({ ...values(), site_id: site.id, logged_by: profile.id, shaft_id: openId, date });
    setSaving(false);
    if (err) { setError(err.message); return; }
    close();
    onRefresh();
  };

  // An edit changes only this one entry and keeps who originally entered it.
  const saveEdit = async () => {
    setError('');
    const problem = check();
    if (problem) { setError(problem); return; }
    setSaving(true);
    const { data, error: err } = await supabase.from('sack_counts')
      .update({ ...values(), date: form.date, shaft_id: form.shaft_id, updated_at: new Date().toISOString() })
      .eq('id', editing.id).select();
    setSaving(false);
    if (err) { setError(err.message); return; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    close();
    onRefresh();
  };

  const handleDelete = async () => {
    if (!window.confirm(`${t('sacks.confirmDelete')}\n${editing.date} · ${nameOf(editing.shaft_id)} · ${editing.sacks}`)) return;
    setError('');
    setSaving(true);
    const { data, error: err } = await supabase.from('sack_counts').delete().eq('id', editing.id).select();
    setSaving(false);
    if (err) { setError(err.message); return; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    close();
    onRefresh();
  };

  const entryFields = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('sacks.sacks')} type="number" value={form?.sacks ?? ''} onChange={(v) => setForm({ ...form, sacks: v })} />
        <Field label={t('sacks.depth')} type="number" value={form?.depth_m ?? ''} onChange={(v) => setForm({ ...form, depth_m: v })} />
      </div>
      <div className={`${LABEL_CLS} mt-3`}>{t('sacks.vein')}</div>
      <div className="flex gap-2 flex-wrap">
        {VEIN_STATES.map((v) => (
          <button key={v} type="button" onClick={() => setForm({ ...form, vein: form.vein === v ? '' : v })}
            className={`px-3 py-2 text-xs uppercase tracking-widest border ${form?.vein === v ? `${VEIN_CLS[v]} border-stone-500` : 'border-stone-300 text-stone-600'}`}>
            {t(`vein.${v}`)}
          </button>
        ))}
      </div>
      <NotesField label={t('sacks.notes')} value={form?.notes ?? ''} onChange={(v) => setForm({ ...form, notes: v })} />
      <ErrorBox error={error} />
    </>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('sacks.title')}</div>
        <div className="text-sm text-stone-600">{t('sacks.subtitle')}</div>
      </div>

      {canAdd && !editing && (shafts.length === 0 ? (
        <div className="bg-white border border-stone-200 px-4 py-3 text-sm text-stone-500">{t('sacks.noShafts')}</div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label={t('sacks.date')} type="date" value={date} onChange={(v) => { setDate(v); close(); }} /></div>
          {openPits.length === 0 && <div className="text-xs text-stone-500">{t('sacks.noneOpen')}</div>}
          {openPits.map((s) => {
            const done = sackCounts.filter((c) => c.shaft_id === s.id && c.date === date);
            const last = pitProgress(s.id, sackCounts);
            return (
              <div key={s.id} className={`bg-white border ${openId === s.id ? 'border-amber-700' : 'border-stone-200'}`}>
                <button onClick={() => (openId === s.id ? close() : startEntry(s))} className="w-full text-left px-4 py-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-stone-900">{s.name}</span>
                    <PhaseBadge phase={resultPhase(s, date)} />
                  </span>
                  <span className="text-xs text-right">
                    {done.length > 0
                      ? <span className="text-emerald-700">✓ {fmtNum(sumOf(done, 'sacks'), 0)} {t('tile.sacks')}{done[0].depth_m != null ? ` · ${fmtNum(done[0].depth_m, 1)} m` : ''}{done[0].vein ? ` · ${t(`vein.${done[0].vein}`)}` : ''}</span>
                      : <span className="text-stone-400">{t('sacks.notEntered')}</span>}
                  </span>
                </button>
                {openId === s.id && form && (
                  <div className="px-4 pb-4 border-t border-stone-100 pt-3">
                    <div className="text-[10px] text-stone-500 mb-2">
                      {t('sacks.lastDepth')} {last.depth !== null ? `${fmtNum(last.depth, 1)} m` : '—'}
                    </div>
                    {entryFields}
                    <div className="flex flex-wrap gap-3 mt-3">
                      <button onClick={saveEntry} disabled={saving} className={SAVE_CLS}>{saving ? t('sacks.saving') : `${t('sacks.saveFor')} ${s.name}`}</button>
                      <button onClick={close} className={CANCEL_CLS}>{t('common.cancel')}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {openPits.length < shafts.length && <div className="text-[10px] text-stone-400">{t('sacks.closedHidden')}</div>}
        </div>
      ))}

      {editing && form && (
        <div ref={editRef} className="bg-white border border-stone-200 p-4">
          <div className="text-[10px] uppercase tracking-widest text-amber-800 mb-3">{t('sacks.editing')} {editing.date}</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label={t('sacks.date')} type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <div>
              <label className={LABEL_CLS}>{t('sacks.shaft')}</label>
              <select value={form.shaft_id} onChange={(e) => setForm({ ...form, shaft_id: e.target.value })} className={INPUT_CLS}>
                {byName.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {entryFields}
          <div className="flex flex-wrap gap-3 mt-3">
            <button onClick={saveEdit} disabled={saving} className={SAVE_CLS}>{saving ? t('sacks.saving') : t('edit.saveChanges')}</button>
            {profile.role === 'super_admin' && <button onClick={handleDelete} disabled={saving} className={DELETE_CLS}>{t('edit.delete')}</button>}
            <button onClick={close} className={CANCEL_CLS}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-stone-100 text-stone-600 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">{t('sacks.colDate')}</th>
              <th className="px-3 py-2 text-left">{t('sacks.colShaft')}</th>
              <th className="px-3 py-2 text-right">{t('sacks.colSacks')}</th>
              <th className="px-3 py-2 text-right">{t('sacks.colDepth')}</th>
              <th className="px-3 py-2 text-left">{t('sacks.colVein')}</th>
              <th className="px-3 py-2 text-left">{t('sacks.colNotes')}</th>
            </tr>
          </thead>
          <tbody>
            {sackCounts.length === 0 && <tr><td colSpan="6" className="px-3 py-8 text-center text-stone-400">{t('sacks.none')}</td></tr>}
            {sackCounts.map((c) => (
              <tr key={c.id} className="border-t border-stone-100">
                <td className="px-3 py-2 text-stone-900 font-medium whitespace-nowrap">
                  {c.date}
                  {canEditPrimary(profile, c) && <button onClick={() => startEdit(c)} className={EDIT_CLS}>{t('edit.edit')}</button>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{nameOf(c.shaft_id)}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtNum(c.sacks, 0)}</td>
                <td className="px-3 py-2 text-right">{c.depth_m != null ? fmtNum(c.depth_m, 1) : '—'}</td>
                <td className="px-3 py-2"><VeinBadge vein={c.vein} /></td>
                <td className="px-3 py-2 text-stone-500">{c.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Grams per sack for each pit or shaft, coloured by its phase today, with the cut-off line.
function PitComparisonChart({ shafts, sackCounts, results, inputs }) {
  const { t } = useT();
  const cutoff = Number(inputs?.cutoff_g_per_sack) || 0;
  const stats = shaftStats(shafts, sackCounts, results, cutoff).filter((p) => p.gPerSack !== null);
  if (stats.length === 0) return null;
  const maxG = Math.max(cutoff, ...stats.map((p) => p.gPerSack)) * 1.15 || 1;
  const W = 300; const H = 150; const base = H - 22; const barW = Math.min(48, (W - 20) / stats.length - 8);
  const yG = (g) => base - (g / maxG) * (base - 10);
  return (
        <div className="bg-white border border-stone-200 p-3">
      <div className={LABEL_CLS}>{t('chart.pitComparison')}</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg" role="img" aria-label={t('chart.pitComparison')}>
            <line x1="0" x2={W} y1={yG(cutoff)} y2={yG(cutoff)} stroke="#BA7517" strokeDasharray="4 3" />
            <text x={W - 2} y={yG(cutoff) - 3} fontSize="9" textAnchor="end" fill="#BA7517">{t('chart.cutoff')} {fmtNum(cutoff, 2)}</text>
            {stats.map((p, i) => {
              const x = 10 + i * (barW + 8);
              const prod = resultPhase(p.shaft, todayISO()) === 'production';
              return (
                <g key={p.shaft.id}>
                  <rect x={x} y={yG(p.gPerSack)} width={barW} height={base - yG(p.gPerSack)} fill={prod ? '#1D9E75' : '#378ADD'} />
                  <text x={x + barW / 2} y={yG(p.gPerSack) - 3} fontSize="9" textAnchor="middle" fill="#444441">{fmtNum(p.gPerSack, 2)}</text>
                  <text x={x + barW / 2} y={H - 8} fontSize="9" textAnchor="middle" fill="#5F5E5A">{p.shaft.name}</text>
                </g>
              );
            })}
          </svg>
          <div className="text-[10px] text-stone-500 flex gap-3 mt-1">
            <span><span className="inline-block w-2 h-2 mr-1" style={{ background: '#1D9E75' }} />{t('phase.production')}</span>
            <span><span className="inline-block w-2 h-2 mr-1" style={{ background: '#378ADD' }} />{t('phase.exploration')}</span>
          </div>
        </div>
  );
}

// Grade against depth for one pit or shaft: each result sits at the depth the pit had reached on its date.
function DepthGradeChart({ shaft, sackCounts, results, inputs }) {
  const { t } = useT();
  const cutoff = Number(inputs?.cutoff_g_per_sack) || 0;
  const days = sackCounts.filter((c) => c.shaft_id === shaft.id && c.depth_m != null && c.depth_m !== '')
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const depthOn = (date) => { let d = null; days.forEach((c) => { if (c.date <= date) d = Number(c.depth_m); }); return d; };
  const points = results.filter((r) => r.shaft_id === shaft.id && Number(r.sacks_milled) > 0)
    .map((r) => ({ id: r.id, d: depthOn(r.date), g: r.gold_g / r.sacks_milled })).filter((p) => p.d !== null).sort((a, b) => a.d - b.d);
  if (points.length === 0) return <div className="text-xs text-stone-400 mt-3">{t('chart.noDepthResults')}</div>;
  const W = 300; const H = 150; const base = H - 22;
  // The depth axis covers this pit's own range, so the points spread across the chart.
  const minD = Math.min(...points.map((p) => p.d));
  const maxD = Math.max(minD + 1, ...points.map((p) => p.d));
  const maxPG = Math.max(cutoff, ...points.map((p) => p.g), 0.1) * 1.15;
  const px = (d) => 40 + ((d - minD) / (maxD - minD)) * (W - 70);
  const py = (g) => base - (g / maxPG) * (base - 10);
  return (
    <div className="mt-3">
      <div className={LABEL_CLS}>{t('chart.depthGrade')}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" role="img" aria-label={t('chart.depthGrade')}>
              <line x1="30" x2={W} y1={py(cutoff)} y2={py(cutoff)} stroke="#BA7517" strokeDasharray="4 3" />
              <line x1="30" x2="30" y1="5" y2={base} stroke="#D3D1C7" />
              <line x1="30" x2={W} y1={base} y2={base} stroke="#D3D1C7" />
              <polyline points={points.map((p) => `${px(p.d)},${py(p.g)}`).join(' ')} fill="none" stroke="#1D9E75" strokeWidth="1.5" />
              {points.map((p) => (
                <g key={p.id}><circle cx={px(p.d)} cy={py(p.g)} r="3" fill="#1D9E75" />
                  <text x={px(p.d)} y={py(p.g) - 6} fontSize="9" textAnchor="middle" fill="#444441">{fmtNum(p.g, 2)}</text></g>
              ))}
              <text x="30" y={H - 6} fontSize="9" fill="#888780">{fmtNum(minD, 1)} m</text>
              <text x={W} y={H - 6} fontSize="9" textAnchor="end" fill="#888780">{fmtNum(maxD, 1)} m</text>
              <text x="2" y="12" fontSize="9" fill="#888780">g/sack</text>
            </svg>
        </div>
  );
}

function MillingResults({ site, shafts, sackCounts, results, inputs, profile, onRefresh }) {
  const { t } = useT();
  const blank = { date: todayISO(), shaft_id: '', sacks_milled: '', gold_g: '', notes: '' };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef(null);
  const canAdd = canAddPrimary(profile);
  const shaftById = useMemo(() => Object.fromEntries(shafts.map((s) => [s.id, s])), [shafts]);
  const nameOf = (id) => shaftById[id]?.name || '—';
  const stats = useMemo(() => Object.fromEntries(
    shaftStats(shafts, sackCounts, results, Number(inputs?.cutoff_g_per_sack)).map((p) => [p.shaft.id, p])),
  [shafts, sackCounts, results, inputs]);
  const sackTonnes = Number(inputs?.sack_kg) / 1000;
  // Sacks still waiting from a pit or shaft, leaving out the result being edited.
  const waitingFor = (id) => (stats[id]?.waiting || 0) + (editing?.shaft_id === id ? Number(editing.sacks_milled) || 0 : 0);

  const sacks = Number(form.sacks_milled);
  const gold = Number(form.gold_g);
  const gps = form.sacks_milled !== '' && form.gold_g !== '' && sacks > 0 && gold >= 0 ? gold / sacks : null;
  const chosen = shaftById[form.shaft_id];

  const closeEdit = () => {
    setEditing(null);
    setError('');
    setForm(blank);
  };

  const startEdit = (r) => {
    setError('');
    setEditing(r);
    setForm({ date: r.date, shaft_id: r.shaft_id, sacks_milled: String(r.sacks_milled ?? ''), gold_g: String(r.gold_g ?? ''), notes: r.notes || '' });
  };

  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editing]);

  const handleSave = async () => {
    setError('');
    if (!chosen) { setError(t('results.chooseShaft')); return; }
    if (form.sacks_milled === '' || !Number.isInteger(sacks) || sacks <= 0) { setError(t('results.enterSacks')); return; }
    if (form.gold_g === '' || !(gold >= 0)) { setError(t('results.enterGold')); return; }
    const waiting = waitingFor(chosen.id);
    if (sacks > waiting
      && !window.confirm(`${t('results.moreThanWaiting')} (${t('results.waiting')}: ${fmtNum(waiting, 0)}).\n${t('results.saveAnyway')}`)) return;
    setSaving(true);
    const fields = { date: form.date, shaft_id: chosen.id, sacks_milled: sacks, gold_g: gold, notes: form.notes || null };
    if (editing) {
      // An edit changes only this one result and keeps who originally entered it.
      const { data, error } = await supabase.from('milling_results')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
        .select();
      setSaving(false);
      if (error) { setError(error.message); return; }
      if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
      closeEdit();
    } else {
      const { error } = await supabase.from('milling_results').insert({ ...fields, site_id: site.id, logged_by: profile.id });
      setSaving(false);
      if (error) { setError(error.message); return; }
      setForm({ ...blank, date: form.date });
    }
    onRefresh();
  };

  const handleDelete = async () => {
    if (!window.confirm(`${t('results.confirmDelete')}\n${editing.date} · ${nameOf(editing.shaft_id)} · ${fmtNum(editing.gold_g, 1)} g`)) return;
    setError('');
    setSaving(true);
    const { data, error } = await supabase.from('milling_results').delete().eq('id', editing.id).select();
    setSaving(false);
    if (error) { setError(error.message); return; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    closeEdit();
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('results.title')}</div>
        <div className="text-sm text-stone-600">
          {results.length} {t('results.entries')} · {fmtNum(sumOf(results, 'gold_g'), 1)} g · {fmtNum(sumOf(results, 'sacks_milled'), 0)} {t('tile.sacks')}
        </div>
      </div>

      {(canAdd || editing) && (shafts.length === 0 ? (
        <div className="bg-white border border-stone-200 px-4 py-3 text-sm text-stone-500">{t('sacks.noShafts')}</div>
      ) : (
        <div ref={formRef} className="bg-white border border-stone-200 p-4">
          {editing && (
            <div className="text-[10px] uppercase tracking-widest text-amber-800 mb-3">{t('results.editing')} {editing.date}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('results.date')} type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <div>
              <label className={LABEL_CLS}>{t('results.shaft')}</label>
              <select value={form.shaft_id} onChange={(e) => setForm({ ...form, shaft_id: e.target.value })} className={INPUT_CLS}>
                <option value="">{t('results.choose')}</option>
                {[...shafts].sort(openFirst).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {fmtNum(waitingFor(s.id), 0)} {t('results.waiting')}</option>
                ))}
              </select>
            </div>
            <Field label={t('results.sacksMilled')} type="number" value={form.sacks_milled} onChange={(v) => setForm({ ...form, sacks_milled: v })} />
            <Field label={t('results.gold')} type="number" value={form.gold_g} onChange={(v) => setForm({ ...form, gold_g: v })} />
          </div>
          <div className="bg-stone-50 border border-stone-200 px-3 py-2 mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-semibold text-stone-900">
              {gps !== null ? `${fmtNum(gps, 2)} ${t('results.perSack')} · ${fmtNum(gps / sackTonnes, 1)} g/t` : '—'}
            </div>
            {chosen && <PhaseBadge phase={resultPhase(chosen, form.date)} />}
          </div>
          <NotesField label={t('results.notes')} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <ErrorBox error={error} />
          <div className="flex flex-wrap gap-3 mt-3">
            <button onClick={handleSave} disabled={saving} className={SAVE_CLS}>
              {saving ? t('results.saving') : editing ? t('edit.saveChanges') : t('results.save')}
            </button>
            {editing && profile.role === 'super_admin' && (
              <button onClick={handleDelete} disabled={saving} className={DELETE_CLS}>{t('edit.delete')}</button>
            )}
            {editing && <button onClick={closeEdit} className={CANCEL_CLS}>{t('common.cancel')}</button>}
          </div>
        </div>
      ))}

      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-stone-100 text-stone-600 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">{t('results.colDate')}</th>
              <th className="px-3 py-2 text-left">{t('results.colShaft')}</th>
              <th className="px-3 py-2 text-right">{t('results.colSacks')}</th>
              <th className="px-3 py-2 text-right">{t('results.colGold')}</th>
              <th className="px-3 py-2 text-right">{t('results.colGps')}</th>
              <th className="px-3 py-2 text-left">{t('results.colPhase')}</th>
              <th className="px-3 py-2 text-left">{t('results.colNotes')}</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr><td colSpan="7" className="px-3 py-8 text-center text-stone-400">{t('results.none')}</td></tr>
            )}
            {results.map((r) => (
              <tr key={r.id} className="border-t border-stone-100">
                <td className="px-3 py-2 text-stone-900 font-medium whitespace-nowrap">
                  {r.date}
                  {canEditPrimary(profile, r) && (
                    <button onClick={() => startEdit(r)} className={EDIT_CLS}>{t('edit.edit')}</button>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{nameOf(r.shaft_id)}</td>
                <td className="px-3 py-2 text-right">{fmtNum(r.sacks_milled, 0)}</td>
                <td className="px-3 py-2 text-right font-medium text-amber-700">{fmtNum(r.gold_g, 1)}</td>
                <td className="px-3 py-2 text-right">{Number(r.sacks_milled) > 0 ? fmtNum(r.gold_g / r.sacks_milled, 2) : '—'}</td>
                <td className="px-3 py-2"><PhaseBadge phase={resultPhase(shaftById[r.shaft_id], r.date)} /></td>
                <td className="px-3 py-2 text-stone-500">{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExcavatorLogs({ site, logs, inputs, transactions, profile, onRefresh }) {
  const { t } = useT();
  const blank = { date: todayISO(), exploration_hrs: '', production_hrs: '', idle_hrs: '', excavator_fuel_barrels: '', mill_fuel_barrels: '', notes: '' };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef(null);
  const canAdd = canAddPrimary(profile);
  // Fuel and machine hours left right now, from the same calculation as the Dashboard.
  const now = useMemo(() => primarySnap(inputs, [], [], [], logs, transactions), [inputs, logs, transactions]);

  const num = (v) => Number(v) || 0;
  const hoursOf = (r) => num(r.exploration_hrs) + num(r.production_hrs) + num(r.idle_hrs);
  const barrelsOf = (r) => num(r.excavator_fuel_barrels) + num(r.mill_fuel_barrels);
  // When editing, the day's old numbers are already counted in what is left.
  const hoursAfter = now ? now.machineHrsRemaining - hoursOf(form) + (editing ? hoursOf(editing) : 0) : 0;
  const fuelAfter = now ? now.fuelRemainingBarrels - barrelsOf(form) + (editing ? barrelsOf(editing) : 0) : 0;

  const closeEdit = () => {
    setEditing(null);
    setError('');
    setForm(blank);
  };

  const startEdit = (l) => {
    setError('');
    setEditing(l);
    setForm({
      date: l.date, notes: l.notes || '',
      ...Object.fromEntries(EXCAVATOR_FIELDS.map((k) => [k, String(l[k] ?? '')])),
    });
  };

  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editing]);

  const handleSave = async () => {
    setError('');
    if (EXCAVATOR_FIELDS.some((k) => Number(form[k]) < 0)) { setError(t('exc.noNegative')); return; }
    if (EXCAVATOR_FIELDS.every((k) => !(Number(form[k]) > 0))) { setError(t('exc.enterSomething')); return; }
    // A second entry for the same day (another shift) is allowed, but asked about first.
    const sameDay = logs.some((l) => l.id !== editing?.id && l.date === form.date);
    if (sameDay && (!editing || editing.date !== form.date) && !window.confirm(t('exc.dateTaken'))) return;
    setSaving(true);
    const fields = { date: form.date, notes: form.notes || null, ...Object.fromEntries(EXCAVATOR_FIELDS.map((k) => [k, num(form[k])])) };
    if (editing) {
      // An edit changes only this one day and keeps who originally entered it.
      const { data, error } = await supabase.from('excavator_logs')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
        .select();
      setSaving(false);
      if (error) { setError(error.message); return; }
      if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    } else {
      const { error } = await supabase.from('excavator_logs').insert({ ...fields, site_id: site.id, logged_by: profile.id });
      setSaving(false);
      if (error) { setError(error.message); return; }
    }
    closeEdit();
    onRefresh();
  };

  const handleDelete = async () => {
    if (!window.confirm(`${t('exc.confirmDelete')}\n${editing.date}`)) return;
    setError('');
    setSaving(true);
    const { data, error } = await supabase.from('excavator_logs').delete().eq('id', editing.id).select();
    setSaving(false);
    if (error) { setError(error.message); return; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    closeEdit();
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('exc.title')}</div>
        <div className="text-sm text-stone-600">{logs.length} {t('exc.entries')}</div>
      </div>

      {now && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone-200">
          <Tile label={t('phase.exploration')} value={fmtNum(now.explorationHrs, 0)} unit="hrs" />
          <Tile label={t('phase.production')} value={fmtNum(now.productionHrs, 0)} unit="hrs" />
          <Tile label={t('tile.idle')} value={fmtNum(now.idleHrs, 0)} unit="hrs" />
          <Tile label={t('tile.totalHours')} value={fmtNum(now.totalHrs, 0)} unit="hrs" />
        </div>
      )}

      {(canAdd || editing) && (
        <div ref={formRef} className="bg-white border border-stone-200 p-4">
          {editing && (
            <div className="text-[10px] uppercase tracking-widest text-amber-800 mb-3">{t('exc.editing')} {editing.date}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label={t('exc.date')} type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <Field label={t('exc.exploration')} type="number" value={form.exploration_hrs} onChange={(v) => setForm({ ...form, exploration_hrs: v })} />
            <Field label={t('exc.production')} type="number" value={form.production_hrs} onChange={(v) => setForm({ ...form, production_hrs: v })} />
            <Field label={t('exc.idle')} type="number" value={form.idle_hrs} onChange={(v) => setForm({ ...form, idle_hrs: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <Field label={t('exc.fuelExcavator')} type="number" value={form.excavator_fuel_barrels} onChange={(v) => setForm({ ...form, excavator_fuel_barrels: v })} />
            <Field label={t('exc.fuelMill')} type="number" value={form.mill_fuel_barrels} onChange={(v) => setForm({ ...form, mill_fuel_barrels: v })} />
          </div>
          {now && (
            <div className="bg-stone-50 border border-stone-200 px-3 py-2 mt-3 text-xs text-stone-700 space-y-0.5">
              <div>
                {fmtNum(hoursOf(form), 1)} {t('exc.hoursToday')} · {t('exc.hoursLeft')} {fmtNum(now.machineHrsRemaining, 0)} →{' '}
                <span className={`font-semibold ${hoursAfter < 100 ? 'text-red-700' : 'text-stone-900'}`}>{fmtNum(hoursAfter, 0)}</span>
              </div>
              <div>
                {fmtBarrels(barrelsOf(form))} {t('exc.barrelsToday')} · {t('exc.fuelLeft')} {fmtBarrels(now.fuelRemainingBarrels)} →{' '}
                <span className={`font-semibold ${fuelAfter < 7 ? 'text-red-700' : 'text-stone-900'}`}>{fmtBarrels(fuelAfter)}</span>
              </div>
            </div>
          )}
          <NotesField label={t('exc.notes')} value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <ErrorBox error={error} />
          <div className="flex flex-wrap gap-3 mt-3">
            <button onClick={handleSave} disabled={saving} className={SAVE_CLS}>
              {saving ? t('exc.saving') : editing ? t('edit.saveChanges') : t('exc.save')}
            </button>
            {editing && profile.role === 'super_admin' && (
              <button onClick={handleDelete} disabled={saving} className={DELETE_CLS}>{t('edit.delete')}</button>
            )}
            {editing && <button onClick={closeEdit} className={CANCEL_CLS}>{t('common.cancel')}</button>}
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-stone-100 text-stone-600 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">{t('exc.colDate')}</th>
              <th className="px-3 py-2 text-right">{t('exc.colExpl')}</th>
              <th className="px-3 py-2 text-right">{t('exc.colProd')}</th>
              <th className="px-3 py-2 text-right">{t('exc.colIdle')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('exc.colTotal')}</th>
              <th className="px-3 py-2 text-right">{t('exc.colFuelExc')}</th>
              <th className="px-3 py-2 text-right">{t('exc.colFuelMill')}</th>
              <th className="px-3 py-2 text-left">{t('exc.colNotes')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan="8" className="px-3 py-8 text-center text-stone-400">{t('exc.none')}</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-stone-100">
                <td className="px-3 py-2 text-stone-900 font-medium whitespace-nowrap">
                  {l.date}
                  {canEditPrimary(profile, l) && (
                    <button onClick={() => startEdit(l)} className={EDIT_CLS}>{t('edit.edit')}</button>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{fmtNum(l.exploration_hrs, 1)}</td>
                <td className="px-3 py-2 text-right">{fmtNum(l.production_hrs, 1)}</td>
                <td className="px-3 py-2 text-right text-stone-400">{l.idle_hrs > 0 ? fmtNum(l.idle_hrs, 1) : '—'}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmtNum(hoursOf(l), 1)}</td>
                <td className="px-3 py-2 text-right">{fmtBarrels(l.excavator_fuel_barrels)}</td>
                <td className="px-3 py-2 text-right">{fmtBarrels(l.mill_fuel_barrels)}</td>
                <td className="px-3 py-2 text-stone-500">{l.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    idle_hrs: '',
    gold_g: '',
    fuel_received_barrels: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const formRef = useRef(null);

  // Super admin can change any log; a site manager only the logs they entered (same rule as the database).
  const canEdit = (l) => profile.role === 'super_admin' || (profile.role === 'site_manager' && l.logged_by === profile.id);

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setError('');
    setForm({ date: todayISO(), cleaning_hrs: '', prep_hrs: '', idle_hrs: '', gold_g: '', fuel_received_barrels: '', notes: '' });
  };

  const startEdit = (l) => {
    setError('');
    setEditing(l);
    setForm({
      date: l.date,
      cleaning_hrs: String(l.cleaning_hrs ?? ''),
      prep_hrs: String(l.prep_hrs ?? ''),
      idle_hrs: String(l.idle_hrs ?? ''),
      gold_g: String(l.gold_g ?? ''),
      fuel_received_barrels: String(l.fuel_received_barrels ?? ''),
      notes: l.notes || '',
    });
    setShowForm(true);
  };

  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editing]);

  // An edit changes only this one log and keeps who originally entered it.
  const saveEdit = async ({ site_id, logged_by, ...changes }) => {
    if (logs.some((l) => l.id !== editing.id && l.date === changes.date)) {
      setSaving(false);
      setError(t('daily.dateTaken'));
      return;
    }
    const { data, error } = await supabase.from('daily_logs')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', editing.id)
      .select();
    setSaving(false);
    if (error) { setError(error.message); return; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    closeForm();
    onRefresh();
  };

  const handleDelete = async () => {
    if (!window.confirm(`${t('daily.confirmDelete')}\n${editing.date}`)) return;
    setError('');
    setSaving(true);
    const { data, error } = await supabase.from('daily_logs').delete().eq('id', editing.id).select();
    setSaving(false);
    if (error) { setError(error.message); return; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    closeForm();
    onRefresh();
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    const payload = {
      site_id: site.id,
      logged_by: profile.id,
      date: form.date,
      cleaning_hrs: Number(form.cleaning_hrs) || 0,
      prep_hrs: Number(form.prep_hrs) || 0,
      idle_hrs: Number(form.idle_hrs) || 0,
      gold_g: Number(form.gold_g) || 0,
      fuel_received_barrels: Number(form.fuel_received_barrels) || 0,
      notes: form.notes || null,
    };
    if (editing) { await saveEdit(payload); return; }
    const { error } = await supabase.from('daily_logs').upsert(payload, { onConflict: 'site_id,date' });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setShowForm(false);
    setForm({ date: todayISO(), cleaning_hrs: '', prep_hrs: '', idle_hrs: '', gold_g: '', fuel_received_barrels: '', notes: '' });
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
          onClick={() => (showForm ? closeForm() : setShowForm(true))}
          className="bg-stone-900 text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-amber-700 transition-colors"
        >
          {showForm ? t('daily.cancel') : t('daily.newLog')}
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white border border-stone-200 p-4 mb-4">
          {editing && (
            <div className="text-[10px] uppercase tracking-widest text-amber-800 mb-3">{t('daily.editing')} {editing.date}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('daily.date')} type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <Field label={t('daily.goldProduced')} type="number" value={form.gold_g} onChange={(v) => setForm({ ...form, gold_g: v })} />
            <Field label={t('daily.cleaningHours')} type="number" value={form.cleaning_hrs} onChange={(v) => setForm({ ...form, cleaning_hrs: v })} />
            <Field label={t('daily.prepHours')} type="number" value={form.prep_hrs} onChange={(v) => setForm({ ...form, prep_hrs: v })} />
            <Field label={t('daily.idleHours')} type="number" value={form.idle_hrs} onChange={(v) => setForm({ ...form, idle_hrs: v })} />
            <Field label={t('daily.fuelReceived')} type="number" value={form.fuel_received_barrels} onChange={(v) => setForm({ ...form, fuel_received_barrels: v })} />
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
            {saving ? t('daily.saving') : editing ? t('edit.saveChanges') : t('daily.saveLog')}
          </button>
          {editing && profile.role === 'super_admin' && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="mt-3 ml-3 border border-red-300 text-red-700 px-6 py-2 text-xs uppercase tracking-widest hover:bg-red-50 disabled:opacity-50"
            >
              {t('edit.delete')}
            </button>
          )}
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
              <th className="px-3 py-2 text-right">{t('daily.colIdle')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('daily.colTotal')}</th>
              <th className="px-3 py-2 text-right">{t('daily.colGold')}</th>
              <th className="px-3 py-2 text-right">{t('daily.colFuelIn')}</th>
              <th className="px-3 py-2 text-left">{t('daily.colNotes')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan="8" className="px-3 py-8 text-center text-stone-400">{t('daily.noLogs')}</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-stone-100">
                <td className="px-3 py-2 text-stone-900 font-medium whitespace-nowrap">
                  {l.date}
                  {canEdit(l) && (
                    <button onClick={() => startEdit(l)}
                      className="ml-2 px-2 py-1 border border-stone-300 text-[10px] uppercase tracking-widest text-stone-600 hover:border-amber-700 hover:text-amber-700">
                      {t('edit.edit')}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{fmtNum(l.cleaning_hrs, 1)}</td>
                <td className="px-3 py-2 text-right">{fmtNum(l.prep_hrs, 1)}</td>
                <td className="px-3 py-2 text-right text-stone-400">{l.idle_hrs > 0 ? fmtNum(l.idle_hrs, 1) : '—'}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {fmtNum((Number(l.cleaning_hrs) || 0) + (Number(l.prep_hrs) || 0) + (Number(l.idle_hrs) || 0), 1)}
                </td>
                <td className="px-3 py-2 text-right font-medium text-amber-700">{fmtNum(l.gold_g, 1)}</td>
                <td className="px-3 py-2 text-right">{fmtNum(l.fuel_received_barrels, 1)}</td>
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
function Transactions({ site, transactions, profile, onRefresh, expenseCategories = CATEGORIES }) {
  const { t } = useT();
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { date: todayISO(), amount: '', type: 'expense', category: expenseCategories[0], paid_by: '', notes: '', gold_grams_sold: '', fuel_barrels_topped_up: '', machine_hrs_topped_up: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const formRef = useRef(null);
  // Only the super admin can change or delete statement entries (same rule as the database).
  const canEdit = profile.role === 'super_admin';

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setError('');
    setForm(emptyForm);
  };

  const startEdit = (tx) => {
    setError('');
    setEditing(tx);
    setForm({
      date: tx.date,
      amount: String(tx.amount ?? ''),
      type: tx.type,
      category: tx.category,
      paid_by: tx.paid_by || '',
      notes: tx.notes || '',
      gold_grams_sold: String(tx.gold_grams_sold ?? ''),
      fuel_barrels_topped_up: String(tx.fuel_barrels_topped_up ?? ''),
      machine_hrs_topped_up: String(tx.machine_hrs_topped_up ?? ''),
    });
    setShowForm(true);
  };

  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editing]);

  // An edit changes only this one entry and keeps who originally entered it.
  const saveEdit = async ({ site_id, entered_by, ...changes }) => {
    const { data, error } = await supabase.from('transactions')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', editing.id)
      .select();
    setSaving(false);
    if (error) { setError(error.message); return; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    closeForm();
    onRefresh();
  };

  const handleDelete = async () => {
    if (!window.confirm(`${t('tx.confirmDelete')}\n${editing.date} · ${editing.category} · ${fmtETB(editing.amount)} ETB`)) return;
    setError('');
    setSaving(true);
    const { data, error } = await supabase.from('transactions').delete().eq('id', editing.id).select();
    setSaving(false);
    if (error) { setError(error.message); return; }
    if (!data || data.length === 0) { setError(t('edit.notSaved')); return; }
    closeForm();
    onRefresh();
  };

  const handleTypeChange = (newType) => {
    setForm({ ...form, type: newType, category: newType === 'credit' ? 'Gold Sale' : expenseCategories[0], gold_grams_sold: '' });
  };

  const handleSave = async () => {
    setError('');
    // A Fuel purchase without barrels adds nothing to the fuel stock; make sure that's intended.
    if (form.type === 'expense' && form.category === 'Fuel' && !(Number(form.fuel_barrels_topped_up) > 0)
      && !window.confirm(t('tx.noBarrelsConfirm'))) return;
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
    if (editing) { await saveEdit(payload); return; }
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

  const categoryList = form.type === 'credit' ? CREDIT_CATEGORIES : expenseCategories;
  // Keep an older entry's category selectable when editing, even if it is no longer in the list.
  const categoryOptions = categoryList.includes(form.category) ? categoryList : [...categoryList, form.category];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-stone-500">{t('tx.title')}</div>
          <div className="text-sm text-stone-600">{transactions.length} {t('status.transactions')} · Expense {fmtETB(totals.exp)} · Credit {fmtETB(totals.cr)} ETB</div>
        </div>
        <button
          onClick={() => (showForm ? closeForm() : setShowForm(true))}
          className="bg-stone-900 text-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-amber-700 transition-colors"
        >
          {showForm ? t('tx.cancel') : t('tx.newTx')}
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white border border-stone-200 p-4 mb-4">
          {editing && (
            <div className="text-[10px] uppercase tracking-widest text-amber-800 mb-3">{t('tx.editing')} {editing.date}</div>
          )}
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
                {categoryOptions.map((c) => (
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
            {saving ? t('tx.saving') : editing ? t('edit.saveChanges') : t('tx.saveTx')}
          </button>
          {editing && canEdit && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="mt-3 ml-3 border border-red-300 text-red-700 px-6 py-2 text-xs uppercase tracking-widest hover:bg-red-50 disabled:opacity-50"
            >
              {t('edit.delete')}
            </button>
          )}
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
                <td className="px-3 py-2 text-stone-900 font-medium whitespace-nowrap">
                  {tx.date}
                  {canEdit && (
                    <button onClick={() => startEdit(tx)}
                      className="ml-2 px-2 py-1 border border-stone-300 text-[10px] uppercase tracking-widest text-stone-600 hover:border-amber-700 hover:text-amber-700">
                      {t('edit.edit')}
                    </button>
                  )}
                </td>
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
  const primary = isPrimarySite(site);

  useEffect(() => { setForm(inputs); }, [inputs]);

  if (!form) return <div className="text-sm text-stone-500">Loading…</div>;

  const handleSave = async () => {
    setError('');
    if (primary && !(Number(form.sack_kg) > 0)) { setError(t('inputs.sackKgPositive')); return; }
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
        // Only primary sites have these settings.
        ...(primary ? {
          sack_kg: Number(form.sack_kg),
          cutoff_g_per_sack: Number(form.cutoff_g_per_sack),
          excavator_on: !!form.excavator_on,
        } : {}),
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
  // A primary site hides the alluvial-only settings; opening fuel and machine hours show only with the excavator on.
  const alluvialOnly = ['fuel_price', 'rental_rate', 'cleaning_fuel_rate', 'prep_fuel_rate', 'fuel_per_barrel', 'efficiency_threshold'];
  const excavatorOnly = ['machine_hrs_opening', 'fuel_barrels_opening'];
  const shownGroups = !primary ? groups : [
    ...groups
      .map((g) => ({ ...g, fields: g.fields.filter((f) => !alluvialOnly.includes(f.key) && (form.excavator_on || !excavatorOnly.includes(f.key))) }))
      .filter((g) => g.fields.length > 0),
    {
      titleKey: 'inputs.primaryMining',
      fields: [
        { key: 'sack_kg', label: t('inputs.sackKg'), unit: 'kg' },
        { key: 'cutoff_g_per_sack', label: t('inputs.cutoff'), unit: 'g/sack' },
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

      {primary && (
        <label className="bg-white border border-stone-200 px-4 py-3 flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={!!form.excavator_on} onChange={(e) => setForm({ ...form, excavator_on: e.target.checked })}
            className="mt-0.5 w-4 h-4 accent-amber-700 flex-shrink-0" />
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-900 font-semibold">{t('inputs.excavatorOn')}</div>
            <div className="text-xs text-stone-500 mt-0.5">{t('inputs.excavatorHelp')}</div>
          </div>
        </label>
      )}

      {shownGroups.map((g) => (
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

      {/* Telegram reports are not built for primary sites yet, so a channel can't be connected to one. */}
      {!primary && <TelegramSettings site={site} profile={profile} />}
    </div>
  );
}

// ============================================================
// TELEGRAM REPORTS (super admin, inside Inputs)
// ============================================================
// The bot runs in Supabase and is deployed by hand, so it can fall behind the app.
// scripts/check-telegram-calc.mjs keeps this equal to BOT_VERSION in the bot's code.
const TELEGRAM_BOT_VERSION = 'eee2a2a9ee';
const TELEGRAM_BOT_FILE = 'https://github.com/Semegn/armada-mining/blob/main/supabase/functions/telegram-reports/index.ts';

function TelegramSettings({ site, profile }) {
  const { t } = useT();
  const demo = isDemoActive();
  const [setting, setSetting] = useState(null);
  const [channels, setChannels] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [botOutdated, setBotOutdated] = useState(false);

  useEffect(() => {
    if (demo) return;
    supabase.from('site_telegram').select('*').eq('site_id', site.id).maybeSingle()
      .then(({ data }) => setSetting(data || null));
  }, [demo, site.id]);

  // The supabase wrapper has no functions.invoke(), so call the real client directly.
  // This is never reached in Demo Mode, so demo data can't reach Supabase or Telegram.
  const callBot = async (body) => {
    const { data, error } = await realSupabase.functions.invoke('telegram-reports', { body });
    if (!error) return data;
    let message = error.message;
    try { message = (await error.context.json()).error || message; } catch (_) {}
    throw new Error(message);
  };

  // Warn when the bot in Supabase is missing or older than this app expects.
  useEffect(() => {
    if (demo) return;
    callBot({ action: 'version' })
      .then((data) => setBotOutdated(data?.version !== TELEGRAM_BOT_VERSION))
      .catch(() => setBotOutdated(true));
  }, [demo]);

  const run = async (name, action) => {
    setBusy(name);
    setNotice(null);
    try { await action(); } catch (e) { setNotice({ ok: false, text: e.message }); }
    setBusy('');
  };

  const findChannels = () => run('find', async () => {
    const data = await callBot({ action: 'list_channels' });
    setChannels(data.channels || []);
  });

  const connect = (channel) => run('save', async () => {
    const { data, error } = await supabase.from('site_telegram').upsert({
      site_id: site.id,
      chat_id: channel.id,
      chat_title: channel.title,
      enabled: true,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    }, { onConflict: 'site_id' }).select().maybeSingle();
    if (error) throw new Error(error.message);
    setSetting(data);
    setChannels(null);
    setNotice({ ok: true, text: t('tg.saved') });
  });

  const sendTest = () => run('test', async () => {
    await callBot({ action: 'send_test', site_id: site.id });
    setNotice({ ok: true, text: t('tg.testSent') });
  });

  // The bot posts past reports in batches; each call says how many are left.
  const sendPast = () => run('past', async () => {
    if (!window.confirm(t('tg.confirmPast'))) return;
    let total = 0;
    for (;;) {
      const res = await callBot({ action: 'backfill', site_id: site.id });
      total += res.posted;
      if (res.done) break;
      if (res.posted === 0) throw new Error(t('tg.pastStuck'));
      setNotice({ ok: true, text: `${t('tg.pastProgress')} ${total} / ${total + res.remaining}` });
    }
    setNotice({ ok: true, text: `${t('tg.pastDone')} (${total})` });
  });

  const disconnect = () => run('remove', async () => {
    if (!window.confirm(t('tg.confirmDisconnect'))) return;
    const { error } = await supabase.from('site_telegram').delete().eq('site_id', site.id);
    if (error) throw new Error(error.message);
    setSetting(null);
    setNotice({ ok: true, text: t('tg.removed') });
  });

  const btn = 'px-4 py-2 text-xs uppercase tracking-widest border transition-colors disabled:opacity-50';
  return (
    <div className="bg-white border border-stone-200">
      <div className="bg-stone-100 px-4 py-2 text-[10px] uppercase tracking-widest text-stone-600 font-semibold">{t('tg.title')}</div>
      <div className="p-4 space-y-3 text-sm">
        <div className="text-stone-600">{t('tg.subtitle')}</div>
        {demo ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">{t('tg.demoNote')}</div>
        ) : (
          <>
            {botOutdated && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs">
                {t('tg.outdated')}{' '}
                <a href={TELEGRAM_BOT_FILE} target="_blank" rel="noreferrer" className="underline font-semibold">{t('tg.openBotFile')}</a>
              </div>
            )}
            <div className="text-stone-900">
              {setting
                ? <>{t('tg.connected')} <span className="font-semibold break-words">{setting.chat_title || setting.chat_id}</span></>
                : t('tg.notConnected')}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={findChannels} disabled={!!busy} className={`${btn} bg-stone-900 text-white border-stone-900 hover:bg-amber-700`}>
                {busy === 'find' ? t('tg.finding') : t('tg.find')}
              </button>
              {setting && (
                <button onClick={sendTest} disabled={!!busy} className={`${btn} bg-amber-700 text-white border-amber-700 hover:bg-amber-800`}>
                  {busy === 'test' ? t('tg.sending') : t('tg.sendTest')}
                </button>
              )}
              {setting && (
                <button onClick={sendPast} disabled={!!busy} className={`${btn} border-stone-300 text-stone-700 hover:border-amber-700 hover:text-amber-700`}>
                  {busy === 'past' ? t('tg.posting') : t('tg.sendPast')}
                </button>
              )}
              {setting && (
                <button onClick={disconnect} disabled={!!busy} className={`${btn} border-red-300 text-red-700 hover:bg-red-50`}>
                  {t('tg.disconnect')}
                </button>
              )}
            </div>
            {channels && (channels.length === 0 ? (
              <div className="text-xs text-stone-500">{t('tg.noneFound')}</div>
            ) : (
              <div className="space-y-2">
                {channels.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 border border-stone-200 px-3 py-2">
                    <div className="min-w-0 break-words">
                      {c.title} <span className="text-[10px] uppercase tracking-widest text-stone-400">{c.type}</span>
                    </div>
                    <button onClick={() => connect(c)} disabled={!!busy}
                      className={`${btn} flex-shrink-0 border-stone-300 text-stone-700 hover:border-amber-700 hover:text-amber-700`}>
                      {t('tg.connect')}
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {notice && (
              <div className={`text-xs px-3 py-2 border ${notice.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                {notice.text}
              </div>
            )}
            <div className="text-xs text-stone-500">{t('tg.help')}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SITE PICKER
// ============================================================
function SitePicker({ sites, profile, onSelect, onRefreshSites }) {
  const { t } = useT();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', site_type: 'alluvial' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setError('');
    setSaving(true);
    // The site type is only sent for primary sites; new sites are alluvial by default.
    const primary = form.site_type === 'primary';
    const { data: newSite, error: sErr } = await supabase
      .from('sites')
      .insert({ name: form.name.trim(), location: form.location.trim(), ...(primary ? { site_type: 'primary' } : {}) })
      .select()
      .single();
    if (sErr) { setError(sErr.message); setSaving(false); return; }
    await supabase.from('inputs').insert({
      site_id: newSite.id,
      gold_price: 0, fuel_price: 0, rental_rate: 0,
      royalty_rate: 0.07, landowner_share: 0.30,
      target_cash_reserve: 0, efficiency_threshold: 0,
      opening_cash: 0, machine_hrs_opening: 0,
      fuel_barrels_opening: 0, fuel_per_barrel: 200,
      cleaning_fuel_rate: 25, prep_fuel_rate: 20,
      ...(primary ? { sack_kg: 25, cutoff_g_per_sack: 0.4, excavator_on: false } : {}),
    });
    setSaving(false);
    setShowCreate(false);
    setForm({ name: '', location: '', site_type: 'alluvial' });
    await onRefreshSites();
    onSelect(newSite);
  };

  const handleClone = async (sourceSite) => {
    if (!window.confirm(`Clone "${sourceSite.name}" as Demo Site?`)) return;
    setError(''); setSaving(true);
    
    const { data: newSite, error: sErr } = await supabase.from('sites')
      .insert({ name: `${sourceSite.name} (Demo)`, location: sourceSite.location })
      .select().single();
      
    if (sErr) { setError(sErr.message); setSaving(false); return; }
    
    const { data: inputs } = await supabase.from('inputs').select('*').eq('site_id', sourceSite.id).maybeSingle();
    if (inputs) {
      delete inputs.id; delete inputs.created_at; inputs.site_id = newSite.id;
      await supabase.from('inputs').insert(inputs);
    }
    
    const { data: logs } = await supabase.from('daily_logs').select('*').eq('site_id', sourceSite.id);
    if (logs && logs.length > 0) {
      const newLogs = logs.map(l => { const { id, created_at, ...rest } = l; return { ...rest, site_id: newSite.id }; });
      await supabase.from('daily_logs').insert(newLogs);
    }
    
    const { data: txs } = await supabase.from('transactions').select('*').eq('site_id', sourceSite.id);
    if (txs && txs.length > 0) {
      const newTxs = txs.map(t => { const { id, created_at, ...rest } = t; return { ...rest, site_id: newSite.id }; });
      await supabase.from('transactions').insert(newTxs);
    }
    
    setSaving(false);
    await onRefreshSites();
    alert('Site cloned successfully! Please ensure your Supabase RLS policies allow the demo account to view this new site.');
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4 py-12" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <img src={logoShield} alt="" className="w-8 h-8" />
          <div>
            <div className="text-sm tracking-widest uppercase font-semibold text-stone-900">Armada Mining</div>
            <div className="text-[10px] uppercase tracking-widest text-stone-500">
              {sites.length > 0 ? 'Select a site to continue' : 'No sites assigned yet'}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {sites.map((s) => (
            <div key={s.id} className="w-full text-left bg-white border border-stone-200 px-5 py-4 hover:border-amber-700 hover:bg-amber-50 transition-colors group cursor-pointer" onClick={() => onSelect(s)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-stone-900 group-hover:text-amber-800">
                    {s.name}
                    {isPrimarySite(s) && (
                      <span className="ml-2 align-middle text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-amber-50 text-amber-800 font-normal">{t('site.primaryTag')}</span>
                    )}
                  </div>
                  {s.location && <div className="text-[10px] uppercase tracking-widest text-stone-500 mt-0.5">{s.location}</div>}
                </div>
                <div className="flex items-center gap-4">
                  {/* Cloning copies daily logs and the statement only, so it is not offered for primary sites. */}
                  {profile?.role === 'super_admin' && !isPrimarySite(s) && (
                    <button onClick={(e) => { e.stopPropagation(); handleClone(s); }} className="text-stone-400 hover:text-amber-700 text-[10px] uppercase tracking-widest px-2 py-1 border border-stone-200 hover:border-amber-700 bg-white">
                      Clone
                    </button>
                  )}
                  <div className="text-stone-400 group-hover:text-amber-700 text-xs uppercase tracking-widest">Enter →</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {sites.length === 0 && profile.role !== 'super_admin' && (
          <div className="text-center py-8 text-stone-400 text-sm">Contact your admin to be assigned to a site.</div>
        )}

        {profile.role === 'super_admin' && (
          <div className="mt-6">
            {!showCreate ? (
              <button onClick={() => setShowCreate(true)}
                className="w-full py-3 text-xs uppercase tracking-widest text-stone-500 border border-dashed border-stone-300 hover:border-amber-700 hover:text-amber-700 transition-colors">
                + New Site
              </button>
            ) : (
              <div className="bg-white border border-stone-200 p-4">
                <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-3 font-semibold">New Site</div>
                <div className="grid gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">Site Name</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Armada North"
                      className="w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">Location</label>
                    <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="e.g. Oromia Region"
                      className="w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-amber-700" />
                  </div>
                  <div>
                    <div className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">{t('site.type')}</div>
                    {['alluvial', 'primary'].map((type) => (
                      <label key={type} className="flex items-center gap-2 py-1 text-sm text-stone-700 cursor-pointer">
                        <input type="radio" name="site_type" value={type} checked={form.site_type === type}
                          onChange={() => setForm({ ...form, site_type: type })} className="accent-amber-700" />
                        {t(`site.${type}`)}
                      </label>
                    ))}
                  </div>
                </div>
                {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 mt-3">{error}</div>}
                <div className="flex gap-2 mt-3">
                  <button onClick={handleCreate} disabled={saving || !form.name.trim()}
                    className="bg-amber-700 text-white px-6 py-2 text-xs uppercase tracking-widest hover:bg-amber-800 disabled:bg-stone-400">
                    {saving ? 'Creating…' : 'Create Site'}
                  </button>
                  <button onClick={() => { setShowCreate(false); setError(''); setForm({ name: '', location: '', site_type: 'alluvial' }); }}
                    className="px-6 py-2 text-xs uppercase tracking-widest text-stone-600 hover:text-stone-900 border border-stone-300">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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
  const [shafts, setShafts] = useState([]);
  const [sackCounts, setSackCounts] = useState([]);
  const [millingResults, setMillingResults] = useState([]);
  const [excavatorLogs, setExcavatorLogs] = useState([]);
  const [samples, setSamples] = useState([]);
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState('');

  // Auth bootstrap
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email === 'demo@armadamining.com') {
        localStorage.setItem('armada_demo_active', 'true');
      }
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (sess?.user?.email === 'demo@armadamining.com') {
        localStorage.setItem('armada_demo_active', 'true');
      }
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load profile and sites when session exists — parallel fetch so all
  // state lands in one render batch (no empty-picker flash).
  useEffect(() => {
    if (!session) {
      setProfile(null); setSites([]); setSite(null);
      return;
    }
    (async () => {
      setBootError('');
      const [profResult, sitesResult] = await Promise.all([
        supabase.from('users').select('*').eq('id', session.user.id).maybeSingle(),
        supabase.from('sites').select('*').order('name'),
      ]);
      if (profResult.error) { setBootError(profResult.error.message); return; }
      
      let prof = profResult.data;
      if (!prof) {
        if (session.user.email === 'demo@armadamining.com') {
          prof = { id: session.user.id, name: 'Demo Mode', role: 'site_manager' };
        } else {
          setBootError('No profile found for this account. Contact super admin.'); 
          return; 
        }
      }
      
      if (sitesResult.error) { setBootError(sitesResult.error.message); return; }

      const ss = sitesResult.data || [];

      // All three updates in one synchronous block → React batches into one render
      setProfile(prof);
      setSites(ss);
      if (ss.length === 1) {
        setSite(ss[0]);
      } else if (ss.length > 1) {
        try {
          const savedId = localStorage.getItem('armada_site_id');
          const remembered = savedId ? ss.find((s) => s.id === savedId) : null;
          if (remembered) setSite(remembered);
        } catch (_) {}
      }
    })();
  }, [session]);

  const refreshSites = async () => {
    const { data: ss } = await supabase.from('sites').select('*').order('name');
    setSites(ss || []);
  };

  // Load site data
  const refreshSiteData = async () => {
    if (!site) return;
    const primary = isPrimarySite(site);
    const [inputsR, logsR, txR, shaftsR, sacksR, resultsR, excavatorR, samplesR] = await Promise.all([
      supabase.from('inputs').select('*').eq('site_id', site.id).maybeSingle(),
      supabase.from('daily_logs').select('*').eq('site_id', site.id).order('date', { ascending: false }),
      supabase.from('transactions').select('*').eq('site_id', site.id).order('date', { ascending: false }),
      // Only primary sites read these tables.
      ...(primary ? [
        supabase.from('shafts').select('*').eq('site_id', site.id).order('name'),
        supabase.from('sack_counts').select('*').eq('site_id', site.id).order('date', { ascending: false }),
        supabase.from('milling_results').select('*').eq('site_id', site.id).order('date', { ascending: false }),
        supabase.from('excavator_logs').select('*').eq('site_id', site.id).order('date', { ascending: false }),
        supabase.from('shaft_samples').select('*').eq('site_id', site.id).order('date', { ascending: false }),
      ] : []),
    ]);
    setInputs(inputsR.data);
    setLogs(logsR.data || []);
    setTransactions(txR.data || []);
    setShafts(shaftsR?.data || []);
    setSackCounts(sacksR?.data || []);
    setMillingResults(resultsR?.data || []);
    setExcavatorLogs(excavatorR?.data || []);
    setSamples(samplesR?.data || []);
  };

  useEffect(() => { refreshSiteData(); }, [site]);

  // Alluvial and primary sites have different tabs: after switching sites, or turning the
  // excavator off, go to the Dashboard if the open tab isn't there.
  useEffect(() => {
    if (!site) return;
    const pages = isPrimarySite(site)
      ? ['shafts', 'sacks', 'results', ...(inputs && !inputs.excavator_on ? [] : ['excavator'])]
      : ['daily', 'weekly'];
    const shared = ['dashboard', 'transactions', 'history', 'inputs', 'language'];
    if (!shared.includes(page) && !pages.includes(page)) setPage('dashboard');
  }, [site, inputs, page]);

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

  if (!profile) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-500 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        Loading profile…
      </div>
    );
  }

  if (!site) {
    return (
      <LocaleProvider>
        <SitePicker
          sites={sites}
          profile={profile}
          onSelect={(s) => { setSite(s); try { localStorage.setItem('armada_site_id', s.id); } catch (_) {} }}
          onRefreshSites={refreshSites}
        />
      </LocaleProvider>
    );
  }

  const primary = isPrimarySite(site);

  return (
    <LocaleProvider>
      <Shell
        user={session.user}
        profile={profile}
        site={site}
        sites={sites}
        onSwitchSite={() => { setSite(null); try { localStorage.removeItem('armada_site_id'); } catch (_) {} }}
        page={page}
        setPage={setPage}
        onLogout={handleLogout}
        excavatorOn={!!inputs?.excavator_on}
      >
        {page === 'dashboard' && !primary && <Dashboard site={site} inputs={inputs} logs={logs} transactions={transactions} />}
        {page === 'dashboard' && primary && (
          <PrimaryDashboard inputs={inputs} shafts={shafts} sackCounts={sackCounts} results={millingResults}
            excavatorLogs={excavatorLogs} transactions={transactions} />
        )}
        {page === 'daily' && !primary && <DailyLogs site={site} logs={logs} profile={profile} onRefresh={refreshSiteData} />}
        {page === 'shafts' && primary && (
          <Shafts site={site} shafts={shafts} sackCounts={sackCounts} results={millingResults} samples={samples} inputs={inputs}
            profile={profile} onRefresh={refreshSiteData} />
        )}
        {page === 'sacks' && primary && (
          <SackCounts site={site} shafts={shafts} sackCounts={sackCounts} profile={profile} onRefresh={refreshSiteData} />
        )}
        {page === 'results' && primary && (
          <MillingResults site={site} shafts={shafts} sackCounts={sackCounts} results={millingResults} inputs={inputs}
            profile={profile} onRefresh={refreshSiteData} />
        )}
        {page === 'excavator' && primary && inputs?.excavator_on && (
          <ExcavatorLogs site={site} logs={excavatorLogs} inputs={inputs} transactions={transactions}
            profile={profile} onRefresh={refreshSiteData} />
        )}
        {page === 'transactions' && (
          <Transactions site={site} transactions={transactions} profile={profile} onRefresh={refreshSiteData}
            expenseCategories={primary ? primaryCategories(!!inputs?.excavator_on) : undefined} />
        )}
        {page === 'weekly' && !primary && <WeeklyReport inputs={inputs} logs={logs} transactions={transactions} />}
        {page === 'history' && <ChangeHistory site={site} shafts={shafts} />}
        {page === 'inputs' && profile.role === 'super_admin' && <Inputs site={site} inputs={inputs} profile={profile} onRefresh={refreshSiteData} />}
        {page === 'language' && profile.role === 'super_admin' && <TranslationsAdmin profile={profile} />}
      </Shell>
    </LocaleProvider>
  );
}
