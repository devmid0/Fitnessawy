/* ============================================
   FORGE — Workout Logger
   Timestamp-based rest timer, dynamic set
   management, localStorage persistence.
   ============================================ */

(function () {
  'use strict';

  var HISTORY_KEY = 'workoutHistory';
  var CURRENT_KEY = 'currentWorkout';

  var DEFAULT_PLAN = {
    name: 'Upper Push + Cardio',
    exercises: [
      { name: 'Barbell Bench Press',   targetSets: 4, targetReps: 8 },
      { name: 'Overhead Press',         targetSets: 4, targetReps: 10 },
      { name: 'Incline Dumbbell Fly',   targetSets: 3, targetReps: 12 },
      { name: 'Lateral Raise',          targetSets: 3, targetReps: 15 },
      { name: 'Tricep Rope Pushdown',   targetSets: 3, targetReps: 12 },
      { name: 'Chest Dip',              targetSets: 3, targetReps: 10 },
      { name: 'Treadmill Sprint',       targetSets: 1, targetReps: 0 },
      { name: 'Battle Ropes',           targetSets: 3, targetReps: 0 },
      { name: 'Box Jumps',              targetSets: 3, targetReps: 12 }
    ]
  };

  var currentWorkout = null;
  var durationRAF = null;
  var durationStart = 0;

  /* ── Rest Timer (Date.now-based) ─────── */

  var timer = {
    active: false,
    targetMs: 0,
    startTs: 0,
    rafId: null,
    exerciseName: ''
  };

  var RING_CIRC = 2 * Math.PI * 18;

  /* ── Floating Timer DOM refs ─────────── */

  var ftEl = null;
  var ftRingFg = null;
  var ftDigit = null;
  var ftSublabel = null;

  /* ── Static DOM refs ─────────────────── */

  var logEmpty, logActive, statsSection, logExercises;
  var logWorkoutName, logDuration, logExerciseCount, logTotalVolume;
  var btnFinish, logValidationMsg;

  function cacheDom() {
    logEmpty         = document.getElementById('logEmpty');
    logActive        = document.getElementById('logActive');
    statsSection     = document.getElementById('statsSection');
    logExercises     = document.getElementById('logExercises');
    logWorkoutName   = document.getElementById('logWorkoutName');
    logDuration      = document.getElementById('logDuration');
    logExerciseCount = document.getElementById('logExerciseCount');
    logTotalVolume   = document.getElementById('logTotalVolume');
    btnFinish        = document.getElementById('btnFinish');
    logValidationMsg = document.getElementById('logValidationMsg');
  }

  /* ── Init ─────────────────────────────── */

  function init() {
    cacheDom();
    loadCurrent();
    render();
    bindGlobal();
  }

  /* ── Start Workout ────────────────────── */

  function startWorkout(plan) {
    plan = plan || DEFAULT_PLAN;

    currentWorkout = {
      id: 'wk_' + Date.now(),
      name: plan.name,
      startTime: Date.now(),
      exercises: plan.exercises.map(function (ex) {
        var sets = [];
        for (var i = 0; i < ex.targetSets; i++) {
          sets.push({ reps: '', weight: '' });
        }
        return { name: ex.name, targetReps: ex.targetReps, sets: sets };
      })
    };

    saveCurrent();
    durationStart = currentWorkout.startTime;
    render();
    startDurationClock();
  }

  /* ── View Toggle ──────────────────────── */

  function render() {
    if (!currentWorkout) {
      logEmpty.style.display = '';
      logActive.style.display = 'none';
      statsSection.style.display = '';
      stopDurationClock();
      hideFloatingTimer();
      return;
    }

    logEmpty.style.display = 'none';
    logActive.style.display = '';
    statsSection.style.display = 'none';

    logWorkoutName.textContent = currentWorkout.name;
    logExerciseCount.textContent = currentWorkout.exercises.length + ' exercises';
    durationStart = currentWorkout.startTime;
    startDurationClock();

    renderCards();
    updateVolume();
  }

  /* ── Exercise Cards ───────────────────── */

  function renderCards() {
    var html = '';

    currentWorkout.exercises.forEach(function (ex, ei) {
      var done = ex.sets.filter(function (s) { return s.reps && s.weight; }).length;
      var complete = done === ex.sets.length && ex.sets.length > 0;

      html += '<div class="log-ex-card' + (complete ? ' completed' : '') + '">';

      /* header */
      html += '<div class="log-ex-header">';
      html += '<div class="log-ex-title-group">';
      html += '<span class="log-ex-num">' + (complete ? '&#10003;' : pad(ei + 1)) + '</span>';
      html += '<span class="log-ex-name">' + esc(ex.name) + '</span>';
      html += '</div>';
      html += '<span class="log-ex-target">' + ex.sets.length + ' &times; ' + (ex.targetReps || '—') + '</span>';
      html += '</div>';

      /* set table */
      html += '<div class="log-set-table">';
      html += '<div class="log-set-head"><span>SET</span><span>REPS</span><span>WEIGHT</span><span></span><span></span></div>';

      ex.sets.forEach(function (set, si) {
        var isDone = !!(set.reps && set.weight);
        html += '<div class="log-set-row' + (isDone ? ' set-done' : '') + '">';
        html += '<span class="log-set-num">' + (si + 1) + '</span>';
        html += input('reps', ei, si, ex.targetReps || '—');
        html += input('weight', ei, si, 'kg');

        /* Complete Set button (cyan checkmark) */
        html += '<button class="log-set-complete-btn" data-ex="' + ei + '" data-set="' + si + '" data-rest-ex="' + escA(ex.name) + '" title="Complete Set">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
        html += '</button>';

        /* Delete Set button (always visible ×) */
        html += '<button class="delete-set-btn" data-ex="' + ei + '" data-set="' + si + '" title="Delete Set">&times;</button>';

        html += '</div>';
      });

      html += '</div>';

      /* add set */
      html += '<button class="log-add-set" data-ex="' + ei + '">';
      html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      html += 'Add Set';
      html += '</button>';

      /* finish exercise */
      html += '<button class="log-finish-exercise" data-ex="' + ei + '">';
      html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
      html += 'Finish Exercise';
      html += '</button>';

      html += '</div>';
    });

    logExercises.innerHTML = html;
  }

  function input(field, ei, si, ph) {
    var val = currentWorkout.exercises[ei].sets[si][field];
    return '<input type="number" class="log-input' + (val ? ' has-value' : '') +
      '" data-ex="' + ei + '" data-set="' + si + '" data-field="' + field +
      '" placeholder="' + ph +
      '" inputmode="' + (field === 'weight' ? 'decimal' : 'numeric') +
      '" min="0" step="' + (field === 'weight' ? '0.5' : '1') +
      '" value="' + escA(val) + '">';
  }

  /* ── Events (delegated) ───────────────── */

  function bindGlobal() {
    logExercises.addEventListener('input', onInput);
    logExercises.addEventListener('focus', onFocus, true);
    logExercises.addEventListener('click', onClick);
    logExercises.addEventListener('keydown', onKeydown);
    logExercises.addEventListener('blur', onBlur, true);

    document.querySelectorAll('.rest-preset').forEach(function (b) {
      b.addEventListener('click', function () {
        startRest(parseInt(this.dataset.rest, 10) * 1000, 'Quick Rest');
      });
    });

    btnFinish.addEventListener('click', finishWorkout);
  }

  function onInput(e) {
    var el = e.target;
    if (!el.classList.contains('log-input')) return;

    var ei = +el.dataset.ex;
    var si = +el.dataset.set;
    var f  = el.dataset.field;

    currentWorkout.exercises[ei].sets[si][f] = el.value;
    saveCurrent();

    el.classList.toggle('has-value', !!el.value);
    refreshSetRow(el);
    refreshCard(ei);
    updateVolume();
  }

  function onFocus(e) {
    if (e.target.classList.contains('log-input')) e.target.select();
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && e.target.classList.contains('log-input')) {
      e.target.blur();
    }
  }

  function onBlur(e) {
    var el = e.target;
    if (!el.classList.contains('log-input')) return;
    if (el.dataset.field !== 'weight') return;
    if (+el.dataset.set !== 0) return;

    autoFillWeights(+el.dataset.ex, el.value);
  }

  function autoFillWeights(ei, val) {
    if (!currentWorkout || !currentWorkout.exercises[ei]) return;
    if (!val) return;

    var sets = currentWorkout.exercises[ei].sets;
    var rows = logExercises.querySelectorAll('.log-ex-card')[ei];
    if (!rows) return;

    var inputs = rows.querySelectorAll('.log-input[data-field="weight"]');

    for (var i = 1; i < sets.length; i++) {
      if (sets[i].weight) continue;

      sets[i].weight = val;
      if (inputs[i]) {
        inputs[i].value = val;
        inputs[i].classList.add('has-value');
      }
    }

    saveCurrent();
    updateVolume();
  }

  function onClick(e) {
    var addBtn = e.target.closest('.log-add-set');
    if (addBtn) { addSet(+addBtn.dataset.ex); return; }

    var completeBtn = e.target.closest('.log-set-complete-btn');
    if (completeBtn) {
      startRest(90000, completeBtn.dataset.restEx);
      return;
    }

    var deleteBtn = e.target.closest('.delete-set-btn');
    if (deleteBtn) {
      deleteSet(+deleteBtn.dataset.ex, +deleteBtn.dataset.set);
      return;
    }

    var finishExBtn = e.target.closest('.log-finish-exercise');
    if (finishExBtn) {
      finishExercise(+finishExBtn.dataset.ex);
      return;
    }
  }

  function refreshSetRow(el) {
    var row = el.closest('.log-set-row');
    if (!row) return;
    var s = currentWorkout.exercises[+el.dataset.ex].sets[+el.dataset.set];
    row.classList.toggle('set-done', !!(s.reps && s.weight));
  }

  function refreshCard(ei) {
    var cards = logExercises.querySelectorAll('.log-ex-card');
    var card = cards[ei];
    if (!card) return;
    var ex = currentWorkout.exercises[ei];
    var complete = ex.sets.length > 0 && ex.sets.every(function (s) { return s.reps && s.weight; });
    card.classList.toggle('completed', complete);
    var num = card.querySelector('.log-ex-num');
    if (num) num.innerHTML = complete ? '&#10003;' : pad(ei + 1);
  }

  /* ── Add / Delete Set ─────────────────── */

  function addSet(ei) {
    currentWorkout.exercises[ei].sets.push({ reps: '', weight: '' });
    saveCurrent();
    renderCards();

    var cards = logExercises.querySelectorAll('.log-ex-card');
    var card = cards[ei];
    if (card) {
      var last = card.querySelector('.log-set-row:last-child .log-input');
      if (last) last.focus();
    }
  }

  function deleteSet(ei, si) {
    if (!currentWorkout || !currentWorkout.exercises[ei]) return;
    if (currentWorkout.exercises[ei].sets.length <= 1) return;

    currentWorkout.exercises[ei].sets.splice(si, 1);
    saveCurrent();
    renderCards();
    refreshCard(ei);
    updateVolume();
  }

  /* ── Finish Exercise (Focus Mode) ─────── */

  function finishExercise(ei) {
    var cards = logExercises.querySelectorAll('.log-ex-card');
    var card = cards[ei];
    if (!card) return;

    card.classList.add('collapsed');

    /* scroll to next uncollapsed card */
    var nextCard = null;
    for (var i = ei + 1; i < cards.length; i++) {
      if (!cards[i].classList.contains('collapsed')) {
        nextCard = cards[i];
        break;
      }
    }

    if (nextCard) {
      setTimeout(function () {
        nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }

  /* ── Volume ───────────────────────────── */

  function updateVolume() {
    var total = 0;
    currentWorkout.exercises.forEach(function (ex) {
      ex.sets.forEach(function (s) {
        total += (parseFloat(s.reps) || 0) * (parseFloat(s.weight) || 0);
      });
    });
    logTotalVolume.textContent = total >= 1000
      ? (total / 1000).toFixed(1) + 'k kg'
      : Math.round(total) + ' kg';
  }

  /* ── Duration Clock ───────────────────── */

  function startDurationClock() {
    stopDurationClock();
    tickDuration();
  }

  function tickDuration() {
    if (!currentWorkout) return;
    logDuration.textContent = fmtDur(Date.now() - durationStart);
    durationRAF = requestAnimationFrame(tickDuration);
  }

  function stopDurationClock() {
    if (durationRAF) { cancelAnimationFrame(durationRAF); durationRAF = null; }
  }

  function fmtDur(ms) {
    var t = Math.floor(ms / 1000);
    var h = Math.floor(t / 3600);
    var m = Math.floor((t % 3600) / 60);
    var s = t % 60;
    return h > 0 ? pad(h) + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
  }

  /* ── Floating Rest Timer ──────────────── */

  function createFloatingTimer() {
    var el = document.createElement('div');
    el.id = 'floatingTimer';
    el.className = 'floating-timer';
    el.innerHTML =
      '<div class="ft-inner">' +
        '<div class="ft-ring-wrap">' +
          '<svg class="ft-ring" viewBox="0 0 44 44">' +
            '<circle class="ft-ring-bg" cx="22" cy="22" r="18"/>' +
            '<circle class="ft-ring-fg" cx="22" cy="22" r="18"/>' +
          '</svg>' +
          '<span class="ft-digit">90</span>' +
        '</div>' +
        '<div class="ft-meta">' +
          '<span class="ft-label">REST</span>' +
          '<span class="ft-sublabel"></span>' +
        '</div>' +
        '<div class="ft-actions">' +
          '<button class="ft-btn ft-btn-skip" title="Skip Rest">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>' +
          '</button>' +
          '<button class="ft-btn ft-btn-add" title="Add 15 seconds">+15s</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);

    ftEl = el;
    ftRingFg = el.querySelector('.ft-ring-fg');
    ftDigit = el.querySelector('.ft-digit');
    ftSublabel = el.querySelector('.ft-sublabel');

    el.querySelector('.ft-btn-skip').addEventListener('click', hideFloatingTimer);
    el.querySelector('.ft-btn-add').addEventListener('click', add15Seconds);
  }

  function showFloatingTimer(durMs, exName) {
    if (!ftEl) createFloatingTimer();

    timer.active = true;
    timer.targetMs = durMs;
    timer.startTs = Date.now();
    timer.exerciseName = exName || '';

    ftSublabel.textContent = timer.exerciseName;
    ftRingFg.style.strokeDasharray = RING_CIRC;
    ftRingFg.style.strokeDashoffset = 0;
    ftRingFg.style.stroke = '';
    ftDigit.style.color = '';
    ftEl.classList.remove('pulse');

    ftEl.style.display = '';
    /* force reflow then slide in */
    void ftEl.offsetWidth;
    ftEl.classList.add('visible');

    tickFloatingTimer();
  }

  function tickFloatingTimer() {
    if (!timer.active) return;

    var elapsed = Date.now() - timer.startTs;
    var remaining = Math.max(0, timer.targetMs - elapsed);
    var sec = Math.ceil(remaining / 1000);

    ftDigit.textContent = sec;

    var progress = remaining / timer.targetMs;
    ftRingFg.style.strokeDashoffset = RING_CIRC * (1 - progress);

    if (sec <= 10) {
      ftRingFg.style.stroke = 'var(--danger)';
      ftDigit.style.color = 'var(--danger)';
    } else if (sec <= 30) {
      ftRingFg.style.stroke = 'var(--accent-lime)';
      ftDigit.style.color = '';
    } else {
      ftRingFg.style.stroke = '';
      ftDigit.style.color = '';
    }

    if (remaining > 0) {
      timer.rafId = requestAnimationFrame(tickFloatingTimer);
    } else {
      floatingTimerComplete();
    }
  }

  function floatingTimerComplete() {
    timer.active = false;
    ftDigit.textContent = '0';
    ftEl.classList.add('pulse');
    setTimeout(hideFloatingTimer, 1200);
  }

  function hideFloatingTimer() {
    timer.active = false;
    if (timer.rafId) { cancelAnimationFrame(timer.rafId); timer.rafId = null; }
    if (!ftEl) return;
    ftEl.classList.remove('visible');
    setTimeout(function () {
      if (ftEl) ftEl.style.display = 'none';
    }, 350);
  }

  function add15Seconds() {
    timer.targetMs += 15000;
  }

  /* ── Start / Cancel Rest ──────────────── */

  function startRest(durMs, exName) {
    showFloatingTimer(durMs, exName);
  }

  function cancelRest() {
    hideFloatingTimer();
  }

  /* ── Finish Workout ───────────────────── */

  function finishWorkout() {
    var session = compile();
    saveHistory(session);
    clearCurrent();
    render();
    if (window.ForgeBrowser) window.ForgeBrowser.resetSelection();
    if (window.ForgeApp) window.ForgeApp.switchView('profile');
  }

  function validate() {
    var errs = [];
    var incomplete = [];

    currentWorkout.exercises.forEach(function (ex, ei) {
      ex.sets.forEach(function (set, si) {
        var hasR = !!set.reps;
        var hasW = !!set.weight;
        if (hasR !== hasW) {
          incomplete.push(ex.name + ' S' + (si + 1));
        }
      });
    });

    if (incomplete.length) {
      errs.push('Incomplete: ' + incomplete.slice(0, 3).join(', ') +
        (incomplete.length > 3 ? ' +' + (incomplete.length - 3) : ''));
    }

    var anyData = currentWorkout.exercises.some(function (ex) {
      return ex.sets.some(function (s) { return s.reps || s.weight; });
    });
    if (!anyData) errs.push('Log at least one set before finishing.');

    return errs;
  }

  function showErr(errs) {
    logValidationMsg.textContent = errs[0];
    logValidationMsg.style.display = '';
    clearTimeout(showErr._t);
    showErr._t = setTimeout(function () { logValidationMsg.style.display = 'none'; }, 4000);
  }

  function compile() {
    var totalVol = 0, totalSets = 0, totalReps = 0;
    var exercises = [];

    currentWorkout.exercises.forEach(function (ex) {
      var sets = [];
      ex.sets.forEach(function (s) {
        var r = parseFloat(s.reps) || 0;
        var w = parseFloat(s.weight) || 0;
        var v = r * w;
        totalVol += v;
        if (r > 0) totalSets++;
        totalReps += r;
        sets.push({ reps: r, weight: w, volume: v });
      });
      exercises.push({ name: ex.name, sets: sets });
    });

    return {
      id: currentWorkout.id,
      date: new Date().toISOString(),
      name: currentWorkout.name,
      startTime: currentWorkout.startTime,
      endTime: Date.now(),
      duration: Date.now() - currentWorkout.startTime,
      exercises: exercises,
      totalVolume: totalVol,
      totalSets: totalSets,
      totalReps: totalReps
    };
  }

  function saveHistory(session) {
    var history = [];
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (raw) history = JSON.parse(raw);
    } catch (e) { history = []; }

    history.unshift(session);
    if (history.length > 100) history.length = 100;

    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) {}
  }

  /* ── Persistence ──────────────────────── */

  function saveCurrent() {
    try { localStorage.setItem(CURRENT_KEY, JSON.stringify(currentWorkout)); } catch (e) {}
  }

  function loadCurrent() {
    try {
      var raw = localStorage.getItem(CURRENT_KEY);
      if (raw) {
        currentWorkout = JSON.parse(raw);
        durationStart = currentWorkout.startTime;
      }
    } catch (e) { currentWorkout = null; }
  }

  function clearCurrent() {
    currentWorkout = null;
    try { localStorage.removeItem(CURRENT_KEY); } catch (e) {}
    hideFloatingTimer();
    stopDurationClock();
  }

  /* ── Utils ────────────────────────────── */

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function escA(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Public API ───────────────────────── */

  window.ForgeLogger = {
    startWorkout: startWorkout,
    hasActive: function () { return !!currentWorkout; }
  };

  /* ── Boot ─────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
