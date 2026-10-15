// Shared data shapes. The contract every other module agrees on.
// Fields are readonly: updates create new objects instead of mutating, so a
// stale reference can never be half-changed.
// Imports: nothing.

export interface Card {
  readonly id: string;
  readonly front: string;
  readonly back: string;
}

// Cards live inside their deck, so deleting a deck cannot orphan cards.
export interface Deck {
  readonly id: string;
  readonly name: string;
  readonly cards: readonly Card[];
}

// Everything persisted to localStorage. `version` lets storage.ts detect and
// migrate old saved data if this shape changes later.
export interface AppData {
  readonly version: 1;
  readonly decks: readonly Deck[];
}

// Outcome of every change in decks.ts: the new AppData, or a message the view
// can show the user. Callers must check `ok` before using `data`.
export type UpdateResult =
  | { readonly ok: true; readonly data: AppData }
  | { readonly ok: false; readonly error: string };

// Which screen is showing. Persisted in the URL hash by router.ts, so a
// refresh (and the back button) keeps the current view.
export type View =
  | { readonly name: "home" }
  | { readonly name: "study"; readonly deckId: string }
  | { readonly name: "manage"; readonly deckId: string };

// A study run through one deck. Kept in memory per deck, so leaving and
// returning resumes where you were. Not persisted: a refresh restarts at card 1.
// Invariant: index always points at a real card (0..cards.length-1);
// `finished` is set by pressing Finish on the last card.
export interface StudySession {
  readonly deckId: string;
  readonly index: number;
  readonly flipped: boolean;
  readonly finished: boolean;
}
