/**
 * Shaping a model reply into something the UI can render calmly.
 *
 * D§30 gives Savi's messages three parts — Answer, Reason, Action — and says
 * they must not be walls of text. The system prompt asks for exactly that
 * shape, unlabelled, which leaves the client one job: render the first thought
 * with more weight than the ones explaining it.
 *
 * This deliberately does NOT try to classify which paragraph is the "reason"
 * and which is the "action". A heuristic that is right most of the time would
 * emphasise the wrong sentence the rest of the time, and a finance app that
 * highlights the wrong line is worse than one that highlights the first.
 *
 * Pure functions, no I/O — the D§63 voice rules are testable without a network.
 */

/**
 * Models emit markdown even when told not to. We render plain text (AI-BOUNDARY
 * §6.3 — no markdown link auto-linking, no HTML), so leftover syntax would show
 * up literally as `**you can afford it**`. Strip the common carriers rather than
 * rendering them raw.
 */
function stripMarkdown(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '') // headings
    .replace(/^\s*[-*+]\s+/, '') // bullets
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/(^|\s)\*(?!\s)(.+?)\*(?=\s|$)/g, '$1$2') // italics, not bare asterisks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .trim();
}

export type ShapedReply = {
  /** The Answer (D§30) — rendered with the most weight. */
  answer: string;
  /** Reason, then Action. Rendered as secondary body text. */
  rest: string[];
};

/**
 * Split a reply into its leading answer and the paragraphs that support it.
 *
 * Blank-line separated first; if the model returned one block, fall back to
 * single newlines. A reply with neither is one paragraph, which is a perfectly
 * good answer — D§30 says a single sentence can be the whole reply.
 */
export function shapeReply(reply: string): ShapedReply | null {
  const normalised = reply.replace(/\r\n/g, '\n').trim();
  if (!normalised) return null;

  const blocks = normalised
    .split(/\n\s*\n/)
    .flatMap((block) => (block.includes('\n') ? block.split('\n') : [block]))
    .map(stripMarkdown)
    .filter((line) => line.length > 0);

  if (blocks.length === 0) return null;

  return { answer: blocks[0], rest: blocks.slice(1) };
}

/**
 * A conversation's title, derived from the first thing the user asked.
 *
 * Truncated on a word boundary so a thread does not read "Can I afford a ₱4,000
 * lapt". 80 characters matches the column's practical use in the list.
 */
export function conversationTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\s+/g, ' ').trim();
  if (clean.length <= 80) return clean;

  const cut = clean.slice(0, 80);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Starter questions offered on an empty thread.
 *
 * Each one is answerable by the read-only tools that actually exist — offering
 * "move ₱500 to savings" would advertise a capability Savi does not have and
 * will not have before v0.6.
 */
export const SUGGESTED_QUESTIONS = [
  'Can I afford to spend ₱4,000 this month?',
  'What bills are coming up?',
  'Where did my money go this month?',
  'What does my week look like?',
] as const;
