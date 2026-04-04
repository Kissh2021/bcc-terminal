import { storage } from '../utils/storage.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';
import { soundManager } from '../core/soundManager.js';

const STORAGE_KEY = 'notes';

// ── Persistence ──────────────────────────────────────────────────────────────

function loadNotes() {
  return storage.get(STORAGE_KEY, []);
}

function saveNotes(notes) {
  storage.set(STORAGE_KEY, notes);
}

function makeNote(overrides = {}) {
  return {
    id:        crypto.randomUUID(),
    content:   '',
    x:         60 + Math.random() * 120,
    y:         60 + Math.random() * 80,
    w:         240,
    h:         180,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Export / Import ───────────────────────────────────────────────────────────

function exportNotes(notes) {
  const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), notes }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `bcc-notes-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importNotes(onSuccess, onError) {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.json,application/json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const notes = Array.isArray(parsed) ? parsed : (parsed.notes ?? null);
        if (!Array.isArray(notes)) throw new Error('Format invalide');
        const valid = notes.filter(n => n && typeof n.id === 'string');
        onSuccess(valid);
      } catch (err) {
        onError(err.message);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ── Drag helper ───────────────────────────────────────────────────────────────

function makeDraggable(noteEl, noteData, canvas, onUpdate) {
  const header = noteEl.querySelector('.note-header');

  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('note-delete')) return;
    e.preventDefault();

    noteEl.classList.add('dragging');
    bringToFront(noteEl, canvas);

    const startX = e.clientX - noteData.x;
    const startY = e.clientY - noteData.y;
    const canvasRect = canvas.getBoundingClientRect();

    function onMove(e) {
      const x = Math.max(0, Math.min(e.clientX - startX, canvasRect.width  - noteEl.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - startY, canvasRect.height - noteEl.offsetHeight));
      noteData.x = x;
      noteData.y = y;
      noteEl.style.left = x + 'px';
      noteEl.style.top  = y + 'px';
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
    const touch  = e.touches[0];
    const startX = touch.clientX - noteData.x;
    const startY = touch.clientY - noteData.y;
    const canvasRect = canvas.getBoundingClientRect();

    function onMove(e) {
      const t = e.touches[0];
      const x = Math.max(0, Math.min(t.clientX - startX, canvasRect.width  - noteEl.offsetWidth));
      const y = Math.max(0, Math.min(t.clientY - startY, canvasRect.height - noteEl.offsetHeight));
      noteData.x = x;
      noteData.y = y;
      noteEl.style.left = x + 'px';
      noteEl.style.top  = y + 'px';
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

// ── Resize watcher ───────────────────────────────────────────────────────────

function watchResize(noteEl, noteData, onUpdate) {
  noteEl.addEventListener('mouseup', () => {
    const newW = noteEl.offsetWidth;
    const newH = noteEl.offsetHeight;
    if (newW > 0 && newH > 0 && (newW !== noteData.w || newH !== noteData.h)) {
      noteData.w = newW;
      noteData.h = newH;
      onUpdate();
    }
  });
}

// ── Z-index management ────────────────────────────────────────────────────────

let topZ = 10;
function bringToFront(noteEl, canvas) {
  topZ++;
  noteEl.style.zIndex = topZ;
}

// ── Rect overlap ──────────────────────────────────────────────────────────────

function rectsOverlap(sel, note) {
  return (
    sel.x < note.x + note.w &&
    sel.x + sel.w > note.x &&
    sel.y < note.y + note.h &&
    sel.y + sel.h > note.y
  );
}

// ── Note element factory ──────────────────────────────────────────────────────

function createNoteEl(noteData, canvas, onUpdate, onDelete) {
  const el = document.createElement('div');
  el.className  = 'note';
  el.style.left = noteData.x + 'px';
  el.style.top  = noteData.y + 'px';
  el.style.width  = noteData.w + 'px';
  el.style.height = noteData.h + 'px';
  el.dataset.id = noteData.id;

  el.innerHTML = `
    <div class="note-header">
      <span class="note-drag-dots">\u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7</span>
      <button class="note-delete" title="Supprimer">\u2715</button>
    </div>
    <textarea class="note-textarea" placeholder="Note\u2026" spellcheck="false"></textarea>
  `;

  const textarea = el.querySelector('.note-textarea');
  textarea.value = noteData.content;

  let saveTimer = null;
  textarea.addEventListener('input', () => {
    noteData.content = textarea.value;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(onUpdate, 300);
  });

  el.addEventListener('mousedown', () => bringToFront(el, canvas));

  el.querySelector('.note-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    soundManager.playBack();
    el.style.transition = 'opacity 0.15s ease';
    el.style.opacity = '0';
    setTimeout(() => {
      el.remove();
      onDelete(noteData.id);
    }, 150);
  });

  makeDraggable(el, noteData, canvas, onUpdate);
  watchResize(el, noteData, onUpdate);

  return el;
}

// ── Feedback toast ────────────────────────────────────────────────────────────

function showFeedback(view, message) {
  // Remove existing toast if any
  view.querySelector('.notes-feedback')?.remove();
  const el = document.createElement('div');
  el.className   = 'notes-feedback';
  el.textContent = message;
  view.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ── Main mount ────────────────────────────────────────────────────────────────

export function mountNotesView(container) {
  let notes = loadNotes();
  let selectedIds = new Set();

  const view = document.createElement('div');
  view.id = 'notes-view';

  view.innerHTML = `
    <div class="notes-toolbar">
      <span class="notes-toolbar-label">NOTES</span>
      <button class="notes-btn primary" id="notes-new">+ NOUVELLE</button>
      <button class="notes-btn" id="notes-export">EXPORTER TOUT</button>
      <button class="notes-btn" id="notes-import">IMPORTER</button>
      <span class="notes-sel-bar" id="notes-sel-bar">
        <span class="notes-sel-info" id="notes-sel-info"></span>
        <button class="notes-btn danger" id="notes-sel-delete">SUPPRIMER</button>
        <button class="notes-btn" id="notes-sel-export">EXPORTER</button>
        <button class="notes-btn dim" id="notes-sel-clear">\u2715 D\u00c9SELECTIONNER</button>
      </span>
      <span class="notes-count" id="notes-count"></span>
    </div>
    <div class="notes-canvas" id="notes-canvas"></div>
  `;

  container.appendChild(view);

  const canvas  = view.querySelector('#notes-canvas');
  const countEl = view.querySelector('#notes-count');
  const selBar  = view.querySelector('#notes-sel-bar');
  const selInfo = view.querySelector('#notes-sel-info');

  // ── Selection visuals ───────────────────────────────────────────────────────

  function updateSelectionVisuals() {
    canvas.querySelectorAll('.note').forEach(el => {
      el.classList.toggle('selected', selectedIds.has(el.dataset.id));
    });
    const count = selectedIds.size;
    if (count > 0) {
      selInfo.textContent = `${count} S\u00c9LECTIONN\u00c9E${count > 1 ? 'S' : ''}`;
      selBar.classList.add('active');
    } else {
      selBar.classList.remove('active');
    }
  }

  function clearSelection() {
    selectedIds = new Set();
    updateSelectionVisuals();
  }

  // ── Rubber-band selection ───────────────────────────────────────────────────

  canvas.addEventListener('mousedown', (e) => {
    // Only start selection when clicking directly on the canvas background
    if (e.target !== canvas) return;
    e.preventDefault();

    const canvasRect = canvas.getBoundingClientRect();
    const startX = e.clientX - canvasRect.left;
    const startY = e.clientY - canvasRect.top;
    let hasMoved = false;

    const selEl = document.createElement('div');
    selEl.className = 'selection-rect';
    canvas.appendChild(selEl);

    function onMove(ev) {
      hasMoved = true;
      const curX = ev.clientX - canvasRect.left;
      const curY = ev.clientY - canvasRect.top;

      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const w = Math.abs(curX - startX);
      const h = Math.abs(curY - startY);

      selEl.style.left   = x + 'px';
      selEl.style.top    = y + 'px';
      selEl.style.width  = w + 'px';
      selEl.style.height = h + 'px';

      // Live-update which notes are in the rect
      selectedIds = new Set();
      notes.forEach(note => {
        if (rectsOverlap({ x, y, w, h }, note)) selectedIds.add(note.id);
      });
      updateSelectionVisuals();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      selEl.remove();
      // Simple click (no drag) → clear selection
      if (!hasMoved) clearSelection();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ── Persistence ─────────────────────────────────────────────────────────────

  function updateCount() {
    countEl.textContent = notes.length + ' NOTE' + (notes.length !== 1 ? 'S' : '');
  }

  function persist() {
    saveNotes(notes);
    updateCount();
  }

  // ── Add note to canvas ───────────────────────────────────────────────────────

  function addNote(noteData) {
    const el = createNoteEl(
      noteData,
      canvas,
      persist,
      (id) => {
        notes = notes.filter(n => n.id !== id);
        selectedIds.delete(id);
        updateSelectionVisuals();
        persist();
      }
    );
    canvas.appendChild(el);
    bringToFront(el, canvas);
  }

  // Render existing notes
  notes.forEach(addNote);
  updateCount();

  // ── Toolbar: main actions ────────────────────────────────────────────────────

  view.querySelector('#notes-new').addEventListener('click', () => {
    soundManager.playNavigate();
    clearSelection();
    const note = makeNote();
    notes.push(note);
    persist();
    addNote(note);
    setTimeout(() => {
      canvas.querySelector(`[data-id="${note.id}"] .note-textarea`)?.focus();
    }, 50);
  });

  view.querySelector('#notes-export').addEventListener('click', () => {
    soundManager.playConfirm();
    exportNotes(notes);
    showFeedback(view, `${notes.length} note(s) export\u00e9e(s)`);
  });

  view.querySelector('#notes-import').addEventListener('click', () => {
    importNotes(
      (imported) => {
        soundManager.playLogin();
        // Ajoute uniquement les notes absentes (par id) — ne touche pas aux existantes
        const existingIds = new Set(notes.map(n => n.id));
        const newOnes = imported.filter(n => !existingIds.has(n.id));
        notes.push(...newOnes);
        persist();
        newOnes.forEach(addNote);
        showFeedback(view, `${newOnes.length} note(s) ajout\u00e9e(s)`);
      },
      (msg) => {
        soundManager.playError();
        showFeedback(view, `ERREUR : ${msg}`);
      }
    );
  });

  // ── Toolbar: selection actions ────────────────────────────────────────────────

  function deleteSelected() {
    const count = selectedIds.size;
    if (count === 0) return;
    soundManager.playBack();
    selectedIds.forEach(id => {
      const el = canvas.querySelector(`[data-id="${id}"]`);
      if (el) {
        el.style.transition = 'opacity 0.15s ease';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 150);
      }
    });
    notes = notes.filter(n => !selectedIds.has(n.id));
    selectedIds = new Set();
    persist();
    updateSelectionVisuals();
    showFeedback(view, `${count} note(s) supprim\u00e9e(s)`);
  }

  view.querySelector('#notes-sel-delete').addEventListener('click', deleteSelected);

  view.querySelector('#notes-sel-export').addEventListener('click', () => {
    soundManager.playConfirm();
    const selected = notes.filter(n => selectedIds.has(n.id));
    exportNotes(selected);
    showFeedback(view, `${selected.length} note(s) export\u00e9e(s)`);
  });

  view.querySelector('#notes-sel-clear').addEventListener('click', () => {
    clearSelection();
  });

  // ── Focus manager ────────────────────────────────────────────────────────────

  const component = {
    id: 'notes',
    handleKeydown(e) {
      if (e.key === 'Escape') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          clearSelection();
          return true;
        }
        // First Escape blurs the focused note; second Escape navigates back
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
      // Suppr / Delete supprime la sélection (AZERTY: "Suppr" → e.key === 'Delete')
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
}
