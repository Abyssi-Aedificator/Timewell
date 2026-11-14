/* Download updates separately from approving them, as in PlayDex. */
window.TimewellUpdates = (() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let registration, offered, dismissed, checking = false, applying = false, options;
  function askWorker(worker, message) {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('The update check timed out. Please try again.')); }, 15000);
      channel.port1.onmessage = event => {
        clearTimeout(timeout); channel.port1.close();
        if (event.data?.error) reject(new Error(event.data.error)); else resolve(event.data);
      };
      try { worker.postMessage(message, [channel.port2]); }
      catch (error) { clearTimeout(timeout); channel.port1.close(); reject(error); }
    });
  }
  function showUpdate(manual = false) {
    if (!offered || applying || document.hidden || $('update-dialog').open) return;
    if (document.querySelector('dialog[open]')) return;
    if (!manual && (dismissed === offered.cache || options.isBusy())) return;
    $('update-description').textContent = 'Timewell ' + offered.version + ' is ready. Choose Update now to install it, or Later to keep your current version.' + (options.isBusy() ? ' Updating reloads the app and resets your current timer to 00:00.' : ' Your history and preferences will be kept.');
    $('update-error').hidden = true;
    $('update-dialog').showModal();
    $('update-later').focus();
  }
  async function offerUpdate() {
    if (!registration || checking || applying) return;
    const worker = registration.waiting || registration.active;
    if (!worker) return;
    checking = true;
    try {
      const info = await askWorker(worker, { type: 'TIMEWELL_UPDATE_INFO' });
      if (!info || !info.pending || info.version === options.version) return;
      offered = { worker, cache: info.cache, version: info.version };
      $('update-open').hidden = false;
      showUpdate();
    } catch { /* Offline or an older worker without the message protocol: retry later. */ }
    finally { checking = false; }
  }
  function waitForActivation(worker) {
    if (worker.state === 'activated') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timeout); worker.removeEventListener('statechange', check); };
      const check = () => {
        if (worker.state === 'activated') { cleanup(); resolve(); }
        else if (worker.state === 'redundant') { cleanup(); reject(new Error('A newer update replaced this one. Please reopen the app.')); }
      };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('The update is taking longer than expected. Close and reopen the app.')); }, 15000);
      worker.addEventListener('statechange', check); check();
    });
  }
  function dismiss(event) {
    if (applying) { event?.preventDefault(); return; }
    event?.preventDefault(); dismissed = offered?.cache;
    $('update-dialog').close();
  }
  async function applyUpdate() {
    if (!offered || applying) return;
    applying = true; $('update-now').disabled = true; $('update-later').disabled = true;
    $('update-error').hidden = true;
    try {
      const { worker, cache } = offered;
      await askWorker(worker, { type: 'TIMEWELL_APPROVE_UPDATE', cache });
      await waitForActivation(worker);
      location.reload();
    } catch (error) {
      $('update-error').textContent = error.message; $('update-error').hidden = false;
      applying = false; $('update-now').disabled = false; $('update-later').disabled = false;
    }
  }
  async function init(config) {
    options = config;
    if (!('serviceWorker' in navigator) || !['https:', 'http:'].includes(location.protocol)) return;
    $('update-open').addEventListener('click', () => showUpdate(true));
    $('update-later').addEventListener('click', dismiss);
    $('update-dialog').addEventListener('cancel', dismiss);
    $('update-now').addEventListener('click', applyUpdate);
    const refresh = () => {
      if (document.hidden) return;
      offerUpdate(); registration?.update().catch(() => {});
    };
    try {
      registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      const watch = worker => {
        if (!worker) return;
        worker.addEventListener('statechange', () => { if (['installed', 'activated'].includes(worker.state)) offerUpdate(); });
      };
      registration.addEventListener('updatefound', () => watch(registration.installing));
      watch(registration.installing);
      navigator.serviceWorker.addEventListener('controllerchange', () => offerUpdate());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { dismissed = null; refresh(); } });
      window.addEventListener('online', refresh);
      document.addEventListener('close', () => showUpdate(), true);
      // Check long-running installed apps too, without reloading or interrupting timers.
      setInterval(() => { offerUpdate(); showUpdate(); }, 30000);
      setInterval(refresh, 5 * 60 * 1000);
      refresh();
    } catch { options.toast('Offline mode could not be enabled. The timer still works while this page is open.'); }
  }
  return { init };
})();
