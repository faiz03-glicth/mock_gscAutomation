/**
 * Static/reference test data for the GSC booking journey.
 *
 * GSC is a live, constantly-changing cinema booking site: movies, cinemas,
 * dates, showtimes and seats all change day to day. Almost nothing here is
 * hard-coded as "the" value to use in a test - instead the page objects
 * *discover* an available option at run time (see pages/*.ts). This file only
 * holds the handful of things that are genuinely stable: URLs, regexes used
 * to recognise page state, and optional credentials for the one flow
 * (seat selection) that GSC gates behind a login wall.
 */

export const urls = {
  home: 'https://www.gsc.com.my/',
  moviesListing: 'https://www.gsc.com.my/movies',
  // Any path on this host is the separate booking/ticketing application that
  // GSC's "Buy Now" buttons send users to.
  bookingAppHostPattern: /epaymentwebapp\.gsc\.com\.my/,
};

/**
 * GSC's live booking app requires a signed-in member account before it will
 * show the seat map (an anonymous "Buy Now" click is redirected to a Log In
 * screen). This is real, current site behaviour - not a test bug - so the
 * "continue booking" test is written to handle both cases:
 *
 *  - If GSC_TEST_MOBILE_NUMBER and GSC_TEST_PASSWORD are supplied via
 *    environment variables (a QA/demo account you control), the test logs in
 *    and drives the flow all the way to seat selection + booking summary.
 *  - If they are not supplied (the default, out-of-the-box run), the test
 *    verifies - with a real, meaningful assertion - that the booking journey
 *    correctly requires authentication before seat selection, and stops
 *    there. Either way, no purchase is ever made.
 */
export const credentials = {
  mobileNumber: process.env.GSC_TEST_MOBILE_NUMBER ?? '',
  password: process.env.GSC_TEST_PASSWORD ?? '',
  get isConfigured(): boolean {
    return this.mobileNumber.length > 0 && this.password.length > 0;
  },
};

/**
 * Regex used to recognise a showtime button's accessible name. GSC's
 * showtime buttons combine the time with the hall/format, e.g.
 * "2:30PM GETHA" or "9:50PM 2D" - so this intentionally has no trailing
 * anchor, only a leading one, letting it match the time prefix regardless of
 * what follows.
 */
export const showtimeLabelPattern = /^\d{1,2}:\d{2}\s?(AM|PM)\b/i;

/**
 * Regex used to recognise a date-selector button's label under "Select
 * Date", e.g. "TUE 01 Sep", "TODAY 01 Sep", or a bare "01 Sep". The day name
 * (or "TODAY") is optional since GSC sometimes labels the first date that
 * way instead of with its weekday abbreviation.
 */
export const dateLabelPattern = /^(?:(?:MON|TUE|WED|THU|FRI|SAT|SUN|TODAY)\s+)?\d{1,2}\s+[A-Za-z]{3}$/i;

/** Regex used to recognise a seat's accessible label, e.g. "J01", "A25". */
export const seatLabelPattern = /^[A-Z]{1,2}\d{1,2}$/;
