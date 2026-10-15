// Study view: show the current card, flip, next, back to home. Nothing else.
// Draws only; reports user actions back to app.ts through callbacks.
// Uses textContent (never innerHTML) for user text.
// Imports: ../types.ts, ../router.ts (viewToHash only, for link hrefs), ./dom.ts

import type { Deck, StudySession } from "../types.js";
import { viewToHash } from "../router.js";
import { announce, button, cardCount, cardFace, el, link } from "./dom.js";

export interface StudyActions {
  readonly flip: () => void;
  readonly next: () => void;
  readonly restart: () => void;
}

// What the user just did, so the re-render can place focus and announce it.
// During a deck, focus always rests on Flip: Space then flips (natively, as
// the focused button) and → moves on, without Space ever pressing Next by accident.
export type StudyFocus = "none" | "flip" | "next" | "restart";

// "Space flips · → next card", shown only on devices with a keyboard (CSS).
function shortcutHint(): HTMLParagraphElement {
  const hint = el("p", undefined, "meta shortcuts");
  hint.append(el("kbd", "Space"), " flips the card · ", el("kbd", "→"), " goes to the next card");
  return hint;
}

function header(deck: Deck, status: string): HTMLElement {
  const titleBlock = el("div");
  titleBlock.append(el("p", "Studying", "eyebrow"), el("h1", deck.name, "title"));

  const head = el("header", undefined, "study-head");
  head.append(titleBlock, el("p", status, "meta"));
  return head;
}

// Thin bar showing how far through the deck you are. Decorative for screen
// readers: the "Card 2 of 5" text already says it.
function progressBar(done: number, total: number): HTMLDivElement {
  const bar = el("div", undefined, "progress");
  bar.setAttribute("aria-hidden", "true");
  const fill = el("span");
  fill.style.width = `${Math.round((done / total) * 100)}%`;
  bar.append(fill);
  return bar;
}

export function renderStudy(
  root: HTMLElement,
  deck: Deck,
  session: StudySession,
  actions: StudyActions,
  focus: StudyFocus,
): void {
  const back = link("← All decks", viewToHash({ name: "home" }), "back-link");
  const wrap = el("div", undefined, "study");
  const total = deck.cards.length;

  if (total === 0) {
    const controls = el("div", undefined, "study-controls");
    controls.append(link("Add cards", viewToHash({ name: "manage", deckId: deck.id }), "btn btn-primary"));
    wrap.append(back, header(deck, "0 cards"), el("p", "This deck has no cards yet.", "card-blank"), controls);
    root.replaceChildren(wrap);
    return;
  }

  if (session.finished) {
    const again = button("Study again", "primary");
    again.addEventListener("click", actions.restart);

    const card = el("div", undefined, "index-card study-card");
    const head = el("div", undefined, "card-head");
    head.append(el("span", "Deck complete", "eyebrow"));
    card.append(head, cardFace(`You finished the deck: ${cardCount(deck)} reviewed.`));

    const controls = el("div", undefined, "study-controls");
    controls.append(again, link("All decks", viewToHash({ name: "home" }), "btn btn-secondary"));

    wrap.append(back, header(deck, `${total} of ${total}`), progressBar(total, total), card, controls);
    root.replaceChildren(wrap);
    if (focus === "next") {
      // "Finish" was just pressed
      again.focus();
      announce(`You finished the deck: ${cardCount(deck)} reviewed.`);
    }
    return;
  }

  // app.ts guarantees index points at a real card; this satisfies the type.
  const current = deck.cards[session.index];
  if (current === undefined) return;

  const position = `Card ${session.index + 1} of ${total}`;

  const card = el("div", undefined, "index-card study-card");
  // The single motion moment: the card turns over when Flip was just pressed.
  if (focus === "flip") card.classList.add("flip-in");
  const head = el("div", undefined, "card-head");
  head.append(el("span", session.flipped ? "Back" : "Front", "eyebrow"));
  card.append(head, cardFace(session.flipped ? current.back : current.front));

  const stage = el("div", undefined, "study-stage");
  stage.append(card);

  const flip = button("Flip card", "primary");
  flip.addEventListener("click", actions.flip);

  const isLast = session.index === total - 1;
  const next = button(isLast ? "Finish" : "Next card", "secondary");
  next.addEventListener("click", actions.next);

  // Progress is kept when you leave, so this is the way to restart mid-deck.
  const startOver = button("Start over", "quiet");
  startOver.addEventListener("click", actions.restart);

  const controls = el("div", undefined, "study-controls");
  controls.append(flip, next, startOver);

  wrap.append(back, header(deck, position), progressBar(session.index, total), stage, controls, shortcutHint());
  root.replaceChildren(wrap);

  const sideName = session.flipped ? "Back" : "Front";
  const shown = session.flipped ? current.back : current.front;
  if (focus === "flip") {
    flip.focus();
    announce(`${sideName}: ${shown}`);
  } else if (focus === "next" || focus === "restart") {
    flip.focus();
    announce(`${position}. ${sideName}: ${shown}`);
  }
}
