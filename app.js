/* ============================================
   FORGE — SPA Controller
   ============================================ */

'use strict';

var STORAGE_KEY = 'forge_last_view';

var views    = document.querySelectorAll('.view');
var navItems = document.querySelectorAll('.nav-item');

var currentView = getStoredView();

/* ── Navigation ─────────────────────────── */

function switchView(name) {
  if (name === currentView) return;

  views.forEach(function (v) { v.classList.remove('active'); });
  navItems.forEach(function (n) { n.classList.remove('active'); });

  /* Hide/show #workout-view since it's not a .view element */
  var wv = document.getElementById('workout-view');
  if (wv) wv.style.display = (name === 'workout') ? 'block' : 'none';

  /* Hide #workout-logger-view when switching tabs */
  var lv = document.getElementById('workout-logger-view');
  if (lv) { lv.style.display = 'none'; stopLoggerClock(); }

  var targetId = name === 'workout' ? 'workout-view' : 'view-' + name;
  var target = document.getElementById(targetId);
  var nav    = document.querySelector('[data-view="' + name + '"]');

  if (target && nav) {
    target.classList.add('active');
    nav.classList.add('active');
    currentView = name;
    storeView(name);

    var scroll = target.querySelector('.view-scroll');
    if (scroll) scroll.scrollTop = 0;

    /* refresh profile analytics on every visit */
    if (name === 'profile' && window.ForgeProfile) {
      try { window.ForgeProfile.refresh(); } catch (e) { console.warn('[Forge] Profile refresh failed:', e); }
    }

    /* refresh dashboard stats on every visit */
    if (name === 'progress' || name === 'profile') {
      updateDashboardStats();
    }
  }
}

navItems.forEach(function (item) {
  item.addEventListener('click', function () {
    switchView(this.dataset.view);
  });
});

/* ── Chart Toggle ──────────────────────── */

document.querySelectorAll('.toggle-btn[data-chart]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    this.closest('.chart-toggle').querySelectorAll('.toggle-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    this.classList.add('active');
  });
});

/* ── Storage ───────────────────────────── */

function storeView(name) {
  try { localStorage.setItem(STORAGE_KEY, name); } catch (e) {}
}

function getStoredView() {
  try { return localStorage.getItem(STORAGE_KEY) || 'workout'; } catch (e) { return 'workout'; }
}

/* ── Stat Bar Animation ────────────────── */

function animateStatBars() {
  document.querySelectorAll('.stat-bar-fill').forEach(function (bar) {
    var w = bar.style.width;
    bar.style.width = '0%';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { bar.style.width = w; });
    });
  });
}

/* ── Keyboard Navigation ───────────────── */

document.addEventListener('keydown', function (e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === '1') switchView('workout');
  if (e.key === '2') switchView('progress');
  if (e.key === '3') switchView('profile');
});

/* ── Swipe Gestures (mobile) ───────────── */

var txStart = 0;
var tyStart = 0;

document.addEventListener('touchstart', function (e) {
  txStart = e.changedTouches[0].screenX;
  tyStart = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', function (e) {
  var dx = e.changedTouches[0].screenX - txStart;
  var dy = e.changedTouches[0].screenY - tyStart;

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 80 && Math.abs(dy) < 60) {
    var order = ['workout', 'progress', 'profile'];
    var idx = order.indexOf(currentView);

    if (dx < 0 && idx < order.length - 1) switchView(order[idx + 1]);
    else if (dx > 0 && idx > 0) switchView(order[idx - 1]);
  }
}, { passive: true });

/* ── Init ──────────────────────────────── */

function init() {
  try { switchView(currentView); } catch (e) { console.warn('[Forge] switchView failed:', e); }
  try { updateDashboardStats(); } catch (e) { console.warn('[Forge] init updateDashboardStats failed:', e); }
  try { requestAnimationFrame(animateStatBars); } catch (e) { console.warn('[Forge] animateStatBars failed:', e); }
}

/* ── Expose globally for cross-module refs ── */

window.ForgeApp = { switchView: switchView, updateDashboardStats: updateDashboardStats };

/* ── Active Workout Logger ────────────── */

var SESSIONS_KEY = 'fitnessawy_sessions';
var MEDIA_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';
var FALLBACK_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MiIgaGVpZ2h0PSI1MiIgdmlld0JveD0iMCAwIDUyIDUyIj48cmVjdCB3aWR0aD0iNTIiIGhlaWdodD0iNTIiIHJ4PSI2IiBmaWxsPSIjMTQxNDE0Ii8+PHRleHQgeD0iMjYiIHk9IjMyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNDQ0IiBmb250LXNpemU9IjIwIj7imqE8L3RleHQ+PC9zdmc+';

var activeWorkout = null;
var loggerRAF = null;
var loggerStartTs = 0;

var loggerView = null;
var loggerExercisesEl = null;
var loggerWorkoutNameEl = null;
var loggerDurationEl = null;
var loggerExCountEl = null;
var loggerVolumeEl = null;
var loggerFinishBtnEl = null;
var loggerBackBtnEl = null;
var loggerEventsBound = false;

/* ── Muscle Group Map (for profile analytics) ── */

var MUSCLE_MAP = {
  'Barbell Bench Press': 'Chest',
  'Incline Dumbbell Fly': 'Chest',
  'Chest Dip': 'Chest',
  'Overhead Press': 'Shoulders',
  'Lateral Raise': 'Shoulders',
  'Tricep Rope Pushdown': 'Arms',
  'Treadmill Sprint': 'Cardio',
  'Battle Ropes': 'Cardio',
  'Box Jumps': 'Legs'
};

function loggerEsc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function loggerPad(n) { return n < 10 ? '0' + n : '' + n; }
function loggerEscA(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function cacheLoggerDom() {
  loggerView = document.getElementById('workout-logger-view');
  loggerExercisesEl = document.getElementById('loggerExercises');
  loggerWorkoutNameEl = document.getElementById('loggerWorkoutName');
  loggerDurationEl = document.getElementById('loggerDuration');
  loggerExCountEl = document.getElementById('loggerExCount');
  loggerVolumeEl = document.getElementById('loggerVolume');
  loggerFinishBtnEl = document.getElementById('loggerFinishBtn');
  loggerBackBtnEl = document.getElementById('loggerBackBtn');
}

function initActiveWorkout(exercises) {
  if (!exercises || !exercises.length) return;
  cacheLoggerDom();
  if (!loggerView || !loggerExercisesEl) return;

  var workoutName = 'Workout';

  activeWorkout = {
    startTime: Date.now(),
    name: workoutName,
    exercises: exercises.map(function (ex) {
      var sets = [];
      for (var i = 0; i < (ex.targetSets || 3); i++) {
        sets.push({ reps: '', weight: '', done: false });
      }
      return {
        name: ex.name,
        gif_url: ex.gif_url || '',
        targetReps: ex.targetReps || 10,
        sets: sets
      };
    })
  };

  loggerWorkoutNameEl.textContent = workoutName;
  loggerExCountEl.textContent = activeWorkout.exercises.length + ' exercises';
  loggerDurationEl.textContent = '00:00';
  loggerVolumeEl.textContent = '0 kg';

  renderLoggerCards();
  bindLoggerEvents();

  loggerView.style.display = 'block';
  workoutView.style.display = 'none';

  loggerStartTs = activeWorkout.startTime;
  startLoggerClock();
}

function generateCardHtml(ei) {
  if (!activeWorkout) return '';
  var ex = activeWorkout.exercises[ei];
  var doneCount = ex.sets.filter(function (s) { return !!s.done; }).length;
  var complete = doneCount === ex.sets.length && ex.sets.length > 0;

  var html = '<div class="log-ex-card' + (complete ? ' completed' : '') + '" data-ei="' + ei + '">';

  html += '<div class="log-ex-header">';
  html += '<div class="log-ex-title-group">';

  var imgSrc = ex.gif_url ? (MEDIA_BASE + ex.gif_url) : '';
  if (imgSrc) {
    html += '<img class="log-ex-thumb" src="' + loggerEsc(imgSrc) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + FALLBACK_SVG + '\';this.classList.add(\'ex-card-fallback\')">';
  }

  html += '<span class="log-ex-num">' + (complete ? '&#10003;' : loggerPad(ei + 1)) + '</span>';
  html += '<span class="log-ex-name">' + loggerEsc(ex.name) + '</span>';
  html += '</div>';
  html += '<div class="log-ex-header-right">';
  html += '<span class="log-ex-target">' + ex.sets.length + ' &times; ' + ex.targetReps + '</span>';
  html += '</div>';
  html += '</div>';

  html += '<div class="log-set-table">';
  html += '<div class="log-set-head"><span>SET</span><span>REPS</span><span>WEIGHT</span><span></span><span></span></div>';

  ex.sets.forEach(function (set, si) {
    html += '<div class="log-set-row' + (set.done ? ' set-done' : '') + '">';
    html += '<span class="log-set-num">' + (si + 1) + '</span>';
    html += '<input type="number" class="log-input' + (set.reps ? ' has-value' : '') + '" data-ex="' + ei + '" data-set="' + si + '" data-field="reps" placeholder="' + ex.targetReps + '" inputmode="numeric" min="0" step="1" value="' + loggerEscA(set.reps) + '">';
    html += '<input type="number" class="log-input' + (set.weight ? ' has-value' : '') + '" data-ex="' + ei + '" data-set="' + si + '" data-field="weight" placeholder="kg" inputmode="decimal" min="0" step="0.5" value="' + loggerEscA(set.weight) + '">';
    html += '<button class="log-set-complete-btn" data-ex="' + ei + '" data-set="' + si + '">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
    html += '</button>';
    html += '<button class="delete-set-btn" data-ex="' + ei + '" data-set="' + si + '" title="Delete Set">&times;</button>';
    html += '</div>';
  });

  html += '</div>';

  html += '<button class="log-add-set" data-ex="' + ei + '">';
  html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y1="12"/></svg>';
  html += 'Add Set';
  html += '</button>';

  html += '<button class="log-finish-exercise" data-ex="' + ei + '">';
  html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
  html += 'Finish Exercise';
  html += '</button>';

  html += '</div>';
  return html;
}

function renderLoggerCards() {
  if (!loggerExercisesEl || !activeWorkout) return;
  var html = '';
  activeWorkout.exercises.forEach(function (ex, ei) { html += generateCardHtml(ei); });
  loggerExercisesEl.innerHTML = html;
  updateLoggerVolume();
}

function renderSingleCard(ei) {
  if (!loggerExercisesEl || !activeWorkout) return;
  var existing = loggerExercisesEl.querySelector('.log-ex-card[data-ei="' + ei + '"]');
  if (!existing) return;
  var wasCollapsed = existing.classList.contains('collapsed');
  var temp = document.createElement('div');
  temp.innerHTML = generateCardHtml(ei);
  var fresh = temp.firstElementChild;
  if (wasCollapsed) fresh.classList.add('collapsed');
  existing.replaceWith(fresh);
}

function bindLoggerEvents() {
  if (loggerEventsBound) return;
  cacheLoggerDom();
  if (!loggerExercisesEl) return;

  loggerExercisesEl.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.classList.contains('log-input')) return;
    var ei = +el.dataset.ex;
    var si = +el.dataset.set;
    var f = el.dataset.field;

    activeWorkout.exercises[ei].sets[si][f] = el.value;
    el.classList.toggle('has-value', !!el.value);

    if (si === 0 && el.value) {
      var card = el.closest('.log-ex-card');
      if (card) {
        card.querySelectorAll('.log-input[data-field="' + f + '"]').forEach(function (inp) {
          var setIdx = +inp.dataset.set;
          if (setIdx > 0) {
            inp.value = el.value;
            inp.classList.add('has-value');
            activeWorkout.exercises[ei].sets[setIdx][f] = el.value;
          }
        });
      }
    }

    updateLoggerVolume();
  });

  loggerExercisesEl.addEventListener('click', function (e) {
    var completeBtn = e.target.closest('.log-set-complete-btn');
    if (completeBtn) {
      e.preventDefault();
      e.stopPropagation();
      toggleSetDone(+completeBtn.dataset.ex, +completeBtn.dataset.set);
      return;
    }

    var deleteBtn = e.target.closest('.delete-set-btn');
    if (deleteBtn) {
      deleteLoggerSet(+deleteBtn.dataset.ex, +deleteBtn.dataset.set);
      return;
    }

    var addBtn = e.target.closest('.log-add-set');
    if (addBtn) {
      addLoggerSet(+addBtn.dataset.ex);
      return;
    }

    var finishExBtn = e.target.closest('.log-finish-exercise');
    if (finishExBtn) {
      finishExercise(+finishExBtn.dataset.ex);
      return;
    }
  });

  if (loggerFinishBtnEl) {
    loggerFinishBtnEl.addEventListener('click', finishActiveWorkout);
  }

  if (loggerBackBtnEl) {
    loggerBackBtnEl.addEventListener('click', function () {
      stopLoggerClock();
      loggerView.style.display = 'none';
      workoutView.style.display = 'block';
    });
  }

  loggerEventsBound = true;
}

function toggleSetDone(ei, si) {
  if (!activeWorkout || !activeWorkout.exercises[ei]) return;
  var set = activeWorkout.exercises[ei].sets[si];
  if (!set) return;

  set.done = !set.done;

  var btn = loggerExercisesEl.querySelector('.log-set-complete-btn[data-ex="' + ei + '"][data-set="' + si + '"]');
  if (btn) {
    var row = btn.closest('.log-set-row');
    if (row) row.classList.toggle('set-done', set.done);
  }

  updateCardComplete(ei);
  updateLoggerVolume();
}

function addLoggerSet(ei) {
  if (!activeWorkout || !activeWorkout.exercises[ei]) return;
  activeWorkout.exercises[ei].sets.push({ reps: '', weight: '', done: false });
  renderSingleCard(ei);

  var card = loggerExercisesEl.querySelector('.log-ex-card[data-ei="' + ei + '"]');
  if (card) {
    var last = card.querySelector('.log-set-row:last-child .log-input');
    if (last) last.focus();
  }
}

function deleteLoggerSet(ei, si) {
  if (!activeWorkout || !activeWorkout.exercises[ei]) return;
  if (activeWorkout.exercises[ei].sets.length <= 1) return;
  activeWorkout.exercises[ei].sets.splice(si, 1);
  renderSingleCard(ei);
}

function updateLoggerVolume() {
  if (!activeWorkout || !loggerVolumeEl) return;
  var total = 0;
  activeWorkout.exercises.forEach(function (ex) {
    ex.sets.forEach(function (s) {
      total += (parseFloat(s.reps) || 0) * (parseFloat(s.weight) || 0);
    });
  });
  loggerVolumeEl.textContent = total >= 1000
    ? (total / 1000).toFixed(1) + 'k kg'
    : Math.round(total) + ' kg';
}

function updateCardComplete(ei) {
  var card = loggerExercisesEl ? loggerExercisesEl.querySelector('.log-ex-card[data-ei="' + ei + '"]') : null;
  if (!card || !activeWorkout || !activeWorkout.exercises[ei]) return;
  var ex = activeWorkout.exercises[ei];
  var allDone = ex.sets.length > 0 && ex.sets.every(function (s) { return !!s.done; });
  card.classList.toggle('completed', allDone);
  var numEl = card.querySelector('.log-ex-num');
  if (numEl) numEl.innerHTML = allDone ? '&#10003;' : loggerPad(ei + 1);
}

function finishExercise(ei) {
  if (!loggerExercisesEl || !activeWorkout) return;
  var card = loggerExercisesEl.querySelector('.log-ex-card[data-ei="' + ei + '"]');
  if (!card) return;

  card.classList.add('collapsed');

  var cards = loggerExercisesEl.querySelectorAll('.log-ex-card');
  var nextCard = null;
  for (var i = 0; i < cards.length; i++) {
    if (+cards[i].dataset.ei > ei && !cards[i].classList.contains('collapsed')) {
      nextCard = cards[i];
      break;
    }
  }

  if (nextCard) {
    nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (loggerFinishBtnEl) {
    loggerFinishBtnEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function startLoggerClock() {
  stopLoggerClock();
  tickLoggerClock();
}

function tickLoggerClock() {
  if (!activeWorkout || !loggerDurationEl) return;
  var t = Math.floor((Date.now() - loggerStartTs) / 1000);
  var h = Math.floor(t / 3600);
  var m = Math.floor((t % 3600) / 60);
  var s = t % 60;
  loggerDurationEl.textContent = h > 0
    ? loggerPad(h) + ':' + loggerPad(m) + ':' + loggerPad(s)
    : loggerPad(m) + ':' + loggerPad(s);
  loggerRAF = requestAnimationFrame(tickLoggerClock);
}

function stopLoggerClock() {
  if (loggerRAF) { cancelAnimationFrame(loggerRAF); loggerRAF = null; }
}

/* ── Session Persistence ──────────────── */

function readSessions() {
  try {
    var raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    /* Validate each session has at least an id and date */
    var clean = [];
    for (var i = 0; i < parsed.length; i++) {
      var s = parsed[i];
      if (s && typeof s === 'object' && s.date) clean.push(s);
    }
    return clean;
  } catch (e) {
    console.warn('[Forge] readSessions failed, returning empty array:', e);
    return [];
  }
}

function writeSession(session) {
  var sessions = readSessions();
  sessions.unshift(session);
  if (sessions.length > 200) sessions.length = 200;
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); } catch (e) {}
}

/* ── Dashboard Rehydration ─────────────── */

function updateDashboardStats() {
  try {
    hydrateDashboard();
  } catch (e) {
    console.warn('[Forge] Dashboard hydration failed — exercises will still render:', e);
  }
}

function hydrateDashboard() {
  var sessions = readSessions();
  var totalWorkouts = sessions.length;
  var totalVolume = 0;
  var uniqueDates = {};
  var muscleCounts = {};

  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    totalVolume += s.totalVolume || 0;

    var dayKey = s.date ? s.date.slice(0, 10) : '';
    if (dayKey) uniqueDates[dayKey] = true;

    if (s.exercises) {
      for (var j = 0; j < s.exercises.length; j++) {
        var ex = s.exercises[j];
        if (ex.sets && ex.sets.length) {
          var hasData = false;
          for (var k = 0; k < ex.sets.length; k++) {
            if ((ex.sets[k].reps && ex.sets[k].reps > 0) || (ex.sets[k].weight && ex.sets[k].weight > 0)) {
              hasData = true;
              break;
            }
          }
          if (hasData) {
            var muscle = MUSCLE_MAP[ex.name] || 'Other';
            muscleCounts[muscle] = (muscleCounts[muscle] || 0) + 1;
          }
        }
      }
    }
  }

  var daysTrained = Object.keys(uniqueDates).length;

  var topMuscle = '\u2014';
  var topCount = 0;
  var keys = Object.keys(muscleCounts);
  for (var m = 0; m < keys.length; m++) {
    if (muscleCounts[keys[m]] > topCount) {
      topCount = muscleCounts[keys[m]];
      topMuscle = keys[m];
    }
  }

  var volStr = totalVolume >= 1000000
    ? (totalVolume / 1000000).toFixed(1) + 'M'
    : totalVolume >= 1000
      ? (totalVolume / 1000).toFixed(1) + 'k'
      : '' + Math.round(totalVolume);

  /* Profile View — surgical .textContent updates */
  var pfDays = document.getElementById('profile-days-trained');
  var pfMuscle = document.getElementById('profile-most-targeted');
  var pfVol = document.getElementById('profile-total-volume');
  if (pfDays) pfDays.textContent = daysTrained;
  if (pfMuscle) pfMuscle.textContent = topMuscle;
  if (pfVol) pfVol.textContent = volStr;

  /* Progress View — surgical .textContent updates */
  var pgWorkouts = document.getElementById('progress-total-workouts');
  var pgVolume = document.getElementById('progress-total-volume');
  var pgDays = document.getElementById('progress-days-trained');
  if (pgWorkouts) pgWorkouts.textContent = totalWorkouts;
  if (pgVolume) pgVolume.textContent = volStr + ' kg';
  if (pgDays) pgDays.textContent = daysTrained;

  /* Trophy Room (Profile) */
  renderAppTrophyRoom(sessions);

  /* Recent Sessions (Profile) */
  renderRecentSessions(sessions);

  /* PR List (Progress) */
  renderProgressPRs(sessions);

  /* Weekly Volume Chart (Progress) */
  renderWeeklyVolumeChart(sessions);

  /* Body Metrics (Progress) */
  hydrateBodyMetrics();
}

/* ── Weekly Volume Chart Renderer ─────── */

function renderWeeklyVolumeChart(sessions) {
  var chart = document.getElementById('weeklyVolumeChart');
  if (!chart) return;

  /* Delegate to ForgeProfile.renderWeeklyChart if available (profile-analytics.js) */
  if (window.ForgeProfile && window.ForgeProfile.renderWeeklyChart) {
    window.ForgeProfile.renderWeeklyChart(sessions);
    return;
  }

  /* Fallback: standalone rendering if profile-analytics.js hasn't loaded */
  var now = new Date();
  var monIdx = (now.getDay() + 6) % 7;
  var monday = new Date(now);
  monday.setDate(now.getDate() - monIdx);
  monday.setHours(0, 0, 0, 0);
  var sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  var daily = [0, 0, 0, 0, 0, 0, 0];
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    if (!s.date) continue;
    var d = new Date(s.date);
    if (d >= monday && d <= sunday) {
      daily[(d.getDay() + 6) % 7] += s.totalVolume || 0;
    }
  }

  var maxVol = 0;
  for (var j = 0; j < 7; j++) {
    if (daily[j] > maxVol) maxVol = daily[j];
  }

  var groups = chart.querySelectorAll('.bar-group');
  groups.forEach(function (g, idx) {
    var bar = g.querySelector('.bar');
    var val = g.querySelector('.bar-val');
    if (!bar || !val) return;

    var vol = daily[idx];
    if (vol <= 0 || maxVol <= 0) {
      bar.style.setProperty('--h', '5%');
      val.textContent = '0';
      bar.classList.add('dim');
      bar.classList.remove('lime');
    } else {
      var pct = Math.round((vol / maxVol) * 90 + 5);
      bar.style.setProperty('--h', pct + '%');
      val.textContent = vol >= 1000 ? (vol / 1000).toFixed(1) + 'k' : '' + Math.round(vol);
      bar.classList.remove('dim');
      bar.classList.toggle('lime', idx === 1 || idx === 4);
    }
  });
}

/* ── Body Metrics Hydration ────────────── */

var BODY_METRICS_KEY = 'fitnessawy_body_metrics';

function hydrateBodyMetrics() {
  var metrics = null;
  try {
    var raw = localStorage.getItem(BODY_METRICS_KEY);
    if (raw) metrics = JSON.parse(raw);
  } catch (e) {}

  var weightEl = document.getElementById('progress-weight');
  var bodyfatEl = document.getElementById('progress-bodyfat');
  var muscleEl = document.getElementById('progress-muscle');
  var bmiEl = document.getElementById('progress-bmi');
  var weightChg = document.getElementById('progress-weight-change');
  var bodyfatChg = document.getElementById('progress-bodyfat-change');
  var muscleChg = document.getElementById('progress-muscle-change');
  var bmiChg = document.getElementById('progress-bmi-change');

  if (!metrics) {
    if (weightEl) weightEl.innerHTML = '-- <small>kg</small>';
    if (bodyfatEl) bodyfatEl.innerHTML = '-- <small>%</small>';
    if (muscleEl) muscleEl.innerHTML = '-- <small>kg</small>';
    if (bmiEl) bmiEl.textContent = '--';
    if (weightChg) { weightChg.textContent = '\u2014'; weightChg.className = 'metric-change neutral'; }
    if (bodyfatChg) { bodyfatChg.textContent = '\u2014'; bodyfatChg.className = 'metric-change neutral'; }
    if (muscleChg) { muscleChg.textContent = '\u2014'; muscleChg.className = 'metric-change neutral'; }
    if (bmiChg) { bmiChg.textContent = '\u2014'; bmiChg.className = 'metric-change neutral'; }
    return;
  }

  var w = metrics.weight;
  var bf = metrics.bodyFat;
  var mm = metrics.muscleMass;
  var bmi = metrics.bmi;
  var prevW = metrics.prevWeight;
  var prevBF = metrics.prevBodyFat;
  var prevMM = metrics.prevMuscleMass;

  function fmtDelta(curr, prev) {
    if (curr == null || prev == null) return { text: '\u2014', cls: 'neutral' };
    var diff = curr - prev;
    if (diff === 0) return { text: '\u2014', cls: 'neutral' };
    var sign = diff > 0 ? '+' : '';
    return { text: sign + diff.toFixed(1), cls: diff > 0 ? 'up' : 'down' };
  }

  if (w != null) {
    if (weightEl) weightEl.innerHTML = w + ' <small>kg</small>';
    var dW = fmtDelta(w, prevW);
    if (weightChg) { weightChg.textContent = dW.text; weightChg.className = 'metric-change ' + dW.cls; }
  } else {
    if (weightEl) weightEl.innerHTML = '-- <small>kg</small>';
    if (weightChg) { weightChg.textContent = '\u2014'; weightChg.className = 'metric-change neutral'; }
  }

  if (bf != null) {
    if (bodyfatEl) bodyfatEl.innerHTML = bf + ' <small>%</small>';
    var dBF = fmtDelta(bf, prevBF);
    if (bodyfatChg) { bodyfatChg.textContent = dBF.text; bodyfatChg.className = 'metric-change ' + dBF.cls; }
  } else {
    if (bodyfatEl) bodyfatEl.innerHTML = '-- <small>%</small>';
    if (bodyfatChg) { bodyfatChg.textContent = '\u2014'; bodyfatChg.className = 'metric-change neutral'; }
  }

  if (mm != null) {
    if (muscleEl) muscleEl.innerHTML = mm + ' <small>kg</small>';
    var dMM = fmtDelta(mm, prevMM);
    if (muscleChg) { muscleChg.textContent = dMM.text; muscleChg.className = 'metric-change ' + dMM.cls; }
  } else {
    if (muscleEl) muscleEl.innerHTML = '-- <small>kg</small>';
    if (muscleChg) { muscleChg.textContent = '\u2014'; muscleChg.className = 'metric-change neutral'; }
  }

  if (bmi != null) {
    if (bmiEl) bmiEl.textContent = bmi;
    if (bmiChg) { bmiChg.textContent = '\u2014'; bmiChg.className = 'metric-change neutral'; }
  } else {
    if (bmiEl) bmiEl.textContent = '--';
    if (bmiChg) { bmiChg.textContent = '\u2014'; bmiChg.className = 'metric-change neutral'; }
  }
}

function renderAppTrophyRoom(sessions) {
  var container = document.getElementById('trophyContent');
  if (!container) return;

  var prs = computePRMap(sessions);
  var names = Object.keys(prs);
  if (!names.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:12px 0">No personal records yet. Complete workouts to earn trophies!</p>';
    return;
  }

  names.sort(function (a, b) { return prs[b].weight - prs[a].weight; });

  var html = '';
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var pr = prs[name];
    var dateStr = pr.date ? new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    var accent = i === 0 ? 'var(--accent-gold)' : i === 1 ? 'var(--accent-lime)' : 'var(--accent-cyan)';

    html += '<div class="trophy-badge">';
    html += '<div class="trophy-left">';
    html += '<span class="trophy-rank-num" style="color:' + accent + '">' + (i + 1) + '</span>';
    html += '<span class="trophy-exercise">' + loggerEsc(name) + '</span>';
    html += '</div>';
    html += '<div class="trophy-right">';
    html += '<span class="trophy-weight">' + pr.weight + '<span class="trophy-weight-unit">kg</span></span>';
    if (dateStr) html += '<span class="trophy-date">' + dateStr + '</span>';
    html += '</div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

/* ── Recent Sessions Renderer ──────────── */

function renderRecentSessions(sessions) {
  var list = document.getElementById('profileRecentLogs');
  var countBadge = document.getElementById('profileLogCount');
  var recentSection = document.getElementById('profileRecentSection');
  if (!list) return;

  if (!sessions.length) {
    if (recentSection) recentSection.style.display = 'none';
    return;
  }
  if (recentSection) recentSection.style.display = '';

  var recent = sessions.slice(0, 5);
  if (countBadge) countBadge.textContent = sessions.length;

  var html = '';
  var accents = ['cyan', 'lime', 'gold', 'cyan', 'lime'];
  for (var i = 0; i < recent.length; i++) {
    var s = recent[i];
    var dateStr = s.date ? new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    var dur = s.duration ? formatDuration(s.duration) : '';
    var vol = s.totalVolume ? Math.round(s.totalVolume) + ' kg' : '';
    var exCount = s.exercises ? s.exercises.length : 0;
    var accent = accents[i % accents.length];

    html += '<div class="profile-log-item">';
    html += '<div class="profile-log-dot ' + accent + '"></div>';
    html += '<div class="profile-log-info">';
    html += '<div class="profile-log-name">' + loggerEsc(s.name || 'Workout') + '</div>';
    html += '<div class="profile-log-date">' + dateStr + (dur ? ' \u2022 ' + dur : '') + (exCount ? ' \u2022 ' + exCount + ' exercises' : '') + '</div>';
    html += '</div>';
    html += '<div class="profile-log-vol">' + vol + '</div>';
    html += '</div>';
  }

  list.innerHTML = html;
}

/* ── Progress PR List Renderer ─────────── */

function renderProgressPRs(sessions) {
  var container = document.getElementById('progressPRList');
  if (!container) return;

  var prs = computePRMap(sessions);
  var names = Object.keys(prs);
  if (!names.length) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:16px 0">No records yet</div>';
    return;
  }

  names.sort(function (a, b) { return prs[b].weight - prs[a].weight; });

  var html = '';
  var iconAccents = ['', 'lime', ''];
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var pr = prs[name];
    var dateStr = pr.date ? new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    var accentClass = iconAccents[i % iconAccents.length];

    html += '<div class="pr-row">';
    html += '<div class="pr-icon' + (accentClass ? ' ' + accentClass : '') + '">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M8 4v4M16 4v4M8 16v4M16 16v4"/></svg>';
    html += '</div>';
    html += '<div class="pr-info">';
    html += '<span class="pr-exercise">' + loggerEsc(name) + '</span>';
    html += '<span class="pr-date">' + dateStr + '</span>';
    html += '</div>';
    html += '<span class="pr-value">' + pr.weight + ' <small>kg</small></span>';
    html += '</div>';
  }

  container.innerHTML = html;
}

/* ── Duration Formatter ────────────────── */

function formatDuration(ms) {
  var totalSec = Math.floor(ms / 1000);
  var h = Math.floor(totalSec / 3600);
  var m = Math.floor((totalSec % 3600) / 60);
  var s = totalSec % 60;
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm ' + s + 's';
  return s + 's';
}

/* ── Finish Workout ────────────────────── */

function finishActiveWorkout() {
  if (!activeWorkout) return;

  /* ── 1. State-based data extraction ────────── */
  var extractedExercises = [];
  var totalVolume = 0;
  var hasAnyData = false;

  activeWorkout.exercises.forEach(function (ex) {
    var sets = [];
    for (var k = 0; k < ex.sets.length; k++) {
      var s = ex.sets[k];
      if (!s.done) continue;
      var r = parseFloat(s.reps) || 0;
      var w = parseFloat(s.weight) || 0;
      var vol = r * w;
      totalVolume += vol;
      hasAnyData = true;
      sets.push({ reps: r, weight: w, volume: vol });
    }
    if (sets.length) {
      extractedExercises.push({ name: ex.name, sets: sets });
    }
  });

  if (!hasAnyData) {
    window.ForgeDialog.alert('No Data', 'Log at least one set before finishing.');
    return;
  }

  /* ── 2. PR detection ───────────────────────── */
  var prevSessions = readSessions();
  var prevPRs = computePRMap(prevSessions);

  var newPRs = [];
  extractedExercises.forEach(function (ex) {
    var bestWeight = 0;
    ex.sets.forEach(function (s) {
      if (s.weight > bestWeight) bestWeight = s.weight;
    });
    if (bestWeight <= 0) return;

    var prevBest = prevPRs[ex.name] ? prevPRs[ex.name].weight : 0;
    if (bestWeight > prevBest) {
      newPRs.push({ name: ex.name, weight: bestWeight, date: new Date().toISOString() });
    }
  });

  /* ── 3. Build & save session ───────────────── */
  var durationMs = Date.now() - activeWorkout.startTime;
  var session = {
    id: Date.now(),
    date: new Date().toISOString(),
    name: activeWorkout.name || 'Workout',
    duration: durationMs,
    totalVolume: totalVolume,
    exercises: extractedExercises,
    newPRs: newPRs
  };

  writeSession(session);

  /* ── 4. Cleanup logger DOM ─────────────────── */
  activeWorkout = null;
  stopLoggerClock();
  if (loggerExercisesEl) loggerExercisesEl.innerHTML = '';
  if (loggerView) loggerView.style.display = 'none';

  /* ── 5. Reset exercise selection ───────────── */
  if (window.ForgeBrowser) window.ForgeBrowser.resetSelection();

  /* ── 6. Hydrate & route ────────────────────── */
  hydrateDashboard();
  switchView('progress');
}

/* ── PR Computation Helper ─────────────────── */

function computePRMap(sessions) {
  var prs = {};
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    if (!s.exercises) continue;
    for (var j = 0; j < s.exercises.length; j++) {
      var ex = s.exercises[j];
      if (!ex.sets || !ex.sets.length) continue;

      /* Find the absolute highest single weight across ALL sets of this exercise */
      var maxWeight = 0;
      var maxWeightDate = s.date;
      for (var k = 0; k < ex.sets.length; k++) {
        var w = parseFloat(ex.sets[k].weight) || 0;
        maxWeight = Math.max(maxWeight, w);
        if (w === maxWeight && w > 0) maxWeightDate = s.date;
      }

      if (maxWeight <= 0) continue;

      /* Keep only the heaviest weight ever recorded for this exercise name */
      if (!prs[ex.name] || maxWeight > prs[ex.name].weight) {
        prs[ex.name] = { weight: maxWeight, date: maxWeightDate };
      }
    }
  }
  return prs;
}

/* ── Delegated Start Workout Button ────── */

var workoutView = document.getElementById('workout-view');
if (workoutView) {
  workoutView.addEventListener('click', function (e) {
    if (!e.target.closest('#btnFabStart')) return;

    var exercises = window.ForgeBrowser ? window.ForgeBrowser.getSelectedExercises() : [];
    if (!exercises.length) return;

    initActiveWorkout(exercises);
  });
}

/* ── Global bootstrap — called by auth-gateway ── */

window.bootMainApp = function (user) {
  console.log('[App] bootMainApp() fired', user ? user.email : '(no user)');

  try {
    /* 1. Force #app-core visible (has inline display:none from HTML) */
    var appCore = document.getElementById('app-core');
    if (appCore) appCore.style.display = 'flex';

    /* 2. Force #workout-view visible */
    var workoutViewEl = document.getElementById('workout-view');
    if (workoutViewEl) {
      workoutViewEl.style.display = 'block';
    } else {
      console.error('CRITICAL: #workout-view is STILL missing from the DOM.');
    }

    /* 3. Force the Workout nav tab active */
    var workoutNav = document.querySelector('.nav-item[data-view="workout"]');
    if (workoutNav) workoutNav.click();

    /* 4. Inject Firebase user data into profile header */
    if (user) {
      var pfAvatar = document.getElementById('pf-avatar');
      var pfName = document.getElementById('pf-name');
      var pfRole = document.getElementById('pf-role');

      if (pfName) pfName.textContent = user.displayName || 'Devmido';
      if (pfRole) pfRole.textContent = 'Pro Member';
      if (pfAvatar && user.photoURL) {
        pfAvatar.src = user.photoURL;
        pfAvatar.style.display = 'block';
        var pfAvatarText = document.getElementById('pf-avatar-text');
        if (pfAvatarText) pfAvatarText.style.display = 'none';
      }
    }

    /* 5. Bind profile menu buttons — Edit Profile opens body metrics modal */
    document.querySelectorAll('.profile-menu-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var label = btn.querySelector('span') ? btn.querySelector('span').textContent.trim() : '';
        if (label === 'Edit Profile') {
          var modal = document.getElementById('bodyMetricsModal');
          if (modal) {
            /* Pre-fill inputs with existing values from localStorage */
            var existing = null;
            try {
              var raw = localStorage.getItem('fitnessawy_body_metrics');
              if (raw) existing = JSON.parse(raw);
            } catch (ex) {}
            var wInput = document.getElementById('inputBodyWeight');
            var bfInput = document.getElementById('inputBodyFat');
            var mmInput = document.getElementById('inputMuscleMass');
            if (wInput) wInput.value = (existing && existing.weight != null) ? existing.weight : '';
            if (bfInput) bfInput.value = (existing && existing.bodyFat != null) ? existing.bodyFat : '';
            if (mmInput) mmInput.value = (existing && existing.muscleMass != null) ? existing.muscleMass : '';
            modal.style.display = 'flex';
          }
        } else if (label === 'Settings') {
          var sm = document.getElementById('settings-modal');
          if (sm) sm.style.display = 'flex';
        } else if (label === 'Privacy & Security') {
          var pm = document.getElementById('privacy-modal');
          if (pm) pm.style.display = 'flex';
        } else if (label === 'Log Out') {
          if (window.__forgeAuth) {
            var authInstance = window.__forgeAuth.getAuth();
            window.__forgeAuth.signOut(authInstance).then(function () {
              window.location.reload();
            }).catch(function (err) {
              console.error('[Forge] signOut failed:', err);
              window.location.reload();
            });
          } else {
            window.location.reload();
          }
        }
      });
    });

    /* 6. Bind body metrics modal buttons */
    var bmClose = document.getElementById('bodyMetricsClose');
    var bmSave = document.getElementById('bodyMetricsSave');
    var bmModal = document.getElementById('bodyMetricsModal');

    if (bmClose && bmModal) {
      bmClose.addEventListener('click', function () { bmModal.style.display = 'none'; });
    }
    if (bmModal) {
      bmModal.addEventListener('click', function (e) {
        if (e.target === bmModal) bmModal.style.display = 'none';
      });
    }
    if (bmSave) {
      bmSave.addEventListener('click', function () {
        var w = document.getElementById('inputBodyWeight');
        var bf = document.getElementById('inputBodyFat');
        var mm = document.getElementById('inputMuscleMass');

        var weightVal = w && w.value !== '' ? parseFloat(w.value) : null;
        var bfVal = bf && bf.value !== '' ? parseFloat(bf.value) : null;
        var mmVal = mm && mm.value !== '' ? parseFloat(mm.value) : null;

        /* Load previous values for delta calculation */
        var prev = null;
        try {
          var raw = localStorage.getItem('fitnessawy_body_metrics');
          if (raw) prev = JSON.parse(raw);
        } catch (ex) {}

        var metrics = {
          weight: weightVal,
          bodyFat: bfVal,
          muscleMass: mmVal,
          bmi: weightVal != null ? (weightVal / (1.75 * 1.75)).toFixed(1) : null,
          prevWeight: prev ? prev.weight : null,
          prevBodyFat: prev ? prev.bodyFat : null,
          prevMuscleMass: prev ? prev.muscleMass : null,
          updatedAt: new Date().toISOString()
        };

        try { localStorage.setItem('fitnessawy_body_metrics', JSON.stringify(metrics)); } catch (ex) {}

        if (bmModal) bmModal.style.display = 'none';

        /* Re-hydrate dashboard to reflect new values immediately */
        try { hydrateDashboard(); } catch (ex) { console.warn('[Forge] hydrateDashboard after save failed:', ex); }
      });
    }

    /* 6. Bind Settings & Privacy modal close buttons + Clear App Data */
    var settingsModal = document.getElementById('settings-modal');
    var privacyModal = document.getElementById('privacy-modal');

    var settingsClose = document.getElementById('settingsClose');
    if (settingsClose && settingsModal) {
      settingsClose.addEventListener('click', function () { settingsModal.style.display = 'none'; });
    }
    if (settingsModal) {
      settingsModal.addEventListener('click', function (e) {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
      });
    }

    var privacyClose = document.getElementById('privacyClose');
    if (privacyClose && privacyModal) {
      privacyClose.addEventListener('click', function () { privacyModal.style.display = 'none'; });
    }
    if (privacyModal) {
      privacyModal.addEventListener('click', function (e) {
        if (e.target === privacyModal) privacyModal.style.display = 'none';
      });
    }

    /* ── Clear App Data ──────────────────────── */
    var clearDataBtn = document.getElementById('settingsClearData');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', function () {
        window.ForgeDialog.confirm('Clear App Data', 'WARNING: This will permanently delete all your workout logs, PRs, and body metrics. Are you sure?', { danger: true, confirmLabel: 'Delete Everything' }).then(function (yes) {
          if (yes) {
            try { localStorage.removeItem('fitnessawy_sessions'); } catch (ex) {}
            try { localStorage.removeItem('fitnessawy_body_metrics'); } catch (ex) {}
            window.location.reload();
          }
        });
      });
    }

    /* ── Change Password (Firebase) ──────────── */
    var changePwBtn = document.getElementById('privacyChangePassword');
    if (changePwBtn) {
      changePwBtn.addEventListener('click', async function () {
        var newPass = await window.ForgeDialog.prompt('Change Password', 'Enter your new password (minimum 6 characters):', { placeholder: 'New password...', confirmLabel: 'Update' });
        if (!newPass) return;
        if (newPass.length < 6) {
          await window.ForgeDialog.alert('Invalid Password', 'Password must be at least 6 characters.');
          return;
        }
        try {
          var authInstance = window.__forgeAuth.getAuth();
          await window.__forgeAuth.updatePassword(authInstance.currentUser, newPass);
          await window.ForgeDialog.alert('Success', 'Password updated successfully!');
        } catch (err) {
          console.error('[Forge] updatePassword failed:', err);
          if (err.code === 'auth/requires-recent-login') {
            await window.ForgeDialog.alert('Re-auth Required', 'For security, please log out and log back in before changing your password.');
          } else {
            await window.ForgeDialog.alert('Error', 'Failed to update password: ' + (err.message || err));
          }
        }
      });
    }

    /* ── Delete Account (Firebase) ───────────── */
    var deleteAcctBtn = document.getElementById('privacyDeleteAccount');
    if (deleteAcctBtn) {
      deleteAcctBtn.addEventListener('click', async function () {
        var yes = await window.ForgeDialog.confirm('Delete Account', 'CRITICAL: This will permanently delete your Forge account and cannot be undone. Proceed?', { danger: true, confirmLabel: 'Delete Account' });
        if (!yes) return;
        try {
          var authInstance = window.__forgeAuth.getAuth();
          await window.__forgeAuth.deleteUser(authInstance.currentUser);
          try { localStorage.removeItem('fitnessawy_sessions'); } catch (ex) {}
          try { localStorage.removeItem('fitnessawy_body_metrics'); } catch (ex) {}
          window.location.reload();
        } catch (err) {
          console.error('[Forge] deleteUser failed:', err);
          if (err.code === 'auth/requires-recent-login') {
            await window.ForgeDialog.alert('Re-auth Required', 'For security, please log out and log back in before deleting your account.');
          } else {
            await window.ForgeDialog.alert('Error', 'Failed to delete account: ' + (err.message || err));
          }
        }
      });
    }

    /* 7. Boot all modules — ForgeBrowser.init() fetches
          exercises.json and renders the muscle grid.
          Each module is individually guarded so one failure
          cannot kill the others. */
    try { init(); } catch (e) { console.warn('[Forge] init() failed:', e); }

    if (window.ForgeBrowser) {
      try { window.ForgeBrowser.init(); } catch (e) { console.warn('[Forge] ForgeBrowser.init() failed:', e); }
    }
    if (window.ForgeLogger) {
      try { window.ForgeLogger.init(); } catch (e) { console.warn('[Forge] ForgeLogger.init() failed:', e); }
    }
    if (window.ForgeProfile) {
      try { window.ForgeProfile.refresh(); } catch (e) { console.warn('[Forge] ForgeProfile.refresh() failed:', e); }
    }
    try { updateDashboardStats(); } catch (e) { console.warn('[Forge] updateDashboardStats() failed:', e); }

  } catch (fatalErr) {
    /* ── Catch-all: if anything above throws uncaught, show the error ── */
    console.error('[Forge] bootMainApp FATAL:', fatalErr);

    var loader = document.getElementById('exLoading');
    if (loader) loader.style.display = 'none';

    var errBox = document.createElement('div');
    errBox.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0a;color:#ff4444;font-family:monospace;text-align:center;padding:32px;';
    errBox.innerHTML =
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<h2 style="margin:16px 0 8px;font-size:1.1rem;color:#ff4444">Application Failed to Load</h2>' +
      '<p style="margin:0 0 16px;font-size:0.85rem;color:#888;max-width:400px">' + String(fatalErr.message || fatalErr) + '</p>' +
      '<button onclick="location.reload()" style="padding:10px 24px;border:1px solid #ff4444;background:transparent;color:#ff4444;border-radius:6px;cursor:pointer;font-size:0.85rem">Reload</button>';
    document.body.appendChild(errBox);

  } finally {
    /* ── ALWAYS hide the loading spinner ── */
    var spinner = document.getElementById('exLoading');
    if (spinner) spinner.style.display = 'none';
  }
};

export { switchView, init };
