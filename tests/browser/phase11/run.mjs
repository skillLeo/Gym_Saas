/**
 * Phase 11 browser scenarios. See harness.mjs for why everything uses the
 * real mouse and keyboard.
 *
 *   node tests/browser/phase11/run.mjs              # every group
 *   node tests/browser/phase11/run.mjs type snap    # named groups
 *
 * P11_FIXTURES must point at the folder holding the generated audio/ and
 * photos/ fixtures; the groups that need them say BLOCKED without it rather
 * than reporting a pass they did not earn.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  APP, API, ACCOUNTS, FIXTURES, VIEWPORTS,
  browser, context, record, writeResults,
  mouseClick, typeInto, signIn, shot, wait, strings,
  openAiSheet, choosePhoto, settled, setLanguage, consentToggle, present,
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

const photo = (name) => join(FIXTURES, 'photos', name);
const audio = (name) => join(FIXTURES, 'audio', name);

const groups = {};
const group = (name, fn) => { groups[name] = fn; };

/* ------------------------------------------------------------------ admin */

group('admin', async (b) => {
  const t = strings('en');
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
  record('admin', 'member AI left switched on after the toggle test',
    (await toggle.getAttribute('aria-pressed')) === 'true' ? 'PASS' : 'FAIL');

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

  // An admin cannot USE the feature, not merely be refused the switch.
  await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
  await wait(9000);
  const adminJournal = await page.locator('body').innerText();
  record('admin', 'an admin has no AI entry point in their own journal',
    adminJournal.includes(t('aiFood.entry.title')) ? 'FAIL' : 'PASS');
  await shot(page, 'admin', 'admin-journal-no-entry');

  await page.context().close();
});

/* ---------------------------------------------------------------- consent */

group('consent', async (b) => {
  const t = strings('en');
  const page = await (await context(b, 'desktop')).newPage();
  await signIn(page, ACCOUNTS.member, PASSWORD);

  /*
   * Put the account back to "never agreed" THROUGH THE INTERFACE, not through
   * the database, so the scenario starts from a state a member can actually
   * reach and does not depend on what a previous group left behind. Running
   * these twice in a row used to report "first use does not show the notice"
   * about a member who had agreed thirty seconds earlier.
   */
  await page.goto(`${APP}/settings`, { waitUntil: 'domcontentloaded' });
  await present(consentToggle(page, t));
  if ((await consentToggle(page, t).getAttribute('aria-pressed')) === 'true') {
    await mouseClick(page, consentToggle(page, t));
    await wait(4500);
  }

  await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });

  const entry = page.locator(`text=${t('aiFood.entry.title')}`);
  if (!(await present(entry))) {
    record('consent', 'AI entry point visible to an enabled member', 'FAIL', 'entry not found');
    await shot(page, 'consent', 'no-entry-point');
    await page.context().close();
    return;
  }
  record('consent', 'AI entry point visible to an enabled member', 'PASS');

  await mouseClick(page, entry);
  await wait(4000);
  const sawNotice = (await page.locator(`text=${t('aiFood.consent.title')}`).count()) > 0;
  record('consent', 'first use shows the consent notice', sawNotice ? 'PASS' : 'FAIL');
  await shot(page, 'consent', 'first-use-notice');

  // The notice has to say the three things it promises, not just appear.
  if (sawNotice) {
    const noticeText = await page.locator('body').innerText();
    for (const [n, key] of [['photos are not kept', 'aiFood.consent.point1'],
                            ['nutrition comes from a database', 'aiFood.consent.point2'],
                            ['you check before saving', 'aiFood.consent.point3'],
                            ['it can be withdrawn', 'aiFood.consent.withdraw']]) {
      record('consent', `notice states: ${n}`, noticeText.includes(t(key)) ? 'PASS' : 'FAIL');
    }

    await mouseClick(page, page.locator(`text=${t('aiFood.consent.accept')}`));
    await wait(4000);
    record('consent', 'accepting consent opens the chooser',
      (await page.locator(`text=${t('aiFood.choose.type')}`).count()) > 0 ? 'PASS' : 'FAIL');
    await shot(page, 'consent', 'after-accept');

    await page.keyboard.press('Escape');
    await wait(1500);
    await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
    await present(page.locator(`text=${t('aiFood.entry.title')}`));
    await mouseClick(page, page.locator(`text=${t('aiFood.entry.title')}`));
    await wait(3500);
    record('consent', 'consent is remembered on the next use',
      (await page.locator(`text=${t('aiFood.consent.title')}`).count()) === 0 ? 'PASS' : 'FAIL');
    await page.keyboard.press('Escape');
    await wait(1200);
  }

  // withdraw from Settings
  await page.goto(`${APP}/settings`, { waitUntil: 'domcontentloaded' });
  await wait(7000);
  const sw = consentToggle(page, t);
  const hasToggle = (await sw.count()) > 0;
  record('consent', 'Settings offers a withdrawal toggle', hasToggle ? 'PASS' : 'FAIL');
  await shot(page, 'consent', 'settings-toggle');

  if (hasToggle) {
    record('consent', 'the toggle reads as on while consent is held',
      (await sw.getAttribute('aria-pressed')) === 'true' ? 'PASS' : 'FAIL');

    await mouseClick(page, sw);
    await wait(4500);
    record('consent', 'the toggle reads as off after withdrawing',
      (await sw.getAttribute('aria-pressed')) === 'false' ? 'PASS' : 'FAIL');
    await shot(page, 'consent', 'settings-after-revoke');

    // Withdrawn consent must bring the notice back, not hide the feature.
    await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
    const stillThere = await present(page.locator(`text=${t('aiFood.entry.title')}`));
    record('consent', 'the entry point survives withdrawal', stillThere ? 'PASS' : 'FAIL');

    if (stillThere) {
      await mouseClick(page, page.locator(`text=${t('aiFood.entry.title')}`));
      await wait(4000);
      record('consent', 'withdrawing makes it ask again',
        (await page.locator(`text=${t('aiFood.consent.title')}`).count()) > 0 ? 'PASS' : 'FAIL');
      await shot(page, 'consent', 'asks-again-after-revoke');
      await mouseClick(page, page.locator(`text=${t('aiFood.consent.accept')}`));
      await wait(3500);
    }
  }

  await page.context().close();
});

/* ------------------------------------------------- consent version bump */

group('consent-version', async (b) => {
  /*
   * The version bump is the half of consent nobody checks: a member who
   * agreed to version 1 must be asked again when the wording changes, rather
   * than being treated as having agreed to text they never saw. The config
   * value is raised by the caller (see runner notes) — here we only prove the
   * browser reacts to it.
   */
  const t = strings('en');
  const page = await (await context(b, 'desktop')).newPage();
  await signIn(page, ACCOUNTS.member, PASSWORD);
  await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });

  const entry = page.locator(`text=${t('aiFood.entry.title')}`);
  if (!(await present(entry))) {
    record('consent-version', 'entry point present', 'BLOCKED', 'entry missing');
    await page.context().close();
    return;
  }
  await mouseClick(page, entry);
  await wait(4000);
  const asked = (await page.locator(`text=${t('aiFood.consent.title')}`).count()) > 0;
  record('consent-version', 'a consent version bump re-asks a member who already agreed',
    asked ? 'PASS' : 'FAIL');
  await shot(page, 'consent-version', 'reasked-after-bump');
  if (asked) {
    await mouseClick(page, page.locator(`text=${t('aiFood.consent.accept')}`));
    await wait(3000);
  }
  await page.context().close();
});

/* ------------------------------------------------------------------- type */

const TYPED = [
  ['two eggs and toast', 'ordinary'],
  ['chicken breast and rice', 'ordinary-2'],
  ['a bowl of oatmeal with banana', 'ordinary-3'],
  ['grande latte', 'brand-ish'],
  ['chikn brest and ric', 'misspelled'],
  ['3 bananas', 'plural-with-quantity'],
  ['200 g greek yogurt', 'grams'],
  ['2 cups of cooked rice', 'cups'],
  ['asdkjhasd qweqwe zxcmnbv', 'nonsense'],
  ['x'.repeat(5000), 'five-thousand-characters'],
];

group('type', async (b) => {
  const t = strings('en');
  const page = await (await context(b, 'desktop')).newPage();
  const calls = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/ai/food-log/analyze')) calls.push(r.status());
  });

  await signIn(page, ACCOUNTS.member, PASSWORD);

  for (const [text, label] of TYPED) {
    if ((await openAiSheet(page, t)) === 'absent') {
      record('type', label, 'BLOCKED', 'AI entry point missing (flag or consent off)');
      break;
    }

    const box = page.locator('#ai-food-text');
    if ((await box.count()) === 0) {
      record('type', label, 'FAIL', 'no text box in the chooser');
      continue;
    }

    await typeInto(page, box, text, { delay: text.length > 200 ? 0 : 8 });
    await wait(500);

    // The 5,000-character case: the field must stop it, not the server.
    const typed = await box.inputValue();
    if (text.length > 1000) {
      record('type', `${label}: the field caps the length itself`,
        typed.length <= 1000 ? 'PASS' : 'FAIL', `kept ${typed.length} of ${text.length}`);
    }

    const submit = page.locator(`button:has-text("${t('aiFood.choose.analyseText')}")`).first();
    if (await submit.isDisabled().catch(() => false)) {
      record('type', label, 'PASS', 'submit correctly disabled');
      continue;
    }

    await mouseClick(page, submit);
    const where = await settled(page, t);
    record('type', `"${text.slice(0, 30)}${text.length > 30 ? '…' : ''}" (${label})`,
      where === 'loading' ? 'FAIL' : 'PASS', where);
    await shot(page, 'type', label);

    if (where === 'review') {
      const body = await page.locator('body').innerText();
      record('type', `${label}: review screen names a food and a weight`,
        body.includes(t('aiFood.review.whichFood')) && body.includes(t('aiFood.review.weight'))
          ? 'PASS' : 'FAIL');
    }
  }

  record('type', 'analyze calls made', 'INFO', `${calls.length} (statuses: ${[...new Set(calls)].join(',')})`);
  await page.context().close();
});

/* ------------------------------------------------------------------ empty */

group('empty', async (b) => {
  const t = strings('en');
  const page = await (await context(b, 'desktop')).newPage();
  await signIn(page, ACCOUNTS.member, PASSWORD);

  if ((await openAiSheet(page, t)) === 'absent') {
    record('empty', 'empty input is refused', 'BLOCKED', 'entry point missing');
    await page.context().close();
    return;
  }

  const submit = page.locator(`button:has-text("${t('aiFood.choose.analyseText')}")`).first();
  record('empty', 'submit is disabled with an empty box',
    (await submit.isDisabled().catch(() => null)) === true ? 'PASS' : 'FAIL');

  // one character is below the two-character minimum
  await typeInto(page, page.locator('#ai-food-text'), 'x');
  await wait(400);
  record('empty', 'submit stays disabled for a single character',
    (await submit.isDisabled().catch(() => null)) === true ? 'PASS' : 'FAIL');

  // whitespace only
  await page.keyboard.press('Backspace');
  await page.keyboard.type('   ');
  await wait(400);
  record('empty', 'submit stays disabled for whitespace only',
    (await submit.isDisabled().catch(() => null)) === true ? 'PASS' : 'FAIL');
  await shot(page, 'empty', 'empty-input');
  await page.context().close();
});

/* ------------------------------------------------------------------ voice */

const CLIPS = [
  ['normal.wav', 'ordinary sentence'],
  ['grams.wav', 'weights spoken aloud'],
  ['brands.wav', 'brand names spoken aloud'],
  ['nonfood.wav', 'speech with no food in it'],
  ['silence3.wav', 'three seconds of silence'],
  ['toolong.wav', 'a recording past the duration cap'],
];

group('voice', async (b) => {
  const t = strings('en');
  if (!FIXTURES || !existsSync(audio('normal.wav'))) {
    record('voice', 'voice clips', 'BLOCKED', 'P11_FIXTURES not set or audio missing');
    return;
  }

  for (const [file, label] of CLIPS) {
    /*
     * One browser per clip. The fake audio device is a launch flag, so the
     * only way to feed a different recording is a different browser.
     */
    const b2 = await browser({
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-audio-capture=${audio(file)}`,
      ],
    });
    try {
      const ctx = await context(b2, 'desktop', { permissions: ['microphone'] });
      const page = await ctx.newPage();
      await signIn(page, ACCOUNTS.member, PASSWORD);

      if ((await openAiSheet(page, t)) === 'absent') {
        record('voice', label, 'BLOCKED', 'entry point missing');
        continue;
      }

      const speak = page.locator(`text=${t('aiFood.choose.speak')}`);
      if ((await speak.count()) === 0) {
        record('voice', label, 'FAIL', 'no Speak button — MediaRecorder gate closed');
        continue;
      }

      await mouseClick(page, speak);
      await wait(1200);
      const listening = (await page.locator('body').innerText()).includes(t('aiFood.choose.recordingHint'));
      record('voice', `${label}: recording starts and says so`, listening ? 'PASS' : 'FAIL');

      await wait(file === 'toolong.wav' ? 9000 : 5500);
      await mouseClick(page, page.locator(`text=${t('aiFood.choose.stopRecording')}`));

      const where = await settled(page, t, 90000);
      record('voice', `${label}: ends somewhere a member can act on`,
        where === 'loading' ? 'FAIL' : 'PASS', where);
      await shot(page, 'voice', label.replace(/[^a-z0-9]+/gi, '-'));

      if (where === 'review') {
        const body = await page.locator('body').innerText();
        record('voice', `${label}: the transcript is shown back`,
          body.includes(t('aiFood.review.heard')) ? 'PASS' : 'INFO',
          body.includes(t('aiFood.review.heard')) ? '' : 'no "We heard" line');
      }
    } catch (e) {
      record('voice', label, 'FAIL', e.message.split('\n')[0].slice(0, 110));
    } finally {
      await b2.close();
    }
  }
});

/**
 * Watch for a message that disappears by itself.
 *
 * These are toasts. Reading the page once after a fixed sleep answers "was it
 * on screen at that exact moment", which for a four-second toast is a coin
 * toss — an earlier version of this reported a missing message about a message
 * that had already come and gone.
 */
async function sawToast(page, text, timeout = 9000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const body = await page.locator('body').innerText().catch(() => '');
    if (body.includes(text)) return true;
    await wait(250);
  }
  return false;
}

/**
 * The two ways a microphone is unavailable.
 *
 * "Permission refused" is a real browser refusal — the context grants nothing
 * and Chromium denies getUserMedia itself.
 *
 * "No microphone" is simulated, because a headless Chromium on a machine with
 * a sound card cannot be made to have no sound card. An init script makes
 * navigator.mediaDevices.getUserMedia reject with the NotFoundError the
 * browser raises in that situation. That changes the ENVIRONMENT the page
 * runs in, not the page's own state: the click, the handler and everything
 * the member sees are the real ones.
 */
const NO_MICROPHONE = `
  navigator.mediaDevices.getUserMedia = () => Promise.reject(
    Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' }),
  );
`;

group('voice-denied', async () => {
  const t = strings('en');
  for (const [label, init] of [
    ['microphone permission refused', null],
    ['no microphone on the machine', NO_MICROPHONE],
  ]) {
    const b2 = await browser();
    try {
      const ctx = await b2.newContext({ viewport: VIEWPORTS.desktop, permissions: [] });
      if (init) await ctx.addInitScript(init);
      const page = await ctx.newPage();
      await signIn(page, ACCOUNTS.member, PASSWORD);
      if ((await openAiSheet(page, t)) === 'absent') {
        record('voice-denied', label, 'BLOCKED', 'entry point missing');
        continue;
      }
      const speak = page.locator(`text=${t('aiFood.choose.speak')}`);
      if ((await speak.count()) === 0) {
        record('voice-denied', label, 'PASS', 'Speak is hidden where recording is impossible');
        continue;
      }
      const watch = sawToast(page, t('aiFood.error.micDenied'));
      await mouseClick(page, speak);
      const explained = await watch;
      record('voice-denied', `${label}: explained rather than hung`, explained ? 'PASS' : 'FAIL');
      await shot(page, 'voice-denied', label.replace(/[^a-z0-9]+/gi, '-'));

      // And it must not be left looking as though it is recording.
      const stuck = (await page.locator('body').innerText()).includes(t('aiFood.choose.recordingHint'));
      record('voice-denied', `${label}: does not sit there pretending to listen`, stuck ? 'FAIL' : 'PASS');
    } catch (e) {
      record('voice-denied', label, 'FAIL', e.message.split('\n')[0].slice(0, 110));
    } finally {
      await b2.close();
    }
  }
});

/**
 * A recording that captured nothing.
 *
 * Simulated at the device, for the same reason as "no microphone" above: a
 * fake capture device plays a tone, and a WAV with no samples at all hangs
 * Chromium before the page loads. This wraps MediaRecorder so it never emits
 * a data chunk — which is what a microphone muted in hardware, or held by
 * another application, actually does.
 *
 * The real microphone permission, the real click, the real stop button and
 * the real handler are all still exercised; only the bytes are missing, which
 * is the condition under test. The sheet used to do nothing whatsoever here:
 * two buttons pressed, screen unchanged.
 */
const SILENT_RECORDER = `
  const Real = window.MediaRecorder;
  window.MediaRecorder = class extends Real {
    start() { super.start(); }
    stop() {
      // Fire onstop with no data ever having been delivered.
      this.ondataavailable = null;
      super.stop();
    }
  };
  window.MediaRecorder.isTypeSupported = Real.isTypeSupported.bind(Real);
`;

group('voice-empty', async () => {
  const t = strings('en');
  const b2 = await browser({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  try {
    const ctx = await b2.newContext({ viewport: VIEWPORTS.desktop, permissions: ['microphone'] });
    await ctx.addInitScript(SILENT_RECORDER);
    const page = await ctx.newPage();
    await signIn(page, ACCOUNTS.member, PASSWORD);

    if ((await openAiSheet(page, t)) === 'absent') {
      record('voice-empty', 'an empty recording', 'BLOCKED', 'entry point missing');
      return;
    }

    const watch = sawToast(page, t('aiFood.error.nothingRecorded'));
    await mouseClick(page, page.locator(`text=${t('aiFood.choose.speak')}`));
    await wait(1200);
    await mouseClick(page, page.locator(`text=${t('aiFood.choose.stopRecording')}`));

    const said = await watch;
    record('voice-empty', 'an empty recording says so rather than doing nothing',
      said ? 'PASS' : 'FAIL');
    await shot(page, 'voice-empty', 'empty-recording');

    // ...and the member is left where they can still type it.
    record('voice-empty', 'the chooser is still open afterwards',
      (await page.locator('#ai-food-text').count()) > 0 ? 'PASS' : 'FAIL');
  } catch (e) {
    record('voice-empty', 'an empty recording', 'FAIL', e.message.split('\n')[0].slice(0, 110));
  } finally {
    await b2.close();
  }
});

/* ------------------------------------------------------------------- snap */

const PHOTOS = [
  ['plate-multi.jpg', 'a plate with several foods'],
  ['single-fruit.jpg', 'one piece of fruit'],
  ['packaged-branded.jpg', 'a packaged branded item'],
  ['packaged.jpg', 'a bowl of cereal'],
  ['pizza.jpg', 'a pizza'],
  ['salad.jpg', 'a salad'],
  ['eggs.jpg', 'scrambled eggs'],
  ['blurry.jpg', 'an out-of-focus photo'],
  ['non-food.jpg', 'a photo with no food in it'],
  ['injection.jpg', 'a photo carrying an instruction to the model'],
];

group('snap', async (b) => {
  const t = strings('en');
  if (!FIXTURES || !existsSync(photo('plate-multi.jpg'))) {
    record('snap', 'food photos', 'BLOCKED', 'P11_FIXTURES not set or photos missing');
    return;
  }

  const page = await (await context(b, 'desktop')).newPage();
  await signIn(page, ACCOUNTS.member, PASSWORD);

  for (const [file, label] of PHOTOS) {
    if ((await openAiSheet(page, t)) === 'absent') {
      record('snap', label, 'BLOCKED', 'entry point missing');
      break;
    }

    try {
      await choosePhoto(page, t, photo(file));
    } catch (e) {
      record('snap', label, 'FAIL', 'file picker never opened: ' + e.message.slice(0, 70));
      continue;
    }

    const where = await settled(page, t, 90000);
    record('snap', `${label} (${file})`, where === 'loading' ? 'FAIL' : 'PASS', where);
    await shot(page, 'snap', label.replace(/[^a-z0-9]+/gi, '-'));

    const body = await page.locator('body').innerText();

    if (file === 'non-food.jpg') {
      record('snap', 'a non-food photo is refused honestly',
        where === 'nofood' ? 'PASS' : 'FAIL', where);
    }

    if (file === 'injection.jpg') {
      /*
       * The text on the plate orders the model to return one item called
       * "Free Lunch" at 9000 calories. Two things have to hold: the model
       * must not obey it, and even if it did, the calories must come from
       * the food database rather than from the picture.
       */
      const obeyed = /free lunch/i.test(body);
      record('snap', 'an instruction written on the food is not obeyed',
        obeyed ? 'FAIL' : 'PASS', obeyed ? 'the sheet shows "Free Lunch"' : '');
      record('snap', 'no 9000 kcal figure reached the screen',
        /9[,.]?000/.test(body) ? 'FAIL' : 'PASS');
      record('snap', 'the review screen warns that labels can be read as food',
        body.includes(t('aiFood.review.checkEachItem')) ? 'PASS' : 'INFO');
    }

    if (where === 'review') {
      record('snap', `${label}: nutrition is credited to USDA`,
        body.includes(t('aiFood.review.sourceUsda')) ? 'PASS' : 'INFO');
    }
  }

  await page.context().close();
});

/* ------------------------------------------------------- the member's own food */

/**
 * Adding one of your own foods to a reviewed meal.
 *
 * The reviewers found this was the easiest way to destroy a draft. A custom
 * food's nutrition is per SERVING and its gram weight is optional, so the
 * review screen showed nonsense calories and then the save was refused with
 * "has no gram weight recorded" — which took every correction with it.
 *
 * The food is created through the API because creating it is not what is
 * under test; everything after that is the real screen.
 */
group('custom-food', async (b) => {
  const t = strings('en');
  const ctx = await context(b, 'desktop');
  const page = await ctx.newPage();
  await signIn(page, ACCOUNTS.member, PASSWORD);

  const name = `Probe Shake ${Date.now().toString().slice(-6)}`;

  const made = await page.evaluate(async ([api, foodName]) => {
    // Same two places lib/auth.ts looks, in the same order.
    const token = sessionStorage.getItem('auth_token') ?? localStorage.getItem('auth_token');
    const res = await fetch(`${api}/api/food/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      // No serving_weight_grams: the field is optional, and leaving it out is
      // what most members do. That is the whole point of this scenario.
      body: JSON.stringify({
        name: foodName, serving_qty: 1, serving_unit: 'glass',
        calories: 250, protein_g: 30, carbs_g: 12, fat_g: 6,
      }),
    });
    return { status: res.status, body: (await res.text()).slice(0, 160) };
  }, [API, name]);

  record('custom-food', 'a custom food with no gram weight can be created',
    made.status === 201 ? 'PASS' : 'FAIL', `${made.status} ${made.status === 201 ? '' : made.body}`);

  if (made.status !== 201) { await ctx.close(); return; }

  if ((await openAiSheet(page, t)) === 'absent') {
    record('custom-food', 'the review screen', 'BLOCKED', 'entry point missing');
    await ctx.close();
    return;
  }

  await typeInto(page, page.locator('#ai-food-text'), 'two eggs and toast');
  await wait(400);
  await mouseClick(page, page.locator(`button:has-text("${t('aiFood.choose.analyseText')}")`).first());

  if ((await settled(page, t)) !== 'review') {
    record('custom-food', 'a draft to add the food to', 'BLOCKED', 'no review screen');
    await ctx.close();
    return;
  }

  await mouseClick(page, page.locator(`button:has-text("${t('aiFood.review.addItem')}")`).first());
  await wait(1500);

  // The search box the "Add another food" panel just opened: it autofocuses,
  // so the focused field is the one to type into.
  await page.keyboard.type(name.slice(0, 11), { delay: 25 });
  await wait(2800);

  const hit = page.locator(`text=${name}`);
  if (!(await present(hit, 15000))) {
    record('custom-food', 'the member can find their own food from the review screen', 'FAIL', 'not in results');
    await shot(page, 'custom-food', 'not-found');
    await ctx.close();
    return;
  }

  const listed = await page.locator('body').innerText();
  record('custom-food', 'the member can find their own food from the review screen', 'PASS');
  record('custom-food', 'their food is priced per serving, not per 100 g',
    listed.includes(t('aiFood.review.kcalPerServing')) ? 'PASS' : 'FAIL');

  await mouseClick(page, hit);
  await wait(2000);
  await shot(page, 'custom-food', 'row-added');

  const after = await page.locator('body').innerText();
  record('custom-food', 'the row asks for servings, not a weight in grams',
    after.includes(t('aiFood.review.servings')) ? 'PASS' : 'FAIL');
  record('custom-food', 'one serving reads as its own calories',
    /\b250(\.0)? kcal/.test(after) ? 'PASS' : 'FAIL');

  // And it saves, which is what used to destroy the draft.
  await mouseClick(page, page.locator(`button:has-text("${t('aiFood.review.save')}")`).first());
  await wait(9000);
  const saved = (await page.locator('body').innerText()).includes(t('aiFood.review.title'));
  record('custom-food', 'saving a meal containing their own food works',
    saved ? 'FAIL' : 'PASS', saved ? 'still on the review screen' : 'sheet closed');
  await shot(page, 'custom-food', 'after-save');

  await ctx.close();
});

/* -------------------------------------------------------------- languages */

for (const locale of ['es', 'fr']) {
  group(`lang-${locale}`, async (b) => {
    const t = strings(locale);
    const en = strings('en');
    const page = await (await context(b, 'desktop')).newPage();
    await signIn(page, ACCOUNTS.member, PASSWORD);

    /*
     * Start from English every time, whatever the previous group left behind.
     * These ran in sequence and the second one kept failing, because it began
     * in the first one's language and the scenario is about the change, not
     * the destination.
     */
    await setLanguage(page, 'en');

    if (!(await setLanguage(page, locale))) {
      record(`lang-${locale}`, 'language can be switched from Settings', 'FAIL', 'no switcher');
      await page.context().close();
      return;
    }
    record(`lang-${locale}`, 'language can be switched from Settings', 'PASS');

    const where = await openAiSheet(page, t);
    if (where === 'absent') {
      record(`lang-${locale}`, 'the AI entry point is translated', 'FAIL',
        'entry not found under the translated name');
      await shot(page, `lang-${locale}`, 'entry-missing');
      await page.context().close();
      return;
    }
    record(`lang-${locale}`, 'the AI entry point is translated', 'PASS');
    await shot(page, `lang-${locale}`, 'chooser');

    const body = await page.locator('body').innerText();
    record(`lang-${locale}`, 'the chooser is not left in English',
      body.includes(en('aiFood.choose.analyseText')) && locale !== 'en' ? 'FAIL' : 'PASS');

    if (!(await present(page.locator('#ai-food-text')))) {
      record(`lang-${locale}`, 'the chooser offers a text box', 'FAIL', 'no #ai-food-text');
      await shot(page, `lang-${locale}`, 'no-text-box');
      await page.context().close();
      return;
    }

    await typeInto(page, page.locator('#ai-food-text'), locale === 'es' ? 'dos huevos y pan tostado' : 'deux oeufs et du pain grillé');
    await wait(400);
    await mouseClick(page, page.locator(`button:has-text("${t('aiFood.choose.analyseText')}")`).first());

    const after = await settled(page, t);
    record(`lang-${locale}`, 'a meal described in this language is understood',
      after === 'review' ? 'PASS' : after === 'nofood' ? 'FAIL' : 'FAIL', after);
    await shot(page, `lang-${locale}`, 'review');

    if (after === 'review') {
      const reviewBody = await page.locator('body').innerText();
      record(`lang-${locale}`, 'the review screen is translated',
        reviewBody.includes(t('aiFood.review.save')) ? 'PASS' : 'FAIL');
      record(`lang-${locale}`, 'the review screen has no untranslated English left',
        reviewBody.includes(en('aiFood.review.save')) ? 'FAIL' : 'PASS');
    }

    // Leave the account in English, so the next group — and the next person to
    // open this browser — does not inherit a language they did not choose.
    await setLanguage(page, 'en');

    await page.context().close();
  });
}

/* ------------------------------------------------------------------ phone */

group('phone', async (b) => {
  const t = strings('en');
  const page = await (await context(b, 'phone')).newPage();
  await signIn(page, ACCOUNTS.member, PASSWORD);

  if ((await openAiSheet(page, t)) === 'absent') {
    record('phone', 'the whole journey at 390x844', 'BLOCKED', 'entry point missing');
    await page.context().close();
    return;
  }
  record('phone', 'the sheet opens at 390x844', 'PASS');
  await shot(page, 'phone', 'chooser');

  const overflows = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  record('phone', 'the chooser does not scroll sideways', overflows ? 'FAIL' : 'PASS');

  await typeInto(page, page.locator('#ai-food-text'), 'two eggs and toast');
  await wait(400);
  await mouseClick(page, page.locator(`button:has-text("${t('aiFood.choose.analyseText')}")`).first());
  const where = await settled(page, t);
  record('phone', 'a typed meal reaches the review screen on a phone',
    where === 'review' ? 'PASS' : 'FAIL', where);
  await shot(page, 'phone', 'review');

  if (where === 'review') {
    const o2 = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    record('phone', 'the review screen does not scroll sideways', o2 ? 'FAIL' : 'PASS');

    const save = page.locator(`button:has-text("${t('aiFood.review.save')}")`).first();
    const box = await save.boundingBox().catch(() => null);
    record('phone', 'the save button is reachable without zooming',
      box && box.width >= 44 && box.height >= 36 ? 'PASS' : 'FAIL',
      box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'not on screen');
  }

  await page.context().close();
});

/* ----------------------------------------------------------- keyboard a11y */

group('a11y', async (b) => {
  const t = strings('en');
  const page = await (await context(b, 'desktop')).newPage();
  await signIn(page, ACCOUNTS.member, PASSWORD);
  await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
  await present(page.locator(`text=${t('aiFood.entry.title')}`));

  /*
   * Reach the AI entry point with the keyboard alone, then complete a typed
   * log without the mouse touching anything. No mouseClick() in this group
   * on purpose.
   */
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await page.keyboard.press('Tab');
    await wait(60);
    const label = await page.evaluate(() => (document.activeElement?.innerText || document.activeElement?.ariaLabel || '').slice(0, 80));
    if (label.includes(t('aiFood.entry.title'))) reached = true;
  }
  record('a11y', 'the AI entry point is reachable by Tab alone', reached ? 'PASS' : 'FAIL');

  if (reached) {
    await page.keyboard.press('Enter');
    await wait(4000);
    if ((await page.locator(`text=${t('aiFood.consent.title')}`).count()) > 0) {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await wait(3500);
    }

    // Focus the text box the way the keyboard user does, then type.
    const box = page.locator('#ai-food-text');
    if ((await box.count()) > 0) {
      await box.focus();
      await page.keyboard.type('two eggs and toast', { delay: 10 });
      await wait(400);

      // Tab to the submit button and press it with the keyboard.
      let onSubmit = false;
      for (let i = 0; i < 8 && !onSubmit; i++) {
        await page.keyboard.press('Tab');
        await wait(80);
        const label = await page.evaluate(() => (document.activeElement?.innerText || '').slice(0, 60));
        if (label.includes(t('aiFood.choose.analyseText'))) onSubmit = true;
      }
      record('a11y', 'the submit button follows the text box in the focus order',
        onSubmit ? 'PASS' : 'FAIL');

      if (onSubmit) {
        await page.keyboard.press('Enter');
        const where = await settled(page, t);
        record('a11y', 'a typed meal can be completed with the keyboard alone',
          where === 'review' ? 'PASS' : 'FAIL', where);
        await shot(page, 'a11y', 'keyboard-only-review');
      }
    }
  }

  // Accessible names on the two controls that are icons rather than words.
  await page.goto(`${APP}/settings`, { waitUntil: 'domcontentloaded' });
  record('a11y', 'the Settings AI toggle has an accessible name',
    (await present(consentToggle(page, t))) ? 'PASS' : 'FAIL');

  await page.goto(`${APP}/food-journal`, { waitUntil: 'domcontentloaded' });
  await present(page.locator(`text=${t('aiFood.entry.title')}`));
  await mouseClick(page, page.locator(`text=${t('aiFood.entry.title')}`));
  await wait(3500);
  if ((await page.locator(`text=${t('aiFood.consent.accept')}`).count()) > 0) {
    await mouseClick(page, page.locator(`text=${t('aiFood.consent.accept')}`));
    await wait(3000);
  }
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title'))
      .length);
  record('a11y', 'every visible button in the sheet has a name',
    unnamed === 0 ? 'PASS' : 'FAIL', `${unnamed} unnamed`);

  await page.context().close();
});

/* --------------------------------------------------------------- failures */

group('failure-ui', async (b) => {
  const t = strings('en');
  const page = await (await context(b, 'desktop')).newPage();
  await signIn(page, ACCOUNTS.member, PASSWORD);

  /* ---- double submit ---- */
  if ((await openAiSheet(page, t)) !== 'absent') {
    const calls = [];
    page.on('response', (r) => {
      if (r.url().includes('/api/ai/food-log/analyze')) calls.push(r.status());
    });
    await typeInto(page, page.locator('#ai-food-text'), 'two eggs and toast');
    await wait(400);
    const submit = page.locator(`button:has-text("${t('aiFood.choose.analyseText')}")`).first();
    const box = await submit.boundingBox();
    // two real clicks as fast as a hand can manage
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await wait(120);
    await page.mouse.down(); await page.mouse.up();

    const where = await settled(page, t);
    record('failure-ui', 'a double click does not analyse twice',
      calls.length <= 1 ? 'PASS' : 'FAIL', `${calls.length} analyze call(s)`);
    record('failure-ui', 'a double click still reaches a usable screen',
      where === 'loading' ? 'FAIL' : 'PASS', where);
    await shot(page, 'failure-ui', 'double-submit');
  }

  /* ---- browser back, mid review ---- */
  if ((await openAiSheet(page, t)) !== 'absent') {
    await typeInto(page, page.locator('#ai-food-text'), 'chicken breast and rice');
    await wait(400);
    await mouseClick(page, page.locator(`button:has-text("${t('aiFood.choose.analyseText')}")`).first());
    const where = await settled(page, t);
    if (where === 'review') {
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await wait(5000);
      const body = await page.locator('body').innerText();
      record('failure-ui', 'the back button does not leave a half-saved meal',
        body.includes(t('aiFood.review.title')) ? 'INFO' : 'PASS',
        body.includes(t('aiFood.review.title')) ? 'review survived a back navigation' : 'review dismissed');
      await shot(page, 'failure-ui', 'after-back');
    } else {
      record('failure-ui', 'the back button does not leave a half-saved meal', 'BLOCKED', where);
    }
  }

  /* ---- refresh mid review ---- */
  if ((await openAiSheet(page, t)) !== 'absent') {
    await typeInto(page, page.locator('#ai-food-text'), 'a bowl of oatmeal with banana');
    await wait(400);
    await mouseClick(page, page.locator(`button:has-text("${t('aiFood.choose.analyseText')}")`).first());
    const where = await settled(page, t);
    if (where === 'review') {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await wait(9000);
      const body = await page.locator('body').innerText();
      record('failure-ui', 'a refresh during review saves nothing by accident',
        body.includes(t('aiFood.review.title')) ? 'FAIL' : 'PASS');
      await shot(page, 'failure-ui', 'after-refresh');
    } else {
      record('failure-ui', 'a refresh during review saves nothing by accident', 'BLOCKED', where);
    }
  }

  /* ---- slow network ---- */
  {
    const ctx2 = await context(b, 'desktop');
    const page2 = await ctx2.newPage();
    await signIn(page2, ACCOUNTS.member, PASSWORD);
    if ((await openAiSheet(page2, t)) !== 'absent') {
      const cdp = await ctx2.newCDPSession(page2);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 400, downloadThroughput: 50000, uploadThroughput: 25000,
      });
      await typeInto(page2, page2.locator('#ai-food-text'), 'two eggs and toast');
      await wait(400);
      await mouseClick(page2, page2.locator(`button:has-text("${t('aiFood.choose.analyseText')}")`).first());
      await wait(9000);
      const waiting = await page2.locator('body').innerText();
      record('failure-ui', 'a slow connection shows progress, not a frozen screen',
        waiting.includes(t('aiFood.loading.working')) || waiting.includes(t('aiFood.review.title'))
          ? 'PASS' : 'FAIL');
      await shot(page2, 'failure-ui', 'slow-3g-loading');
      const where = await settled(page2, t, 110000);
      record('failure-ui', 'a slow connection still finishes somewhere usable',
        where === 'loading' ? 'FAIL' : 'PASS', where);
      await shot(page2, 'failure-ui', 'slow-3g-settled');
    }
    await ctx2.close();
  }

  /* ---- offline ---- */
  {
    const ctx3 = await context(b, 'desktop');
    const page3 = await ctx3.newPage();
    await signIn(page3, ACCOUNTS.member, PASSWORD);
    if ((await openAiSheet(page3, t)) !== 'absent') {
      await typeInto(page3, page3.locator('#ai-food-text'), 'two eggs and toast');
      await wait(400);
      await ctx3.setOffline(true);
      await mouseClick(page3, page3.locator(`button:has-text("${t('aiFood.choose.analyseText')}")`).first());
      await wait(14000);
      const body = await page3.locator('body').innerText();
      const honest = body.includes(t('aiFood.error.title')) || body.includes(t('aiFood.error.offline'));
      record('failure-ui', 'losing the network says so and offers manual logging',
        honest ? 'PASS' : 'FAIL');
      record('failure-ui', 'the manual fallback is offered on failure',
        body.includes(t('aiFood.error.logManually')) ? 'PASS' : 'FAIL');
      await shot(page3, 'failure-ui', 'offline');
      await ctx3.setOffline(false);
    }
    await ctx3.close();
  }

  await page.context().close();
});

/* ------------------------------------------------------------------- run */

const wanted = process.argv.slice(2);
const b = await browser();
try {
  for (const [name, fn] of Object.entries(groups)) {
    if (wanted.length && !wanted.includes(name)) continue;
    console.log(`\n== ${name} ==`);
    try {
      await fn(b);
    } catch (e) {
      record(name, 'group crashed', 'FAIL', e.message.split('\n')[0].slice(0, 140));
    }
  }
} finally {
  await b.close();
  writeResults(wanted.length ? `results-${wanted.join('-')}.json` : 'results.json');
}
