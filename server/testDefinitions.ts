import { TestDefinition } from './types';

/**
 * The fixed set of tests the dashboard is allowed to run, and the exact
 * spec file each one maps to. This is the ONLY place a test id resolves to
 * a file path - the HTTP layer (index.ts) never accepts a path from the
 * client, only an id, which is looked up here. That is what prevents the
 * dashboard from being able to trigger arbitrary commands or files.
 */
export const testDefinitions: TestDefinition[] = [
  {
    id: 'login',
    name: 'Log In',
    description: 'Log in to a GSC account (or verify the login gate without credentials configured).',
    specFile: 'tests/login.spec.ts',
  },
  {
    id: 'browse-and-select',
    name: 'Browse and Select',
    description: 'Browse GSC and select an available movie/cinema.',
    specFile: 'tests/browse-and-select.spec.ts',
  },
  {
    id: 'select-showtime',
    name: 'Select Showtime',
    description: 'Select an available date and showtime.',
    specFile: 'tests/select-showtime.spec.ts',
  },
  {
    id: 'continue-booking',
    name: 'Continue Booking',
    description: 'Select an available seat and continue toward booking review/checkout.',
    specFile: 'tests/continue-booking.spec.ts',
  },
  {
    id: 'negative-validation',
    name: 'Negative Validation',
    description: 'Verify unavailable booking options cannot be selected.',
    specFile: 'tests/negative-validation.spec.ts',
  },
  {
    id: 'search-movie-trailer',
    name: 'Search & Trailer',
    description: 'Search for a movie, open it, and play/pause its trailer.',
    specFile: 'tests/search-movie-trailer.spec.ts',
  },
];

export function findTestDefinition(id: string): TestDefinition | undefined {
  return testDefinitions.find((def) => def.id === id);
}
