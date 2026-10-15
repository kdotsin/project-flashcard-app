// Study logic: start a session, flip, next. Pure functions, no DOM, no storage.
// Read-only toward decks: studying never changes cards.
// Imports: types.ts

import type { Deck, StudySession } from "./types.js";

export function startSession(deckId: string): StudySession {
  return { deckId, index: 0, flipped: false, finished: false };
}

export function flipCard(session: StudySession): StudySession {
  if (session.finished) return session;
  return { ...session, flipped: !session.flipped };
}

// Moves to the next card, front side up. On the last card it sets `finished`
// instead, leaving index on that last card so it always points at a real card.
export function nextCard(session: StudySession, deck: Deck): StudySession {
  if (session.finished) return session;
  if (session.index >= deck.cards.length - 1) return { ...session, flipped: false, finished: true };
  return { ...session, index: session.index + 1, flipped: false };
}

// True if the session still fits the deck: same deck, and index points at a
// real card. app.ts resets sessions on card edits; this is the backstop.
export function sessionFits(session: StudySession, deck: Deck): boolean {
  return session.deckId === deck.id && session.index >= 0 && session.index < deck.cards.length;
}
