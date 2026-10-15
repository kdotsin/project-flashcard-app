// Small helpers shared by the views.
// Class names refer to the component styles in index.html.
// Imports: ../types.ts

import type { Deck } from "../types.js";

export type Control = HTMLInputElement | HTMLTextAreaElement;
export type ButtonStyle = "primary" | "secondary" | "quiet" | "danger";

// Create an element, optionally with text and classes. Text always goes
// through textContent, so user text can never become HTML.
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className !== undefined) node.className = className;
  return node;
}

// Speak a message to screen readers via the live region in index.html.
// Needed when an action changes the content but not the focused control
// (e.g. Flip: focus stays on the Flip button, so nothing else is announced).
export function announce(message: string): void {
  const region = document.getElementById("announcer");
  if (region) region.textContent = message;
}

export function cardCount(deck: Deck): string {
  const n = deck.cards.length;
  return `${n} card${n === 1 ? "" : "s"}`;
}

export function link(text: string, href: string, className: string): HTMLAnchorElement {
  const anchor = el("a", text, className);
  anchor.href = href;
  return anchor;
}

// Card text keeps its line breaks and sits on the index card's writing lines.
export function cardFace(text: string): HTMLParagraphElement {
  return el("p", text, "card-text whitespace-pre-wrap");
}

export function button(text: string, style: ButtonStyle = "secondary"): HTMLButtonElement {
  const node = el("button", text, `btn btn-${style}`);
  node.type = "button";
  return node;
}

export function submitButton(text: string, style: ButtonStyle = "primary"): HTMLButtonElement {
  const node = el("button", text, `btn btn-${style}`);
  node.type = "submit";
  return node;
}

// A required, labelled text field. `id` must be unique on the page.
export function field(id: string, labelText: string, value: string, multiline: boolean): { label: HTMLLabelElement; control: Control } {
  const label = el("label", labelText, "field-label");
  label.htmlFor = id;

  let control: Control;
  if (multiline) {
    const area = el("textarea");
    area.rows = 3;
    control = area;
  } else {
    const input = el("input");
    input.type = "text";
    input.autocomplete = "off";
    control = input;
  }
  control.className = "field";
  control.id = id;
  control.required = true;
  control.value = value;
  return { label, control };
}

// Where a form's error message appears. aria-live makes screen readers announce it.
export function errorLine(id: string): HTMLParagraphElement {
  const line = el("p", undefined, "form-error");
  line.id = id;
  line.setAttribute("aria-live", "polite");
  return line;
}

// Link controls to their error line so screen readers read the message with them.
export function describedBy(controls: readonly Control[], error: HTMLElement): void {
  for (const control of controls) control.setAttribute("aria-describedby", error.id);
}

// On submit, run `submit`. On error, show the message and refocus `focusOnError`,
// keeping the typed text. On success the caller has already re-rendered.
export function handleSubmit(
  form: HTMLFormElement,
  error: HTMLElement,
  focusOnError: Control,
  submit: () => string | null,
): void {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = submit();
    if (message !== null) {
      error.textContent = message;
      focusOnError.focus();
    }
  });
}

export interface TextFormOptions {
  readonly id: string; // input id; must be unique on the page
  readonly label: string;
  readonly button: string;
  readonly buttonStyle: ButtonStyle;
  readonly value: string; // starting value of the input
  // Returns an error message to show, or null on success.
  readonly onSubmit: (value: string) => string | null;
}

// Labelled one-field form: input and button share a row, wrapping on narrow screens.
export function textForm(options: TextFormOptions): { form: HTMLFormElement; input: Control } {
  const form = el("form");
  const { label, control } = field(options.id, options.label, options.value, false);
  const error = errorLine(`${options.id}-error`);
  describedBy([control], error);

  const row = el("div", undefined, "field-row");
  row.append(control, submitButton(options.button, options.buttonStyle));

  form.append(label, row, error);
  handleSubmit(form, error, control, () => options.onSubmit(control.value));
  return { form, input: control };
}
