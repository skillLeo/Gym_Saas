/**
 * Real-browser harness for Phase 11 (Snap / Say / Type).
 *
 * REAL MOUSE AND KEYBOARD. Every interaction goes through page.mouse and
 * page.keyboard against the element's measured position on screen, not
 * locator.click() and not state injection. That is the point of this file:
 * a test that sets React state directly proves the state machine works and
 * proves nothing about whether a person can reach it.
 *
 * The one unavoidable exception is choosing a file. A real click opens the
 * operating system's file dialog, which is not part of the page and cannot be
 * driven. So the button IS clicked with the real mouse and the dialog it
 * raises is caught through Playwright's filechooser event — the browser's own
 * picker, answered programmatically. See choosePhoto().
 *
 * ASSERTIONS GO THROUGH THE LOCALE FILES, never through English literals, so
 * the same scenario runs unchanged in es and fr. A hardcoded "Check before
 * saving" would silently fail every Spanish run for the wrong reason.
 *
 * Usage:  node tests/browser/phase11/run.mjs [group]
 */

import { chromium } from '../../../frontend/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const APP = 'http://localhost:3000';
export const API = 'http://127.0.0.1:8001';

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};

/** Seeded development accounts. The password lives in the seeder, not here. */
export const ACCOUNTS = {
  member: 'member@myextremetrainer.com',
  admin: 'kelvin@myextremetrainer.com',
};

/** Where the generated audio and photo fixtures were put. */
export const FIXTURES = process.env.P11_FIXTURES ?? '';

export const results = [];

export function record(group, scenario, status, detail = '') {
  results.push({ group, scenario, status, detail });
  const mark = status === 'PASS' ? 'ok  ' : status === 'FAIL' ? 'FAIL' : status;
  console.log(`  ${mark} [${group}] ${scenario}${detail ? ' — ' + detail : ''}`);
}

export function outDir(...parts) {
  const dir = join(process.cwd(), 'deliverables', 'test-reports', 'phase-11', ...parts);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/* ---------------------------------------------------------------- strings */

const localeCache = {};

/**
 * The interface strings for one language, straight from the file the app ships.
 *
 * Reading these rather than copying them means a scenario cannot drift out of
 * step with a reworded button, and means the Spanish and French runs assert
 * against Spanish and French rather than against a translation written here.
 */
export function strings(locale = 'en') {
  if (!localeCache[locale]) {
    localeCache[locale] = JSON.parse(
      readFileSync(join(process.cwd(), 'frontend', 'src', 'locales', `${locale}.json`), 'utf8'),
    );
  }
  const dict = localeCache[locale];
  return (key, vars) => {
    let s = dict[key];
    if (s === undefined) throw new Error(`missing locale key ${locale}:${key}`);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

/* ---------------------------------------------------------------- browser */

export async function browser(opts = {}) {
  return chromium.launch({ headless: true, ...opts });
}

export async function context(b, viewport = 'desktop', extra = {}) {
  return b.newContext({ viewport: VIEWPORTS[viewport], ...extra });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export { wait };

/**
 * Click by moving the real mouse to the middle of the element.
 *
 * Scrolls it into view first, because a click at a coordinate outside the
 * viewport lands on whatever is actually there — which is how a passing test
 * can be clicking the wrong thing entirely.
 */
export async function mouseClick(page, locator, { timeout = 15000 } = {}) {
  const el = locator.first();
  await el.waitFor({ state: 'visible', timeout });
  await el.scrollIntoViewIfNeeded();
  await wait(150);

  const box = await el.boundingBox();
  if (!box) throw new Error('element has no box on screen');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await wait(60);
  await page.mouse.down();
  await wait(40);
  await page.mouse.up();
  return box;
}

/** Type with real key events, after clicking the field to focus it. */
export async function typeInto(page, locator, text, { delay = 12 } = {}) {
  await mouseClick(page, locator);
  await wait(80);
  await page.keyboard.type(text, { delay });
}

/**
 * Sign in through the form with mouse and keyboard.
 *
 * The dev quick-login buttons are deliberately NOT used: they are stripped
 * from production builds, so a suite that relies on them never exercises the
 * path a real person takes.
 */
export async function signIn(page, email, password) {
  await page.goto(`${APP}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await wait(1500); // hydration: typing before it lands is silently dropped

  await typeInto(page, page.locator('input[type="email"]'), email);
  await typeInto(page, page.locator('input[type="password"]'), password);
  await mouseClick(page, page.locator('button[type="submit"]'));

  await page.waitForURL((u) => !u.pathname.startsWith('/auth/login'), { timeout: 60000 });
  await wait(1200);
}

/**
 * Switch the interface language the way a member does, from Settings.
 *
 * The switcher is a row of buttons carrying `lang`, not a <select> — an
 * earlier version of this helper looked for a select, found none, and
 * reported "no language switcher" about a switcher that was on the screen.
 */
export async function setLanguage(page, code) {
  await page.goto(`${APP}/settings`, { waitUntil: 'domcontentloaded' });
  const btn = page.locator(`button[lang="${code}"]`);
  if (!(await present(btn))) return false;

  await mouseClick(page, btn);

  /*
   * Wait for the change to have STUCK, not merely to have been clicked.
   *
   * Choosing a language sets the store and then PUTs /auth/user; if that
   * request fails the handler puts the old language back. Navigating away
   * while it is in flight aborts it, which is a failure — so a fixed sleep
   * raced the save and sometimes left the next page in English, reported as
   * "the AI entry point is not translated" about a page that was never
   * switched.
   */
  const until = Date.now() + 25000;
  while (Date.now() < until) {
    const lang = await page.evaluate(() => document.documentElement.lang).catch(() => '');
    const pressed = await btn.getAttribute('aria-pressed').catch(() => null);
    if (lang === code && pressed === 'true') {
      await wait(1200); // let the PUT finish; aborting it reverts the choice
      return true;
    }
    await wait(400);
  }
  return false;
}

/** The AI consent toggle in Settings, found by its accessible name. */
export function consentToggle(page, t) {
  return page.locator(`button[aria-label="${t('settings.aiFood.toggle')}"]`);
}

/* ------------------------------------------------------------ the AI flow */

/**
 * Wait for a locator to exist, polling rather than sleeping a fixed time.
 *
 * The food journal loads its slots, its entries and the AI status in separate
 * requests on a dev server that compiles pages on first visit, so "wait twelve
 * seconds" is a race that passes on a warm run and fails on a cold one. An
 * earlier version of these scenarios reported "AI entry point not found" about
 * an entry point that appeared a second later.
 */
export async function present(locator, timeout = 40000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if ((await locator.count()) > 0) return true;
    await wait(700);
  }
  return false;
}

/**
 * Open the Snap/Say/Type sheet, accepting consent if it is asked for.
 *
 * @returns 'choose' | 'absent'   where it ended up
 */
export async function openAiSheet(page, t, { acceptConsent = true } = {}) {
  await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});

  const entry = page.locator(`text=${t('aiFood.entry.title')}`);
  if (!(await present(entry))) return 'absent';

  await mouseClick(page, entry);
  await wait(3000);

  if (acceptConsent && (await page.locator(`text=${t('aiFood.consent.title')}`).count()) > 0) {
    await mouseClick(page, page.locator(`text=${t('aiFood.consent.accept')}`));
    await wait(3500);
  }
  return 'choose';
}

/**
 * Hand a file to the page the way a person does: click the button, answer the
 * picker the browser opens.
 */
export async function choosePhoto(page, t, filePath) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 20000 }),
    mouseClick(page, page.locator(`text=${t('aiFood.choose.choosePhoto')}`)),
  ]);
  await chooser.setFiles(filePath);
}

/**
 * Wait for the sheet to leave the loading step, and say where it landed.
 *
 * @returns 'review' | 'nofood' | 'error' | 'loading'
 */
export async function settled(page, t, timeout = 75000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const body = await page.locator('body').innerText().catch(() => '');
    if (body.includes(t('aiFood.review.noFoodTitle'))) return 'nofood';
    if (body.includes(t('aiFood.review.title'))) return 'review';
    if (body.includes(t('aiFood.error.title'))) return 'error';
    await wait(1500);
  }
  return 'loading';
}

export async function shot(page, group, name) {
  const dir = outDir('screenshots', group);
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

export function writeResults(file = 'results.json') {
  const dir = outDir();
  writeFileSync(join(dir, file), JSON.stringify(results, null, 2));
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const other = results.length - pass - fail;
  console.log(`\n  ${pass} passed, ${fail} failed, ${other} other — ${join(dir, file)}`);
  return { pass, fail, other };
}
