// ── Constants ──────────────────────────────────────────────────────────
const INBOX_ID = 'inbox';

// ── State ──────────────────────────────────────────────────────────────
let sections = [];
let todayItems = []; // [{taskId, sectionId, addedDate: 'YYYY-MM-DD'}]

const SECTION_COLORS = [null, '#c8a97e', '#7ab07a', '#7a9ab0', '#b07a9a', '#b0a07a', '#7ab0a0', '#b08a7a'];

const STALE_AMBER_DAYS = 3;
const STALE_RED_DAYS = 7;

// ── Undo / Redo ────────────────────────────────────────────────────────
const UNDO_MAX = 20;
let undoStack = [];
let redoStack = [];
