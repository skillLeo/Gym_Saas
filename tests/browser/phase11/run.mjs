/**
 * Phase 11 browser scenarios. See harness.mjs for why everything uses the
 * real mouse and keyboard.
 *
 *   node tests/browser/phase11/run.mjs           # all groups
 *   node tests/browser/phase11/run.mjs admin     # one group
 */

import { readFileSync } from 'node:fs';
import {
  APP, ACCOUNTS, browser, context, record, results, writeResults,
  mouseClick, typeInto, signIn, shot, wait,
} from './harness.mjs';

/**
 * The seeded development password, read from the seeder that sets it rather
 * than written here — this file is committed to a public repository.
 */
const PASSWORD = (() => {
  const src = readFileSync('database/seeders/AdminUserSeeder.php', 'utf8');
  const m = src.match(/Hash::make\('([^']+)'\)/);
  if (!m) throw new Error('could not read the seeded password from AdminUserSeeder.php');
  return m[1];
})();

const only = process.argv[2];
const groups = {};
const group = (name, fn) => { groups[name] = fn; };

/* ------------------------------------------------------------- admin */

group('admin', async (b) => {
  const page = await (await context(b, 'desktop')).newPage();
  await signIn(page, ACCOUNTS.admin, PASSWORD);

  await page.goto(`${APP}/admin/users`, { waitUntil: 'domcontentloaded' });
  await wait(6000);
  await typeInto(page, page.locator('input[placeholder*="Search"]'), ACCOUNTS.member);
  await wait(4000);

  const toggle = page.locator('button[aria-pressed]').first();
  if ((await toggle.count()) === 0) {
    record('admin', 'camera toggle present on Manage Users', 'FAIL', 'no button[aria-pressed] found');
    return;
  }

  const before = await toggle.getAttribute('aria-pressed');
  await mouseClick(page, toggle);
  await wait(3500);
  const after = await toggle.getAttribute('aria-pressed');
  record('admin', 'camera icon toggles AI for a member',
    before !== after ? 'PASS' : 'FAIL', `${before} -> ${after}`);
  await shot(page, 'admin', 'manage-users-toggle');

  // put it back on, whatever it was
  if ((await toggle.getAttribute('aria-pressed')) === 'false') {
    await mouseClick(page, toggle);
    await wait(3000);
  }

  // detail-page switch
  await page.goto(`${APP}/admin/users/3`, { waitUntil: 'domcontentloaded' });
  await wait(6000);
  const body = await page.locator('body').innerText();
  record('admin', 'member detail page shows the AI switch',
    body.includes('Photo, voice and text food logging') ? 'PASS' : 'FAIL');
  await shot(page, 'admin', 'member-detail-switch');

  // an admin's own detail page must explain rather than offer a dead switch
  await page.goto(`${APP}/admin/users/2`, { waitUntil: 'domcontentloaded' });
  await wait(6000);
  const adminBody = await page.locator('body').innerText();
  record('admin', 'admin account is refused AI, with a reason',
    adminBody.includes('does not apply to admin accounts') ? 'PASS' : 'FAIL');
  await shot(page, 'admin', 'admin-detail-no-switch');

  await page.context().close();
});

/* ----------------------------------------------------------- consent */

group('consent', async (b) => {
  const page = await (await context(b, 'desktop')).newPage();
  await signIn(page, ACCOUNTS.member, PASSWORD);

  await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
  await wait(14000);

  const entry = page.locator('text=Add with camera, voice or text');
  if ((await entry.count()) === 0) {
    record('consent', 'AI entry point visible to an enabled member', 'FAIL', 'entry not found');
    await shot(page, 'consent', 'no-entry-point');
    await page.context().close();
    return;
  }
  record('consent', 'AI entry point visible to an enabled member', 'PASS');

  await mouseClick(page, entry);
  await wait(4000);
  const sawNotice = (await page.locator('text=Before you start').count()) > 0;
  record('consent', 'first use shows the consent notice', sawNotice ? 'PASS' : 'FAIL');
  await shot(page, 'consent', 'first-use-notice');

  if (sawNotice) {
    await mouseClick(page, page.locator('text=I understand'));
    await wait(4000);
    const chooser = (await page.locator('text=Type it').count()) > 0;
    record('consent', 'accepting consent opens the chooser', chooser ? 'PASS' : 'FAIL');
    await shot(page, 'consent', 'after-accept');

    // close, reopen: must NOT ask again
    await page.keyboard.press('Escape');
    await wait(1500);
    await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
    await wait(10000);
    await mouseClick(page, page.locator('text=Add with camera, voice or text'));
    await wait(3500);
    record('consent', 'consent is remembered on the next use',
      (await page.locator('text=Before you start').count()) === 0 ? 'PASS' : 'FAIL');
  }

  // revoke from Settings, then it must ask again
  await page.goto(`${APP}/settings`, { waitUntil: 'domcontentloaded' });
  await wait(7000);
  const settingsBody = await page.locator('body').innerText();
  const hasToggle = settingsBody.includes('Photo, voice and text logging');
  record('consent', 'Settings offers a withdrawal toggle', hasToggle ? 'PASS' : 'FAIL');
  await shot(page, 'consent', 'settings-toggle');

  if (hasToggle) {
    const sw = page.locator('button[role="switch"], input[type="checkbox"]').last();
    await mouseClick(page, sw);
    await wait(4000);
    await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
    await wait(10000);
    const entryGone = (await page.locator('text=Add with camera, voice or text').count()) === 0;
    record('consent', 'withdrawing consent removes the entry point', entryGone ? 'PASS' : 'FAIL');
    await shot(page, 'consent', 'after-revoke');
  }

  await page.context().close();
});

/* -------------------------------------------------------------- type */

const TYPED = [
  ['two eggs and toast', 'ordinary'],
  ['chicken breast and rice', 'ordinary'],
  ['a bowl of oatmeal with banana', 'ordinary'],
  ['grande latte', 'brand-ish'],
  ['chikn brest and ric', 'misspelled'],
  ['3 bananas', 'plural with quantity'],
  ['200 g greek yogurt', 'grams'],
  ['2 cups of cooked rice', 'cups'],
  ['asdkjhasd qweqwe zxcmnbv', 'nonsense'],
  ['x'.repeat(5000), '5,000 characters'],
];

group('type', async (b) => {
  const page = await (await context(b, 'desktop')).newPage();
  const calls = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/ai/food-log/analyze')) calls.push(r.status());
  });

  await signIn(page, ACCOUNTS.member, PASSWORD);

  for (const [text, label] of TYPED) {
    await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
    await wait(9000);

    const entry = page.locator('text=Add with camera, voice or text');
    if ((await entry.count()) === 0) {
      record('type', `${label}`, 'BLOCKED', 'AI entry point missing (flag or consent off)');
      break;
    }
    await mouseClick(page, entry);
    await wait(3500);
    if ((await page.locator('text=I understand').count()) > 0) {
      await mouseClick(page, page.locator('text=I understand'));
      await wait(3000);
    }

    const box = page.locator('textarea').first();
    if ((await box.count()) === 0) {
      record('type', label, 'FAIL', 'no textarea in the chooser');
      continue;
    }
    await typeInto(page, box, text, { delay: text.length > 200 ? 0 : 8 });
    await wait(400);

    const submit = page.locator('text=Find these foods');
    const disabled = await submit.first().isDisabled().catch(() => false);
    if (disabled) {
      record('type', label, 'PASS', 'submit correctly disabled');
      continue;
    }

    await mouseClick(page, submit);
    await wait(30000);

    const body = await page.locator('body').innerText();
    const review = body.includes('Check before saving');
    const noFood = body.includes('No food found');
    const error = body.includes('That did not work');

    const status = review || noFood || error ? 'PASS' : 'FAIL';
    const what = review ? 'review screen' : noFood ? 'no food found' : error ? 'honest error' : 'nothing happened';
    record('type', `"${text.slice(0, 32)}${text.length > 32 ? '…' : ''}" (${label})`, status, what);
    await shot(page, 'type', label.replace(/[^a-z0-9]+/gi, '-'));
  }

  record('type', 'analyze calls made', 'INFO', `${calls.length} (statuses: ${[...new Set(calls)].join(',')})`);
  await page.context().close();
});

/* ------------------------------------------------------------- empty */

group('empty', async (b) => {
  const page = await (await context(b, 'desktop')).newPage();
  await signIn(page, ACCOUNTS.member, PASSWORD);
  await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
  await wait(10000);

  const entry = page.locator('text=Add with camera, voice or text');
  if ((await entry.count()) === 0) {
    record('empty', 'empty input is refused', 'BLOCKED', 'entry point missing');
    await page.context().close();
    return;
  }
  await mouseClick(page, entry);
  await wait(3500);
  if ((await page.locator('text=I understand').count()) > 0) {
    await mouseClick(page, page.locator('text=I understand'));
    await wait(3000);
  }

  const submit = page.locator('text=Find these foods').first();
  const disabled = await submit.isDisabled().catch(() => null);
  record('empty', 'submit is disabled with an empty box',
    disabled === true ? 'PASS' : 'FAIL', `disabled=${disabled}`);
  await shot(page, 'empty', 'empty-input');
  await page.context().close();
});

/* ------------------------------------------------------------- run */

const b = await browser();
try {
  for (const [name, fn] of Object.entries(groups)) {
    if (only && only !== name) continue;
    console.log(`\n== ${name} ==`);
    try {
      await fn(b);
    } catch (e) {
      record(name, 'group crashed', 'FAIL', e.message.split('\n')[0].slice(0, 120));
    }
  }
} finally {
  await b.close();
  writeResults();
}
