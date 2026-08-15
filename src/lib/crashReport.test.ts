import { scrubForReport } from './crashReport';

/**
 * PRIVACY.md promises crash reports never include financial data. These are the
 * tests that keep that promise honest.
 */
describe('scrubForReport', () => {
  it('removes peso, dollar and euro amounts', () => {
    expect(scrubForReport('Could not save ₱24,500.50 to the ledger')).toBe(
      'Could not save [amount] to the ledger'
    );
    expect(scrubForReport('balance $1,200 short')).toBe('balance [amount] short');
    expect(scrubForReport('€99 charge failed')).toBe('[amount] charge failed');
  });

  it('removes a negative amount, which is the one most worth hiding', () => {
    // A negative Available Money is the most sensitive single figure in the app.
    expect(scrubForReport('available -₱6,699')).toBe('available [amount]');
    expect(scrubForReport('available ₱-6,699')).toBe('available [amount]');
  });

  it('removes bare numbers long enough to be minor units', () => {
    expect(scrubForReport('amount_minor=2450050 rejected')).toBe(
      'amount_minor=[number] rejected'
    );
  });

  it('keeps short numbers so stack traces stay readable', () => {
    // Line numbers and small counts are what make a report useful at all.
    expect(scrubForReport('at index.ts:42:8 in round 3')).toBe('at index.ts:42:8 in round 3');
  });

  it('removes uuids — account, transaction and user ids all look alike', () => {
    expect(scrubForReport('account ef0c4a82-88ac-4fab-8ebc-4606a38f33cc not found')).toBe(
      'account [id] not found'
    );
  });

  it('removes email addresses', () => {
    expect(scrubForReport('user ren@example.com failed to sync')).toBe(
      'user [email] failed to sync'
    );
  });

  it('removes anything shaped like a JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc-def_123';
    expect(scrubForReport(`auth failed with ${jwt}`)).toBe('auth failed with [token]');
  });

  it('scrubs a realistic stack trace end to end', () => {
    const stack = [
      'Error: Could not save ₱1,699 for bill ef0c4a82-88ac-4fab-8ebc-4606a38f33cc',
      '    at markBillPaid (api.ts:118:11)',
      '    at user ren@example.com',
    ].join('\n');

    const scrubbed = scrubForReport(stack);

    expect(scrubbed).not.toMatch(/₱|1,699|ef0c4a82|ren@example\.com/);
    // Still debuggable: the function name and line survive.
    expect(scrubbed).toContain('markBillPaid (api.ts:118:11)');
  });

  it('leaves ordinary error text alone', () => {
    const message = "Savi couldn't reach the server. Check your connection and try again.";
    expect(scrubForReport(message)).toBe(message);
  });
});
