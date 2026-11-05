import { landingRoute } from './landing';

describe('landingRoute', () => {
  it('shows Welcome on a fresh install', () => {
    expect(landingRoute(false)).toBe('/(auth)/welcome');
  });

  it('sends every later launch to Login', () => {
    expect(landingRoute(true)).toBe('/(auth)/login');
  });

  it('declines to answer until the flag has been read', () => {
    // Guessing here would render Welcome for a few frames and then replace it.
    expect(landingRoute(null)).toBeNull();
  });
});
