// Confirms the Telegram bot uses exactly the same calculations as the app, and that its
// version number is current. supabase/functions/telegram-reports/index.ts carries copies of
// these functions from src/App.jsx. Run this before deploying the bot:
//   node scripts/check-telegram-calc.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('src/App.jsx');
const bot = read('supabase/functions/telegram-reports/index.ts');

// A top-level `const name = ...` or `function name(...)` up to its closing brace at column 0.
const grab = (src, name) =>
  src.match(new RegExp(`^(?:const ${name} = |function ${name}\\()[\\s\\S]*?^\\};?$`, 'm'))?.[0];

let ok = true;
for (const name of ['weekStart', 'addDays', 'fmtETB', 'fmtNum', 'fmtBarrels', 'weeklySnap']) {
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

// The bot's version is a fingerprint of its own code, so any change to the bot needs a new
// number, and the app must expect the same number to warn about an outdated deployed bot.
const VERSION_LINE = /^const BOT_VERSION = '([0-9a-f]*)';$/m;
const expected = createHash('sha256').update(bot.replace(VERSION_LINE, "const BOT_VERSION = '';")).digest('hex').slice(0, 10);
const inBot = bot.match(VERSION_LINE)?.[1];
const inApp = app.match(/^const TELEGRAM_BOT_VERSION = '([0-9a-f]*)';$/m)?.[1];
if (inBot === expected && inApp === expected) {
  console.log(`✓ bot version ${expected} (the app expects the same)`);
} else {
  ok = false;
  console.error(`✗ bot version: set BOT_VERSION in the bot and TELEGRAM_BOT_VERSION in src/App.jsx to '${expected}'`);
}
process.exit(ok ? 0 : 1);
