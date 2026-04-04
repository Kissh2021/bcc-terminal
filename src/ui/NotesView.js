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
        // Support both raw array and wrapped object
        const notes = Array.isArray(parsed) ? parsed : (parsed.notes ?? null);
        if (!Array.isArray(notes)) throw new Error('Format invalide');
        // Basic validation
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
  // On écoute mouseup sur la note : se déclenche quand l'utilisateur lâche
  // le handle de resize CSS (bottom-right), pas à l'insertion dans le DOM.
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

// ── Note element factory ──────────────────────────────────────────────────────

function createNoteEl(noteData, canvas, notes, onUpdate, onDelete) {
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

  // Auto-save on input (debounced)
  let saveTimer = null;
  textarea.addEventListener('input', () => {
    noteData.content = textarea.value;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(onUpdate, 300);
  });

  // Bring to front on click
  el.addEventListener('mousedown', () => bringToFront(el, canvas));

  // Delete
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

function showFeedback(canvas, message) {
  const el = document.createElement('div');
  el.className   = 'notes-feedback';
  el.textContent = message;
  canvas.closest('#notes-view').appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ── Main mount ────────────────────────────────────────────────────────────────

export function mountNotesView(container) {
  // Import notes CSS
  let notes = loadNotes();

  const view = document.createElement('div');
  view.id = 'notes-view';

  // Toolbar
  view.innerHTML = `
    <div class="notes-toolbar">
      <span class="notes-toolbar-label">NOTES</span>
      <button class="notes-btn primary" id="notes-new">+ NOUVELLE</button>
      <button class="notes-btn" id="notes-export">EXPORTER JSON</button>
      <button class="notes-btn" id="notes-import">IMPORTER JSON</button>
      <span class="notes-count" id="notes-count"></span>
    </div>
    <div class="notes-canvas" id="notes-canvas"></div>
  `;

  container.appendChild(view);

  const canvas    = view.querySelector('#notes-canvas');
  const countEl   = view.querySelector('#notes-count');

  function updateCount() {
    countEl.textContent = notes.length + ' NOTE' + (notes.length !== 1 ? 'S' : '');
  }

  function persist() {
    saveNotes(notes);
    updateCount();
  }

  function addNote(noteData) {
    const el = createNoteEl(
      noteData,
      canvas,
      notes,
      persist,
      (id) => {
        notes = notes.filter(n => n.id !== id);
        persist();
      }
    );
    canvas.appendChild(el);
    bringToFront(el, canvas);
  }

  // Render existing notes
  notes.forEach(addNote);
  updateCount();

  // New note button
  view.querySelector('#notes-new').addEventListener('click', () => {
    soundManager.playNavigate();
    const note = makeNote();
    notes.push(note);
    persist();
    addNote(note);
    // Focus the textarea of the new note
    setTimeout(() => {
      const noteEl = canvas.querySelector(`[data-id="${note.id}"] .note-textarea`);
      noteEl?.focus();
    }, 50);
  });

  // Export
  view.querySelector('#notes-export').addEventListener('click', () => {
    soundManager.playConfirm();
    exportNotes(notes);
    showFeedback(canvas, `${notes.length} note(s) export\u00e9e(s)`);
  });

  // Import
  view.querySelector('#notes-import').addEventListener('click', () => {
    importNotes(
      (imported) => {
        soundManager.playLogin();
        // Merge: ajoute sans écraser les existantes (par id)
        const existingIds = new Set(notes.map(n => n.id));
        const newOnes = imported.filter(n => !existingIds.has(n.id));
        notes.push(...newOnes);
        persist();
        // Re-render nouvelles notes
        newOnes.forEach(addNote);
        showFeedback(canvas, `${newOnes.length} note(s) import\u00e9e(s)`);
      },
      (msg) => {
        soundManager.playError();
        showFeedback(canvas, `ERREUR : ${msg}`);
      }
    );
  });

  // Focus manager
  const component = {
    id: 'notes',
    handleKeydown(e) {
      if (e.key === 'Escape' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        soundManager.playBack();
        router.pop();
        return true;
      }
      return false;
    },
    focus() {},
  };

  focusManager.claim(component);
}
