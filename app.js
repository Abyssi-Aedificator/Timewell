(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const defaults = { theme: 'dark', ui: 'classic', accent: 'default', sound: true, notify: false, goal: 120 };
  let storageFailed = false;
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem('timewell-' + key)) ?? fallback; } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem('timewell-' + key, JSON.stringify(value)); }
    catch { if (!storageFailed) { storageFailed = true; toast('Browser storage is unavailable. Keep this tab open to preserve your session.'); } }
  }
  let settings = { ...defaults, ...read('settings', {}) };
  if (!['dark', 'light', 'system'].includes(settings.theme)) settings.theme = defaults.theme;
  if (!['classic', 'material', 'apple'].includes(settings.ui)) settings.ui = defaults.ui;
  settings.accent = TimewellTheme.normalizeAccent(settings.accent);
  if (!Number.isInteger(settings.goal) || settings.goal < 1 || settings.goal > 1440) settings.goal = defaults.goal;
  let history = read('history', []);
  if (!Array.isArray(history)) history = [];
  history = history.filter(s => s && typeof s.name === 'string' && Number.isFinite(s.duration) && s.duration > 0 && Number.isFinite(s.endedAt) && ['focus', 'break', 'stopwatch'].includes(s.mode));
  const freshTimer = (mode = 'focus', duration = mode === 'break' ? 300000 : 1500000) => ({ mode, duration, remaining: duration, running: false, deadline: null, startedAt: null, name: '' });
  // Each new page load starts with an empty timer.
  let timer = freshTimer('focus', 0);
  let page = 'timer', audioContext, toastTimeout, installPrompt;
  let pendingConfirmation = null;
  const systemTheme = matchMedia('(prefers-color-scheme: light)');
  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 5000);
  }
  function applySettings() {
    const theme = settings.theme === 'system' ? (systemTheme.matches ? 'light' : 'dark') : settings.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.ui = settings.ui;
    TimewellTheme.apply(settings);
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0b0d14' : '#f2f4fa';
    $('setting-theme').value = settings.theme;
    $('setting-ui').value = settings.ui;
    $('setting-goal').value = settings.goal;
    $('setting-sound').checked = settings.sound;
    $('setting-notify').checked = settings.notify && 'Notification' in window && Notification.permission === 'granted';
    document.querySelectorAll('.swatch').forEach(button => {
      button.setAttribute('aria-pressed', button.dataset.accent === settings.accent);
      const preset = TimewellTheme.presets.find(p => p.id === button.dataset.accent);
      const [first, second] = TimewellTheme.presetColors(preset, theme);
      button.style.setProperty('--swatch', preset.id === 'default' ? first : preset.group === 1 ? 'linear-gradient(135deg,' + first + ' 50%,' + second + ' 50%)' : 'linear-gradient(135deg,' + first + ',' + second + ')');
    });
    $('accent-extra').hidden = settings.ui === 'material';
    renderStats();
  }
  function saveSettings() { write('settings', settings); applySettings(); }
  systemTheme.addEventListener('change', () => { if (settings.theme === 'system') applySettings(); });
  function clock(ms, roundUp = false) {
    const seconds = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
    return (h ? String(h).padStart(2, '0') + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function durationText(ms) {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return seconds + 's';
    const minutes = Math.floor(seconds / 60);
    return minutes >= 60 ? Math.floor(minutes / 60) + 'h ' + minutes % 60 + 'm' : minutes + 'm' + (seconds % 60 ? ' ' + seconds % 60 + 's' : '');
  }
  function timeLeft() { return timer.running ? Math.max(0, timer.deadline - Date.now()) : timer.remaining; }
  function persistTimer() { write('timer', timer); }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon'); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name); svg.append(use); return svg;
  }
  function setAction(id, paused, text) {
    const button = $(id);
    if (button.dataset.action === text) return;
    button.dataset.action = text;
    const span = document.createElement('span'); span.textContent = text;
    button.replaceChildren(icon(paused ? 'pause' : 'play'), span);
  }
  function renderTimer() {
    const remaining = timeLeft();
    const time = clock(remaining, true);
    $('timer-display').textContent = time;
    $('timer-display').classList.toggle('long', time.length > 5);
    $('timer-status').textContent = timer.running ? (timer.mode === 'break' ? 'TAKE A BREATHER' : 'FOCUS IN PROGRESS') : timer.startedAt ? 'PAUSED' : timer.mode === 'break' ? 'READY FOR A BREAK' : 'READY TO FOCUS';
    $('timer-caption').textContent = timer.running ? 'You’ve got this.' : timer.startedAt ? 'Pick up where you left off.' : timer.mode === 'break' ? 'A moment to recharge.' : 'One thing at a time.';
    $('timer-progress').style.strokeDashoffset = 879.646 * (1 - (timer.duration > 0 ? Math.min(1, remaining / timer.duration) : 0));
    $('timer-start').disabled = timer.duration === 0;
    setAction('timer-start', timer.running, timer.running ? 'Pause timer' : timer.startedAt ? 'Resume timer' : 'Start timer');
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === timer.mode));
    document.querySelectorAll('[data-minutes]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.minutes) * 60000 === timer.duration));
    $('mode-badge').textContent = timer.mode === 'break' ? 'BREAK' : 'COUNTDOWN';
    document.title = timer.running ? time + ' · Timewell' : 'Timewell';
  }
  function showPage(next) {
    if (!['timer', 'history', 'settings'].includes(next)) return;
    page = next;
    document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.id !== 'panel-' + next; });
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.dataset.page === next) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (next === 'history') renderHistory();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
  function confirmAction({ title = 'Reset this session?', message = 'Your current progress will be discarded.', accept = 'Reset' } = {}) {
    if (pendingConfirmation) return Promise.resolve(false);
    $('confirm-title').textContent = title; $('confirm-message').textContent = message; $('confirm-accept').textContent = accept;
    $('confirm-cancel').textContent = 'Cancel';
    $('confirm-dialog').showModal(); $('confirm-cancel').focus();
    return new Promise(resolve => { pendingConfirmation = resolve; });
  }
  function resolveConfirmation(result) {
    $('confirm-dialog').close(); const resolve = pendingConfirmation; pendingConfirmation = null; resolve?.(result);
  }
  $('confirm-cancel').addEventListener('click', () => resolveConfirmation(false));
  $('confirm-accept').addEventListener('click', () => resolveConfirmation(true));
  $('confirm-dialog').addEventListener('cancel', event => { event.preventDefault(); resolveConfirmation(false); });
  function durationUntil(time, now = new Date()) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
    const [hours, minutes] = time.split(':').map(Number);
    const end = new Date(now);
    end.setHours(hours, minutes, 0, 0);
    if (end <= now) end.setDate(end.getDate() + 1);
    return end.getTime() - now.getTime();
  }
  function scrollToTimer() {
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  async function chooseDuration(duration, mode = timer.mode, endTime = null) {
    if (!Number.isFinite(duration) || duration < 1000 || duration > 86400000) return toast('Choose a duration between 1 second and 24 hours.');
    if (timer.startedAt && !await confirmAction()) return;
    let startAt = null;
    if (endTime !== null) {
      // Recalculate after confirmation so time spent in the dialog is excluded.
      startAt = Date.now();
      duration = durationUntil(endTime, new Date(startAt));
      if (!Number.isFinite(duration) || duration < 1000 || duration > 86400000) return toast('Choose an end time within the next 24 hours.');
    }
    timer = { ...freshTimer(mode, duration), name: $('task-name').value };
    if (startAt !== null) {
      timer.startedAt = startAt;
      timer.deadline = startAt + duration;
      timer.running = true;
    }
    persistTimer(); renderTimer();
    $('custom-hours').value = Math.floor(duration / 3600000);
    $('custom-minutes').value = Math.floor(duration / 60000) % 60;
    $('custom-seconds').value = Math.floor(duration / 1000) % 60;
    if (endTime !== null) { scrollToTimer(); toast('Timer started for ' + clock(duration, true) + '.'); }
  }
  document.querySelectorAll('[data-minutes]').forEach(b => b.addEventListener('click', () => chooseDuration(Number(b.dataset.minutes) * 60000)));
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { if (timer.mode !== b.dataset.mode) chooseDuration(b.dataset.mode === 'break' ? 300000 : 1500000, b.dataset.mode); }));
  $('custom-form').addEventListener('submit', event => {
    event.preventDefault();
    const values = ['custom-hours', 'custom-minutes', 'custom-seconds'].map(id => Number($(id).value));
    if (!values.every(Number.isInteger)) return toast('Use whole numbers for hours, minutes, and seconds.');
    chooseDuration((values[0] * 3600 + values[1] * 60 + values[2]) * 1000);
  });
  $('end-time-form').addEventListener('submit', event => {
    event.preventDefault();
    const time = $('end-time').value;
    const duration = durationUntil(time);
    if (!Number.isFinite(duration)) return toast('Choose a valid end time.');
    prepareAudio();
    chooseDuration(duration, timer.mode, time);
  });
  function prepareAudio() {
    if (!settings.sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) { audioContext ??= new Audio(); audioContext.resume().catch(() => {}); }
    } catch { /* The visual completion dialog remains available without audio. */ }
  }
  $('timer-start').addEventListener('click', () => {
    if (timer.duration === 0) return;
    tick(); prepareAudio();
    if (timer.running) { timer.remaining = timeLeft(); timer.running = false; timer.deadline = null; }
    else { if (timer.remaining <= 0) timer.remaining = timer.duration; timer.startedAt ??= Date.now(); timer.deadline = Date.now() + timer.remaining; timer.running = true; }
    persistTimer(); renderTimer();
    if (timer.running) scrollToTimer();
  });
  $('timer-reset').addEventListener('click', async () => {
    if (timer.startedAt && !await confirmAction()) return;
    timer = { ...freshTimer(timer.mode, 0), name: $('task-name').value };
    for (const id of ['custom-hours', 'custom-minutes', 'custom-seconds']) $(id).value = 0;
    $('end-time').value = '';
    $('end-time-label').textContent = 'Choose time';
    persistTimer(); renderTimer();
  });
  $('timer-add').addEventListener('click', () => {
    tick();
    if (timer.duration + 60000 > 86399000) return toast('The maximum duration is 23:59:59.');
    timer.duration += 60000; timer.remaining += 60000; if (timer.running) timer.deadline += 60000;
    persistTimer(); renderTimer();
  });
  $('task-name').value = typeof timer.name === 'string' ? timer.name : '';
  $('task-name').addEventListener('input', () => { timer.name = $('task-name').value; persistTimer(); });
  function chime() {
    if (!settings.sound || !audioContext || audioContext.state !== 'running') return;
    try {
      [523.25, 659.25, 783.99].forEach((frequency, i) => {
        const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
        const start = audioContext.currentTime + i * .2;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.12, start + .02); gain.gain.exponentialRampToValueAtTime(.001, start + .8);
        oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + .85);
      });
    } catch { /* Audio failure must not prevent completion. */ }
  }
  function addSession(session) {
    history.unshift(session); write('history', history); renderHistory(); renderStats();
  }
  function completeTimer() {
    const endedAt = timer.deadline;
    timer.running = false; timer.remaining = 0; timer.deadline = null;
    const completed = { mode: timer.mode, name: timer.name.trim() || (timer.mode === 'break' ? 'A little breathing room' : 'Focus session'), duration: timer.duration, endedAt };
    persistTimer(); addSession(completed); chime();
    $('complete-title').textContent = timer.mode === 'break' ? 'Feeling refreshed?' : 'Time well spent.';
    $('complete-message').textContent = timer.mode === 'break' ? 'Your break is complete. Ready for your next focus session?' : 'You made time for ' + durationText(timer.duration) + ' of focus. Take a moment to recharge.';
    $('complete-next').textContent = timer.mode === 'break' ? 'Start focusing' : 'Take a break';
    if ($('confirm-dialog').open) resolveConfirmation(false);
    if (!$('complete-dialog').open) $('complete-dialog').showModal();
    if (settings.notify && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      const options = { body: $('complete-message').textContent, icon: 'icon-192.png', tag: 'timewell-complete' };
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(reg => reg.showNotification($('complete-title').textContent, options)).catch(() => {});
      else { try { new Notification($('complete-title').textContent, options); } catch {} }
    }
    timer.startedAt = null; persistTimer(); renderTimer();
  }
  $('complete-close').addEventListener('click', () => { $('complete-dialog').close(); timer.remaining = timer.duration; persistTimer(); renderTimer(); });
  $('complete-dialog').addEventListener('cancel', () => { timer.remaining = timer.duration; persistTimer(); renderTimer(); });
  $('complete-next').addEventListener('click', () => {
    $('complete-dialog').close(); const mode = timer.mode === 'break' ? 'focus' : 'break';
    timer = freshTimer(mode); $('task-name').value = ''; persistTimer(); renderTimer(); showPage('timer');
  });
  function renderSessions(target, sessions) {
    target.replaceChildren();
    if (!sessions.length) {
      const empty = document.createElement('div'); empty.className = 'empty';
      const title = document.createElement('div'); title.textContent = 'A fresh start.';
      const note = document.createElement('p'); note.textContent = 'Your completed sessions will find a home here.';
      empty.append(icon('history'), title, note); target.append(empty); return;
    }
    sessions.forEach(session => {
      const row = document.createElement('div'); row.className = 'session-row';
      const mark = document.createElement('div'); mark.className = 'session-icon'; mark.append(icon(session.mode === 'break' ? 'leaf' : 'check'));
      const copy = document.createElement('div'); copy.className = 'session-copy';
      const name = document.createElement('strong'); name.textContent = session.name;
      const info = document.createElement('small'); info.textContent = new Date(session.endedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' · ' + (session.mode === 'break' ? 'Break' : session.mode === 'stopwatch' ? 'Stopwatch' : 'Focus');
      copy.append(name, info);
      const duration = document.createElement('span'); duration.className = 'session-duration'; duration.textContent = durationText(session.duration);
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'btn small danger'; remove.textContent = 'Delete';
      remove.setAttribute('aria-label', 'Delete session: ' + session.name);
      remove.addEventListener('click', async () => {
        if (!await confirmAction({ title: 'Delete this session?', message: 'This session will be removed from your history and daily totals.', accept: 'Delete' })) return;
        const index = history.indexOf(session);
        if (index === -1) return;
        history.splice(index, 1);
        write('history', history); renderHistory(); renderStats(); toast('Session deleted.');
      });
      row.append(mark, copy, duration, remove); target.append(row);
    });
  }
  function renderHistory() { renderSessions($('all-sessions'), history); }
  function renderStats() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const today = history.filter(s => s.endedAt >= start.getTime() && s.endedAt <= Date.now());
    const focus = today.filter(s => s.mode === 'focus'), minutes = Math.floor(focus.reduce((sum, s) => sum + s.duration, 0) / 60000);
    $('stat-focus').textContent = minutes >= 60 ? Math.floor(minutes / 60) + 'h ' + minutes % 60 + 'm' : minutes + 'm';
    $('stat-sessions').textContent = focus.length;
    $('stat-breaks').textContent = today.filter(s => s.mode === 'break').length;
    $('goal-label').textContent = minutes + ' / ' + settings.goal + ' min';
    const progress = Math.min(100, minutes / settings.goal * 100);
    $('goal-fill').style.width = progress + '%'; $('goal-progress').setAttribute('aria-valuenow', Math.round(progress));
  }
  $('export-history').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'Timewell', exportedAt: new Date().toISOString(), sessions: history }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'timewell-history-' + new Date().toISOString().slice(0, 10) + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('clear-history').addEventListener('click', async () => {
    if (!history.length) return toast('Your history is already empty.');
    if (!await confirmAction({ title: 'Clear your session history?', message: 'All saved sessions and daily totals will be removed from this browser. Export your history first if you want a copy.', accept: 'Clear history' })) return;
    history = []; write('history', history); renderHistory(); renderStats(); toast('Session history cleared.');
  });
  TimewellTheme.presets.forEach(preset => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'swatch'; button.dataset.accent = preset.id;
    button.setAttribute('aria-label', preset.name); button.title = preset.name;
    button.addEventListener('click', () => { settings.accent = preset.id; saveSettings(); });
    $(preset.group === 1 ? 'accent-extra' : 'accent-main').append(button);
  });
  $('setting-theme').addEventListener('change', event => { settings.theme = event.target.value; saveSettings(); });
  $('setting-ui').addEventListener('change', event => { settings.ui = event.target.value; saveSettings(); });
  $('setting-sound').addEventListener('change', event => { settings.sound = event.target.checked; prepareAudio(); saveSettings(); });
  $('goal-edit').addEventListener('click', () => {
    $('setting-goal').value = settings.goal;
    $('goal-dialog').showModal(); $('setting-goal').focus(); $('setting-goal').select();
  });
  $('goal-cancel').addEventListener('click', () => { $('goal-dialog').close(); $('goal-edit').focus(); });
  $('goal-form').addEventListener('submit', event => {
    event.preventDefault();
    const value = Number($('setting-goal').value);
    if (!Number.isInteger(value) || value < 1 || value > 1440) { toast('Choose a daily goal from 1 to 1,440 minutes.'); return; }
    settings.goal = value; saveSettings();
    $('goal-dialog').close(); $('goal-edit').focus(); toast('Daily focus goal updated.');
  });
  $('setting-notify').addEventListener('change', async event => {
    if (!event.target.checked) { settings.notify = false; saveSettings(); return; }
    if (!('Notification' in window)) { toast('Desktop notifications are not supported in this browser.'); event.target.checked = false; return; }
    try { settings.notify = await Notification.requestPermission() === 'granted'; }
    catch { settings.notify = false; }
    if (!settings.notify) toast('Notifications are blocked. You can enable them in your browser’s site settings.');
    saveSettings();
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,select,textarea,button,[contenteditable=true]') || document.querySelector('dialog[open]')) return;
    if (event.code === 'Space' && page === 'timer') { event.preventDefault(); $('timer-start').click(); }
    if (event.key.toLowerCase() === 'r' && page === 'timer') $('timer-reset').click();
  });
  let dateKey = '';
  function tick() {
    if (timer.running && timer.deadline <= Date.now()) completeTimer();
    renderTimer();
    const now = new Date();
    if (now.toDateString() !== dateKey) { dateKey = now.toDateString(); renderStats(); }
  }
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('pageshow', tick);
  // A session has one writer. Other tabs refresh after a local write to avoid duplicate completions.
  window.addEventListener('storage', event => {
    if (event.key?.startsWith('timewell-')) location.reload();
  });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
  $('install').addEventListener('click', async () => {
    if (!installPrompt) return;
    try { await installPrompt.prompt(); await installPrompt.userChoice; }
    catch { toast('Installation could not start. Try your browser’s Install app menu.'); }
    finally { installPrompt = null; $('install').hidden = true; }
  });
  window.addEventListener('appinstalled', () => { $('install').hidden = true; });
  applySettings(); renderHistory(); tick();
  setInterval(tick, 100);
  if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => { toast('Offline mode could not be enabled. The timer still works while this page is open.'); });
})();
