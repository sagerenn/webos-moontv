(function () {
  'use strict';

  installCompatibilityPolyfills();

  const storageKey = 'moontv-tv.launcherUrl';
  const input = document.getElementById('launcher-url');
  const launchButton = document.getElementById('launch-button');
  const saveButton = document.getElementById('save-button');
  const statusLine = document.getElementById('launcher-status');

  let config = {
    defaultUrl: '',
    autoLaunch: false,
    lastBuiltAt: ''
  };
  let autoLaunchTimer = 0;
  let autoLaunchCancelled = false;

  function installCompatibilityPolyfills() {
    if (
      typeof Promise !== 'undefined' &&
      Promise.prototype &&
      !Promise.prototype.finally
    ) {
      Promise.prototype.finally = function (callback) {
        const onFinally = function () {
          return callback();
        };

        return this.then(
          function (value) {
            return Promise.resolve(onFinally()).then(function () {
              return value;
            });
          },
          function (error) {
            return Promise.resolve(onFinally()).then(function () {
              throw error;
            });
          }
        );
      };
    }
  }

  loadConfig()
    .catch(function () {
      return null;
    })
    .finally(function () {
      hydrate();
      bindEvents();
    });

  function bindEvents() {
    launchButton.addEventListener('click', launch);
    saveButton.addEventListener('click', saveUrl);
    document.addEventListener('keydown', function (event) {
      if (autoLaunchTimer && (event.key === 'Escape' || event.keyCode === 461)) {
        event.preventDefault();
        cancelAutoLaunch();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        launch();
      }
    });
  }

  function hydrate() {
    const savedUrl = localStorage.getItem(storageKey) || '';
    input.value = savedUrl || config.defaultUrl || '';
    maybeScheduleAutoLaunch();
  }

  async function loadConfig() {
    const response = await fetch('./launcher-config.json');
    if (!response.ok) {
      return;
    }

    config = await response.json();
  }

  function normalizeUrl(value) {
    return (value || '').trim();
  }

  function saveUrl() {
    const url = normalizeUrl(input.value);
    if (!url) {
      setStatus('Enter a valid hosted frontend URL.', true);
      return;
    }

    localStorage.setItem(storageKey, url);
    autoLaunchCancelled = false;
    setStatus('Saved launcher URL.', false);
  }

  function launch() {
    const url = normalizeUrl(input.value);
    if (!url) {
      setStatus('Enter a hosted frontend URL before launching.', true);
      return;
    }

    localStorage.setItem(storageKey, url);
    window.clearTimeout(autoLaunchTimer);
    autoLaunchTimer = 0;
    setStatus('Opening hosted frontend...', false);
    window.location.href = url;
  }

  function maybeScheduleAutoLaunch() {
    const url = normalizeUrl(input.value);
    if (!url || !config.autoLaunch || autoLaunchCancelled) {
      return;
    }

    setStatus('Auto-launching hosted frontend in 3 seconds. Press Back to cancel.', false);
    autoLaunchTimer = window.setTimeout(function () {
      autoLaunchTimer = 0;
      launch();
    }, 3000);
  }

  function cancelAutoLaunch() {
    window.clearTimeout(autoLaunchTimer);
    autoLaunchTimer = 0;
    autoLaunchCancelled = true;
    setStatus('Auto-launch cancelled. You can still launch manually.', false);
  }

  function setStatus(message, isError) {
    statusLine.textContent = message;
    statusLine.style.color = isError ? '#ff8f8f' : '#9aaac0';
  }
})();
