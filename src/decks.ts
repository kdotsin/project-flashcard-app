// CRUD for decks and the cards inside them. Pure functions: take AppData,
// return new AppData. No DOM, no storage.
// Owns input rules: trim text, reject blank deck names and blank card faces.
// Imports: types.ts

import type { AppData, Card, Deck, UpdateResult } from "./types.js";

// crypto.randomUUID only exists in secure contexts (https, localhost).
// Testing on a phone over the LAN (http://192.168...) is not one, so fall back
// to getRandomValues, which works everywhere.
function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function ok(data: AppData): UpdateResult {
  return { ok: true, data };
}

function fail(error: string): UpdateResult {
  return { ok: false, error };
}

// Swap one deck (matched by id) for its updated version.
function replaceDeck(data: AppData, updated: Deck): AppData {
  return {
    ...data,
    decks: data.decks.map((deck) => (deck.id === updated.id ? updated : deck)),
  };
}

export function findDeck(data: AppData, deckId: string): Deck | undefined {
  return data.decks.find((deck) => deck.id === deckId);
}

// ---- Decks ----

export function createDeck(data: AppData, name: string): UpdateResult {
  const trimmed = name.trim();
  if (trimmed === "") return fail("Deck name can't be blank.");

  const deck: Deck = { id: newId(), name: trimmed, cards: [] };
  return ok({ ...data, decks: [...data.decks, deck] });
}

export function renameDeck(data: AppData, deckId: string, name: string): UpdateResult {
  const deck = findDeck(data, deckId);
  if (!deck) return fail("Deck not found.");

  const trimmed = name.trim();
  if (trimmed === "") return fail("Deck name can't be blank.");

  return ok(replaceDeck(data, { ...deck, name: trimmed }));
}

export function deleteDeck(data: AppData, deckId: string): UpdateResult {
  if (!findDeck(data, deckId)) return fail("Deck not found.");
  return ok({ ...data, decks: data.decks.filter((deck) => deck.id !== deckId) });
}

// ---- Cards ----

export function addCard(data: AppData, deckId: string, front: string, back: string): UpdateResult {
  const deck = findDeck(data, deckId);
  if (!deck) return fail("Deck not found.");

  const f = front.trim();
  const b = back.trim();
  if (f === "" || b === "") return fail("Front and back can't be blank.");

  const card: Card = { id: newId(), front: f, back: b };
  return ok(replaceDeck(data, { ...deck, cards: [...deck.cards, card] }));
}

export function editCard(
  data: AppData,
  deckId: string,
  cardId: string,
  front: string,
  back: string,
): UpdateResult {
  const deck = findDeck(data, deckId);
  if (!deck) return fail("Deck not found.");
  if (!deck.cards.some((card) => card.id === cardId)) return fail("Card not found.");

  const f = front.trim();
  const b = back.trim();
  if (f === "" || b === "") return fail("Front and back can't be blank.");

  const cards = deck.cards.map((card) => (card.id === cardId ? { ...card, front: f, back: b } : card));
  return ok(replaceDeck(data, { ...deck, cards }));
}

export function deleteCard(data: AppData, deckId: string, cardId: string): UpdateResult {
  const deck = findDeck(data, deckId);
  if (!deck) return fail("Deck not found.");
  if (!deck.cards.some((card) => card.id === cardId)) return fail("Card not found.");

  const cards = deck.cards.filter((card) => card.id !== cardId);
  return ok(replaceDeck(data, { ...deck, cards }));
}
