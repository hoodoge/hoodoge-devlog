#!/usr/bin/env node
// Builds the public devlog from entries.json and publishes it.
//   node tools/publish.mjs            → regenerate README.md + log/YYYY-MM.md, update the profile README, commit & push both
//   node tools/publish.mjs --dry      → regenerate and lint only (no git)
// The profile repo (github.com/hoodoge/hoodoge) is expected next to this one at ../profile; override with PROFILE_DIR.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE = process.env.PROFILE_DIR || path.resolve(ROOT, '..', 'profile');
const DRY = process.argv.includes('--dry');
const RECENT_README = 12, RECENT_PROFILE = 5;

const LIVE = [
  ['Sherwood Outlaw', 'https://outlaw.hoodoge.com', 'card game'],
  ['Hoodoge Pop', 'https://pop.hoodoge.com', 'puzzle game'],
  ['HOODOGE TV', 'https://tv.hoodoge.com', '24h ambient scene'],
  ['HOODOGE Website', 'https://hoodoge.com', 'home of the goodest outlaw'],
];

// ---------- safety lint: anything that looks like an address, credential, internal path or foreign link stops the publish
const ALLOW_HOSTS = ['hoodoge.com'];
const RULES = [
  [/0x[0-9a-fA-F]{6,}/, 'hex address / hash'],
  [/\b(secret|api[ _-]?key|private key|bearer|token|password|passwd|seed phrase|mnemonic)\b/i, 'credential word'],
  [/\b(cid|client id|wallet address|session cookie|jwt)\b/i, 'internal identifier'],
  [/\b[\w-]+\.(ts|js|mjs|sql|toml|json|env)\b/, 'source file name'],
  [/\b(functions|migrations|wrangler|d1|cloudflare|worker)\b/i, 'infrastructure detail'],
  [/\b\d{1,3}(,\d{3})+\b/, 'large number (economy figure?)'],
  // design must stay abstract: no influences, genre labels or mechanic names anyone could copy from
  [/slay the spire|\bsts\b|inspired by|based on|modell?ed on|\blike [A-Z]/i, 'influence / comparison'],
  [/rogue-?like|rogue-?lite|deck-?build|match-?3|match three|auto-?battler|gacha/i, 'genre label'],
  [/\b(intent|damage preview|relics?|energy|fury|bitten|shaken|scared|feats?|act [123]|three acts|boss|elite|campfire|merchant|upgrade|remove a card)\b/i, 'mechanic name'],
];
function lint(e) {
  const text = `${e.project} ${e.area} ${e.summary}`;
  for (const [re, why] of RULES) if (re.test(text)) return `${why}: "${text.match(re)[0]}"`;
  for (const m of text.matchAll(/https?:\/\/([^\s/]+)/g)) if (!ALLOW_HOSTS.some((h) => m[1] === h || m[1].endsWith('.' + h))) return `link to ${m[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return 'bad date';
  if (!e.project || !e.area || !e.summary) return 'missing field';
  if (e.summary.length > 220) return 'summary too long';
  return null;
}

// ---------- load + validate
const entries = JSON.parse(fs.readFileSync(path.join(ROOT, 'entries.json'), 'utf8'));
const problems = entries.map((e) => [e, lint(e)]).filter(([, p]) => p);
if (problems.length) {
  console.error('REFUSED — fix these entries first:');
  for (const [e, p] of problems) console.error(` - ${e.date} ${e.project} — ${e.area}: ${p}`);
  process.exit(1);
}
entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const line = (e) => `- **${e.project} — ${e.area}** · ${e.date}  \n  ${e.summary}`;
const month = (d) => d.slice(0, 7);

// ---------- README.md
const months = [...new Set(entries.map((e) => month(e.date)))];
const readme = `# HOODOGE devlog

What is being built across the HOODOGE ecosystem — games, the website and the shared Treats system — summarised as it ships. Code for these projects lives in private repositories; this log is the public record of what changed.

**Live:** ${LIVE.map(([n, u, d]) => `[${n}](${u}) (${d})`).join(' · ')}

## Recent development

${entries.slice(0, RECENT_README).map(line).join('\n')}

## Archive

${months.map((m) => `- [${m}](log/${m}.md)`).join('\n')}

<sub>Entries are written by hand at each deploy and checked by a linter before publishing (see SAFETY.md). No source code, keys, addresses or internal details are posted here.</sub>
`;
fs.writeFileSync(path.join(ROOT, 'README.md'), readme);

// ---------- log/YYYY-MM.md
fs.mkdirSync(path.join(ROOT, 'log'), { recursive: true });
for (const m of months) {
  const list = entries.filter((e) => month(e.date) === m);
  fs.writeFileSync(path.join(ROOT, 'log', `${m}.md`), `# ${m}\n\n${list.map(line).join('\n')}\n`);
}

// ---------- profile README (between markers)
const START = '<!-- devlog:start -->', END = '<!-- devlog:end -->';
const profileReadme = path.join(PROFILE, 'README.md');
let profileChanged = false;
if (fs.existsSync(profileReadme)) {
  const src = fs.readFileSync(profileReadme, 'utf8');
  const a = src.indexOf(START), b = src.indexOf(END);
  if (a >= 0 && b > a) {
    const block = `${START}\n${entries.slice(0, RECENT_PROFILE).map(line).join('\n')}\n\n<sub>Full log: [hoodoge-devlog](https://github.com/hoodoge/hoodoge-devlog)</sub>\n${END}`;
    const out = src.slice(0, a) + block + src.slice(b + END.length);
    if (out !== src) { fs.writeFileSync(profileReadme, out); profileChanged = true; }
  } else console.warn('profile README has no devlog markers; skipped');
} else console.warn('profile README not found at', profileReadme);

console.log(`built: ${entries.length} entries, ${months.length} month file(s)${profileChanged ? ', profile README updated' : ''}`);
if (DRY) process.exit(0);

// ---------- commit & push (only when something changed)
function pushRepo(dir, msg) {
  const status = execSync('git status --porcelain', { cwd: dir }).toString().trim();
  if (!status) { console.log(`${path.basename(dir)}: nothing to publish`); return; }
  execSync('git add -A', { cwd: dir });
  execSync(`git commit -q -m "${msg}"`, { cwd: dir, stdio: 'inherit' });
  execSync('git push -q origin HEAD:main', { cwd: dir, stdio: 'inherit' });
  console.log(`${path.basename(dir)}: published (${msg})`);
}
const stamp = entries[0]?.date ?? new Date().toISOString().slice(0, 10);
pushRepo(ROOT, `devlog ${stamp}`);
if (fs.existsSync(path.join(PROFILE, '.git'))) pushRepo(PROFILE, `profile: recent development ${stamp}`);
