# Flashcards

A flashcard study app built with TypeScript and no framework. Create decks, fill them with cards, and study them one card at a time: flip to check your answer, then move to the next card. Everything is saved in your browser, so your decks are still there when you come back.

The visual design is based on a real index card: cream card stock, a red line under the header, and blue writing lines that the card text sits on.

---

## Features

- **Decks:** create, rename and delete decks. The cards drawn stacked behind each deck reflect how many cards it holds.
- **Cards:** add, edit and delete cards on a separate Manage screen. Editing happens in place, and multi-line answers keep their line breaks.
- **Study mode:** flip a card, go to the next one, and finish the deck. It has a progress bar, a "Start over" button and a "Deck complete" screen.
- **Remembers your place:** leave a deck halfway through and come back later, and you're on the same card. Each deck keeps its own progress.
- **Survives a refresh:** decks and cards are saved in `localStorage`, and the current screen is kept in the URL.
- **Keyboard shortcuts:** <kbd>Space</kbd> flips the card and <kbd>→</kbd> goes to the next card.
- **Multiple tabs:** if the app is open in two tabs, a change saved in one appears in the other, and neither tab overwrites the other's work.

## Tech stack

| | |
|---|---|
| Language | TypeScript (strict mode), compiled with plain `tsc` (no bundler) |
| Styling | Tailwind CSS v4 (CDN build) with custom design tokens and component classes |
| Fonts | Fraunces, Inter Tight, IBM Plex Mono (Google Fonts) |
| Storage | Browser `localStorage` |
| Routing | URL hash (`#/`, `#/study/<deckId>`, `#/manage/<deckId>`) |

## Getting started

```bash
npm install
npm run watch     # terminal 1: recompiles src/ into dist/ on every save
```

Then serve the project folder in either of these ways:

- **VS Code Live Server:** right-click `index.html` and choose "Open with Live Server".
- **Or from a terminal:** run `npm run serve`, then open <http://localhost:5500>.

> The page has to be served by a local server. If you open `index.html` directly from your file system (`file://`), the browser blocks the app's JavaScript modules.

## Project structure

```
flashcard-app/
├── index.html          page shell, design tokens and component styles
└── src/
    ├── types.ts        data shapes: Card, Deck, AppData, View, StudySession
    ├── storage.ts      the only file that touches localStorage; checks saved data before using it
    ├── decks.ts        create / rename / delete decks and cards (pure functions)
    ├── session.ts      study logic: start, flip, next, finish (pure functions)
    ├── router.ts       converts between the URL hash and the current screen
    ├── app.ts          entry point: holds the state and connects everything
    └── views/
        ├── dom.ts      shared helpers for building elements and forms
        ├── home.ts     deck list and the new-deck form
        ├── manage.ts   card list, add/edit forms and deck settings
        └── study.ts    the study card, flip/next and the finished screen
```

### How the pieces fit together

Imports only flow one way. `types.ts` is the foundation and imports nothing. `app.ts` is the only file that knows about everything else.

```
user action → view callback → app.ts → decks.ts / session.ts (returns new data)
            → storage.ts (save) → app.ts updates its state → view redraws
```

- **Views only draw.** They never save anything or change data themselves.
- **One place changes saved data.** Every change goes through `commit()` in `app.ts`.
- **The screen never shows unsaved work.** The data in memory is updated only *after* the save succeeds, so the screen always matches what will survive a refresh.

## Accessibility

- Every form field has a label, and error messages are announced to screen readers.
- After each action, keyboard focus moves somewhere useful instead of jumping back to the top of the page.
- Screen readers announce the new card after Flip and Next (see the reflection below).
- Every button and link is at least 44px tall, and there's a visible focus outline on everything you can tab to.
- Text contrast meets WCAG AA (the lowest ratio is 5.25:1).
- The card-flip animation is turned off for users who set "reduce motion" in their system settings.

## Known limitations

- **Progress resets on refresh:** study progress is kept in memory only, so a refresh starts every deck at card 1. This was a deliberate choice.
- **Unsaved edits can be lost:** an unsaved card edit disappears if the screen redraws, for example when you add another card.
- **No length limit:** there's no cap on deck names or card text.
- **Development-only Tailwind:** the Tailwind CDN build is meant for development, not production.

---

## AI reflection

### Where AI saved time

The biggest time savings came in **design** and in **thinking through edge cases**.

On the design side, AI turned "make it look as good as possible" into a complete visual system: a color palette checked for contrast, a font pairing, layouts for phone and desktop, and the index-card concept the whole look is built around. Doing that by hand would have taken me much longer.

On the edge-case side, AI raised problems before they turned into bugs, such as:
- What happens if you delete a card in the middle of studying it?
- What happens if someone types a fake deck ID into the URL?
- What happens if saved data is corrupted?
- What happens if the app is open in two tabs and both save?

Each of these was found and handled before it ever reached the browser.

### An AI bug I identified and how I fixed it

The most important issue I caught wasn't a syntax error. It was AI building the **wrong behavior** because my instructions weren't specific enough.

When I first asked for a study mode, the AI decided that leaving the study screen in any way should reset your progress. It also had no explicit "finished" flag: it worked out whether a deck was done from the card position. Both were reasonable guesses, but neither was what I actually wanted. I fixed it by stating the requirement precisely:

> *"We should definitely have a finished or done flag once the studying is complete. The session shouldn't reset on any navigation. It should go back to where it was."*

The AI then rebuilt the study session around an explicit `finished` field and stored progress separately for each deck. It also pointed out a new problem my change created: if you edit a deck's cards while partway through studying it, the saved position could point at the wrong card. We agreed that changing a deck's cards resets that deck's progress.

**What I learned:** AI fills gaps in a request with its own assumptions, and they won't always match yours. The fix is to be specific about behavior, not just features.

### A code snippet refactored for clarity

Every action in the app (create a deck, rename it, add a card) followed the same steps: try the change, save it, then redraw the screen if it worked. At first, each action had its own copy of that logic:

```ts
// Before: the same three lines repeated in every handler
function handleCreateDeck(name: string): string | null {
  const error = commit(createDeck(data, name));
  if (error === null) render(true);
  return error;
}

function handleRenameDeck(deckId: string, name: string): string | null {
  const error = commit(renameDeck(data, deckId, name));
  if (error === null) render(true);
  return error;
}
```

During the build these were combined into one helper, so each action now takes one line:

```ts
// After: one helper; each action says what changes and where focus goes next
function apply(result: UpdateResult, focus: Focus): string | null {
  const error = commit(result);
  if (error === null) render(focus);
  return error;
}

renameDeck: (name) => apply(renameDeck(data, id, name), "rename"),
addCard: (front, back) => applyToDeck(id, addCard(data, id, front, back), "add-card"),
```

There's now a single place where "save, then redraw" happens. Adding a new action is one line, and it can't accidentally skip the save step.

### An accessibility improvement

**Screen readers announce the card after it flips.**

When you press Flip, the card text changes, but keyboard focus stays on the Flip button. Screen readers mostly announce what has focus, so a blind user would press Flip and hear nothing at all.

The fix is a hidden "live region" that sits outside the part of the page that gets redrawn:

```html
<p id="announcer" class="sr-only" aria-live="polite"></p>
```

After every Flip, Next or Finish, the app writes a short message into it, such as *"Back: hello"* or *"Card 2 of 3. Front: adiós"*, and the screen reader reads it aloud. It has to stay outside the redrawn part of the page, because screen readers only announce changes to a live region that was already there.

### What prompt changes improved AI output

The single biggest improvement was **writing down rules for the AI in a `CLAUDE.md` file** instead of repeating instructions in every prompt. Two rulesets made the difference:

1. **How to work in my codebase:**
   - map out how the code connects before changing anything
   - stay within the scope of each request and ask before going outside it
   - check its own work, and say plainly when it's unsure
2. **Design standards:**
   - a list of "AI-looking" design patterns to avoid
   - rules for typography, color contrast and phone-first layout
   - a checklist to run before calling a design finished

With those rules in place, the AI asked questions at the right moments instead of guessing. It also flagged anything outside the scope of my request instead of quietly changing it, and the design came out looking deliberate rather than generic. The output caused almost no problems.

A second change that helped was **building in small slices**: one complete feature at a time (create a deck, then manage it, then edit cards, then study), with each slice tested before starting the next. That kept every change small enough to check and understand.
