/* ============================================
   FORGE — Profile Analytics
   Reads workoutHistory from localStorage,
   computes stats, renders profile data.
   ============================================ */

(function () {
  'use strict';

  var HISTORY_KEY = 'workoutHistory';
  var RECENT_LIMIT = 5;

  /* ── Muscle Group Map ──────────────────── */

  var MUSCLE_MAP = {
    'Barbell Bench Press':   'Chest',
    'Incline Dumbbell Fly':  'Chest',
    'Chest Dip':             'Chest',
    'Overhead Press':        'Shoulders',
    'Lateral Raise':         'Shoulders',
    'Tricep Rope Pushdown':  'Arms',
    'Treadmill Sprint':      'Cardio',
    'Battle Ropes':          'Cardio',
    'Box Jumps':             'Legs'
  };

  var MUSCLE_ICONS = {
    Chest:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M8 4v4M16 4v4M8 16v4M16 16v4"/></svg>',
    Shoulders: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    Arms:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M14 8l-4 4-2-2-4 4"/></svg>',
    Cardio:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    Legs:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 16 16 12"/></svg>',
    Other:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

  /* ── DOM refs ──────────────────────────── */

  var analyticsGrid, emptyState, recentSection, recentLogs, logCount;
  var btnProfileStart;

  function cacheDom() {
    analyticsGrid = document.getElementById('profileAnalytics');
    emptyState    = document.getElementById('profileEmpty');
    recentSection = document.getElementById('profileRecentSection');
    recentLogs    = document.getElementById('profileRecentLogs');
    logCount      = document.getElementById('profileLogCount');
    btnProfileStart = document.getElementById('btnProfileStart');
  }

  /* ── History Reader ────────────────────── */

  function readHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  /* ── Analytics Engine ──────────────────── */

  function computeStats(history) {
    var uniqueDates = {};
    var muscleCounts = {};
    var totalVolume = 0;

    history.forEach(function (session) {
      /* unique days */
      var dayKey = session.date ? session.date.slice(0, 10) : '';
      if (dayKey) uniqueDates[dayKey] = true;

      /* total volume */
      totalVolume += session.totalVolume || 0;

      /* muscle frequency */
      if (session.exercises) {
        session.exercises.forEach(function (ex) {
          var hasData = ex.sets && ex.sets.some(function (s) {
            return (s.reps && s.reps > 0) || (s.weight && s.weight > 0);
          });
          if (hasData) {
            var muscle = MUSCLE_MAP[ex.name] || 'Other';
            muscleCounts[muscle] = (muscleCounts[muscle] || 0) + 1;
          }
        });
      }
    });

    var daysTrained = Object.keys(uniqueDates).length;

    var topMuscle = '—';
    var topCount = 0;
    var topIcon = MUSCLE_ICONS.Other;
    Object.keys(muscleCounts).forEach(function (m) {
      if (muscleCounts[m] > topCount) {
        topCount = muscleCounts[m];
        topMuscle = m;
        topIcon = MUSCLE_ICONS[m] || MUSCLE_ICONS.Other;
      }
    });

    return {
      daysTrained: daysTrained,
      topMuscle: topMuscle,
      topMuscleCount: topCount,
      topMuscleIcon: topIcon,
      totalVolume: totalVolume,
      totalSessions: history.length
    };
  }

  /* ── Render Analytics Cards ────────────── */

  function renderAnalytics(stats) {
    analyticsGrid.innerHTML =
      '<div class="pa-card">' +
        '<div class="pa-icon cyan">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
        '</div>' +
        '<span class="pa-value">' + stats.daysTrained + '</span>' +
        '<span class="pa-label">Days<br>Trained</span>' +
      '</div>' +
      '<div class="pa-card">' +
        '<div class="pa-icon lime">' +
          stats.topMuscleIcon +
        '</div>' +
        '<span class="pa-value">' + esc(stats.topMuscle) + '</span>' +
        '<span class="pa-label">Most<br>Targeted</span>' +
      '</div>' +
      '<div class="pa-card">' +
        '<div class="pa-icon purple">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
        '</div>' +
        '<span class="pa-value">' + fmtVol(stats.totalVolume) + '</span>' +
        '<span class="pa-label">Total<br>Volume</span>' +
      '</div>';
  }

  /* ── Render Recent Logs ────────────────── */

  function renderRecentLogs(history) {
    if (history.length === 0) {
      recentSection.style.display = 'none';
      return;
    }

    recentSection.style.display = '';
    logCount.textContent = history.length;

    var recent = history.slice(0, RECENT_LIMIT);
    var html = '';

    recent.forEach(function (session, i) {
      var dotClass = i === 0 ? 'cyan' : (i === 1 ? 'lime' : 'dim');
      var dateStr = fmtDate(session.date);
      var durStr = fmtDur(session.duration || 0);
      var volStr = fmtVol(session.totalVolume || 0);
      var exCount = session.exercises ? session.exercises.length : 0;

      html += '<div class="profile-log-item">';
      html += '<div class="profile-log-dot ' + dotClass + '"></div>';
      html += '<div class="profile-log-info">';
      html += '<div class="profile-log-name">' + esc(session.name || 'Workout') + '</div>';
      html += '<div class="profile-log-date">' + dateStr + ' · ' + exCount + ' exercises</div>';
      html += '</div>';
      html += '<div class="profile-log-right">';
      html += '<span class="profile-log-vol">' + volStr + '</span>';
      html += '<span class="profile-log-dur">' + durStr + '</span>';
      html += '</div>';
      html += '</div>';
    });

    recentLogs.innerHTML = html;
  }

  /* ── Main Refresh ──────────────────────── */

  function refresh() {
    cacheDom();
    var history = readHistory();

    if (history.length === 0) {
      analyticsGrid.innerHTML = '';
      emptyState.style.display = '';
      recentSection.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      var stats = computeStats(history);
      renderAnalytics(stats);
      renderRecentLogs(history);
    }

    bindEmptyButton();
  }

  function bindEmptyButton() {
    if (btnProfileStart && !btnProfileStart._bound) {
      btnProfileStart._bound = true;
      btnProfileStart.addEventListener('click', function () {
        if (window.ForgeLogger) {
          window.ForgeLogger.startWorkout();
          if (window.ForgeApp) window.ForgeApp.switchView('progress');
        }
      });
    }
  }

  /* ── Formatters ────────────────────────── */

  function fmtVol(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return '' + Math.round(n);
  }

  function fmtDur(ms) {
    var t = Math.floor(ms / 1000);
    var h = Math.floor(t / 3600);
    var m = Math.floor((t % 3600) / 60);
    var s = t % 60;
    if (h > 0) return h + 'h ' + pad(m) + 'm';
    return m + 'm ' + pad(s) + 's';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var now = new Date();
      var diff = now - d;
      var dayMs = 86400000;

      if (diff < dayMs && d.getDate() === now.getDate()) {
        return 'Today, ' + fmt12(d);
      }
      if (diff < dayMs * 2 && d.getDate() === now.getDate() - 1) {
        return 'Yesterday, ' + fmt12(d);
      }
      if (diff < dayMs * 7) {
        var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        return days[d.getDay()] + ', ' + fmt12(d);
      }
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    } catch (e) {
      return '—';
    }
  }

  function fmt12(d) {
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ── Public API ────────────────────────── */

  window.ForgeProfile = { refresh: refresh };

  /* ── Boot (defer until DOM ready) ──────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      cacheDom();
      refresh();
    });
  } else {
    cacheDom();
    refresh();
  }

})();
