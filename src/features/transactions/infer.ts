/**
 * Smart defaults (P§61).
 *
 * "The user should correct Savi rather than fill everything manually."
 *
 * Two sources, in priority order:
 *   1. The user's own history — if they've logged "Grab" as Transport/Need
 *      before, that is a far better signal than any built-in list.
 *   2. A keyword map, for the first few weeks when there is no history.
 *
 * This is deliberately NOT an LLM call. Ask Savi is v0.4, and classifying
 * "Jollibee" as Food is arithmetic-grade certainty that should not cost a
 * network round trip or leave the device.
 *
 * Everything here is a SUGGESTION. The Quick Add sheet shows what was inferred
 * and lets the user change it in one tap — an inference the user cannot see or
 * override is just a bug they cannot report.
 */

import type { Classification } from '@/lib/database.types';

import type { TransactionWithCategory } from './api';

export type Inference = {
  categorySlug: string | null;
  classification: Classification;
  /** Where the guess came from, so the UI can be honest about it. */
  source: 'history' | 'keyword' | 'default';
};

/**
 * Keyword → category. Weighted toward the Philippine market the product
 * targets (P§3), since a generic list would miss Jollibee, GCash, and Meralco.
 */
const KEYWORDS: Record<string, { slug: string; classification: Classification }> = {
  // Food
  jollibee: { slug: 'food', classification: 'need' },
  mcdo: { slug: 'food', classification: 'want' },
  mcdonald: { slug: 'food', classification: 'want' },
  chowking: { slug: 'food', classification: 'need' },
  grocery: { slug: 'food', classification: 'need' },
  supermarket: { slug: 'food', classification: 'need' },
  palengke: { slug: 'food', classification: 'need' },
  lunch: { slug: 'food', classification: 'need' },
  dinner: { slug: 'food', classification: 'need' },
  breakfast: { slug: 'food', classification: 'need' },
  coffee: { slug: 'food', classification: 'want' },
  starbucks: { slug: 'food', classification: 'want' },
  milktea: { slug: 'food', classification: 'want' },
  foodpanda: { slug: 'food', classification: 'want' },
  grabfood: { slug: 'food', classification: 'want' },

  // Transport
  grab: { slug: 'transport', classification: 'need' },
  angkas: { slug: 'transport', classification: 'need' },
  jeep: { slug: 'transport', classification: 'need' },
  jeepney: { slug: 'transport', classification: 'need' },
  tricycle: { slug: 'transport', classification: 'need' },
  mrt: { slug: 'transport', classification: 'need' },
  lrt: { slug: 'transport', classification: 'need' },
  gas: { slug: 'transport', classification: 'need' },
  gasoline: { slug: 'transport', classification: 'need' },
  fare: { slug: 'transport', classification: 'need' },
  toll: { slug: 'transport', classification: 'need' },

  // Bills — classification 'bill', category is whatever it belongs to.
  meralco: { slug: 'personal', classification: 'bill' },
  electricity: { slug: 'personal', classification: 'bill' },
  water: { slug: 'personal', classification: 'bill' },
  maynilad: { slug: 'personal', classification: 'bill' },
  internet: { slug: 'personal', classification: 'bill' },
  pldt: { slug: 'personal', classification: 'bill' },
  globe: { slug: 'personal', classification: 'bill' },
  converge: { slug: 'personal', classification: 'bill' },
  rent: { slug: 'personal', classification: 'bill' },
  netflix: { slug: 'entertainment', classification: 'bill' },
  spotify: { slug: 'entertainment', classification: 'bill' },
  subscription: { slug: 'personal', classification: 'bill' },
  load: { slug: 'personal', classification: 'bill' },

  // Health
  pharmacy: { slug: 'health', classification: 'need' },
  mercury: { slug: 'health', classification: 'need' },
  watsons: { slug: 'health', classification: 'need' },
  medicine: { slug: 'health', classification: 'need' },
  doctor: { slug: 'health', classification: 'need' },
  hospital: { slug: 'health', classification: 'need' },
  gym: { slug: 'health', classification: 'want' },

  // Shopping / entertainment
  shopee: { slug: 'shopping', classification: 'want' },
  lazada: { slug: 'shopping', classification: 'want' },
  uniqlo: { slug: 'shopping', classification: 'want' },
  clothes: { slug: 'shopping', classification: 'want' },
  movie: { slug: 'entertainment', classification: 'want' },
  cinema: { slug: 'entertainment', classification: 'want' },
  game: { slug: 'entertainment', classification: 'want' },
  steam: { slug: 'entertainment', classification: 'want' },

  // Education / work
  tuition: { slug: 'education', classification: 'need' },
  book: { slug: 'education', classification: 'need' },
  school: { slug: 'education', classification: 'need' },
  office: { slug: 'work', classification: 'need' },
  printing: { slug: 'work', classification: 'need' },
};

/**
 * History first. If the user has logged this description before, reuse what
 * they chose — including any correction they made, which is the whole point.
 */
function fromHistory(
  description: string,
  history: TransactionWithCategory[]
): Inference | null {
  const needle = description.trim().toLowerCase();
  if (needle.length < 2) return null;

  const match = history.find(
    (t) => (t.description ?? '').trim().toLowerCase() === needle && t.type === 'expense'
  );
  if (!match) return null;

  return {
    categorySlug: match.category?.slug ?? null,
    classification: match.classification ?? 'need',
    source: 'history',
  };
}

function fromKeywords(description: string): Inference | null {
  const text = description.toLowerCase();

  // Longest keyword wins, so "grabfood" beats "grab".
  const hit = Object.keys(KEYWORDS)
    .filter((k) => text.includes(k))
    .sort((a, b) => b.length - a.length)[0];

  if (!hit) return null;
  const { slug, classification } = KEYWORDS[hit];
  return { categorySlug: slug, classification, source: 'keyword' };
}

export function inferFromDescription(
  description: string,
  history: TransactionWithCategory[] = []
): Inference {
  if (!description.trim()) {
    return { categorySlug: null, classification: 'need', source: 'default' };
  }

  return (
    fromHistory(description, history) ??
    fromKeywords(description) ?? {
      categorySlug: 'other',
      // 'need' is the safer default: mislabelling a want as a need understates
      // discretionary spending, which is the direction that avoids nagging a
      // user about overspending they didn't do (D§63).
      classification: 'need',
      source: 'default',
    }
  );
}
