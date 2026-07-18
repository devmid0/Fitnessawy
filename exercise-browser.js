/* ============================================
   FORGE — Exercise Browser
   Fetches 1,324 exercises from GitHub,
   renders muscle grid + paginated exercise list.
   ============================================ */

(function () {
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

  var MUSCLE_VIS = {
    'upper arms':   { icon: '💪', color: 'var(--accent-cyan)' },
    'upper legs':   { icon: '🦵', color: 'var(--accent-lime)' },
    'back':         { icon: '🔙', color: '#A078FF' },
    'waist':        { icon: '🔥', color: '#FF6B6B' },
    'chest':        { icon: '🫁', color: 'var(--accent-cyan)' },
    'shoulders':    { icon: '🎯', color: 'var(--accent-lime)' },
    'lower legs':   { icon: '🦿', color: '#A078FF' },
    'lower arms':   { icon: '🤝', color: '#FFB84D' },
    'cardio':       { icon: '❤️', color: '#FF6B6B' },
    'neck':         { icon: '🦒', color: '#FFB84D' }
  };

  var DEFAULT_VIS = { icon: '⚡', color: 'var(--accent-cyan)' };

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
    btnFabStart.addEventListener('click', onStartWorkout);
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
      var vis = MUSCLE_VIS[m] || DEFAULT_VIS;
      var count = muscleGroups[m].length;
      var label = capitalize(m);

      html += '<div class="muscle-card" data-muscle="' + esc(m) + '">';
      html += '<div class="muscle-card-icon" style="background:' + vis.color + '15;color:' + vis.color + '">' + vis.icon + '</div>';
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

  function deleteRoutine(index, e) {
    e.stopPropagation();
    var routines = readRoutines();
    if (index < 0 || index >= routines.length) return;
    routines.splice(index, 1);
    writeRoutines(routines);
    renderMyRoutines();
  }

  function loadRoutine(index) {
    var routines = readRoutines();
    var routine = routines[index];
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
          target: match.target || '',
          equipment: match.equipment || '',
          body_part: match.body_part || match.category || '',
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

    routines.forEach(function (r, i) {
      html += '<div class="mr-card" data-routine="' + i + '">';
      html += '<button class="mr-card-delete" data-delete="' + i + '" title="Delete routine">';
      html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      html += '</button>';
      html += '<div class="mr-card-icon">';
      html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
      html += '</div>';
      html += '<span class="mr-card-name">' + esc(r.name) + '</span>';
      html += '<span class="mr-card-count">' + r.exercises.length + ' exercises</span>';
      html += '</div>';
    });

    html += '</div>';
    myRoutines.innerHTML = html;

    myRoutines.querySelector('.mr-scroll').addEventListener('click', function (e) {
      var delBtn = e.target.closest('.mr-card-delete');
      if (delBtn) {
        deleteRoutine(+delBtn.dataset.delete, e);
        return;
      }
      var card = e.target.closest('.mr-card');
      if (card) loadRoutine(+card.dataset.routine);
    });
  }

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

  /* ── Public API ────────────────────────── */

  function init() {
    cacheDom();
    bindEvents();
    renderMyRoutines();
    if (!allExercises.length) fetchExercises();
  }

  window.ForgeBrowser = {
    init: init,
    isLoaded: function () { return allExercises.length > 0; },
    resetSelection: resetWorkoutSelectionUI
  };

  /* ── Boot ──────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      cacheDom();
      bindEvents();
      renderMyRoutines();
      fetchExercises();
    });
  } else {
    cacheDom();
    bindEvents();
    renderMyRoutines();
    fetchExercises();
  }

})();
