// Entry point loaded by index.html. Owns the current AppData, View and StudySession.
// Cycle: load (storage) + read view from URL (router) -> render current view ->
//        user action -> update (decks / session) -> save if AppData changed (storage)
//        -> render. Navigation writes the URL (router); hashchange re-renders.
// Imports: storage.ts, router.ts, decks.ts, session.ts, views/*

import { loadData, onExternalChange, saveData } from "./storage.js";
import { readView, redirect } from "./router.js";
import { addCard, createDeck, deleteCard, deleteDeck, editCard, findDeck, renameDeck } from "./decks.js";
import { flipCard, nextCard, sessionFits, startSession } from "./session.js";
import { renderHome } from "./views/home.js";
import { renderManage, type ManageFocus } from "./views/manage.js";
import { renderStudy, type StudyActions, type StudyFocus } from "./views/study.js";
import type { AppData, Deck, StudySession, UpdateResult } from "./types.js";

// Where the cursor goes after a render. "new-deck" is the home form's input.
// The two view unions share only "none", so each value means one thing.
type Focus = ManageFocus | StudyFocus | "new-deck";

function getRoot(): HTMLElement {
  const root = document.getElementById("app");
  if (!root) throw new Error('index.html is missing <main id="app">');
  return root;
}

const root = getRoot();
let data: AppData = loadData();
// One session per deck, kept while navigating so returning to a deck resumes
// where you were. In memory only: a refresh starts every deck at card 1.
// A deck's session is dropped when its cards change (see applyToDeck).
const sessions = new Map<string, StudySession>();

// The one place AppData changes. Memory is updated only after the save
// succeeds, so what's on screen always matches what survives a refresh.
function commit(result: UpdateResult): string | null {
  if (!result.ok) return result.error;
  if (!saveData(result.data)) return "Couldn't save. Your browser storage may be full or blocked.";
  data = result.data;
  return null;
}

// Commit a change; on success re-render with the cursor at `focus`.
function apply(result: UpdateResult, focus: Focus): string | null {
  const error = commit(result);
  if (error === null) render(focus);
  return error;
}

// Like apply, for changes to a deck's cards: also drops that deck's study
// session, since its position may no longer point at the same card.
function applyToDeck(deckId: string, result: UpdateResult, focus: Focus): string | null {
  const error = commit(result);
  if (error === null) {
    sessions.delete(deckId);
    render(focus);
  }
  return error;
}

// The deck's session, or a fresh one if it has none or no longer fits.
function sessionFor(deck: Deck): StudySession {
  const existing = sessions.get(deck.id);
  if (existing && sessionFits(existing, deck)) return existing;
  const fresh = startSession(deck.id);
  sessions.set(deck.id, fresh);
  return fresh;
}

// Session changes are never saved, so there's nothing that can fail.
function study(deck: Deck, change: (current: StudySession) => StudySession, focus: StudyFocus): void {
  sessions.set(deck.id, change(sessionFor(deck)));
  render(focus);
}

function goHome(): void {
  redirect({ name: "home" });
  render("none");
}

// After deleting, replace the manage entry so Back doesn't lead to a dead deck.
function handleDeleteDeck(deckId: string): string | null {
  const error = commit(deleteDeck(data, deckId));
  if (error === null) {
    sessions.delete(deckId);
    goHome();
  }
  return error;
}

function isManageFocus(focus: Focus): focus is ManageFocus {
  return focus === "none" || focus === "rename" || focus === "cards" || focus === "add-card" || typeof focus === "object";
}

function isStudyFocus(focus: Focus): focus is StudyFocus {
  return focus === "none" || focus === "flip" || focus === "next" || focus === "restart";
}

function render(focus: Focus): void {
  const view = readView(data);
  switch (view.name) {
    case "home":
      renderHome(root, data, { createDeck: (name) => apply(createDeck(data, name), "new-deck") }, focus === "new-deck");
      return;
    case "manage": {
      // readView already checked the deck exists; this satisfies the type.
      const deck = findDeck(data, view.deckId);
      if (!deck) return goHome();
      const id = deck.id;
      renderManage(
        root,
        deck,
        {
          renameDeck: (name) => apply(renameDeck(data, id, name), "rename"),
          deleteDeck: () => handleDeleteDeck(id),
          addCard: (front, back) => applyToDeck(id, addCard(data, id, front, back), "add-card"),
          editCard: (cardId, front, back) => applyToDeck(id, editCard(data, id, cardId, front, back), { edit: cardId }),
          deleteCard: (cardId) => applyToDeck(id, deleteCard(data, id, cardId), "cards"),
        },
        isManageFocus(focus) ? focus : "none",
      );
      return;
    }
    case "study": {
      const deck = findDeck(data, view.deckId);
      if (!deck) return goHome();
      renderStudy(root, deck, sessionFor(deck), studyActions(deck), isStudyFocus(focus) ? focus : "none");
      return;
    }
  }
}

// Shared by the study buttons and the keyboard shortcuts, so they can't drift apart.
function studyActions(deck: Deck): StudyActions {
  return {
    flip: () => study(deck, flipCard, "flip"),
    next: () => study(deck, (current) => nextCard(current, deck), "next"),
    restart: () => study(deck, () => startSession(deck.id), "restart"),
  };
}

// Study shortcuts: Space flips, → goes to the next card.
// - Space is left to the browser when a button/link/field has focus, so it
//   presses that control as usual and never fires twice.
// - Held-down keys (repeat) and modifier combos (browser shortcuts) are ignored.
// - Nothing happens on the empty or finished screens.
const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const PRESSABLE = new Set(["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT", "SUMMARY"]);

function handleStudyKey(event: KeyboardEvent): void {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== " " && event.key !== "ArrowRight") return;

  const view = readView(data);
  if (view.name !== "study") return;
  const deck = findDeck(data, view.deckId);
  if (!deck || deck.cards.length === 0 || sessionFor(deck).finished) return;

  const focused = document.activeElement?.tagName ?? "";
  if (event.key === " ") {
    if (PRESSABLE.has(focused)) return;
    event.preventDefault(); // otherwise Space also scrolls the page
    studyActions(deck).flip();
  } else {
    if (TYPING.has(focused)) return;
    event.preventDefault();
    studyActions(deck).next();
  }
}

function cardIds(deck: Deck | undefined): string {
  return deck ? deck.cards.map((card) => card.id).join("\n") : "";
}

// Another tab saved. Reload so this tab never saves over that change with
// stale data. Study progress survives unless that deck's cards changed.
function handleExternalChange(): void {
  const previous = data;
  data = loadData();
  for (const deckId of sessions.keys()) {
    if (cardIds(findDeck(previous, deckId)) !== cardIds(findDeck(data, deckId))) sessions.delete(deckId);
  }
  render("none");
}

window.addEventListener("hashchange", () => render("none"));
document.addEventListener("keydown", handleStudyKey);
onExternalChange(handleExternalChange);
render("none");
