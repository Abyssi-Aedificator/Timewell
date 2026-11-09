(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('time-picker');
  let hour = 12, minute = 0, pm = false, unit = 'hour', inputMode = false, dragging = false;
  const pad = value => String(value).padStart(2, '0');
  function to24Hour(hour, pm) { return hour % 12 + (pm ? 12 : 0); }
  function dialValue(x, y, unit) {
    const turns = (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1;
    const steps = unit === 'hour' ? 12 : 60;
    const value = Math.round(turns * steps) % steps;
    return unit === 'hour' ? value || 12 : value;
  }
  function render() {
    $('picker-hour').textContent = pad(hour);
    $('picker-minute').textContent = pad(minute);
    $('picker-hour').setAttribute('aria-pressed', unit === 'hour');
    $('picker-minute').setAttribute('aria-pressed', unit === 'minute');
    $('picker-am').setAttribute('aria-pressed', !pm);
    $('picker-pm').setAttribute('aria-pressed', pm);
    for (const part of ['hour', 'minute']) {
      $('picker-' + part).hidden = inputMode;
      $('picker-' + part + '-input').hidden = !inputMode;
    }
    $('picker-dial-area').hidden = inputMode;
    $('picker-input-toggle').setAttribute('aria-label', inputMode ? 'Switch to clock dial' : 'Switch to keyboard input');
    $('picker-input-toggle').title = inputMode ? 'Switch to clock dial' : 'Switch to keyboard input';
    $('picker-input-toggle').replaceChildren();
    if (inputMode) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('icon'); svg.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#i-timer'); svg.append(use); $('picker-input-toggle').append(svg);
    } else {
      $('picker-input-toggle').textContent = '⌨';
    }
    const dial = $('picker-dial');
    dial.setAttribute('aria-label', unit === 'hour' ? 'Hour' : 'Minute');
    dial.setAttribute('aria-valuemin', unit === 'hour' ? 1 : 0);
    dial.setAttribute('aria-valuemax', unit === 'hour' ? 12 : 59);
    dial.setAttribute('aria-valuenow', unit === 'hour' ? hour : minute);
    $('picker-instruction').textContent = unit === 'hour' ? 'Select hour' : 'Select minute';
    $('picker-dial-labels').replaceChildren();
    const selected = unit === 'hour' ? hour : minute;
    for (let i = 0; i < 12; i++) {
      const value = unit === 'hour' ? i || 12 : i * 5;
      const angle = i * Math.PI / 6;
      const label = document.createElement('span');
      label.className = 'picker-dial-label' + (value === selected ? ' selected' : '');
      label.style.left = (50 + Math.sin(angle) * 40.625) + '%';
      label.style.top = (50 - Math.cos(angle) * 40.625) + '%';
      label.textContent = unit === 'hour' ? value : pad(value);
      $('picker-dial-labels').append(label);
    }
    const angle = selected * Math.PI * 2 / (unit === 'hour' ? 12 : 60);
    const x = 128 + Math.sin(angle) * 104, y = 128 - Math.cos(angle) * 104;
    $('picker-hand').setAttribute('x2', x); $('picker-hand').setAttribute('y2', y);
    $('picker-hand-tip').setAttribute('cx', x); $('picker-hand-tip').setAttribute('cy', y);
  }
  function readInputs() {
    const h = $('picker-hour-input').value, m = $('picker-minute-input').value;
    const valid = h !== '' && m !== '' && Number.isInteger(+h) && +h >= 1 && +h <= 12 && Number.isInteger(+m) && +m >= 0 && +m <= 59;
    $('picker-error').hidden = valid;
    if (valid) { hour = +h; minute = +m; }
    return valid;
  }
  function closePicker() { dragging = false; dialog.close(); $('end-time-open').focus(); }
  $('end-time-open').addEventListener('click', () => {
    const value = $('end-time').value;
    const now = new Date(Date.now() + 3600000);
    const h = value ? +value.split(':')[0] : now.getHours();
    hour = h % 12 || 12; pm = h >= 12; minute = value ? +value.split(':')[1] : now.getMinutes();
    unit = 'hour'; inputMode = false; dragging = false;
    $('picker-error').hidden = true; render(); dialog.showModal(); $('picker-hour').focus();
  });
  for (const part of ['hour', 'minute']) $('picker-' + part).addEventListener('click', () => { unit = part; render(); $('picker-dial').focus(); });
  $('picker-am').addEventListener('click', () => { pm = false; render(); });
  $('picker-pm').addEventListener('click', () => { pm = true; render(); });
  $('picker-input-toggle').addEventListener('click', () => {
    if (inputMode && !readInputs()) return;
    inputMode = !inputMode;
    if (inputMode) { $('picker-hour-input').value = pad(hour); $('picker-minute-input').value = pad(minute); }
    render();
    if (inputMode) { $('picker-hour-input').focus(); $('picker-hour-input').select(); } else $('picker-dial').focus();
  });
  const dial = $('picker-dial');
  function selectPoint(event) {
    const rect = dial.getBoundingClientRect();
    const value = dialValue(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2, unit);
    if (unit === 'hour') hour = value; else minute = value;
    render();
  }
  dial.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); dial.focus(); dragging = true; dial.setPointerCapture(event.pointerId); selectPoint(event);
  });
  dial.addEventListener('pointermove', event => { if (dragging) selectPoint(event); });
  dial.addEventListener('pointerup', event => {
    if (!dragging) return;
    selectPoint(event); dragging = false;
    if (dial.hasPointerCapture(event.pointerId)) dial.releasePointerCapture(event.pointerId);
    if (unit === 'hour') { unit = 'minute'; render(); }
  });
  dial.addEventListener('pointercancel', () => { dragging = false; });
  dial.addEventListener('keydown', event => {
    if (['Enter', ' '].includes(event.key)) { event.preventDefault(); if (unit === 'hour') { unit = 'minute'; render(); } else $('picker-set').focus(); return; }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const max = unit === 'hour' ? 12 : 60;
    let value = unit === 'hour' ? hour % 12 : minute;
    if (event.key === 'Home') value = unit === 'hour' ? 1 : 0;
    else if (event.key === 'End') value = unit === 'hour' ? 0 : 59;
    else value = (value + (['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : -1) + max) % max;
    if (unit === 'hour') hour = value || 12; else minute = value;
    render();
  });
  $('picker-cancel').addEventListener('click', closePicker);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closePicker(); });
  $('picker-set').addEventListener('click', () => {
    if (inputMode && !readInputs()) return;
    $('end-time').value = pad(to24Hour(hour, pm)) + ':' + pad(minute);
    $('end-time-label').textContent = hour + ':' + pad(minute) + (pm ? ' PM' : ' AM');
    closePicker();
    $('end-time-form').requestSubmit();
  });
  dialog.addEventListener('keydown', event => {
    if (inputMode && event.key === 'Enter' && event.target.matches('input')) { event.preventDefault(); $('picker-set').click(); }
  });
})();
