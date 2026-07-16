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

  /* ── DOM refs ─────────────────────────── */

  var logEmpty, logActive, statsSection, logExercises;
  var logWorkoutName, logDuration, logExerciseCount, logTotalVolume;
  var btnFinish, logValidationMsg;
  var restTimerPanel, restRingFg, restTimerDigit, restTimerSublabel;
  var btnRestSkip, btnRestCancel;

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
    restTimerPanel   = document.getElementById('restTimerPanel');
    restRingFg       = document.getElementById('restRingFg');
    restTimerDigit   = document.getElementById('restTimerDigit');
    restTimerSublabel= document.getElementById('restTimerSublabel');
    btnRestSkip      = document.getElementById('btnRestSkip');
    btnRestCancel    = document.getElementById('btnRestCancel');
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
      html += '<div class="log-set-head"><span>SET</span><span>REPS</span><span>WEIGHT</span><span></span></div>';

      ex.sets.forEach(function (set, si) {
        var isDone = !!(set.reps && set.weight);
        html += '<div class="log-set-row' + (isDone ? ' set-done' : '') + '">';
        html += '<span class="log-set-num">' + (si + 1) + '</span>';
        html += input('reps', ei, si, ex.targetReps || '—');
        html += input('weight', ei, si, 'kg');
        html += '<button class="log-set-timer-btn" data-rest-ex="' + escA(ex.name) + '" title="Rest 90s">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
        html += '</button>';
        html += '</div>';
      });

      html += '</div>';

      /* add set */
      html += '<button class="log-add-set" data-ex="' + ei + '">';
      html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      html += 'Add Set';
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

    document.querySelectorAll('.rest-preset').forEach(function (b) {
      b.addEventListener('click', function () {
        startRest(parseInt(this.dataset.rest, 10) * 1000, 'Quick Rest');
      });
    });

    btnRestSkip.addEventListener('click', cancelRest);
    btnRestCancel.addEventListener('click', cancelRest);
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

  function onClick(e) {
    var addBtn = e.target.closest('.log-add-set');
    if (addBtn) { addSet(+addBtn.dataset.ex); return; }

    var tBtn = e.target.closest('.log-set-timer-btn');
    if (tBtn) { startRest(90000, tBtn.dataset.restEx); return; }
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

  /* ── Add Set ──────────────────────────── */

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

  /* ── Rest Timer (Timestamp-Based) ─────── */

  function startRest(durMs, exName) {
    timer.active = true;
    timer.targetMs = durMs;
    timer.startTs = Date.now();
    timer.exerciseName = exName || '';

    restTimerPanel.style.display = '';
    restTimerSublabel.textContent = timer.exerciseName;
    restRingFg.style.strokeDasharray = RING_CIRC;
    restRingFg.style.strokeDashoffset = 0;
    restRingFg.style.stroke = '';
    restTimerDigit.style.color = '';
    restTimerPanel.style.borderColor = '';
    restTimerPanel.style.boxShadow = '';

    tickRest();
  }

  function tickRest() {
    if (!timer.active) return;

    var elapsed = Date.now() - timer.startTs;
    var remaining = Math.max(0, timer.targetMs - elapsed);
    var sec = Math.ceil(remaining / 1000);

    restTimerDigit.textContent = sec;

    var progress = remaining / timer.targetMs;
    restRingFg.style.strokeDashoffset = RING_CIRC * (1 - progress);

    if (sec <= 10) {
      restRingFg.style.stroke = 'var(--danger)';
      restTimerDigit.style.color = 'var(--danger)';
    } else if (sec <= 30) {
      restRingFg.style.stroke = 'var(--accent-lime)';
      restTimerDigit.style.color = '';
    } else {
      restRingFg.style.stroke = '';
      restTimerDigit.style.color = '';
    }

    if (remaining > 0) {
      timer.rafId = requestAnimationFrame(tickRest);
    } else {
      restComplete();
    }
  }

  function restComplete() {
    timer.active = false;
    restTimerPanel.style.borderColor = 'var(--accent-lime)';
    restTimerPanel.style.boxShadow = '0 0 24px var(--accent-lime-glow)';
    restTimerDigit.textContent = '0';
    setTimeout(cancelRest, 1500);
  }

  function cancelRest() {
    timer.active = false;
    if (timer.rafId) cancelAnimationFrame(timer.rafId);
    timer.rafId = null;
    restTimerPanel.style.display = 'none';
    restTimerPanel.style.borderColor = '';
    restTimerPanel.style.boxShadow = '';
    restRingFg.style.strokeDashoffset = 0;
    restRingFg.style.stroke = '';
    restTimerDigit.style.color = '';
  }

  /* ── Finish Workout ───────────────────── */

  function finishWorkout() {
    var errs = validate();
    if (errs.length) { showErr(errs); return; }

    var session = compile();
    saveHistory(session);
    clearCurrent();
    render();
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
    cancelRest();
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
