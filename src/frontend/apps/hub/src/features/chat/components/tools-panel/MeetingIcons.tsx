/**
 * Icons the meetings panel needs that the LaSuite icon set does not ship.
 * Drawn on the same 24×24 grid and with `currentColor` so they inherit the
 * panel's colours exactly like the imported icons do.
 */

export const Download = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path
      d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Calendar = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <rect
      x="3.5"
      y="5.5"
      width="17"
      height="15"
      rx="2.5"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M3.5 10h17M8 3.5v4m8-4v4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);
