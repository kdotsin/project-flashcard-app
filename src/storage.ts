// Load and save AppData in localStorage. The only file that touches localStorage.
// Validates parsed JSON before returning it as typed data; falls back to an
// empty AppData if the saved value is missing or malformed.
// Imports: types.ts

import type { AppData, Card, Deck } from "./types.js";

const STORAGE_KEY = "flashcards:data";

function emptyData(): AppData {
  return { version: 1, decks: [] };
}

// JSON.parse returns `any`, so these guards are the only thing standing
// between saved data and the rest of the app's types.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCard(value: unknown): value is Card {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.front === "string" &&
    typeof value.back === "string"
  );
}

function isDeck(value: unknown): value is Deck {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.cards) &&
    value.cards.every(isCard)
  );
}

function isAppData(value: unknown): value is AppData {
  return (
    isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.decks) &&
    value.decks.every(isDeck)
  );
}

// Lookups go by id, so two decks (or two cards in one deck) sharing an id
// would make edits hit the wrong one. Only hand-edited storage can do this.
function allUnique(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}

function idsAreUnique(data: AppData): boolean {
  return (
    allUnique(data.decks.map((deck) => deck.id)) &&
    data.decks.every((deck) => allUnique(deck.cards.map((card) => card.id)))
  );
}

// Never throws. Bad or missing data is logged and replaced with empty data;
// nothing is written back until the next saveData call.
export function loadData(): AppData {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Flashcards: storage is unavailable, starting empty.", error);
    return emptyData();
  }

  if (raw === null) return emptyData();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("Flashcards: saved data is not valid JSON, starting empty.", raw);
    return emptyData();
  }

  if (!isAppData(parsed)) {
    console.warn("Flashcards: saved data has an unexpected shape, starting empty.", parsed);
    return emptyData();
  }

  if (!idsAreUnique(parsed)) {
    console.warn("Flashcards: saved data has duplicate ids, starting empty.", parsed);
    return emptyData();
  }

  return parsed;
}

// Calls `onChange` when another tab saves (or clears) our data. The browser
// only fires "storage" in the *other* tabs, never the one that saved.
export function onExternalChange(onChange: () => void): void {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  });
}

// Returns false if the browser refused the write (storage full or blocked),
// so the caller can tell the user their change was not saved.
export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Flashcards: could not save.", error);
    return false;
  }
}
