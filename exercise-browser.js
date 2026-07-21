/* ============================================
   Fitnessawy — Exercise Browser
   Fetches 1,324 exercises from JSON,
   renders muscle grid + paginated exercise list.
   ============================================ */

'use strict';

var DATA_URL = './assets/data/exercises.json';
var MEDIA_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';
var PAGE_SIZE = 30;

/* ── State ─────────────────────────────── */

var allExercises = [];
var muscleGroups = {};
var muscles = [];
var selectedMuscle = null;
var selectedExercises = [];
var filteredExercises = [];
var renderedCount = 0;
var observer = null;

/* ── Muscle Visuals ────────────────────── */

var anatomicalIconsMap = {
  'Upper Arms': './icons/biceps.png',
  'Upper Legs': './icons/upper leg.png',
  'Back':       './icons/back.png',
  'Waist':      './icons/core.png',
  'Chest':      './icons/chest.png',
  'Shoulders':  './icons/shoulder.png',
  'Lower Legs': './icons/lower leg.png',
  'Lower Arms': './icons/forearm.png',
  'Cardio':     './icons/treadmill.png',
  'Neck':       './icons/neck.png'
};

var DEFAULT_VIS = { color: 'var(--accent-cyan)' };

/* ── DOM refs ──────────────────────────── */

var exLoading, exError, muscleGrid, exerciseList;
var exListTitle, exListCount, exListContainer, exSentinel;
var exSearchInput, btnExBack, btnRetryLoad;
var workoutFab, fabCount, btnFabStart, btnSaveRoutine;
var myRoutines;
var routineModal, routineNameInput, modalCancel, modalSave;

function cacheDom() {
  exLoading       = document.getElementById('exLoading');
  exError         = document.getElementById('exError');
  muscleGrid      = document.getElementById('muscleGrid');
  exerciseList    = document.getElementById('exerciseList');
  exListTitle     = document.getElementById('exListTitle');
  exListCount     = document.getElementById('exListCount');
  exListContainer = document.getElementById('exListContainer');
  exSentinel      = document.getElementById('exSentinel');
  exSearchInput   = document.getElementById('exSearchInput');
  btnExBack       = document.getElementById('btnExBack');
  btnRetryLoad    = document.getElementById('btnRetryLoad');
  workoutFab      = document.getElementById('workoutFab');
  fabCount        = document.getElementById('fabCount');
  btnFabStart     = document.getElementById('btnFabStart');
  btnSaveRoutine  = document.getElementById('btnSaveRoutine');
  myRoutines      = document.getElementById('myRoutines');
  routineModal    = document.getElementById('routineModal');
  routineNameInput = document.getElementById('routineNameInput');
  modalCancel     = document.getElementById('modalCancel');
  modalSave       = document.getElementById('modalSave');
}

/* ── Events ────────────────────────────── */

function bindEvents() {
  btnExBack.addEventListener('click', showMuscleGrid);
  btnRetryLoad.addEventListener('click', fetchExercises);
  exSearchInput.addEventListener('input', onSearch);
  btnSaveRoutine.addEventListener('click', openSaveModal);
  modalCancel.addEventListener('click', closeModal);
  modalSave.addEventListener('click', confirmSaveRoutine);
  routineNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') confirmSaveRoutine();
    if (e.key === 'Escape') closeModal();
  });
  routineModal.addEventListener('click', function (e) {
    if (e.target === routineModal) closeModal();
  });
}

/* ── Fetch ─────────────────────────────── */

function pulseEntrance(el) {
  el.classList.remove('ex-entrance');
  void el.offsetWidth;
  el.classList.add('ex-entrance');
}

function showError(msg) {
  exLoading.style.display = 'none';
  exError.querySelector('p').textContent = msg;
  exError.style.display = '';
  if (myRoutines) myRoutines.style.display = 'none';
  muscleGrid.style.display = 'none';
  exerciseList.style.display = 'none';
  workoutFab.style.display = 'none';
}

function fetchExercises() {
  exError.style.display = 'none';

  fetch(DATA_URL)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      allExercises = data;
      parseAndGroup();
      pulseEntrance(muscleGrid);
      showMuscleGrid();
    })
    .catch(function () {
      showError('SYSTEM HALTED: Could not locate database at /assets/data/exercises.json');
    });
}

/* ── Parse & Group ─────────────────────── */

function parseAndGroup() {
  muscleGroups = {};

  allExercises.forEach(function (ex) {
    var cat = (ex.body_part || ex.category || 'other').toLowerCase().trim();
    if (!muscleGroups[cat]) muscleGroups[cat] = [];
    muscleGroups[cat].push(ex);
  });

  muscles = Object.keys(muscleGroups).sort(function (a, b) {
    return muscleGroups[b].length - muscleGroups[a].length;
  });
}

/* ── Muscle Grid ───────────────────────── */

function showMuscleGrid() {
  selectedMuscle = null;
  exLoading.style.display = 'none';
  exError.style.display = 'none';
  if (myRoutines) renderMyRoutines();
  if (myRoutines) myRoutines.style.display = '';
  muscleGrid.style.display = '';
  exerciseList.style.display = 'none';
  workoutFab.style.display = 'none';
  destroyObserver();

  var html = '';
  muscles.forEach(function (m) {
    var src = anatomicalIconsMap[capitalize(m)];
    var count = muscleGroups[m].length;
    var label = capitalize(m);

    html += '<div class="muscle-card" data-muscle="' + esc(m) + '">';
    html += '<div class="muscle-card-icon">';
    if (src) {
      html += '<img src="' + esc(src) + '" alt="' + esc(label) + '" class="custom-muscle-icon" onerror="this.style.display=\'none\'">';
    }
    html += '</div>';
    html += '<span class="muscle-card-count">' + count + ' exercises</span>';
    html += '<span class="muscle-card-name">' + esc(label) + '</span>';
    html += '</div>';
  });

  muscleGrid.innerHTML = html;
  muscleGrid.onclick = onMuscleClick;
}

function onMuscleClick(e) {
  var card = e.target.closest('.muscle-card');
  if (!card) return;
  showExerciseList(card.dataset.muscle);
}

/* ── Exercise List ─────────────────────── */

function showExerciseList(muscle) {
  selectedMuscle = muscle;
  if (myRoutines) myRoutines.style.display = 'none';
  muscleGrid.style.display = 'none';
  exerciseList.style.display = '';
  updateFab();

  exListTitle.textContent = capitalize(muscle);
  filteredExercises = muscleGroups[muscle] || [];
  exListCount.textContent = filteredExercises.length + ' exercises';

  renderedCount = 0;
  exListContainer.innerHTML = '';
  exSearchInput.value = '';
  exSearchInput.focus();

  renderBatch();
  setupObserver();
}

function onSearch() {
  var q = exSearchInput.value.toLowerCase().trim();

  if (q) {
    filteredExercises = (muscleGroups[selectedMuscle] || []).filter(function (ex) {
      return ex.name.toLowerCase().indexOf(q) !== -1 ||
             (ex.equipment || '').toLowerCase().indexOf(q) !== -1 ||
             (ex.target || '').toLowerCase().indexOf(q) !== -1;
    });
  } else {
    filteredExercises = muscleGroups[selectedMuscle] || [];
  }

  exListCount.textContent = filteredExercises.length + ' exercises';
  renderedCount = 0;
  exListContainer.innerHTML = '';
  renderBatch();
  destroyObserver();
  setupObserver();
}

/* ── Batch Rendering (30 per frame) ────── */

function renderBatch() {
  var start = renderedCount;
  var end = Math.min(start + PAGE_SIZE, filteredExercises.length);
  var frag = document.createDocumentFragment();

  for (var i = start; i < end; i++) {
    frag.appendChild(createExCard(filteredExercises[i]));
  }

  exListContainer.appendChild(frag);
  renderedCount = end;
}

var FALLBACK_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MiIgaGVpZ2h0PSI1MiIgdmlld0JveD0iMCAwIDUyIDUyIj48cmVjdCB3aWR0aD0iNTIiIGhlaWdodD0iNTIiIHJ4PSI2IiBmaWxsPSIjMTQxNDE0Ii8+PHRleHQgeD0iMjYiIHk9IjMyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNDQ0IiBmb250LXNpemU9IjIwIj7imqE8L3RleHQ+PC9zdmc+';

function createExCard(ex) {
  var div = document.createElement('div');
  div.className = 'ex-card';
  div.dataset.id = ex.id;

  var isAdded = selectedExercises.some(function (s) { return s.id === ex.id; });
  var imgSrc = ex.gif_url ? (MEDIA_BASE + ex.gif_url) : (ex.image ? (MEDIA_BASE + ex.image) : '');

  var html = '';
  if (imgSrc) {
    html += '<img class="ex-card-thumb" src="' + esc(imgSrc) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + FALLBACK_SVG + '\';this.classList.add(\'ex-card-fallback\')">';
  } else {
    html += '<div class="ex-card-thumb ex-card-fallback"></div>';
  }

  html += '<div class="ex-card-info">';
  html += '<div class="ex-card-name">' + esc(ex.name) + '</div>';
  html += '<div class="ex-card-meta">';
  if (ex.equipment) html += '<span class="ex-card-tag">' + esc(ex.equipment) + '</span>';
  if (ex.target) html += '<span class="ex-card-tag">' + esc(ex.target) + '</span>';
  html += '</div>';
  html += '</div>';

  html += '<button class="ex-card-add' + (isAdded ? ' added' : '') + '" data-id="' + esc(ex.id) + '" title="Add to workout">';
  html += isAdded
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  html += '</button>';

  div.innerHTML = html;
  div.querySelector('.ex-card-add').addEventListener('click', function (e) {
    e.stopPropagation();
    toggleExercise(ex, this);
  });

  return div;
}

/* ── Infinite Scroll (IntersectionObserver) */

function setupObserver() {
  destroyObserver();

  if (!('IntersectionObserver' in window)) {
    /* fallback: just render all */
    while (renderedCount < filteredExercises.length) renderBatch();
    return;
  }

  observer = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting && renderedCount < filteredExercises.length) {
      renderBatch();
    }
  }, { root: document.getElementById('workoutScroll'), rootMargin: '200px' });

  observer.observe(exSentinel);
}

function destroyObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}

/* ── Custom Routines (localStorage) ──── */

var ROUTINES_KEY = 'customRoutines';

function readRoutines() {
  try {
    var raw = localStorage.getItem(ROUTINES_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeRoutines(list) {
  try {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(list));
  } catch (e) { /* quota exceeded — silently fail */ }
}

function openSaveModal() {
  if (!selectedExercises.length) return;
  routineNameInput.value = '';
  routineModal.style.display = '';
  setTimeout(function () { routineNameInput.focus(); }, 100);
}

function closeModal() {
  routineModal.style.display = 'none';
}

function confirmSaveRoutine() {
  var name = routineNameInput.value.trim();
  if (!name) {
    routineNameInput.focus();
    return;
  }

  var routine = {
    id: Date.now() + '_custom',
    name: name,
    exercises: selectedExercises.map(function (ex) {
      return { name: ex.name, targetSets: ex.targetSets, targetReps: ex.targetReps };
    })
  };

  var routines = readRoutines();
  routines.unshift(routine);
  writeRoutines(routines);

  closeModal();
  renderMyRoutines();
}

function deleteRoutine(id) {
  var routines = readRoutines();
  routines = routines.filter(function (r) { return r.id !== id; });
  writeRoutines(routines);
  renderMyRoutines();
}

function loadRoutine(id) {
  var routines = readRoutines();
  var routine = routines.find(function (r) { return r.id === id; });
  if (!routine || !routine.exercises.length) return;

  selectedExercises = [];

  routine.exercises.forEach(function (t) {
    var match = allExercises.find(function (ex) {
      return ex.name.toLowerCase() === t.name.toLowerCase();
    });
    if (match) {
      selectedExercises.push({
        id: match.id,
        name: match.name,
        gif_url: match.gif_url || '',
        target: match.target || '',
        equipment: match.equipment || '',
        body_part: match.body_part || match.category || '',
        targetSets: t.targetSets,
        targetReps: t.targetReps
      });
    } else {
      selectedExercises.push({
        id: t.id || ('sel_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
        name: t.name,
        gif_url: t.gifUrl || '',
        target: t.target || '',
        equipment: '',
        body_part: t.bodyPart || '',
        targetSets: t.targetSets,
        targetReps: t.targetReps
      });
    }
  });

  document.querySelectorAll('.ex-card-add.added').forEach(function (btn) {
    btn.classList.remove('added');
    btn.innerHTML = SVG_PLUS;
  });

  selectedExercises.forEach(function (sel) {
    var card = exListContainer.querySelector('.ex-card[data-id="' + sel.id + '"]');
    if (card) {
      var btn = card.querySelector('.ex-card-add');
      if (btn) {
        btn.classList.add('added');
        btn.innerHTML = SVG_CHECK;
      }
    }
  });

  updateFab();
}

function renderMyRoutines() {
  if (!myRoutines) return;
  var routines = readRoutines();

  if (!routines.length) {
    myRoutines.innerHTML = '';
    myRoutines.style.display = 'none';
    return;
  }

  myRoutines.style.display = '';
  var html = '<h3 class="mr-title">My Routines</h3><div class="mr-scroll">';

  routines.forEach(function (r) {
    html += '<div class="mr-card" data-routine="' + r.id + '">';
    html += '<button class="mr-card-delete" data-delete="' + r.id + '" title="Delete routine">';
    html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    html += '</button>';
    html += '<div class="mr-card-icon">';
    html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
    html += '</div>';
    html += '<span class="mr-card-name">' + esc(r.name) + '</span>';
    html += `<span class="mr-card-count">${r.exercises ? r.exercises.length : 0} EXERCISES</span>`;
    html += '</div>';
  });

  html += '</div>';
  myRoutines.innerHTML = html;
}

document.body.addEventListener('click', function (e) {
  var delBtn = e.target.closest('.mr-card-delete');
  if (delBtn) {
    deleteRoutine(delBtn.dataset.delete);
    return;
  }
  var card = e.target.closest('.mr-card');
  if (card) loadRoutine(card.dataset.routine);
});

/* ── Add / Remove Exercise ─────────────── */

var SVG_PLUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
var SVG_CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';

function toggleExercise(ex, btn) {
  var isSelected = selectedExercises.some(function (s) { return s.id === ex.id; });

  if (isSelected) {
    selectedExercises = selectedExercises.filter(function (s) { return s.id !== ex.id; });
    btn.classList.remove('added');
    btn.innerHTML = SVG_PLUS;
  } else {
    selectedExercises.push({
      id: ex.id,
      name: ex.name,
      gif_url: ex.gif_url || '',
      target: ex.target || '',
      equipment: ex.equipment || '',
      body_part: ex.body_part || ex.category || '',
      targetSets: 3,
      targetReps: 10
    });
    btn.classList.add('added');
    btn.innerHTML = SVG_CHECK;
  }

  updateFab();
}

function updateFab() {
  if (selectedExercises.length > 0) {
    workoutFab.style.display = '';
    fabCount.textContent = selectedExercises.length;
  } else {
    workoutFab.style.display = 'none';
  }
}

/* ── Start Workout ─────────────────────── */

function onStartWorkout() {
  if (!selectedExercises.length) return;
  if (!window.ForgeLogger) return;

  var plan = {
    name: capitalize(selectedMuscle || 'Custom') + ' Workout',
    exercises: selectedExercises.map(function (ex) {
      return { name: ex.name, targetSets: ex.targetSets, targetReps: ex.targetReps };
    })
  };

  window.ForgeLogger.startWorkout(plan);
  selectedExercises = [];
  updateFab();

  if (window.ForgeApp) window.ForgeApp.switchView('progress');
}

/* ── Utils ─────────────────────────────── */

function capitalize(s) {
  return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ── Full Selection Reset ─────────────── */

function resetWorkoutSelectionUI() {
  selectedExercises = [];

  document.querySelectorAll('.ex-card-add.added').forEach(function (btn) {
    btn.classList.remove('added');
    btn.innerHTML = SVG_PLUS;
  });

  if (workoutFab) {
    workoutFab.style.display = 'none';
  }
  if (fabCount) {
    fabCount.textContent = '0';
  }
}

/* ── Routine Wizard — AI-Less Decision Engine ── */

var WIZARD_TEMPLATES = {
  '6 Days': {
    name: 'Push / Pull / Legs',
    days: [
      { label: 'Push', exercises: [
        { name: 'Barbell Bench Press', targetSets: 4, targetReps: 10 },
        { name: 'Overhead Press', targetSets: 3, targetReps: 10 },
        { name: 'Incline Dumbbell Fly', targetSets: 3, targetReps: 12 },
        { name: 'Tricep Rope Pushdown', targetSets: 3, targetReps: 12 }
      ]},
      { label: 'Pull', exercises: [
        { name: 'Barbell Bent Over Row', targetSets: 4, targetReps: 10 },
        { name: 'Lat Pulldown', targetSets: 3, targetReps: 12 },
        { name: 'Barbell Curl', targetSets: 3, targetReps: 12 },
        { name: 'Lateral Raise', targetSets: 3, targetReps: 15 }
      ]},
      { label: 'Legs', exercises: [
        { name: 'Barbell Squat', targetSets: 4, targetReps: 8 },
        { name: 'Romanian Deadlift', targetSets: 3, targetReps: 10 },
        { name: 'Leg Extension', targetSets: 3, targetReps: 12 },
        { name: 'Chest Dip', targetSets: 3, targetReps: 10 }
      ]}
    ]
  },
  '4 Days': {
    name: 'Upper / Lower',
    days: [
      { label: 'Upper Body', exercises: [
        { name: 'Barbell Bench Press', targetSets: 4, targetReps: 10 },
        { name: 'Barbell Bent Over Row', targetSets: 4, targetReps: 10 },
        { name: 'Overhead Press', targetSets: 3, targetReps: 10 },
        { name: 'Barbell Curl', targetSets: 3, targetReps: 12 }
      ]},
      { label: 'Lower Body', exercises: [
        { name: 'Barbell Squat', targetSets: 4, targetReps: 8 },
        { name: 'Romanian Deadlift', targetSets: 3, targetReps: 10 },
        { name: 'Leg Extension', targetSets: 3, targetReps: 12 },
        { name: 'Lateral Raise', targetSets: 3, targetReps: 15 }
      ]}
    ]
  },
  '3 Days': {
    name: 'Full Body',
    days: [
      { label: 'Full Body Day 1', exercises: [
        { name: 'Barbell Bench Press', targetSets: 3, targetReps: 10 },
        { name: 'Barbell Squat', targetSets: 3, targetReps: 10 },
        { name: 'Barbell Bent Over Row', targetSets: 3, targetReps: 10 },
        { name: 'Barbell Curl', targetSets: 3, targetReps: 12 }
      ]},
      { label: 'Full Body Day 2', exercises: [
        { name: 'Overhead Press', targetSets: 3, targetReps: 10 },
        { name: 'Romanian Deadlift', targetSets: 3, targetReps: 10 },
        { name: 'Lat Pulldown', targetSets: 3, targetReps: 12 },
        { name: 'Leg Extension', targetSets: 3, targetReps: 12 }
      ]},
      { label: 'Full Body Day 3', exercises: [
        { name: 'Barbell Squat', targetSets: 3, targetReps: 10 },
        { name: 'Barbell Curl', targetSets: 3, targetReps: 12 },
        { name: 'Leg Extension', targetSets: 3, targetReps: 12 },
        { name: 'Lateral Raise', targetSets: 3, targetReps: 15 }
      ]}
    ]
  }
};

/* ── Local Routine Generation ─────────── */

function pickRandom(arr, count) {
  var shuffled = arr.slice().sort(function () { return 0.5 - Math.random(); });
  return shuffled.slice(0, count);
}

function generateWizardRoutine(frequency, goal, experience) {
  var template = WIZARD_TEMPLATES[frequency];
  if (!template) return null;

  var suffix = '';
  if (goal === 'Lose Fat') suffix += ' — Fat Loss';
  else if (goal === 'Strength') suffix += ' — Strength';
  if (experience === 'Beginner') suffix += ' (Beginner)';
  else if (experience === 'Advanced') suffix += ' (Advanced)';

  var exerciseMeta = {
    'Barbell Bench Press':     { bodyPart: 'chest',      target: 'pectorals',      gifUrl: './assets/data/exercises.json' },
    'Overhead Press':          { bodyPart: 'shoulders',  target: 'delts',           gifUrl: './assets/data/exercises.json' },
    'Incline Dumbbell Fly':    { bodyPart: 'chest',      target: 'pectorals',       gifUrl: './assets/data/exercises.json' },
    'Tricep Rope Pushdown':    { bodyPart: 'upper arms', target: 'triceps',         gifUrl: './assets/data/exercises.json' },
    'Barbell Bent Over Row':   { bodyPart: 'back',       target: 'upper back',      gifUrl: './assets/data/exercises.json' },
    'Lat Pulldown':            { bodyPart: 'back',       target: 'lats',            gifUrl: './assets/data/exercises.json' },
    'Barbell Curl':            { bodyPart: 'upper arms', target: 'biceps',          gifUrl: './assets/data/exercises.json' },
    'Lateral Raise':           { bodyPart: 'shoulders',  target: 'delts',           gifUrl: './assets/data/exercises.json' },
    'Barbell Squat':           { bodyPart: 'upper legs', target: 'quadriceps',      gifUrl: './assets/data/exercises.json' },
    'Romanian Deadlift':       { bodyPart: 'upper legs', target: 'hamstrings',      gifUrl: './assets/data/exercises.json' },
    'Leg Extension':           { bodyPart: 'upper legs', target: 'quadriceps',      gifUrl: './assets/data/exercises.json' },
    'Chest Dip':               { bodyPart: 'chest',      target: 'pectorals',       gifUrl: './assets/data/exercises.json' }
  };

  if (frequency === '4 Days') {
    var pushPool = allExercises.filter(function (ex) {
      var bp = (ex.body_part || '').toLowerCase();
      var tgt = (ex.target || '').toLowerCase();
      return bp === 'chest' || bp === 'shoulders' || (bp === 'upper arms' && tgt === 'triceps');
    });
    var pullPool = allExercises.filter(function (ex) {
      var bp = (ex.body_part || '').toLowerCase();
      var tgt = (ex.target || '').toLowerCase();
      return bp === 'back' || (bp === 'upper arms' && tgt === 'biceps');
    });
    var legPool = allExercises.filter(function (ex) {
      var bp = (ex.body_part || '').toLowerCase();
      return bp === 'upper legs' || bp === 'lower legs' || bp === 'cardio';
    });

    var pushPicks = pickRandom(pushPool, 4);
    var pullPicks = pickRandom(pullPool, 4);
    var legPicks = pickRandom(legPool, 4);

    return [
      {
        id: 'rt_push_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: 'Push Day' + suffix,
        exercises: pushPicks.map(function (ex, i) {
          return {
            id: 'ex_push_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 8),
            name: ex.name,
            bodyPart: ex.body_part || ex.category || '',
            target: ex.target || '',
            gifUrl: ex.gif_url || '',
            equipment: ex.equipment || '',
            targetSets: 4,
            targetReps: 10
          };
        })
      },
      {
        id: 'rt_pull_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: 'Pull Day' + suffix,
        exercises: pullPicks.map(function (ex, i) {
          return {
            id: 'ex_pull_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 8),
            name: ex.name,
            bodyPart: ex.body_part || ex.category || '',
            target: ex.target || '',
            gifUrl: ex.gif_url || '',
            equipment: ex.equipment || '',
            targetSets: 4,
            targetReps: 10
          };
        })
      },
      {
        id: 'rt_leg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: 'Leg Day' + suffix,
        exercises: legPicks.map(function (ex, i) {
          return {
            id: 'ex_leg_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 8),
            name: ex.name,
            bodyPart: ex.body_part || ex.category || '',
            target: ex.target || '',
            gifUrl: ex.gif_url || '',
            equipment: ex.equipment || '',
            targetSets: 4,
            targetReps: 10
          };
        })
      }
    ];
  }

  var routines = [];
  template.days.forEach(function (day, index) {
    var freshExercises = [];
    var exList = day.exercises.slice(0, 4);
    for (var i = 0; i < exList.length; i++) {
      var src = exList[i];
      var meta = exerciseMeta[src.name] || { bodyPart: 'other', target: 'other', gifUrl: '' };
      freshExercises.push({
        id: 'ex_' + Date.now() + '_' + index + '_' + i + '_' + Math.random().toString(36).slice(2, 8),
        name: src.name,
        bodyPart: meta.bodyPart,
        target: meta.target,
        gifUrl: meta.gifUrl,
        targetSets: src.targetSets,
        targetReps: src.targetReps
      });
    }
    routines.push({
      id: 'rt_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 8),
      name: day.label + suffix,
      exercises: freshExercises
    });
  });

  return routines;
}

function initWizard() {
  var overlay = document.getElementById('routine-wizard-overlay');
  var form = document.getElementById('routine-wizard-form');
  var cancelBtn = document.getElementById('wizardCancelBtn');
  var startBtn = document.getElementById('btn-start-wizard');

  if (!overlay || !form || !cancelBtn || !startBtn) return;

  startBtn.addEventListener('click', function () {
    overlay.classList.add('open');
  });

  cancelBtn.addEventListener('click', function () {
    overlay.classList.remove('open');
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.classList.remove('open');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var experience = document.getElementById('wizExperience').value;
    var frequency = document.getElementById('wizFrequency').value;
    var goal = document.getElementById('wizGoal').value;

    var generatedRoutines = generateWizardRoutine(frequency, goal, experience);
    if (!generatedRoutines || !generatedRoutines.length) return;

    var routines = readRoutines();
    generatedRoutines.forEach(function (r) { routines.unshift(r); });
    writeRoutines(routines);

    console.log('[Wizard] Generated routines:', generatedRoutines);
    renderMyRoutines();
    overlay.classList.remove('open');

    if (window.ForgeDialog) {
      var names = generatedRoutines.map(function (r) { return r.name; }).join('", "');
      window.ForgeDialog.alert('Routine Generated', 'Your custom workouts ("' + names + '") have been generated!');
    }
  });
}

/* ── Public API ────────────────────────── */

function init() {
  cacheDom();
  bindEvents();
  renderMyRoutines();
  initWizard();
  if (!allExercises.length) fetchExercises();
}

window.ForgeBrowser = {
  init: init,
  isLoaded: function () { return allExercises.length > 0; },
  resetSelection: resetWorkoutSelectionUI,
  getSelectedCount: function () { return selectedExercises.length; },
  getSelectedExercises: function () { return selectedExercises.slice(); },
  startSelectedWorkout: onStartWorkout,
  renderRoutines: renderMyRoutines
};

export { init, resetWorkoutSelectionUI };
