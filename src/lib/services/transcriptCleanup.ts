// Turns a stream of committed sign tokens (words, or collapsed
// fingerspelled letters) into a readable running sentence. Deliberately
// simple — the PRD calls this "Language Model Cleanup" and notes a real
// LLM pass could replace this for grammar/punctuation, but a lightweight
// deterministic version keeps the demo fast and dependency-free.

export interface CleanupState {
  words: string[];
}

export function createCleanupState(): CleanupState {
  return { words: [] };
}

/** Adds a newly committed word/phrase to the running sentence buffer. */
export function appendWord(state: CleanupState, word: string): CleanupState {
  return { words: [...state.words, word] };
}

/** Renders the buffer as a capitalized, punctuated sentence-in-progress. */
export function renderSentence(state: CleanupState): string {
  if (state.words.length === 0) return "";
  const joined = state.words.join(" ");
  const capitalized = joined.charAt(0).toUpperCase() + joined.slice(1);
  return capitalized;
}

/** Finalizes the current buffer into a punctuated sentence and clears it. */
export function finalizeSentence(state: CleanupState): {
  sentence: string;
  next: CleanupState;
} {
  const text = renderSentence(state);
  if (!text) return { sentence: "", next: createCleanupState() };
  const withPunctuation = /[.?!]$/.test(text) ? text : `${text}.`;
  return { sentence: withPunctuation, next: createCleanupState() };
}

/** Collapses a run of fingerspelled letters ("H","E","L","L","O") into a word. */
export function collapseLetters(letters: string[]): string {
  return letters.join("").toUpperCase();
}
