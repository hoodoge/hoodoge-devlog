#!/usr/bin/env node
// Adds one entry and publishes.
//   node tools/add.mjs "Sherwood Outlaw" "Card Combat" "Card balancing and combat UI improvements." [YYYY-MM-DD]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [project, area, summary, date] = process.argv.slice(2);
if (!project || !area || !summary) { console.error('usage: add.mjs "<project>" "<area>" "<summary>" [date]'); process.exit(2); }
const file = path.join(ROOT, 'entries.json');
const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
// Today's date in Korea (KST): the team deploys from Korea, and UTC would still be "yesterday" before 09:00.
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD
const e = { date: date || today(), project, area, summary };
if (entries.some((x) => x.date === e.date && x.project === e.project && x.area === e.area && x.summary === e.summary)) { console.log('already present'); process.exit(0); }
entries.unshift(e);
fs.writeFileSync(file, JSON.stringify(entries, null, 2).replace(/\{\n\s+"date"/g, '{ "date"').replace(/,\n\s+"(project|area|summary)"/g, ', "$1"').replace(/\n\s+\}/g, ' }') + '\n');
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'publish.mjs'), ...process.argv.slice(6)], { stdio: 'inherit' });
