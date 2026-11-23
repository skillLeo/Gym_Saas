/**
 * Turn a run's results into the markdown table the report carries.
 *
 *   node tests/browser/phase11/summarise.mjs results-a.json results-b.json …
 *
 * Several files may be merged, but ONLY if every row was produced against the
 * same commit. Merging across builds is how a report ends up quoting a pass
 * from one afternoon beside a failure from another, with nothing to say which
 * build either belonged to — so that is refused outright rather than
 * discouraged in a comment nobody reads.
 *
 * Where the same scenario appears in more than one of the files, the later
 * run wins: a group re-run after a harness fix is the current answer for it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join('deliverables', 'test-reports', 'phase-11');

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(DIR).filter((f) => f.startsWith('results') && f.endsWith('.json')).map((f) => join(DIR, f));

if (files.length === 0) {
  console.error('no results files');
  process.exit(1);
}

const loaded = files.map((f) => ({ file: f, rows: JSON.parse(readFileSync(f, 'utf8')) }));

const revisions = new Set(loaded.flatMap(({ rows: rs }) => rs.map((r) => r.revision ?? 'unstamped')));
if (revisions.size > 1) {
  console.error('refusing to merge results from different builds:');
  for (const { file: f, rows: rs } of loaded) {
    console.error(`  ${f} — ${[...new Set(rs.map((r) => r.revision ?? 'unstamped'))].join(', ')}`);
  }
  process.exit(1);
}

// Later file, and later row within it, wins for a given scenario.
const latest = new Map();
for (const { rows: rs } of loaded) {
  for (const r of rs) latest.set(`${r.group}|${r.scenario}`, r);
}
const rows = [...latest.values()];

console.log(`<!-- ${rows.length} checks, ${files.length} run file(s), build ${[...revisions][0]} -->\n`);

const groups = new Map();
for (const r of rows) {
  if (!groups.has(r.group)) groups.set(r.group, []);
  groups.get(r.group).push(r);
}

const WHAT = {
  admin: 'Admin switches AI on and off; an admin cannot use it themselves',
  consent: 'First-use notice, its four promises, remembering, withdrawing, re-asking',
  'consent-version': 'A reworded notice re-asks a member who already agreed',
  type: 'Ten typed meals: ordinary, brands, misspellings, plurals, grams, cups, nonsense, 5,000 characters',
  empty: 'An empty, one-character or whitespace-only description is refused before sending',
  voice: 'Five recordings through the microphone: sentence, weights, brands, no food, silence',
  'voice-denied': 'Microphone permission refused, and no microphone on the machine',
  'voice-empty': 'A recording that captured nothing',
  snap: 'Ten real photographs, including a non-food one and one carrying an instruction to the model',
  'custom-food': "Adding the member's own food, priced per serving, to a reviewed meal",
  'lang-es': 'The whole journey in Spanish',
  'lang-fr': 'The whole journey in French',
  phone: 'The whole journey at 390×844',
  a11y: 'Keyboard only, focus order, accessible names',
  'failure-ui': 'Double click, back button, refresh mid-review, slow connection, offline',
  'failure-api': 'Budget gone, rate limited, provider down, server error, a request that never answers',
};

let pass = 0, fail = 0, other = 0;
const lines = ['| Area | What it covers | Checks | Result |', '|---|---|---|---|'];

for (const [group, rs] of [...groups].sort()) {
  const p = rs.filter((r) => r.status === 'PASS').length;
  const f = rs.filter((r) => r.status === 'FAIL').length;
  const o = rs.length - p - f;
  pass += p; fail += f; other += o;

  const verdict = f > 0 ? `**${f} failed**, ${p} passed` : o > 0 ? `${p} passed, ${o} other` : `${p} passed`;
  lines.push(`| \`${group}\` | ${WHAT[group] ?? ''} | ${rs.length} | ${verdict} |`);
}

lines.push(`| **Total** | | **${pass + fail + other}** | **${pass} passed, ${fail} failed${other ? `, ${other} informational` : ''}** |`);

console.log(lines.join('\n'));

const problems = rows.filter((r) => r.status !== 'PASS' && r.status !== 'INFO');
if (problems.length) {
  console.log('\nNot passing:\n');
  for (const r of problems) console.log(`- \`${r.group}\` — ${r.scenario}${r.detail ? ` (${r.detail})` : ''} — **${r.status}**`);
}
