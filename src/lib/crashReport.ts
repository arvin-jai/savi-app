/**
 * Crash reporting — and the redaction that makes it safe to send (v1.0).
 *
 * Pure, no imports, so it is testable without rendering anything. It lives here
 * rather than beside the ErrorBoundary for the reason the rest of the codebase
 * splits this way: a rule that can only be tested by mounting a component is in
 * the wrong file.
 *
 * A crash report carries an error message and a stack. Savi's error messages are
 * written by us and carry no amounts today — but a future
 * `throw new Error(\`Could not save ₱\${amount} to \${accountName}\`)` would
 * quietly start sending someone's balance to a third party, and nobody would
 * notice. The scrubber is here so that mistake is caught by the reporter rather
 * than by a user reading a support ticket.
 *
 * PRIVACY.md promises crash reports never include financial data. This is where
 * that promise is kept.
 */

/**
 * Strip anything that looks like money or an identifier from text bound for a
 * crash report.
 *
 * Deliberately aggressive. An over-redacted stack costs a developer five
 * minutes; an under-redacted one costs a user their privacy, and they never
 * find out it happened.
 */
export function scrubForReport(text: string): string {
  return (
    text
      // Currency amounts in any symbol formatMoney can emit, sign included.
      .replace(/-?[₱$€]\s?-?[\d,]+(\.\d+)?/g, '[amount]')
      // Bare numbers long enough to be a balance in minor units or a card
      // number. Short ones survive so line numbers stay readable.
      .replace(/\b\d{6,}\b/g, '[number]')
      // UUIDs — account, transaction and user ids all look like this.
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
      .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, '[email]')
      // JWTs, in case one ever reaches an error message.
      .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
  );
}

/**
 * Where a crash reporter gets wired in.
 *
 * Left unimplemented on purpose: choosing a provider and putting its DSN in the
 * build is a release decision, not a code one. Whatever goes here MUST send
 * `scrubForReport(...)` output and nothing else — see RELEASE.md.
 */
export function reportCrash(error: Error, componentStack: string | null): void {
  const safeMessage = scrubForReport(error.message);
  const safeStack = scrubForReport(error.stack ?? '');
  const safeComponents = componentStack ? scrubForReport(componentStack) : '';

  // Until a provider is configured this is a console record — still the
  // difference between a reproducible bug report and "it went white".
  console.error('[Savi crash]', safeMessage, '\n', safeStack, '\n', safeComponents);
}
