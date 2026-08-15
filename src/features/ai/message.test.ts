import { conversationTitle, shapeReply, SUGGESTED_QUESTIONS } from './message';

describe('shapeReply', () => {
  it('splits blank-line separated paragraphs into answer and the rest', () => {
    const shaped = shapeReply(
      'You can probably afford it.\n\n' +
        "After your upcoming bills you'll have around ₱6,300.\n\n" +
        "I'd wait until your salary if you want to keep your savings goal."
    );

    expect(shaped).toEqual({
      answer: 'You can probably afford it.',
      rest: [
        "After your upcoming bills you'll have around ₱6,300.",
        "I'd wait until your salary if you want to keep your savings goal.",
      ],
    });
  });

  it('treats a single sentence as a complete reply', () => {
    // D§30 is explicit that one sentence can be the whole answer.
    expect(shapeReply('You have three bills due this week.')).toEqual({
      answer: 'You have three bills due this week.',
      rest: [],
    });
  });

  it('falls back to single newlines when the model does not double-space', () => {
    expect(shapeReply('Yes.\nYour balance covers it.')).toEqual({
      answer: 'Yes.',
      rest: ['Your balance covers it.'],
    });
  });

  it('strips markdown the model emits despite being asked not to', () => {
    // We render plain text (AI-BOUNDARY §6.3), so leftover syntax would show up
    // literally as `**you can afford it**`.
    const shaped = shapeReply(
      '## Summary\n\n**You can afford it.**\n\n- Your balance is `₱21,300`.'
    );

    expect(shaped).toEqual({
      answer: 'Summary',
      rest: ['You can afford it.', 'Your balance is ₱21,300.'],
    });
  });

  it('does not mangle a bare asterisk or a lone currency figure', () => {
    expect(shapeReply('Rent * 2 is ₱20,000.')).toEqual({
      answer: 'Rent * 2 is ₱20,000.',
      rest: [],
    });
  });

  it.each(['', '   ', '\n\n', null as unknown as string])('returns null for %p', (input) => {
    expect(shapeReply(input ?? '')).toBeNull();
  });

  it('drops blank paragraphs rather than rendering empty rows', () => {
    expect(shapeReply('Yes.\n\n\n\nBecause your balance covers it.')).toEqual({
      answer: 'Yes.',
      rest: ['Because your balance covers it.'],
    });
  });
});

describe('conversationTitle', () => {
  it('keeps a short question whole', () => {
    expect(conversationTitle('What bills are due?')).toBe('What bills are due?');
  });

  it('collapses whitespace', () => {
    expect(conversationTitle('  What   bills\nare due? ')).toBe('What bills are due?');
  });

  it('truncates on a word boundary rather than mid-word', () => {
    const long =
      'Can I afford to buy a new laptop this month if I also want to keep saving for my emergency fund';
    const title = conversationTitle(long);

    expect(title.length).toBeLessThanOrEqual(81);
    expect(title.endsWith('…')).toBe(true);

    // The kept text is a prefix of the original that ends where a word ends —
    // so the next character in the source is a space, not more of the word.
    const body = title.slice(0, -1);
    expect(long.startsWith(body)).toBe(true);
    expect(long.charAt(body.length)).toBe(' ');
  });

  it('falls back to a hard cut when there is no late word boundary', () => {
    const title = conversationTitle('x'.repeat(200));
    expect(title).toHaveLength(81);
  });
});

describe('suggested questions', () => {
  it('only offers questions the read-only tools can actually answer', () => {
    // Advertising "move ₱500 to savings" would promise a capability Savi does
    // not have and will not have before v0.6 (AI-BOUNDARY §5).
    const forbidden = /\b(move|transfer|pay|create|delete|add)\b/i;

    for (const q of SUGGESTED_QUESTIONS) {
      expect(q).not.toMatch(forbidden);
    }
  });
});
