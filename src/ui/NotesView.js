import { storage } from '../utils/storage.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';
import { soundManager } from '../core/soundManager.js';
import { showNotesLoader, updateNotesLoader, hideNotesLoader } from './NotesLoader.js';
import { save } from '@tauri-apps/plugin-dialog';

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
  if (saved) {
    // Migrate pages that have never been panned (panX/panY === 0 or missing)
    // so they get centred on first render instead of showing the origin at top-left.
    saved.pages.forEach(p => {
      if (p.panX == null || (p.panX === 0 && p.panY === 0)) {
        p.panX = null;
        p.panY = null;
      }
      p.connections = p.connections ?? [];
      // Migrate notes from content string → blocks
      p.notes.forEach(n => migrateNoteBlocks(n));
    });
    return saved;
  }
  const page = makePage('PAGE 1');
  return { activePageId: page.id, pages: [page] };
}

function saveData(data) {
  storage.set(DATA_KEY, data);
}

// ── Factories ──────────────────────────────────────────────────────────────────

function makePage(name, overrides = {}) {
  return { id: crypto.randomUUID(), name, notes: [], connections: [], panX: null, panY: null, ...overrides };
}

function makeConnection(fromId, toId) {
  return { id: crypto.randomUUID(), fromId, toId, color: null, waypoints: [] };
}

function makeNote(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    blocks: [{ type: 'text', value: '' }],
    x: 60 + Math.random() * 120,
    y: 60 + Math.random() * 80,
    w: 240,
    h: 180,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Block migration & helpers ─────────────────────────────────────────────────

function migrateNoteBlocks(note) {
  if (!note.blocks) {
    note.blocks = [{ type: 'text', value: note.content || '' }];
    delete note.content;
  }
}

function mergeAdjacentTextBlocks(blocks) {
  for (let i = blocks.length - 1; i > 0; i--) {
    if (blocks[i].type === 'text' && blocks[i - 1].type === 'text') {
      blocks[i - 1].value += (blocks[i - 1].value && blocks[i].value ? '\n' : '') + blocks[i].value;
      blocks.splice(i, 1);
    }
  }
}

function readImageFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve({ dataUrl: e.target.result, width: img.naturalWidth, height: img.naturalHeight });
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Export / Import ────────────────────────────────────────────────────────────

const MIN_LOADER_MS = 800;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function exportNotes(notes) {
  const defaultName = `bcc-notes-${new Date().toISOString().slice(0, 10)}.bccnotes`;

  // Tauri save dialog — ask where to save
  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: 'BCC Notes', extensions: ['bccnotes'] }],
  });
  if (!filePath) return null; // user cancelled

  showNotesLoader('EXPORT EN COURS…');
  updateNotesLoader(`${notes.length} NOTE${notes.length > 1 ? 'S' : ''}…`);

  const json = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), notes }, null, 2);

  // Write file via Tauri fs + enforce minimum loader time
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await Promise.all([writeTextFile(filePath, json), delay(MIN_LOADER_MS)]);

  updateNotesLoader('EXPORT TERMINÉ');
  hideNotesLoader();
  return filePath;
}

function importNotes(onSuccess, onError) {
  const input   = document.createElement('input');
  input.type    = 'file';
  input.accept  = '.json,.bccnotes';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    showNotesLoader('IMPORT EN COURS…');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const notes  = Array.isArray(parsed) ? parsed : (parsed.notes ?? null);
        if (!Array.isArray(notes)) throw new Error('Format invalide');
        // Migrate v1 notes (content string → blocks)
        notes.forEach(n => migrateNoteBlocks(n));
        const valid = notes.filter(n => n && typeof n.id === 'string');
        updateNotesLoader(`${valid.length} NOTE${valid.length > 1 ? 'S' : ''} TROUVÉE${valid.length > 1 ? 'S' : ''}…`);
        await delay(MIN_LOADER_MS);
        updateNotesLoader('IMPORT TERMINÉ');
        hideNotesLoader();
        onSuccess(valid);
      } catch (err) {
        hideNotesLoader();
        onError(err.message);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ── Connection colors ─────────────────────────────────────────────────────────

const CONN_COLORS = {
  default: null,       // uses CSS var --color-accent
  red:     '#ff4444',
  amber:   '#ffaa00',
  blue:    '#4488ff',
  dim:     null,       // uses CSS var --color-text-dim
};

function resolveConnColor(color) {
  if (!color || color === 'default') return 'var(--color-accent)';
  if (color === 'dim') return 'var(--color-text-dim)';
  return CONN_COLORS[color] || 'var(--color-accent)';
}

// ── Z-index ────────────────────────────────────────────────────────────────────

let topZ = 10;
function bringToFront(el) { el.style.zIndex = ++topZ; }

// ── Drag (unclamped — infinite canvas, supports multi-selection drag) ─────────
// getSelection(noteId) → [{noteData, noteEl}] for all notes to move together.

function makeDraggable(noteEl, noteData, onUpdate, getSelection, { onDragMove, onConnStart } = {}) {
  const header = noteEl.querySelector('.note-header');

  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('note-delete')) return;
    // Shift+drag or connect mode → start connection instead of moving
    if (e.button === 0 && onConnStart && onConnStart.shouldConnect(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      onConnStart(noteData.id, e);
      return;
    }
    e.preventDefault();
    bringToFront(noteEl);

    const group = getSelection(noteData.id);
    group.forEach(({ noteEl: el }) => el?.classList.add('dragging'));

    const startX = e.clientX;
    const startY = e.clientY;
    const initPos = group.map(({ noteData: nd }) => ({ nd, ix: nd.x, iy: nd.y }));

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      initPos.forEach(({ nd, ix, iy }) => {
        nd.x = ix + dx;
        nd.y = iy + dy;
      });
      group.forEach(({ noteData: nd, noteEl: el }) => {
        if (el) { el.style.left = nd.x + 'px'; el.style.top = nd.y + 'px'; }
      });
      if (onDragMove) onDragMove();
    }
    function onUp() {
      group.forEach(({ noteEl: el }) => el?.classList.remove('dragging'));
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
    const t = e.touches[0];

    const group = getSelection(noteData.id);
    const startX = t.clientX;
    const startY = t.clientY;
    const initPos = group.map(({ noteData: nd }) => ({ nd, ix: nd.x, iy: nd.y }));

    function onMove(e) {
      const t  = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      initPos.forEach(({ nd, ix, iy }) => { nd.x = ix + dx; nd.y = iy + dy; });
      group.forEach(({ noteData: nd, noteEl: el }) => {
        if (el) { el.style.left = nd.x + 'px'; el.style.top = nd.y + 'px'; }
      });
      if (onDragMove) onDragMove();
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

function watchResize(noteEl, noteData, onUpdate, onDragMove) {
  noteEl.addEventListener('mouseup', () => {
    const w = noteEl.offsetWidth;
    const h = noteEl.offsetHeight;
    if (w > 0 && h > 0 && (w !== noteData.w || h !== noteData.h)) {
      noteData.w = w;
      noteData.h = h;
      onUpdate();
      if (onDragMove) onDragMove();
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

function createNoteEl(noteData, onUpdate, onDelete, getSelection, dragOpts = {}) {
  const el = document.createElement('div');
  el.className    = 'note';
  el.style.left   = noteData.x + 'px';
  el.style.top    = noteData.y + 'px';
  el.style.width  = noteData.w + 'px';
  el.style.height = noteData.h + 'px';
  el.dataset.id   = noteData.id;

  el.innerHTML = `
    <div class="note-header">
      <span class="note-drag-dots">· · · · �� · · ·</span>
      <button class="note-add-image" title="Ajouter une image">IMG</button>
      <button class="note-delete" title="Supprimer">✕</button>
    </div>
    <div class="note-body"></div>
  `;

  const body = el.querySelector('.note-body');
  let saveTimer = null;
  const debouncedSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(onUpdate, 300); };

  function autoResize(ta) {
    ta.style.height = '0';
    ta.style.height = ta.scrollHeight + 'px';
  }

  function insertImage(dataUrl, width, height, afterIdx) {
    const maxW = noteData.w - 20;
    let w = width, h = height;
    if (w > maxW) { h = h * (maxW / w); w = maxW; }
    const imgBlock = { type: 'image', dataUrl, width: Math.round(w), height: Math.round(h) };
    const newText  = { type: 'text', value: '' };
    noteData.blocks.splice(afterIdx + 1, 0, imgBlock, newText);
    onUpdate();
    renderBlocks();
    const newTa = body.querySelector(`[data-block-idx="${afterIdx + 2}"]`);
    if (newTa) newTa.focus();
  }

  function renderBlocks() {
    body.innerHTML = '';
    const singleText = noteData.blocks.length === 1 && noteData.blocks[0].type === 'text';

    noteData.blocks.forEach((block, idx) => {
      if (block.type === 'text') {
        const ta = document.createElement('textarea');
        ta.className = 'note-textarea';
        ta.placeholder = idx === 0 ? 'Note…' : '';
        ta.spellcheck = false;
        ta.value = block.value;
        ta.dataset.blockIdx = idx;

        if (singleText) {
          ta.style.flex = '1';
        }

        ta.addEventListener('input', () => {
          block.value = ta.value;
          if (!singleText) autoResize(ta);
          debouncedSave();
        });

        // Paste image from clipboard
        ta.addEventListener('paste', (e) => {
          const items = e.clipboardData?.items;
          if (!items) return;
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              e.preventDefault();
              readImageFile(item.getAsFile()).then(({ dataUrl, width, height }) => {
                insertImage(dataUrl, width, height, idx);
              });
              return;
            }
          }
        });

        body.appendChild(ta);
        if (!singleText) requestAnimationFrame(() => autoResize(ta));

      } else if (block.type === 'image') {
        const wrapper = document.createElement('div');
        wrapper.className = 'note-image-block';
        wrapper.dataset.blockIdx = idx;

        // Action buttons (visible on hover)
        const actions = document.createElement('div');
        actions.className = 'note-image-actions';

        if (idx > 0) {
          const up = document.createElement('button');
          up.className = 'note-image-action-btn';
          up.textContent = '↑';
          up.title = 'Monter';
          up.addEventListener('click', (e) => {
            e.stopPropagation();
            [noteData.blocks[idx - 1], noteData.blocks[idx]] = [noteData.blocks[idx], noteData.blocks[idx - 1]];
            onUpdate(); renderBlocks();
          });
          actions.appendChild(up);
        }

        if (idx < noteData.blocks.length - 1) {
          const down = document.createElement('button');
          down.className = 'note-image-action-btn';
          down.textContent = '↓';
          down.title = 'Descendre';
          down.addEventListener('click', (e) => {
            e.stopPropagation();
            [noteData.blocks[idx], noteData.blocks[idx + 1]] = [noteData.blocks[idx + 1], noteData.blocks[idx]];
            onUpdate(); renderBlocks();
          });
          actions.appendChild(down);
        }

        const del = document.createElement('button');
        del.className = 'note-image-action-btn danger';
        del.textContent = '✕';
        del.title = 'Supprimer l\'image';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          noteData.blocks.splice(idx, 1);
          mergeAdjacentTextBlocks(noteData.blocks);
          if (noteData.blocks.length === 0) noteData.blocks.push({ type: 'text', value: '' });
          onUpdate(); renderBlocks();
        });
        actions.appendChild(del);
        wrapper.appendChild(actions);

        // Image with resize handle
        const imgWrap = document.createElement('div');
        imgWrap.className = 'note-image-wrap';

        const img = document.createElement('img');
        img.src = block.dataUrl;
        img.style.width  = block.width + 'px';
        img.style.height = block.height + 'px';
        img.draggable = false;
        imgWrap.appendChild(img);

        const handle = document.createElement('div');
        handle.className = 'note-image-resize-handle';
        imgWrap.appendChild(handle);

        handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startW = block.width;
          const ratio  = block.height / block.width;
          function onMove(ev) {
            const newW = Math.max(50, startW + (ev.clientX - startX));
            block.width  = Math.round(newW);
            block.height = Math.round(newW * ratio);
            img.style.width  = block.width + 'px';
            img.style.height = block.height + 'px';
          }
          function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            onUpdate();
          }
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });

        wrapper.appendChild(imgWrap);
        body.appendChild(wrapper);
      }
    });
  }

  // Image add button (file picker)
  el.querySelector('.note-add-image').addEventListener('click', (e) => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      readImageFile(file).then(({ dataUrl, width, height }) => {
        // Insert before last block position (so text follows)
        const insertIdx = noteData.blocks.length - 1;
        insertImage(dataUrl, width, height, insertIdx);
      });
    });
    input.click();
  });

  el.addEventListener('mousedown', () => bringToFront(el));

  el.querySelector('.note-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    soundManager.playBack();
    el.style.transition = 'opacity 0.15s ease';
    el.style.opacity    = '0';
    setTimeout(() => { el.remove(); onDelete(noteData.id); }, 150);
  });

  renderBlocks();
  makeDraggable(el, noteData, onUpdate, getSelection, dragOpts);
  watchResize(el, noteData, onUpdate, dragOpts.onDragMove);
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
      <button class="notes-btn" id="notes-reset-view" title="Réinitialiser la position de la vue">⌖ VUE</button>
      <button class="notes-btn" id="notes-export">EXPORTER TOUT</button>
      <button class="notes-btn" id="notes-import">IMPORTER</button>
      <button class="notes-btn" id="notes-help-btn">? AIDE</button>
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
    // Scroll the grid background in sync with the world pan
    canvas.style.backgroundPosition = `${panX}px ${panY}px`;
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
    selectedWaypoints = [];
    updateSelectionVisuals();
    renderConnections();
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

  // Returns all notes that should move together when dragging noteId.
  // If noteId is in the current selection → return all selected notes.
  // Otherwise → return just the one note (single drag).
  function getSelection(noteId) {
    const page = activePage();
    const ids  = selectedIds.has(noteId) ? [...selectedIds] : [noteId];
    return ids.map(id => ({
      noteData: page.notes.find(n => n.id === id),
      noteEl:   world.querySelector(`[data-id="${id}"]`),
    })).filter(({ noteData, noteEl }) => noteData && noteEl);
  }

  // ── Connection state ────────────────────────────────────────────────────────

  let svgEl = null;
  let connPathMap = new Map();       // connId → { visible, hit, waypoints: [circle] }
  let selectedConnId = null;
  let selectedWaypoints = [];        // [{connId, wpIdx}]
  let connectMode = false;
  let clipboard = null;              // {notes, connections} for Ctrl+C/V

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function createSvgLayer() {
    svgEl = document.createElementNS(SVG_NS, 'svg');
    svgEl.classList.add('connections-svg');
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgEl.style.cssText = 'position:absolute;top:0;left:0;overflow:visible;pointer-events:none;';
    // Glow filter
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `<filter id="conn-glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    svgEl.appendChild(defs);
    return svgEl;
  }

  function buildPathD(conn, page) {
    const from = page.notes.find(n => n.id === conn.fromId);
    const to   = page.notes.find(n => n.id === conn.toId);
    if (!from || !to) return null;
    const pts = [
      { x: from.x + from.w / 2, y: from.y + from.h / 2 },
      ...conn.waypoints,
      { x: to.x + to.w / 2, y: to.y + to.h / 2 },
    ];
    return 'M ' + pts.map(p => `${p.x},${p.y}`).join(' L ');
  }

  function renderConnections() {
    if (!svgEl) return;
    // Remove old paths
    connPathMap.forEach(({ visible, hit, wpCircles }) => {
      visible.remove();
      hit.remove();
      wpCircles.forEach(c => c.remove());
    });
    connPathMap.clear();

    const page = activePage();
    page.connections.forEach(conn => {
      const d = buildPathD(conn, page);
      if (!d) return;
      const color = resolveConnColor(conn.color);

      // Visible path
      const vis = document.createElementNS(SVG_NS, 'path');
      vis.setAttribute('d', d);
      vis.setAttribute('stroke', color);
      vis.setAttribute('stroke-width', '1.5');
      vis.setAttribute('fill', 'none');
      vis.setAttribute('filter', 'url(#conn-glow)');
      vis.setAttribute('opacity', '0.7');
      vis.dataset.connId = conn.id;
      if (conn.id === selectedConnId) {
        vis.setAttribute('stroke-width', '2.5');
        vis.setAttribute('opacity', '1');
      }
      svgEl.appendChild(vis);

      // Invisible hit area
      const hit = document.createElementNS(SVG_NS, 'path');
      hit.setAttribute('d', d);
      hit.setAttribute('stroke', 'transparent');
      hit.setAttribute('stroke-width', '14');
      hit.setAttribute('fill', 'none');
      hit.setAttribute('opacity', '0');
      hit.style.pointerEvents = 'stroke';
      hit.style.cursor = 'pointer';
      hit.dataset.connId = conn.id;
      svgEl.appendChild(hit);

      // Event handlers on hit area
      hit.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); showConnContextMenu(conn, e); });
      hit.addEventListener('dblclick', (e) => { e.stopPropagation(); addWaypoint(conn, e); });
      hit.addEventListener('click', (e) => { e.stopPropagation(); selectConnection(conn.id); });

      // Waypoint circles
      const wpCircles = conn.waypoints.map((wp, idx) => {
        const isSelected = selectedWaypoints.some(sw => sw.connId === conn.id && sw.wpIdx === idx);
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', wp.x);
        circle.setAttribute('cy', wp.y);
        circle.setAttribute('r', isSelected ? '7' : '5');
        circle.setAttribute('fill', isSelected ? 'var(--color-accent)' : 'var(--color-bg-surface)');
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', isSelected ? '2' : '1.5');
        circle.setAttribute('filter', 'url(#conn-glow)');
        circle.style.pointerEvents = 'auto';
        circle.style.cursor = 'grab';
        svgEl.appendChild(circle);

        circle.addEventListener('mousedown', (e) => {
          if (e.button === 2) return; // let context menu through
          e.preventDefault();
          e.stopPropagation();
          startWaypointDrag(conn, idx, wp, e);
        });
        circle.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showWaypointContextMenu(conn, idx, e);
        });

        return circle;
      });

      connPathMap.set(conn.id, { visible: vis, hit, wpCircles });
    });
  }

  function updateConnectionPaths() {
    const page = activePage();
    page.connections.forEach(conn => {
      const entry = connPathMap.get(conn.id);
      if (!entry) return;
      const d = buildPathD(conn, page);
      if (!d) return;
      entry.visible.setAttribute('d', d);
      entry.hit.setAttribute('d', d);
      // Update waypoint positions
      conn.waypoints.forEach((wp, i) => {
        if (entry.wpCircles[i]) {
          entry.wpCircles[i].setAttribute('cx', wp.x);
          entry.wpCircles[i].setAttribute('cy', wp.y);
        }
      });
    });
  }

  function selectConnection(connId) {
    selectedConnId = connId === selectedConnId ? null : connId;
    renderConnections();
  }

  function deselectConnection() {
    if (selectedConnId) { selectedConnId = null; renderConnections(); }
  }

  // ── Connection creation (Shift+drag from note header) ─────────────────────

  function startConnectionDraw(fromId, e) {
    const page = activePage();
    const fromNote = page.notes.find(n => n.id === fromId);
    if (!fromNote) return;

    const canvasRect = canvas.getBoundingClientRect();
    const fx = fromNote.x + fromNote.w / 2;
    const fy = fromNote.y + fromNote.h / 2;

    const tempLine = document.createElementNS(SVG_NS, 'line');
    tempLine.setAttribute('x1', fx);
    tempLine.setAttribute('y1', fy);
    tempLine.setAttribute('x2', fx);
    tempLine.setAttribute('y2', fy);
    tempLine.setAttribute('stroke', 'var(--color-accent)');
    tempLine.setAttribute('stroke-width', '1.5');
    tempLine.setAttribute('stroke-dasharray', '6,4');
    tempLine.setAttribute('opacity', '0.6');
    tempLine.setAttribute('filter', 'url(#conn-glow)');
    tempLine.style.pointerEvents = 'none';
    svgEl.appendChild(tempLine);

    function onMove(ev) {
      const wx = ev.clientX - canvasRect.left - page.panX;
      const wy = ev.clientY - canvasRect.top - page.panY;
      tempLine.setAttribute('x2', wx);
      tempLine.setAttribute('y2', wy);
    }
    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      tempLine.remove();

      // Find target note under cursor
      const elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
      const noteEl = elUnder?.closest?.('.note');
      const toId = noteEl?.dataset?.id;

      if (toId && toId !== fromId) {
        // Check no duplicate
        const exists = page.connections.some(c =>
          (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId)
        );
        if (!exists) {
          page.connections.push(makeConnection(fromId, toId));
          soundManager.playConfirm();
          persist();
          renderConnections();
          return;
        }
      }
      soundManager.playBack();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Waypoints ─────────────────────────────────────────────────────────────

  function addWaypoint(conn, e) {
    const page = activePage();
    const canvasRect = canvas.getBoundingClientRect();
    const wx = e.clientX - canvasRect.left - page.panX;
    const wy = e.clientY - canvasRect.top  - page.panY;

    // Find which segment is closest to insert the waypoint
    const from = page.notes.find(n => n.id === conn.fromId);
    const to   = page.notes.find(n => n.id === conn.toId);
    if (!from || !to) return;

    const pts = [
      { x: from.x + from.w / 2, y: from.y + from.h / 2 },
      ...conn.waypoints,
      { x: to.x + to.w / 2, y: to.y + to.h / 2 },
    ];

    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegment(wx, wy, pts[i], pts[i + 1]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    conn.waypoints.splice(bestIdx, 0, { x: wx, y: wy });
    soundManager.playConfirm();
    persist();
    renderConnections();
  }

  function distToSegment(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
    let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  function startWaypointDrag(conn, wpIdx, wp, e) {
    const canvasRect = canvas.getBoundingClientRect();
    const page = activePage();

    function onMove(ev) {
      wp.x = ev.clientX - canvasRect.left - page.panX;
      wp.y = ev.clientY - canvasRect.top  - page.panY;
      updateConnectionPaths();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      persist();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Context menus ─────────────────────────────────────────────────────────

  let ctxMenu = null;

  function closeContextMenu() {
    if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
  }

  function showConnContextMenu(conn, e) {
    closeContextMenu();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'conn-context-menu';
    ctxMenu.style.left = e.clientX + 'px';
    ctxMenu.style.top  = e.clientY + 'px';
    ctxMenu.innerHTML = `
      <div class="conn-context-item" data-action="delete">SUPPRIMER</div>
      <div class="conn-context-sep"></div>
      <div class="conn-color-row">
        <span class="conn-color-swatch ${!conn.color || conn.color === 'default' ? 'active' : ''}" data-color="default" title="Accent" style="background:var(--color-accent)"></span>
        <span class="conn-color-swatch ${conn.color === 'red' ? 'active' : ''}" data-color="red" title="Rouge" style="background:#ff4444"></span>
        <span class="conn-color-swatch ${conn.color === 'amber' ? 'active' : ''}" data-color="amber" title="Ambre" style="background:#ffaa00"></span>
        <span class="conn-color-swatch ${conn.color === 'blue' ? 'active' : ''}" data-color="blue" title="Bleu" style="background:#4488ff"></span>
        <span class="conn-color-swatch ${conn.color === 'dim' ? 'active' : ''}" data-color="dim" title="Discret" style="background:var(--color-text-dim)"></span>
      </div>
    `;
    document.body.appendChild(ctxMenu);

    ctxMenu.querySelector('[data-action="delete"]').addEventListener('click', () => {
      const page = activePage();
      page.connections = page.connections.filter(c => c.id !== conn.id);
      if (selectedConnId === conn.id) selectedConnId = null;
      soundManager.playBack();
      persist();
      renderConnections();
      closeContextMenu();
    });

    ctxMenu.querySelectorAll('.conn-color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        const c = sw.dataset.color;
        conn.color = c === 'default' ? null : c;
        soundManager.playToggle(true);
        persist();
        renderConnections();
        closeContextMenu();
      });
    });

    setTimeout(() => {
      document.addEventListener('click', closeContextMenu, { once: true });
    }, 0);
  }

  function showWaypointContextMenu(conn, wpIdx, e) {
    closeContextMenu();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'conn-context-menu';
    ctxMenu.style.left = e.clientX + 'px';
    ctxMenu.style.top  = e.clientY + 'px';
    ctxMenu.innerHTML = `<div class="conn-context-item" data-action="delete">SUPPRIMER LE POINT</div>`;
    document.body.appendChild(ctxMenu);

    ctxMenu.querySelector('[data-action="delete"]').addEventListener('click', () => {
      conn.waypoints.splice(wpIdx, 1);
      soundManager.playBack();
      persist();
      renderConnections();
      closeContextMenu();
    });

    setTimeout(() => {
      document.addEventListener('click', closeContextMenu, { once: true });
    }, 0);
  }

  // ── Connect mode indicator ────────────────────────────────────────────────

  function updateConnectModeIndicator() {
    const existing = view.querySelector('.connect-mode-indicator');
    if (connectMode && !existing) {
      const ind = document.createElement('span');
      ind.className = 'connect-mode-indicator';
      ind.textContent = '⚡ CONNEXION';
      view.querySelector('.notes-toolbar').appendChild(ind);
    } else if (!connectMode && existing) {
      existing.remove();
    }
  }

  // ── Drag opts for notes ───────────────────────────────────────────────────

  const connStart = (noteId, e) => startConnectionDraw(noteId, e);
  connStart.shouldConnect = (e) => e.shiftKey || connectMode;

  const dragOpts = {
    onDragMove: () => updateConnectionPaths(),
    onConnStart: connStart,
  };

  function addNote(noteData) {
    const page = activePage();
    const el = createNoteEl(
      noteData,
      persist,
      (id) => {
        page.notes = page.notes.filter(n => n.id !== id);
        page.connections = page.connections.filter(c => c.fromId !== id && c.toId !== id);
        selectedIds.delete(id);
        updateSelectionVisuals();
        persist();
        renderConnections();
      },
      getSelection,
      dragOpts
    );
    world.appendChild(el);
    bringToFront(el);
  }

  function renderPage() {
    world.innerHTML = '';
    selectedIds     = new Set();
    selectedConnId  = null;
    connPathMap.clear();
    updateSelectionVisuals();
    // First time this page is displayed: centre the origin in the viewport.
    const page = activePage();
    if (page.panX === null || page.panY === null) {
      page.panX = canvas.offsetWidth  / 2;
      page.panY = canvas.offsetHeight / 2;
    }
    applyPan();
    // Origin marker at world (0,0) — moves with the canvas when panning
    const originMarker = document.createElement('div');
    originMarker.className = 'canvas-center-marker';
    world.appendChild(originMarker);
    // SVG layer for connections (behind notes)
    world.appendChild(createSvgLayer());
    activePage().notes.forEach(addNote);
    renderConnections();
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
  // Uses Pointer Events + setPointerCapture so the browser (Vivaldi, Opera…)
  // cannot intercept the drag for its own gesture/rocker navigation.

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 1 && e.button !== 2) return;
    e.preventDefault(); // blocks middle-click auto-scroll and right-click browser gestures
    canvas.setPointerCapture(e.pointerId); // claim the pointer before browser gestures fire

    const startButton = e.button; // remember which button started the pan
    const page   = activePage();
    const startX = e.clientX - page.panX;
    const startY = e.clientY - page.panY;
    canvas.classList.add('panning');

    function onMove(e) {
      page.panX = e.clientX - startX;
      page.panY = e.clientY - startY;
      applyPan();
    }
    function onUp(e) {
      if (e.button !== startButton) return; // only stop on the button that started the pan
      canvas.classList.remove('panning');
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      persist();
    }
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
  });

  // ── Deselect on click on canvas background ────────────────────────────────────

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0 && e.target === canvas) { clearSelection(); deselectConnection(); closeContextMenu(); }
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
      // Select waypoints inside rubber-band
      selectedWaypoints = [];
      page.connections.forEach(conn => {
        conn.waypoints.forEach((wp, wpIdx) => {
          if (wp.x >= x && wp.x <= x + w && wp.y >= y && wp.y <= y + h) {
            selectedWaypoints.push({ connId: conn.id, wpIdx });
          }
        });
      });
      updateSelectionVisuals();
      renderConnections();
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
    // Place the note in the top-left of the visible viewport regardless of pan.
    // Visible top-left in world coords = (-panX, -panY).
    // Add a small random offset so stacked notes don't perfectly overlap.
    const note = makeNote({
      x: -page.panX + 20 + Math.random() * 40,
      y: -page.panY + 60 + Math.random() * 30, // 60px: clears the 40px toolbar
    });
    page.notes.push(note);
    persist();
    addNote(note);
    setTimeout(() => {
      world.querySelector(`[data-id="${note.id}"] .note-textarea`)?.focus();
    }, 50);
  });

  view.querySelector('#notes-reset-view').addEventListener('click', () => {
    soundManager.playBack();
    const page = activePage();
    // Center the view on world origin (0,0): pan = half canvas dimensions
    page.panX = canvas.offsetWidth  / 2;
    page.panY = canvas.offsetHeight / 2;
    applyPan();
    persist();
  });

  view.querySelector('#notes-export').addEventListener('click', async () => {
    const notes = activePage().notes;
    const result = await exportNotes(notes);
    if (result) showFeedback(view, `${notes.length} note(s) exportée(s)`);
  });

  view.querySelector('#notes-import').addEventListener('click', () => {
    importNotes(
      (imported) => {
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
    page.connections = page.connections.filter(c => !selectedIds.has(c.fromId) && !selectedIds.has(c.toId));
    selectedIds = new Set();
    persist();
    updateSelectionVisuals();
    renderConnections();
    showFeedback(view, `${count} note(s) supprimée(s)`);
  }

  view.querySelector('#notes-sel-delete').addEventListener('click', deleteSelected);

  view.querySelector('#notes-sel-export').addEventListener('click', async () => {
    const selected = activePage().notes.filter(n => selectedIds.has(n.id));
    const result = await exportNotes(selected);
    if (result) showFeedback(view, `${selected.length} note(s) exportée(s)`);
  });

  view.querySelector('#notes-sel-clear').addEventListener('click', clearSelection);
  view.querySelector('#notes-help-btn').addEventListener('click', toggleHelp);

  // ── Focus manager ──────────────────────────────────────────────────────────────

  // ── Help panel ───────────────────────────────────────────────────────────

  let helpVisible = false;

  function toggleHelp() {
    helpVisible = !helpVisible;
    const existing = view.querySelector('.notes-help-panel');
    if (existing) { existing.remove(); helpVisible = false; return; }
    const panel = document.createElement('div');
    panel.className = 'notes-help-panel';
    panel.innerHTML = `
      <div class="notes-help-title">RACCOURCIS</div>
      <div class="notes-help-row"><kbd>Shift + Drag</kbd> Connecter deux notes</div>
      <div class="notes-help-row"><kbd>C</kbd> Mode connexion (toggle)</div>
      <div class="notes-help-row"><kbd>Dbl-clic ligne</kbd> Ajouter un point</div>
      <div class="notes-help-row"><kbd>Clic droit ligne</kbd> Supprimer / Couleur</div>
      <div class="notes-help-row"><kbd>Sélection rect.</kbd> Sélectionne notes + points</div>
      <div class="notes-help-row"><kbd>Ctrl + C</kbd> Copier la sélection</div>
      <div class="notes-help-row"><kbd>Ctrl + V</kbd> Coller</div>
      <div class="notes-help-row"><kbd>Suppr</kbd> Supprimer sélection</div>
      <div class="notes-help-row"><kbd>Esc</kbd> Désélectionner / Quitter</div>
      <div class="notes-help-row"><kbd>Clic droit canvas</kbd> Déplacer la vue</div>
      <div class="notes-help-row"><kbd>?</kbd> Afficher / masquer l'aide</div>
    `;
    view.querySelector('.notes-canvas').appendChild(panel);
    helpVisible = true;
  }

  const component = {
    id: 'notes',
    handleKeydown(e) {
      const inTextarea = document.activeElement?.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        closeContextMenu();
        if (connectMode) { connectMode = false; updateConnectModeIndicator(); return true; }
        if (selectedConnId) { e.preventDefault(); deselectConnection(); return true; }
        if (selectedIds.size > 0) { e.preventDefault(); clearSelection(); return true; }
        if (helpVisible) { toggleHelp(); return true; }
        if (inTextarea) { e.preventDefault(); document.activeElement.blur(); return true; }
        e.preventDefault();
        soundManager.playBack();
        router.pop();
        return true;
      }

      if (!inTextarea) {
        if (e.key === '?' || e.key === 'F1') {
          e.preventDefault();
          toggleHelp();
          return true;
        }
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          connectMode = !connectMode;
          soundManager.playToggle(connectMode);
          updateConnectModeIndicator();
          return true;
        }
        // Ctrl+C — copy selected notes (+ internal connections)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          if (selectedIds.size > 0) {
            e.preventDefault();
            const page = activePage();
            const copiedNotes = page.notes.filter(n => selectedIds.has(n.id)).map(n => ({ ...n, blocks: n.blocks.map(b => ({ ...b })) }));
            const copiedConns = page.connections
              .filter(c => selectedIds.has(c.fromId) && selectedIds.has(c.toId))
              .map(c => ({ ...c, waypoints: c.waypoints.map(wp => ({ ...wp })) }));
            clipboard = { notes: copiedNotes, connections: copiedConns };
            soundManager.playConfirm();
            showFeedback(view, `${copiedNotes.length} note(s) copiée(s)`);
            return true;
          }
        }
        // Ctrl+V — paste
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          if (clipboard && clipboard.notes.length > 0) {
            e.preventDefault();
            const page = activePage();
            const idMap = new Map(); // old id → new id
            const offset = 30;
            const newNotes = clipboard.notes.map(n => {
              const newId = crypto.randomUUID();
              idMap.set(n.id, newId);
              return { ...n, id: newId, x: n.x + offset, y: n.y + offset };
            });
            const newConns = clipboard.connections.map(c => ({
              ...c,
              id: crypto.randomUUID(),
              fromId: idMap.get(c.fromId),
              toId: idMap.get(c.toId),
              waypoints: c.waypoints.map(wp => ({ x: wp.x + offset, y: wp.y + offset })),
            })).filter(c => c.fromId && c.toId);
            page.notes.push(...newNotes);
            page.connections.push(...newConns);
            // Select pasted notes
            selectedIds = new Set(newNotes.map(n => n.id));
            persist();
            newNotes.forEach(addNote);
            renderConnections();
            updateSelectionVisuals();
            soundManager.playConfirm();
            showFeedback(view, `${newNotes.length} note(s) collée(s)`);
            return true;
          }
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedWaypoints.length > 0) {
            e.preventDefault();
            const page = activePage();
            // Remove waypoints in reverse index order to keep indices valid
            const byConn = new Map();
            selectedWaypoints.forEach(({ connId, wpIdx }) => {
              if (!byConn.has(connId)) byConn.set(connId, []);
              byConn.get(connId).push(wpIdx);
            });
            byConn.forEach((indices, connId) => {
              const conn = page.connections.find(c => c.id === connId);
              if (!conn) return;
              indices.sort((a, b) => b - a).forEach(i => conn.waypoints.splice(i, 1));
            });
            selectedWaypoints = [];
            soundManager.playBack();
            persist();
            renderConnections();
            return true;
          }
          if (selectedConnId) {
            e.preventDefault();
            const page = activePage();
            page.connections = page.connections.filter(c => c.id !== selectedConnId);
            selectedConnId = null;
            soundManager.playBack();
            persist();
            renderConnections();
            return true;
          }
          if (selectedIds.size > 0) {
            e.preventDefault();
            deleteSelected();
            return true;
          }
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
