// Manage view: rename/delete the deck; add, edit, delete its cards.
// Draws only; reports user actions back to app.ts through callbacks.
// Uses textContent (never innerHTML) for user text; form inputs are labelled.
// Imports: ../types.ts, ../router.ts (viewToHash only, for link hrefs), ./dom.ts

import type { Card, Deck } from "../types.js";
import { viewToHash } from "../router.js";
import {
  button,
  cardCount,
  cardFace,
  type Control,
  describedBy,
  el,
  errorLine,
  field,
  handleSubmit,
  link,
  submitButton,
  textForm,
} from "./dom.js";

// app.ts binds the deck id, so the view never handles deck ids itself.
// Each returns an error message to show, or null on success.
export interface ManageActions {
  readonly renameDeck: (name: string) => string | null;
  readonly deleteDeck: () => string | null;
  readonly addCard: (front: string, back: string) => string | null;
  readonly editCard: (cardId: string, front: string, back: string) => string | null;
  readonly deleteCard: (cardId: string) => string | null;
}

// Where the cursor goes after app.ts re-renders this view.
export type ManageFocus =
  | "none"
  | "rename" // after renaming the deck
  | "cards" // after deleting a card: the "Cards" heading
  | "add-card" // after adding a card: ready to add the next
  | { readonly edit: string }; // after saving an edit: that card's Edit button

interface CardFormOptions {
  readonly idPrefix: string; // must be unique on the page
  readonly front: string;
  readonly back: string;
  readonly button: string;
  readonly extra: readonly HTMLElement[]; // placed after the submit button
  readonly onSubmit: (front: string, back: string) => string | null;
}

function cardForm(options: CardFormOptions): { form: HTMLFormElement; front: Control } {
  const form = el("form");
  const front = field(`${options.idPrefix}-front`, "Front", options.front, true);
  const back = field(`${options.idPrefix}-back`, "Back", options.back, true);
  const error = errorLine(`${options.idPrefix}-error`);
  describedBy([front.control, back.control], error);

  const frontWrap = el("div");
  frontWrap.append(front.label, front.control);
  const backWrap = el("div");
  backWrap.append(back.label, back.control);
  const fields = el("div", undefined, "card-form-fields");
  fields.append(frontWrap, backWrap);

  const actions = el("div", undefined, "form-actions");
  actions.append(submitButton(options.button), ...options.extra);

  form.append(fields, actions, error);
  handleSubmit(form, error, front.control, () => options.onSubmit(front.control.value, back.control.value));
  return { form, front: front.control };
}

// Two-digit card number ("01"): it encodes the card's real position in the deck.
function cardNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function side(label: string, text: string): HTMLDivElement {
  const wrap = el("div");
  wrap.append(el("p", label, "side-label"), cardFace(text));
  return wrap;
}

// One card in the list. Edit swaps the row for a form in place; Cancel swaps
// it back. That toggle is local to this row: nothing else needs to know.
function cardRow(card: Card, index: number, actions: ManageActions): { item: HTMLLIElement; editButton: HTMLButtonElement } {
  const item = el("li", undefined, "index-card");

  const editButton = button("Edit", "quiet");
  editButton.setAttribute("aria-label", `Edit card: ${card.front}`);

  const deleteButton = button("Delete", "quiet");
  deleteButton.setAttribute("aria-label", `Delete card: ${card.front}`);

  const deleteError = errorLine(`card-${index}-delete-error`);

  const head = (): HTMLDivElement => {
    const row = el("div", undefined, "card-head");
    const rowActions = el("div", undefined, "row-actions");
    rowActions.append(editButton, deleteButton);
    row.append(el("span", `No. ${cardNumber(index)}`, "meta"), rowActions);
    return row;
  };

  const showCard = (): void => {
    item.className = "index-card";
    const sides = el("div", undefined, "card-sides");
    sides.append(side("Front", card.front), side("Back", card.back));
    item.replaceChildren(head(), sides, deleteError);
  };

  editButton.addEventListener("click", () => {
    const cancel = button("Cancel", "quiet");
    const { form, front } = cardForm({
      idPrefix: `card-${index}`,
      front: card.front,
      back: card.back,
      button: "Save",
      extra: [cancel],
      onSubmit: (f, b) => actions.editCard(card.id, f, b),
    });
    cancel.addEventListener("click", () => {
      showCard();
      editButton.focus();
    });
    item.className = "index-card card-edit";
    item.replaceChildren(el("p", `Editing No. ${cardNumber(index)}`, "eyebrow"), form);
    front.focus();
  });

  deleteButton.addEventListener("click", () => {
    if (!confirm(`Delete this card?\n\n${card.front}`)) return;
    const message = actions.deleteCard(card.id);
    if (message !== null) deleteError.textContent = message;
  });

  showCard();
  return { item, editButton };
}

function settingsPanel(deck: Deck, actions: ManageActions): { panel: HTMLElement; renameInput: Control } {
  const rename = textForm({
    id: "rename-deck-name",
    label: "Deck name",
    button: "Rename",
    buttonStyle: "secondary",
    value: deck.name,
    onSubmit: actions.renameDeck,
  });

  const deleteButton = button("Delete deck", "danger");
  const error = errorLine("delete-deck-error");
  deleteButton.addEventListener("click", () => {
    if (!confirm(`Delete "${deck.name}" and its ${cardCount(deck)}? This can't be undone.`)) return;
    const message = actions.deleteDeck();
    if (message !== null) error.textContent = message;
  });

  // Destructive action set apart from everyday ones, below a divider.
  const panel = el("section", undefined, "panel area-settings");
  panel.setAttribute("aria-label", "Deck settings");
  panel.append(
    el("h2", "Deck settings", "subhead"),
    rename.form,
    el("hr", undefined, "settings-divider"),
    el("p", "Deleting removes the deck and every card in it.", "meta"),
    deleteButton,
    error,
  );
  return { panel, renameInput: rename.input };
}

export function renderManage(root: HTMLElement, deck: Deck, actions: ManageActions, focus: ManageFocus): void {
  const head = el("header", undefined, "manage-head");
  head.append(
    link("← All decks", viewToHash({ name: "home" }), "back-link"),
    el("p", "Manage deck", "eyebrow"),
    el("h1", deck.name, "title"),
    el("p", cardCount(deck), "meta"),
  );

  // Cards
  const cardsHeading = el("h2", "Cards", "subhead");
  cardsHeading.tabIndex = -1; // focusable by script only, not in the Tab order

  const rows = deck.cards.map((card, index) => ({ cardId: card.id, ...cardRow(card, index, actions) }));
  let list: HTMLElement;
  if (rows.length === 0) {
    list = el("p", "No cards yet. Write the first one in “Add a card”.", "card-blank");
  } else {
    list = el("ol", undefined, "card-list");
    list.append(...rows.map((row) => row.item));
  }

  const listSection = el("section", undefined, "area-list");
  listSection.setAttribute("aria-labelledby", "cards-heading");
  cardsHeading.id = "cards-heading";
  listSection.append(cardsHeading, list);

  // Add a card
  const add = cardForm({
    idPrefix: "new-card",
    front: "",
    back: "",
    button: "Add card",
    extra: [],
    onSubmit: actions.addCard,
  });
  const addPanel = el("section", undefined, "panel area-add");
  addPanel.setAttribute("aria-label", "Add a card");
  addPanel.append(el("h2", "Add a card", "subhead"), add.form);

  const settings = settingsPanel(deck, actions);

  const layout = el("div", undefined, "manage-layout");
  layout.append(addPanel, listSection, settings.panel);

  root.replaceChildren(head, layout);

  if (focus === "rename") settings.renameInput.focus();
  else if (focus === "cards") cardsHeading.focus();
  else if (focus === "add-card") add.front.focus();
  else if (typeof focus === "object") rows.find((row) => row.cardId === focus.edit)?.editButton.focus();
}
