/**
 * The password floor, in one place.
 *
 * Supabase's own default minimum is 6. Keeping ours identical means the form
 * never accepts something the server then rejects — the failure mode when these
 * two numbers drift is a valid-looking password bouncing off the API with a
 * message the user cannot act on.
 *
 * Shared by signup and password reset so the two screens cannot disagree about
 * what counts as long enough.
 */
export const MIN_PASSWORD = 6;
