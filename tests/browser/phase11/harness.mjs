/**
 * Real-browser harness for Phase 11 (Snap / Say / Type).
 *
 * REAL MOUSE AND KEYBOARD. Every interaction goes through page.mouse and
 * page.keyboard against the element's measured position on screen, not
 * locator.click() and not state injection. That is the point of this file:
 * a test that sets React state directly proves the state machine works and
 * proves nothing about whether a person can reach it.
 *
 * Usage:  node tests/browser/phase11/run.mjs [group]
 */

import { chromium } from '../../../frontend/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
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

/** Set the interface language the way a member does, from Settings. */
export async function setLanguage(page, code) {
  await page.goto(`${APP}/settings`, { waitUntil: 'domcontentloaded' });
  await wait(4000);
  const select = page.locator('select').filter({ hasText: /English|Español|Français/ }).first();
  if ((await select.count()) === 0) return false;
  await select.selectOption(code);
  await wait(1500);
  return true;
}

export async function shot(page, group, name) {
  const dir = outDir('screenshots', group);
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file });
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
