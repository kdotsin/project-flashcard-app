// Converts View <-> URL hash: #/ , #/study/<deckId> , #/manage/<deckId>.
// The only file that touches location.hash.
// The hash is user-editable input: unknown routes or a deckId that no longer
// exists fall back to { name: "home" }.
// Imports: types.ts

import type { AppData, View } from "./types.js";

const HOME: View = { name: "home" };

export function viewToHash(view: View): string {
  switch (view.name) {
    case "home":
      return "#/";
    case "study":
      return `#/study/${encodeURIComponent(view.deckId)}`;
    case "manage":
      return `#/manage/${encodeURIComponent(view.deckId)}`;
  }
}

function parseHash(hash: string): View {
  const parts = hash.replace(/^#\/?/, "").split("/");
  if (parts.length !== 2) return HOME;

  const [name, rawId] = parts;
  if (rawId === undefined || rawId === "") return HOME;

  let deckId: string;
  try {
    deckId = decodeURIComponent(rawId);
  } catch {
    return HOME; // malformed %-escape, e.g. #/study/%E0
  }

  if (name === "study" || name === "manage") return { name, deckId };
  return HOME;
}

// Current view from the URL, checked against the data. If the URL was invalid
// or pointed at a missing deck, it is corrected in place (no history entry).
export function readView(data: AppData): View {
  const parsed = parseHash(location.hash);
  const view =
    parsed.name !== "home" && !data.decks.some((deck) => deck.id === parsed.deckId) ? HOME : parsed;

  if (location.hash !== viewToHash(view)) redirect(view);
  return view;
}

// Go to a view, adding a history entry. Fires hashchange, which re-renders.
export function navigate(view: View): void {
  location.hash = viewToHash(view);
}

// Replace the current history entry, so Back skips it. Does NOT fire
// hashchange: the caller must re-render.
export function redirect(view: View): void {
  history.replaceState(null, "", viewToHash(view));
}
