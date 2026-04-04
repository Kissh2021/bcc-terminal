import { storage } from '../utils/storage.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';
import { soundManager } from '../core/soundManager.js';

// ── Storage ────────────────────────────────────────────────────────────────────

const DATA_KEY   = 'notes-data';
const LEGACY_KEY = 'notes'; // migrated on first load

function loadData() {
  // One-time migration from old flat notes array
  const legacy = storage.get(LEGACY_KEY, null);
  if (legacy !== null) {
    const page = makePage('PAGE 1', { notes: Array.isArray(legacy) ? legacy : [] });
    const data = { activePageId: page.id, pages: [page] };
    storage.set(DATA_KEY, data);
    storage.remove(LEGACY_KEY);
    return data;
  }
  const saved = storage.get(DATA_KEY, null);
  if (saved) return saved;
  const page = makePage('PAGE 1');
  return { activePageId: page.id, pages: [page] };
}

function saveData(data) {
  storage.set(DATA_KEY, data);
}

// ── Factories ──────────────────────────────────────────────────────────────────

function makePage(name, overrides = {}) {
  return { id: crypto.randomUUID(), name, notes: [], panX: 0, panY: 0, ...overrides };
}

function makeNote(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    content: '',
    x: 60 + Math.random() * 120,
    y: 60 + Math.random() * 80,
    w: 240,
    h: 180,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Export / Import ────────────────────────────────────────────────────────────

function exportNotes(notes) {
  const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), notes }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `bcc-notes-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importNotes(onSuccess, onError) {
  const input   = document.createElement('input');
  input.type    = 'file';
  input.accept  = '.json,application/json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const notes  = Array.isArray(parsed) ? parsed : (parsed.notes ?? null);
        if (!Array.isArray(notes)) throw new Error('Format invalide');
        onSuccess(notes.filter(n => n && typeof n.id === 'string'));
      } catch (err) {
        onError(err.message);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ── Z-index ────────────────────────────────────────────────────────────────────

let topZ = 10;
function bringToFront(el) { el.style.zIndex = ++topZ; }

// ── Drag (unclamped — infinite canvas) ────────────────────────────────────────

function makeDraggable(noteEl, noteData, onUpdate) {
  const header = noteEl.querySelector('.note-header');

  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('note-delete')) return;
    e.preventDefault();
    noteEl.classList.add('dragging');
    bringToFront(noteEl);

    // startX/Y encode the offset so that delta = new world position
    const startX = e.clientX - noteData.x;
    const startY = e.clientY - noteData.y;

    function onMove(e) {
      noteData.x = e.clientX - startX;
      noteData.y = e.clientY - startY;
      noteEl.style.left = noteData.x + 'px';
      noteEl.style.top  = noteData.y + 'px';
    }
    function onUp() {
      noteEl.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      onUpdate();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Touch support
  header.addEventListener('touchstart', (e) => {
    if (e.target.classList.contains('note-delete')) return;
    const t      = e.touches[0];
    const startX = t.clientX - noteData.x;
    const startY = t.clientY - noteData.y;

    function onMove(e) {
      const t    = e.touches[0];
      noteData.x = t.clientX - startX;
      noteData.y = t.clientY - startY;
      noteEl.style.left = noteData.x + 'px';
      noteEl.style.top  = noteData.y + 'px';
    }
    function onEnd() {
      header.removeEventListener('touchmove', onMove);
      header.removeEventListener('touchend', onEnd);
      onUpdate();
    }
    header.addEventListener('touchmove', onMove, { passive: true });
    header.addEventListener('touchend', onEnd);
  }, { passive: true });
}

// ── Resize watcher ─────────────────────────────────────────────────────────────

function watchResize(noteEl, noteData, onUpdate) {
  noteEl.addEventListener('mouseup', () => {
    const w = noteEl.offsetWidth;
    const h = noteEl.offsetHeight;
    if (w > 0 && h > 0 && (w !== noteData.w || h !== noteData.h)) {
      noteData.w = w;
      noteData.h = h;
      onUpdate();
    }
  });
}

// ── Rect overlap ───────────────────────────────────────────────────────────────

function rectsOverlap(sel, note) {
  return (
    sel.x < note.x + note.w &&
    sel.x + sel.w > note.x &&
    sel.y < note.y + note.h &&
    sel.y + sel.h > note.y
  );
}

// ── Note element ───────────────────────────────────────────────────────────────

function createNoteEl(noteData, onUpdate, onDelete) {
  const el = document.createElement('div');
  el.className    = 'note';
  el.style.left   = noteData.x + 'px';
  el.style.top    = noteData.y + 'px';
  el.style.width  = noteData.w + 'px';
  el.style.height = noteData.h + 'px';
  el.dataset.id   = noteData.id;

  el.innerHTML = `
    <div class="note-header">
      <span class="note-drag-dots">· · · · · · · ·</span>
      <button class="note-delete" title="Supprimer">✕</button>
    </div>
    <textarea class="note-textarea" placeholder="Note…" spellcheck="false"></textarea>
  `;

  const textarea = el.querySelector('.note-textarea');
  textarea.value = noteData.content;

  let saveTimer = null;
  textarea.addEventListener('input', () => {
    noteData.content = textarea.value;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(onUpdate, 300);
  });

  el.addEventListener('mousedown', () => bringToFront(el));

  el.querySelector('.note-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    soundManager.playBack();
    el.style.transition = 'opacity 0.15s ease';
    el.style.opacity    = '0';
    setTimeout(() => { el.remove(); onDelete(noteData.id); }, 150);
  });

  makeDraggable(el, noteData, onUpdate);
  watchResize(el, noteData, onUpdate);
  return el;
}

// ── Feedback toast ─────────────────────────────────────────────────────────────

function showFeedback(container, message) {
  container.querySelector('.notes-feedback')?.remove();
  const el = document.createElement('div');
  el.className   = 'notes-feedback';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ── Main mount ─────────────────────────────────────────────────────────────────

export function mountNotesView(container) {
  let data        = loadData();
  let selectedIds = new Set();

  // ── DOM ────────────────────────────────────────────────────────────────────────

  const view = document.createElement('div');
  view.id = 'notes-view';
  view.innerHTML = `
    <div class="notes-toolbar">
      <div class="notes-pages-bar" id="notes-pages-bar"></div>
      <div class="notes-toolbar-sep"></div>
      <span class="notes-toolbar-label">NOTES</span>
      <button class="notes-btn primary" id="notes-new">+ NOUVELLE</button>
      <button class="notes-btn" id="notes-export">EXPORTER TOUT</button>
      <button class="notes-btn" id="notes-import">IMPORTER</button>
      <span class="notes-sel-bar" id="notes-sel-bar">
        <span class="notes-sel-info" id="notes-sel-info"></span>
        <button class="notes-btn danger" id="notes-sel-delete">SUPPRIMER</button>
        <button class="notes-btn" id="notes-sel-export">EXPORTER</button>
        <button class="notes-btn dim" id="notes-sel-clear">✕ DÉSÉLECTIONNER</button>
      </span>
      <span class="notes-count" id="notes-count"></span>
    </div>
    <div class="notes-canvas" id="notes-canvas">
      <div class="canvas-world" id="canvas-world"></div>
    </div>
  `;
  container.appendChild(view);

  const canvas   = view.querySelector('#notes-canvas');
  const world    = view.querySelector('#canvas-world');
  const countEl  = view.querySelector('#notes-count');
  const selBar   = view.querySelector('#notes-sel-bar');
  const selInfo  = view.querySelector('#notes-sel-info');
  const pagesBar = view.querySelector('#notes-pages-bar');

  // ── Page helpers ───────────────────────────────────────────────────────────────

  function activePage() {
    return data.pages.find(p => p.id === data.activePageId) ?? data.pages[0];
  }

  // ── Pan ────────────────────────────────────────────────────────────────────────

  function applyPan() {
    const { panX, panY } = activePage();
    world.style.transform = `translate(${panX}px, ${panY}px)`;
  }

  // ── Selection ──────────────────────────────────────────────────────────────────

  function updateSelectionVisuals() {
    world.querySelectorAll('.note').forEach(el => {
      el.classList.toggle('selected', selectedIds.has(el.dataset.id));
    });
    const count = selectedIds.size;
    if (count > 0) {
      selInfo.textContent = `${count} SÉLECTIONNÉE${count > 1 ? 'S' : ''}`;
      selBar.classList.add('active');
    } else {
      selBar.classList.remove('active');
    }
  }

  function clearSelection() {
    selectedIds = new Set();
    updateSelectionVisuals();
  }

  // ── Persistence ────────────────────────────────────────────────────────────────

  function updateCount() {
    const n = activePage().notes.length;
    countEl.textContent = n + ' NOTE' + (n !== 1 ? 'S' : '');
  }

  function persist() {
    saveData(data);
    updateCount();
  }

  // ── Canvas rendering ───────────────────────────────────────────────────────────

  function addNote(noteData) {
    const page = activePage();
    const el = createNoteEl(
      noteData,
      persist,
      (id) => {
        page.notes = page.notes.filter(n => n.id !== id);
        selectedIds.delete(id);
        updateSelectionVisuals();
        persist();
      }
    );
    world.appendChild(el);
    bringToFront(el);
  }

  function renderPage() {
    world.innerHTML = '';
    selectedIds     = new Set();
    updateSelectionVisuals();
    applyPan();
    activePage().notes.forEach(addNote);
    updateCount();
    renderPageTabs();
  }

  // ── Page tabs ──────────────────────────────────────────────────────────────────

  function renderPageTabs() {
    pagesBar.innerHTML = '';

    data.pages.forEach((page) => {
      const isActive = page.id === data.activePageId;
      const tab = document.createElement('button');
      tab.className   = 'notes-page-tab' + (isActive ? ' active' : '');
      tab.dataset.id  = page.id;

      const label = document.createElement('span');
      label.textContent = page.name;
      tab.appendChild(label);

      // Delete button (hidden when only one page)
      if (data.pages.length > 1) {
        const del = document.createElement('span');
        del.className   = 'notes-page-del';
        del.textContent = '✕';
        del.title       = 'Supprimer cette page';
        del.addEventListener('click', (e) => { e.stopPropagation(); deletePage(page.id); });
        tab.appendChild(del);
      }

      tab.addEventListener('click', () => {
        if (page.id !== data.activePageId) switchPage(page.id);
      });
      pagesBar.appendChild(tab);
    });

    const addBtn = document.createElement('button');
    addBtn.className   = 'notes-page-add';
    addBtn.textContent = '+';
    addBtn.title       = 'Nouvelle page';
    addBtn.addEventListener('click', addPage);
    pagesBar.appendChild(addBtn);
  }

  // ── Page management ────────────────────────────────────────────────────────────

  function switchPage(pageId) {
    soundManager.playNavigate();
    data.activePageId = pageId;
    renderPage();
    persist();
  }

  function addPage() {
    soundManager.playNavigate();
    const page = makePage(`PAGE ${data.pages.length + 1}`);
    data.pages.push(page);
    data.activePageId = page.id;
    renderPage();
    persist();
  }

  function deletePage(pageId) {
    if (data.pages.length <= 1) return;
    soundManager.playBack();
    const idx = data.pages.findIndex(p => p.id === pageId);
    data.pages.splice(idx, 1);
    if (data.activePageId === pageId) {
      data.activePageId = data.pages[Math.max(0, idx - 1)].id;
    }
    renderPage();
    persist();
  }

  // ── Right-click canvas panning ─────────────────────────────────────────────────

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return;
    e.preventDefault();

    const page   = activePage();
    const startX = e.clientX - page.panX;
    const startY = e.clientY - page.panY;
    canvas.classList.add('panning');

    function onMove(e) {
      page.panX = e.clientX - startX;
      page.panY = e.clientY - startY;
      applyPan();
    }
    function onUp() {
      canvas.classList.remove('panning');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      persist();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ── Rubber-band selection (left click on canvas background) ────────────────────

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target !== canvas) return;
    e.preventDefault();

    const page       = activePage();
    const canvasRect = canvas.getBoundingClientRect();
    // Convert viewport coords to world coords (subtract pan)
    const startX = e.clientX - canvasRect.left - page.panX;
    const startY = e.clientY - canvasRect.top  - page.panY;
    let hasMoved = false;

    const selEl = document.createElement('div');
    selEl.className = 'selection-rect';
    world.appendChild(selEl);

    function onMove(ev) {
      hasMoved = true;
      const curX = ev.clientX - canvasRect.left - page.panX;
      const curY = ev.clientY - canvasRect.top  - page.panY;

      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const w = Math.abs(curX - startX);
      const h = Math.abs(curY - startY);

      selEl.style.left   = x + 'px';
      selEl.style.top    = y + 'px';
      selEl.style.width  = w + 'px';
      selEl.style.height = h + 'px';

      selectedIds = new Set();
      page.notes.forEach(note => {
        if (rectsOverlap({ x, y, w, h }, note)) selectedIds.add(note.id);
      });
      updateSelectionVisuals();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      selEl.remove();
      if (!hasMoved) clearSelection();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ── Toolbar: note actions ──────────────────────────────────────────────────────

  view.querySelector('#notes-new').addEventListener('click', () => {
    soundManager.playNavigate();
    clearSelection();
    const page = activePage();
    const note = makeNote();
    page.notes.push(note);
    persist();
    addNote(note);
    setTimeout(() => {
      world.querySelector(`[data-id="${note.id}"] .note-textarea`)?.focus();
    }, 50);
  });

  view.querySelector('#notes-export').addEventListener('click', () => {
    soundManager.playConfirm();
    const notes = activePage().notes;
    exportNotes(notes);
    showFeedback(view, `${notes.length} note(s) exportée(s)`);
  });

  view.querySelector('#notes-import').addEventListener('click', () => {
    importNotes(
      (imported) => {
        soundManager.playLogin();
        const page       = activePage();
        const existingIds = new Set(page.notes.map(n => n.id));
        const newOnes    = imported.filter(n => !existingIds.has(n.id));
        page.notes.push(...newOnes);
        persist();
        newOnes.forEach(addNote);
        showFeedback(view, `${newOnes.length} note(s) ajoutée(s)`);
      },
      (msg) => {
        soundManager.playError();
        showFeedback(view, `ERREUR : ${msg}`);
      }
    );
  });

  // ── Toolbar: selection actions ─────────────────────────────────────────────────

  function deleteSelected() {
    const count = selectedIds.size;
    if (count === 0) return;
    soundManager.playBack();
    selectedIds.forEach(id => {
      const el = world.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.style.transition = 'opacity 0.15s ease';
        el.style.opacity    = '0';
        setTimeout(() => el.remove(), 150);
      }
    });
    const page = activePage();
    page.notes = page.notes.filter(n => !selectedIds.has(n.id));
    selectedIds = new Set();
    persist();
    updateSelectionVisuals();
    showFeedback(view, `${count} note(s) supprimée(s)`);
  }

  view.querySelector('#notes-sel-delete').addEventListener('click', deleteSelected);

  view.querySelector('#notes-sel-export').addEventListener('click', () => {
    soundManager.playConfirm();
    const selected = activePage().notes.filter(n => selectedIds.has(n.id));
    exportNotes(selected);
    showFeedback(view, `${selected.length} note(s) exportée(s)`);
  });

  view.querySelector('#notes-sel-clear').addEventListener('click', clearSelection);

  // ── Focus manager ──────────────────────────────────────────────────────────────

  const component = {
    id: 'notes',
    handleKeydown(e) {
      if (e.key === 'Escape') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          clearSelection();
          return true;
        }
        if (document.activeElement?.tagName === 'TEXTAREA') {
          e.preventDefault();
          document.activeElement.blur();
          return true;
        }
        e.preventDefault();
        soundManager.playBack();
        router.pop();
        return true;
      }
      if (selectedIds.size > 0 && document.activeElement?.tagName !== 'TEXTAREA') {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          deleteSelected();
          return true;
        }
      }
      return false;
    },
    focus() {},
  };

  focusManager.claim(component);

  // ── Initial render ─────────────────────────────────────────────────────────────

  renderPage();
}
