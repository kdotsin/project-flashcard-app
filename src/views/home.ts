// Home view: list decks, create a deck, open a deck to study or manage.
// Draws only; reports user actions back to app.ts through callbacks.
// Uses textContent (never innerHTML) for user text.
// Imports: ../types.ts, ../router.ts (viewToHash only, for link hrefs), ./dom.ts

import type { AppData, Deck } from "../types.js";
import { viewToHash } from "../router.js";
import { cardCount, el, link, textForm } from "./dom.js";

export interface HomeActions {
  // Returns an error message to show, or null on success.
  readonly createDeck: (name: string) => string | null;
}

// How many cards are drawn stacked behind the tile: 0, 1, or 2 (for 2+).
function stackClass(deck: Deck): string {
  const n = deck.cards.length;
  return n === 0 ? "" : n === 1 ? " stack-1" : " stack-2";
}

function deckTile(deck: Deck): HTMLLIElement {
  // Every tile has the same link text; the label tells screen readers which deck.
  const study = link("Study", viewToHash({ name: "study", deckId: deck.id }), "btn btn-primary");
  study.setAttribute("aria-label", `Study ${deck.name}`);

  const manage = link("Manage", viewToHash({ name: "manage", deckId: deck.id }), "btn btn-secondary");
  manage.setAttribute("aria-label", `Manage ${deck.name}`);

  const actions = el("div", undefined, "deck-actions");
  actions.append(study, manage);

  const item = el("li", undefined, `deck-tile${stackClass(deck)}`);
  item.append(el("span", deck.name, "deck-name"), " ", el("span", cardCount(deck), "meta"), " ", actions);
  return item;
}

function deckList(decks: readonly Deck[]): HTMLElement {
  if (decks.length === 0) return el("p", "No decks yet. Name your first one above to get started.", "card-blank");

  const list = el("ul", undefined, "deck-grid");
  list.append(...decks.map(deckTile));
  return list;
}

// focusForm: put the cursor back in the input (after creating a deck), so
// keyboard users can keep adding without hunting for the field.
export function renderHome(root: HTMLElement, data: AppData, actions: HomeActions, focusForm: boolean): void {
  const { form, input } = textForm({
    id: "new-deck-name",
    label: "New deck name",
    button: "Create deck",
    buttonStyle: "primary",
    value: "",
    onSubmit: actions.createDeck,
  });

  const intro = el("div");
  const n = data.decks.length;
  intro.append(el("p", `${n} deck${n === 1 ? "" : "s"}`, "eyebrow"), el("h1", "Your decks", "title"));

  const head = el("div", undefined, "home-head");
  head.append(intro, form);

  root.replaceChildren(head, deckList(data.decks));
  if (focusForm) input.focus();
}
