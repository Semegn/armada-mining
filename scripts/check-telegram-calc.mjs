// Confirms the Telegram bot uses exactly the same calculations as the app.
// supabase/functions/telegram-reports/index.ts carries copies of these functions from
// src/App.jsx. Run this before deploying the bot: node scripts/check-telegram-calc.mjs
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('src/App.jsx');
const bot = read('supabase/functions/telegram-reports/index.ts');

// A top-level `const name = ...` or `function name(...)` up to its closing brace at column 0.
const grab = (src, name) =>
  src.match(new RegExp(`^(?:const ${name} = |function ${name}\\()[\\s\\S]*?^\\};?$`, 'm'))?.[0];

let ok = true;
for (const name of ['weekStart', 'addDays', 'fmtETB', 'fmtNum', 'dailyFuelUsedL', 'weeklySnap']) {
  const inApp = grab(app, name);
  const inBot = grab(bot, name);
  if (inApp && inApp === inBot) {
    console.log(`✓ ${name}`);
  } else {
    ok = false;
    console.error(`✗ ${name}: ${!inApp ? 'not found in src/App.jsx' : !inBot ? 'missing from the bot' : 'the bot copy differs from src/App.jsx'}`);
  }
}
if (!ok) console.error('Copy the functions marked ✗ from src/App.jsx into supabase/functions/telegram-reports/index.ts.');
process.exit(ok ? 0 : 1);
