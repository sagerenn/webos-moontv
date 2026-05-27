import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { JSDOM, VirtualConsole } from 'jsdom';

const rootDir = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createJsonResponse(body) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body;
    }
  };
}

function createTimerHarness() {
  let nextTimerId = 1;
  const timers = new Map();

  return {
    setTimeout(callback, delay) {
      const timerId = nextTimerId++;
      timers.set(timerId, {
        callback,
        delay: Number(delay) || 0
      });
      return timerId;
    },
    clearTimeout(timerId) {
      timers.delete(timerId);
    },
    getPendingCount() {
      return timers.size;
    },
    runAll() {
      const pending = Array.from(timers.entries()).sort(function (left, right) {
        return left[1].delay - right[1].delay;
      });

      timers.clear();
      pending.forEach(function (entry) {
        entry[1].callback();
      });
    }
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await new Promise(function (resolve) {
    setImmediate(resolve);
  });
}

async function createLauncherEnv(config) {
  const [indexHtml, launcherJs] = await Promise.all([
    fs.readFile(path.join(rootDir, 'launcher', 'index.html'), 'utf8'),
    fs.readFile(path.join(rootDir, 'launcher', 'launcher.js'), 'utf8')
  ]);

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', function (error) {
    if (!error || !String(error.message || '').includes('navigation')) {
      throw error;
    }
  });

  const dom = new JSDOM(indexHtml, {
    url: 'http://127.0.0.1:3010/launcher/index.html',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    virtualConsole
  });

  const { window } = dom;
  const timers = createTimerHarness();

  window.fetch = async function (url) {
    if (String(url) === './launcher-config.json') {
      return createJsonResponse(config);
    }
    throw new Error('Unexpected launcher fetch: ' + String(url));
  };
  window.setTimeout = timers.setTimeout;
  window.clearTimeout = timers.clearTimeout;

  const context = dom.getInternalVMContext();
  context.fetch = window.fetch;
  context.console = console;
  context.setTimeout = window.setTimeout;
  context.clearTimeout = window.clearTimeout;

  new vm.Script(launcherJs, { filename: 'launcher/launcher.js' }).runInContext(context);
  await flushAsyncWork();

  return {
    dom,
    window,
    timers,
    storage: window.localStorage,
    input: window.document.getElementById('launcher-url'),
    launchButton: window.document.getElementById('launch-button'),
    saveButton: window.document.getElementById('save-button'),
    statusLine: window.document.getElementById('launcher-status')
  };
}

async function testManualMode() {
  const env = await createLauncherEnv({
    defaultUrl: '',
    autoLaunch: false,
    lastBuiltAt: '2026-05-27T00:00:00.000Z'
  });

  env.input.value = 'https://moontv.example.com/tv/index.html';
  env.saveButton.click();

  assert(
    env.storage.getItem('moontv-tv.launcherUrl') === 'https://moontv.example.com/tv/index.html',
    'Manual save should persist the launcher URL.'
  );
  assert(
    env.statusLine.textContent.includes('Saved launcher URL.'),
    'Manual save should update the status line.'
  );
  assert(env.timers.getPendingCount() === 0, 'Manual mode should not schedule auto-launch.');

  env.launchButton.click();
  assert(
    env.statusLine.textContent.includes('Opening hosted frontend...'),
    'Manual launch should update the status line.'
  );
  assert(
    env.storage.getItem('moontv-tv.launcherUrl') === 'https://moontv.example.com/tv/index.html',
    'Manual launch should keep the launcher URL persisted.'
  );
}

async function testAutoLaunchCancel() {
  const env = await createLauncherEnv({
    defaultUrl: 'https://moontv.example.com/tv/index.html',
    autoLaunch: true,
    lastBuiltAt: '2026-05-27T00:00:00.000Z'
  });

  assert(
    env.input.value === 'https://moontv.example.com/tv/index.html',
    'Auto-launch mode should hydrate the default URL into the input.'
  );
  assert(env.timers.getPendingCount() === 1, 'Auto-launch mode should schedule one timer.');
  assert(
    env.statusLine.textContent.includes('Auto-launching hosted frontend in 3 seconds'),
    'Auto-launch mode should announce the pending launch.'
  );

  env.window.document.dispatchEvent(
    new env.window.KeyboardEvent('keydown', {
      key: 'Escape',
      keyCode: 27,
      bubbles: true,
      cancelable: true
    })
  );

  assert(env.timers.getPendingCount() === 0, 'Escape should cancel the pending auto-launch timer.');
  assert(
    env.statusLine.textContent.includes('Auto-launch cancelled.'),
    'Escape should update the cancel status.'
  );
}

async function testAutoLaunchExecution() {
  const env = await createLauncherEnv({
    defaultUrl: 'https://moontv.example.com/tv/index.html',
    autoLaunch: true,
    lastBuiltAt: '2026-05-27T00:00:00.000Z'
  });

  assert(env.timers.getPendingCount() === 1, 'Auto-launch execution test should start with one timer.');
  env.timers.runAll();

  assert(
    env.statusLine.textContent.includes('Opening hosted frontend...'),
    'Executing the auto-launch timer should trigger launcher navigation state.'
  );
  assert(
    env.storage.getItem('moontv-tv.launcherUrl') === 'https://moontv.example.com/tv/index.html',
    'Auto-launch should persist the default URL before opening.'
  );
}

async function main() {
  await testManualMode();
  await testAutoLaunchCancel();
  await testAutoLaunchExecution();
  console.log('Launcher smoke test passed.');
}

main().catch(function (error) {
  console.error(error.message || error);
  process.exit(1);
});
