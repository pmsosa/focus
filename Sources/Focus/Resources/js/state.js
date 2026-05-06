// ── Constants ──────────────────────────────────────────────────────────
const INBOX_ID = 'inbox';

// ── State ──────────────────────────────────────────────────────────────
let sections = [];
let todayItems = []; // [{taskId, sectionId, addedDate: 'YYYY-MM-DD'}]
let currentDrag = null; // { type: 'task'|'section', taskId?, sectionId }

const SECTION_COLORS = [null, '#c8a97e', '#7ab07a', '#7a9ab0', '#b07a9a', '#b0a07a', '#7ab0a0', '#b08a7a'];

// ── Undo / Redo ────────────────────────────────────────────────────────
const UNDO_MAX = 20;
let undoStack = [];
let redoStack = [];
