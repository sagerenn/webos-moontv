import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const rootDir = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createJsonResponse(body, init = {}) {
  const status = init.status || 200;
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    async json() {
      return body;
    },
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    }
  };
}

async function waitFor(window, predicate, message, timeoutMs = 1000, intervalMs = 10) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }

  throw new Error(message);
}

async function main() {
  const [indexHtml, appJs] = await Promise.all([
    fs.readFile(path.join(rootDir, 'hosted', 'index.html'), 'utf8'),
    fs.readFile(path.join(rootDir, 'hosted', 'app.js'), 'utf8')
  ]);

  const dom = new JSDOM(indexHtml, {
    url: 'http://127.0.0.1:3010/tv/index.html',
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });

  const { window } = dom;
  const { document } = window;
  const storage = window.localStorage;

  const localHistoryKey = 'moontv-tv.localHistory.admin';
  const localFavoritesKey = 'moontv-tv.localFavorites.admin';

  storage.setItem(localHistoryKey, JSON.stringify({
    'sourceA+video1': {
      title: 'Existing History',
      source_name: 'Source A',
      cover: '',
      year: '2025',
      index: 1,
      total_episodes: 12,
      play_time: 42,
      total_time: 120,
      save_time: 1000,
      search_title: 'Existing History'
    }
  }));
  storage.setItem(localFavoritesKey, JSON.stringify({
    'sourceB+video9': {
      title: 'Other Favorite',
      source_name: 'Source B',
      total_episodes: 8,
      year: '2024',
      cover: '',
      save_time: 2000,
      search_title: 'Other Favorite'
    }
  }));

  const fetchLog = [];
  const detailPayload = {
    id: 'video1',
    source: 'sourceA',
    source_name: 'Source A',
    title: 'Video One',
    poster: '',
    year: '2025',
    type_name: 'Series',
    desc: 'Description',
    episodes: ['/stream/ep1.m3u8'],
    episodes_titles: ['Episode 1']
  };
  const searchPayload = {
    results: [
      {
        id: 'video1',
        source: 'sourceA',
        source_name: 'Source A',
        title: 'Video One',
        poster: '',
        year: '2025',
        episodes_titles: ['Episode 1']
      }
    ]
  };

  window.fetch = async function (url, options = {}) {
    const requestUrl = String(url);
    fetchLog.push({ url: requestUrl, options });

    if (requestUrl === '/api/login') {
      return createJsonResponse({
        token: encodeURIComponent(
          JSON.stringify({
            role: 'owner',
            username: 'admin',
            timestamp: Date.now(),
            signature: 'sig'
          })
        ),
        auth: {
          role: 'owner',
          username: 'admin',
          timestamp: Date.now(),
          signature: 'sig'
        }
      });
    }

    if (requestUrl.startsWith('/api/playrecords')) {
      if ((options.method || 'GET').toUpperCase() === 'GET') {
        return createJsonResponse({ error: 'Internal Server Error' }, { status: 500 });
      }
      return createJsonResponse({ error: 'Internal Server Error' }, { status: 500 });
    }

    if (requestUrl.startsWith('/api/favorites')) {
      if ((options.method || 'GET').toUpperCase() === 'GET') {
        return createJsonResponse({ error: 'Internal Server Error' }, { status: 500 });
      }
      return createJsonResponse({ error: 'Internal Server Error' }, { status: 500 });
    }

    if (requestUrl.startsWith('/api/search')) {
      return createJsonResponse(searchPayload);
    }

    if (requestUrl.startsWith('/api/source-detail')) {
      return createJsonResponse(detailPayload);
    }

    if (requestUrl === '/api/logout') {
      return createJsonResponse({ ok: true });
    }

    throw new Error('Unexpected fetch: ' + requestUrl);
  };

  window.open = function () {};
  window.HTMLMediaElement.prototype.load = function () {};
  window.HTMLMediaElement.prototype.play = function () {
    return Promise.resolve();
  };
  Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get() {
      return 120;
    }
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get() {
      return this._currentTime || 0;
    },
    set(value) {
      this._currentTime = value;
    }
  });

  const context = dom.getInternalVMContext();
  context.fetch = window.fetch;
  context.console = console;
  context.setTimeout = window.setTimeout.bind(window);
  context.clearTimeout = window.clearTimeout.bind(window);
  context.Headers = window.Headers;
  context.Response = window.Response;
  context.Request = window.Request;

  new vm.Script(appJs, { filename: 'hosted/app.js' }).runInContext(context);

  const serverInput = document.getElementById('server-url');
  const passwordInput = document.getElementById('password');
  const searchInput = document.getElementById('search-input');
  const loginForm = document.getElementById('login-form');
  const searchForm = document.getElementById('search-form');
  const statusPanel = document.getElementById('status-panel');
  const favoriteButton = document.getElementById('favorite-button');
  const historySummary = document.getElementById('history-summary');
  const favoritesSummary = document.getElementById('favorites-summary');
  const player = document.getElementById('player');

  serverInput.value = 'http://127.0.0.1:3010';
  passwordInput.value = 'test';
  loginForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(
    window,
    function () {
      return statusPanel.textContent.includes('stored locally on this TV');
    },
    'Login should report local sync fallback.'
  );

  assert(
    statusPanel.textContent.includes('stored locally on this TV'),
    'Login should report local sync fallback.'
  );
  assert(
    historySummary.textContent.includes('local') || historySummary.textContent.includes('stored locally'),
    'History summary should reflect local fallback.'
  );
  assert(
    favoritesSummary.textContent.includes('local') || favoritesSummary.textContent.includes('stored locally'),
    'Favorites summary should reflect local fallback.'
  );

  searchInput.value = 'Video';
  searchForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(
    window,
    function () {
      return Boolean(document.querySelector('#results-grid button'));
    },
    'Search should render a result button.'
  );

  const firstResult = document.querySelector('#results-grid button');
  assert(firstResult, 'Search should render a result button.');
  firstResult.click();
  await waitFor(
    window,
    function () {
      return document.getElementById('detail-title').textContent.includes('Video One');
    },
    'Detail view should load after selecting a result.'
  );

  favoriteButton.click();
  await waitFor(
    window,
    function () {
      const storedFavorites = JSON.parse(storage.getItem(localFavoritesKey) || '{}');
      return Boolean(storedFavorites['sourceA+video1']);
    },
    'Favorite should persist to local fallback storage.'
  );

  const storedFavorites = JSON.parse(storage.getItem(localFavoritesKey) || '{}');
  assert(storedFavorites['sourceA+video1'], 'Favorite should persist to local fallback storage.');
  assert(statusPanel.textContent.includes('Favorite saved locally.'), 'Favorite action should use local fallback.');

  player.currentTime = 55;
  player.dispatchEvent(new window.Event('pause', { bubbles: true }));
  await waitFor(
    window,
    function () {
      const storedHistory = JSON.parse(storage.getItem(localHistoryKey) || '{}');
      return storedHistory['sourceA+video1'] && Math.round(storedHistory['sourceA+video1'].play_time) === 55;
    },
    'Play history should persist to local fallback storage.',
    1500,
    20
  );

  const storedHistory = JSON.parse(storage.getItem(localHistoryKey) || '{}');
  assert(storedHistory['sourceA+video1'], 'Play history should persist to local fallback storage.');
  assert(
    Math.round(storedHistory['sourceA+video1'].play_time) === 55,
    'Play history should store the latest local playback time.'
  );

  assert(
    fetchLog.some((entry) => entry.url === '/api/login'),
    'Smoke test should exercise login.'
  );
  assert(
    fetchLog.some((entry) => entry.url.startsWith('/api/search?q=')),
    'Smoke test should exercise search.'
  );
  assert(
    fetchLog.some((entry) => entry.url.startsWith('/api/source-detail')),
    'Smoke test should exercise detail loading.'
  );

  console.log('Hosted frontend smoke test passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
