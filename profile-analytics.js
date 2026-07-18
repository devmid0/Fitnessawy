/* ============================================
   FORGE — Profile Analytics
   Reads workoutHistory from localStorage,
   computes stats, renders profile data.
   ============================================ */

'use strict';

var HISTORY_KEY = 'workoutHistory';
var PROFILE_KEY = 'forge_profile';
var SETTINGS_KEY = 'forge_settings';
var ACCENT_KEY = 'forge_accent';
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
var trophyRoom, trophyGrid;
var profileMain, profileEdit, profileSettings, profilePrivacy;
var profileNameDisplay, profileAvatarText, profileSubDisplay;
var inputDisplayName, inputBodyweight, inputTargetWeight;
var inputPrimaryGoal, inputExperienceLevel;
var btnSaveProfile, profileSaveStatus;
var toggleWeightUnit, toggleUnitLabel;
var toggleTimerAlerts, toggleWakeLock;
var accentColorSelector;
var btnDownloadBackup, btnImportBackup, importBackupFile, btnDeleteAll;

function cacheDom() {
  analyticsGrid   = document.getElementById('profileAnalytics');
  emptyState      = document.getElementById('profileEmpty');
  recentSection   = document.getElementById('profileRecentSection');
  recentLogs      = document.getElementById('profileRecentLogs');
  logCount        = document.getElementById('profileLogCount');
  btnProfileStart = document.getElementById('btnProfileStart');
  trophyRoom      = document.getElementById('trophyRoom');
  trophyGrid      = document.getElementById('trophyGrid');

  profileMain     = document.getElementById('profileMain');
  profileEdit     = document.getElementById('profileEdit');
  profileSettings = document.getElementById('profileSettings');
  profilePrivacy  = document.getElementById('profilePrivacy');

  profileNameDisplay  = document.getElementById('profileNameDisplay');
  profileAvatarText   = document.getElementById('profileAvatarText');
  profileSubDisplay   = document.getElementById('profileSubDisplay');

  inputDisplayName    = document.getElementById('inputDisplayName');
  inputBodyweight     = document.getElementById('inputBodyweight');
  inputTargetWeight   = document.getElementById('inputTargetWeight');
  inputPrimaryGoal    = document.getElementById('inputPrimaryGoal');
  inputExperienceLevel = document.getElementById('inputExperienceLevel');
  btnSaveProfile      = document.getElementById('btnSaveProfile');
  profileSaveStatus   = document.getElementById('profileSaveStatus');

  toggleWeightUnit = document.getElementById('toggleWeightUnit');
  toggleUnitLabel  = document.getElementById('toggleUnitLabel');
  toggleTimerAlerts = document.getElementById('toggleTimerAlerts');
  toggleWakeLock   = document.getElementById('toggleWakeLock');
  accentColorSelector = document.getElementById('accentColorSelector');

  btnDownloadBackup = document.getElementById('btnDownloadBackup');
  btnImportBackup   = document.getElementById('btnImportBackup');
  importBackupFile  = document.getElementById('importBackupFile');
  btnDeleteAll      = document.getElementById('btnDeleteAll');
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

/* ── Compute Personal Records ──────────── */

function computePRs(history) {
  var prMap = {};

  history.forEach(function (session) {
    if (!session.exercises) return;
    var sessionDate = session.date || '';

    session.exercises.forEach(function (ex) {
      if (!ex.sets) return;

      ex.sets.forEach(function (set) {
        var w = parseFloat(set.weight) || 0;
        if (w <= 0) return;

        if (!prMap[ex.name] || w > prMap[ex.name].weight) {
          prMap[ex.name] = { weight: w, date: sessionDate, reps: set.reps || 0 };
        }
      });
    });
  });

  var prs = [];
  Object.keys(prMap).forEach(function (name) {
    prs.push({
      name: name,
      weight: prMap[name].weight,
      date: prMap[name].date,
      reps: prMap[name].reps
    });
  });

  prs.sort(function (a, b) { return b.weight - a.weight; });
  return prs.slice(0, 4);
}

/* ── Render Trophy Room ────────────────── */

function renderTrophyRoom(history) {
  if (!trophyRoom || !trophyGrid) return;

  var prs = computePRs(history);

  if (prs.length === 0) {
    trophyRoom.style.display = '';
    trophyGrid.innerHTML =
      '<div class="trophy-empty" style="grid-column:1/-1">' +
        '<div class="trophy-empty-icon">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>' +
        '</div>' +
        '<div class="trophy-empty-title">No PRs Yet</div>' +
        '<div class="trophy-empty-desc">Log weights during your workouts to start tracking personal records.</div>' +
      '</div>';
    return;
  }

  trophyRoom.style.display = '';

  var html = '';
  prs.forEach(function (pr, i) {
    var rankLabel = (i + 1) + '';
    html += '<div class="trophy-badge">';
    html += '<div class="trophy-rank"><span class="trophy-rank-num">' + rankLabel + '</span> PR</div>';
    html += '<div class="trophy-exercise">' + esc(pr.name) + '</div>';
    html += '<div><span class="trophy-weight">' + pr.weight + '</span><span class="trophy-weight-unit">kg</span></div>';
    html += '<div class="trophy-date">' + fmtDate(pr.date) + '</div>';
    html += '</div>';
  });

  trophyGrid.innerHTML = html;
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

/* ── Weekly Volume Chart ───────────────── */

function computeWeeklyVolume(history) {
  var now = new Date();
  var monIdx = (now.getDay() + 6) % 7;

  var monday = new Date(now);
  monday.setDate(now.getDate() - monIdx);
  monday.setHours(0, 0, 0, 0);

  var sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  var daily = [0, 0, 0, 0, 0, 0, 0];

  history.forEach(function (s) {
    if (!s.date) return;
    var d = new Date(s.date);
    if (d >= monday && d <= sunday) {
      daily[(d.getDay() + 6) % 7] += s.totalVolume || 0;
    }
  });

  return daily;
}

function renderWeeklyChart(history) {
  var chart = document.querySelector('#view-progress .bar-chart');
  if (!chart) return;

  var groups = chart.querySelectorAll('.bar-group');
  if (!groups.length) return;

  var daily = computeWeeklyVolume(history);
  var maxVol = 0;
  for (var i = 0; i < 7; i++) {
    if (daily[i] > maxVol) maxVol = daily[i];
  }

  groups.forEach(function (g, i) {
    var bar = g.querySelector('.bar');
    var val = g.querySelector('.bar-val');
    if (!bar || !val) return;

    var vol = daily[i];

    if (vol <= 0 || maxVol <= 0) {
      bar.style.setProperty('--h', '5%');
      val.textContent = '0';
      bar.classList.add('dim');
      bar.classList.remove('lime');
    } else {
      var pct = Math.round((vol / maxVol) * 90 + 5);
      bar.style.setProperty('--h', pct + '%');
      val.textContent = fmtVol(vol);
      bar.classList.remove('dim');
      if (i === 1 || i === 4) bar.classList.add('lime');
      else bar.classList.remove('lime');
    }
  });
}

/* ── Sub-View Routing ──────────────────── */

var subViews = {
  'edit-profile': { el: null, bound: false },
  'settings':     { el: null, bound: false },
  'privacy':      { el: null, bound: false }
};

function showSubview(name) {
  var sv = subViews[name];
  if (!sv || !sv.el) return;
  profileMain.style.display = 'none';
  sv.el.style.display = '';
}

function hideAllSubviews() {
  Object.keys(subViews).forEach(function (k) {
    subViews[k].el.style.display = 'none';
  });
  profileMain.style.display = '';
  /* re-render hero in case profile was edited */
  applyProfileToHero();
}

function bindSubViewRouting() {
  /* menu buttons → open sub-view */
  document.querySelectorAll('.menu-row[data-action]').forEach(function (btn) {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', function () {
      showSubview(this.dataset.action);
    });
  });

  /* back buttons → close sub-view */
  document.querySelectorAll('.btn-back[data-back]').forEach(function (btn) {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', function () {
      hideAllSubviews();
    });
  });
}

/* ── Profile Storage ───────────────────── */

function readProfile() {
  try {
    var raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function writeProfile(data) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(data)); } catch (e) {}
}

function applyProfileToHero() {
  var p = readProfile();
  var name = p.displayName || 'Mido A.';
  var bw   = p.bodyweight;

  if (profileNameDisplay) profileNameDisplay.textContent = name;
  if (profileAvatarText) {
    var parts = name.trim().split(/\s+/);
    var initials = (parts[0] || 'M').charAt(0).toUpperCase();
    if (parts.length > 1) initials += parts[parts.length - 1].charAt(0).toUpperCase();
    profileAvatarText.textContent = initials;
  }
  if (profileSubDisplay) {
    var labels = [];
    if (bw) labels.push(bw + ' kg');
    if (p.primaryGoal) {
      var goalMap = { hypertrophy: 'Hypertrophy', strength: 'Strength', fat_loss: 'Fat Loss', maintenance: 'Maintenance' };
      labels.push(goalMap[p.primaryGoal] || p.primaryGoal);
    }
    if (p.experienceLevel) {
      var lvlMap = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', elite: 'Elite' };
      labels.push(lvlMap[p.experienceLevel] || p.experienceLevel);
    }
    if (labels.length === 0) labels.push('Pro Member · Since Jan 2026');
    profileSubDisplay.textContent = labels.join(' · ');
  }
}

/* ── Edit Profile Logic ────────────────── */

function loadProfileForm() {
  var p = readProfile();
  if (inputDisplayName)    inputDisplayName.value    = p.displayName || '';
  if (inputBodyweight)     inputBodyweight.value     = p.bodyweight || '';
  if (inputTargetWeight)   inputTargetWeight.value   = p.targetWeight || '';
  if (inputPrimaryGoal)    inputPrimaryGoal.value    = p.primaryGoal || '';
  if (inputExperienceLevel) inputExperienceLevel.value = p.experienceLevel || '';
}

function bindEditProfile() {
  if (!btnSaveProfile || btnSaveProfile._bound) return;
  btnSaveProfile._bound = true;
  btnSaveProfile.addEventListener('click', function () {
    var name = (inputDisplayName.value || '').trim();
    if (!name) {
      inputDisplayName.focus();
      return;
    }

    var bw  = parseFloat(inputBodyweight.value) || 0;
    var tw  = parseFloat(inputTargetWeight.value) || 0;
    var goal = inputPrimaryGoal ? inputPrimaryGoal.value : '';
    var lvl  = inputExperienceLevel ? inputExperienceLevel.value : '';

    var p = readProfile();
    p.displayName = name;
    if (bw > 0) p.bodyweight = bw;
    else delete p.bodyweight;
    if (tw > 0) p.targetWeight = tw;
    else delete p.targetWeight;
    if (goal) p.primaryGoal = goal;
    else delete p.primaryGoal;
    if (lvl) p.experienceLevel = lvl;
    else delete p.experienceLevel;
    writeProfile(p);

    if (profileSaveStatus) {
      profileSaveStatus.className = 'form-status lime';
      profileSaveStatus.textContent = 'Profile Data Synced';
      setTimeout(function () {
        profileSaveStatus.className = 'form-status';
        profileSaveStatus.textContent = '';
      }, 3000);
    }

    showToast('Profile Data Synced', 'lime');
    hideAllSubviews();
  });
}

/* ── Settings Logic ────────────────────── */

function readSettings() {
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function writeSettings(data) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(data)); } catch (e) {}
}

/* ── Feature 1: Weight Unit ────────────── */

function applyWeightUnitUI() {
  var s = readSettings();
  var isLbs = s.weightUnit === 'lbs';
  if (toggleWeightUnit) toggleWeightUnit.setAttribute('aria-checked', isLbs ? 'true' : 'false');
  if (toggleUnitLabel) {
    toggleUnitLabel.textContent = isLbs ? 'LBS' : 'KG';
    toggleUnitLabel.classList.toggle('active', isLbs);
  }
}

function bindWeightUnit() {
  if (!toggleWeightUnit || toggleWeightUnit._bound) return;
  toggleWeightUnit._bound = true;
  toggleWeightUnit.addEventListener('click', function () {
    var s = readSettings();
    var isLbs = s.weightUnit === 'lbs';
    s.weightUnit = isLbs ? 'kg' : 'lbs';
    writeSettings(s);
    applyWeightUnitUI();
    showToast(s.weightUnit === 'lbs' ? 'Switched to LBS' : 'Switched to KG');
  });
}

/* ── Feature 2: Timer Alerts ───────────── */

function applyTimerAlertsUI() {
  var s = readSettings();
  var on = s.timerAlerts === true;
  if (toggleTimerAlerts) toggleTimerAlerts.setAttribute('aria-checked', on ? 'true' : 'false');
}

function bindTimerAlerts() {
  if (!toggleTimerAlerts || toggleTimerAlerts._bound) return;
  toggleTimerAlerts._bound = true;
  toggleTimerAlerts.addEventListener('click', function () {
    var s = readSettings();
    s.timerAlerts = !s.timerAlerts;
    writeSettings(s);
    applyTimerAlertsUI();
    if (s.timerAlerts) playTimerAlert();
    showToast(s.timerAlerts ? 'Timer Alerts Enabled' : 'Timer Alerts Disabled');
  });
}

function playTimerAlert() {
  var s = readSettings();
  if (s.timerAlerts !== true) return;

  /* haptic vibration */
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }

  /* audio beep via Web Audio API */
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

/* ── Feature 3: Keep Screen Awake ──────── */

var wakeLock = null;

function applyWakeLockUI() {
  var s = readSettings();
  var on = s.keepAwake === true;
  if (toggleWakeLock) toggleWakeLock.setAttribute('aria-checked', on ? 'true' : 'false');
}

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', function () { wakeLock = null; });
  } catch (e) { wakeLock = null; }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

function bindWakeLock() {
  if (!toggleWakeLock || toggleWakeLock._bound) return;
  toggleWakeLock._bound = true;
  toggleWakeLock.addEventListener('click', async function () {
    var s = readSettings();
    s.keepAwake = !s.keepAwake;
    writeSettings(s);

    if (s.keepAwake) {
      await requestWakeLock();
      showToast('Screen will stay awake');
    } else {
      releaseWakeLock();
      showToast('Screen sleep restored');
    }
    applyWakeLockUI();
  });

  /* re-acquire lock when user returns to tab */
  document.addEventListener('visibilitychange', async function () {
    var s = readSettings();
    if (s.keepAwake === true && document.visibilityState === 'visible' && !wakeLock) {
      await requestWakeLock();
    }
  });
}

function restoreWakeLock() {
  var s = readSettings();
  if (s.keepAwake === true && 'wakeLock' in navigator) {
    requestWakeLock();
  }
}

/* ── Feature 4: Accent Color ───────────── */

function applyAccentColor(hex) {
  if (!hex) return;
  var r = document.documentElement;
  r.style.setProperty('--accent-cyan', hex);
  r.style.setProperty('--accent-cyan-dim', hexToRgba(hex, 0.12));
  r.style.setProperty('--accent-cyan-glow', hexToRgba(hex, 0.25));
}

function applySavedAccent() {
  try {
    var saved = localStorage.getItem(ACCENT_KEY);
    if (saved) applyAccentColor(saved);
  } catch (e) {}
}

function highlightActiveSwatch() {
  if (!accentColorSelector) return;
  var current = '';
  try { current = localStorage.getItem(ACCENT_KEY) || ''; } catch (e) {}

  accentColorSelector.querySelectorAll('.color-swatch').forEach(function (sw) {
    sw.classList.toggle('active', sw.dataset.color.toUpperCase() === current.toUpperCase());
  });
}

function bindAccentColor() {
  if (!accentColorSelector || accentColorSelector._bound) return;
  accentColorSelector._bound = true;
  accentColorSelector.addEventListener('click', function (e) {
    var sw = e.target.closest('.color-swatch');
    if (!sw) return;
    var hex = sw.dataset.color;
    try { localStorage.setItem(ACCENT_KEY, hex); } catch (e) {}
    applyAccentColor(hex);
    highlightActiveSwatch();
    showToast('Accent: ' + (sw.dataset.name || 'Custom'));
  });
}

function hexToRgba(hex, alpha) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var r = parseInt(h.substring(0, 2), 16);
  var g = parseInt(h.substring(2, 4), 16);
  var b = parseInt(h.substring(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/* ── Settings Refresh ──────────────────── */

function refreshSettingsUI() {
  applyWeightUnitUI();
  applyTimerAlertsUI();
  applyWakeLockUI();
  highlightActiveSwatch();
}

function bindSettings() {
  bindWeightUnit();
  bindTimerAlerts();
  bindWakeLock();
  bindAccentColor();
}

/* ── Privacy Logic ─────────────────────── */

function bindPrivacy() {
  bindExport();
  bindImport();
  bindSecureWipe();
}

/* ── Export: Blob + programmatic download ── */

function bindExport() {
  if (!btnDownloadBackup || btnDownloadBackup._bound) return;
  btnDownloadBackup._bound = true;
  btnDownloadBackup.addEventListener('click', function () {
    var data = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
    } catch (e) {
      showToast('Export failed', 'danger');
      return;
    }

    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = 'forge-fitness-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(function () { URL.revokeObjectURL(url); }, 100);
    showToast('Backup downloaded', 'lime');
  });
}

/* ── Import: FileReader + localStorage restore ── */

function bindImport() {
  if (!btnImportBackup || btnImportBackup._bound) return;
  btnImportBackup._bound = true;

  btnImportBackup.addEventListener('click', function () {
    if (importBackupFile) importBackupFile.click();
  });

  if (!importBackupFile || importBackupFile._bound) return;
  importBackupFile._bound = true;

  importBackupFile.addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      var parsed;
      try {
        parsed = JSON.parse(e.target.result);
      } catch (err) {
        showToast('Invalid backup file', 'danger');
        return;
      }

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        showToast('Invalid backup format', 'danger');
        return;
      }

      try {
        Object.keys(parsed).forEach(function (key) {
          localStorage.setItem(key, parsed[key]);
        });
      } catch (err) {
        showToast('Import failed: storage full', 'danger');
        return;
      }

      showToast('Backup Restored Successfully', 'lime');
      setTimeout(function () { location.reload(); }, 800);
    };

    reader.onerror = function () {
      showToast('Failed to read file', 'danger');
    };

    reader.readAsText(file);
    importBackupFile.value = '';
  });
}

/* ── Secure Wipe: strict "DELETE" prompt ── */

function bindSecureWipe() {
  if (!btnDeleteAll || btnDeleteAll._bound) return;
  btnDeleteAll._bound = true;
  btnDeleteAll.addEventListener('click', function () {
    var input = window.prompt(
      'PERMANENT DELETION\n\n' +
      'This will erase ALL workout history, profile data, settings, and routines.\n' +
      'This cannot be undone.\n\n' +
      'Type DELETE to confirm:'
    );

    if (input !== 'DELETE') {
      if (input !== null) showToast('Deletion cancelled', 'danger');
      return;
    }

    try { localStorage.clear(); } catch (e) {}

    showToast('System Wiped', 'danger', 1200);
    setTimeout(function () { location.reload(); }, 1000);
  });
}

/* ── Toast Utility ─────────────────────── */

function showToast(msg, type, duration) {
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();

  var t = document.createElement('div');
  t.className = 'toast';
  if (type === 'danger') t.className += ' danger';
  else if (type === 'lime') t.className += ' lime';
  t.textContent = msg;
  document.body.appendChild(t);

  var ms = duration || 1800;
  setTimeout(function () {
    t.classList.add('out');
    setTimeout(function () { t.remove(); }, 300);
  }, ms);
}

/* ── Main Refresh ──────────────────────── */

function refresh() {
  cacheDom();
  var history = readHistory();

  /* init sub-view refs (once) */
  if (!subViews['edit-profile'].el) {
    subViews['edit-profile'].el = profileEdit;
    subViews['settings'].el     = profileSettings;
    subViews['privacy'].el      = profilePrivacy;
  }

  /* ensure main profile is visible (not stuck in a sub-view) */
  if (profileMain) profileMain.style.display = '';
  Object.keys(subViews).forEach(function (k) {
    if (subViews[k].el) subViews[k].el.style.display = 'none';
  });

  applyProfileToHero();
  loadProfileForm();
  refreshSettingsUI();

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

  renderTrophyRoom(history);
  renderWeeklyChart(history);
  bindEmptyButton();
  bindSubViewRouting();
  bindEditProfile();
  bindSettings();
  bindPrivacy();
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

window.ForgeProfile = {
  refresh: refresh,
  getWeightUnit: function () {
    var s = readSettings();
    return s.weightUnit || 'kg';
  },
  getAppUnit: function () {
    var s = readSettings();
    return s.weightUnit || 'kg';
  },
  playTimerAlert: playTimerAlert
};

/* ── Apply saved accent color immediately (safe at module scope) ── */
applySavedAccent();

export { refresh };
