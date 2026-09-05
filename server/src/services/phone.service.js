/* =========================================================
   PHONE NORMALIZATION SERVICE
   Canonical format:
   +2348012345678
========================================================= */

export function normalizePhone(phone) {
  if (phone === null || phone === undefined) {
    return null;
  }

  let value = String(phone).trim();

  if (!value) {
    return null;
  }

  // Remove spaces, hyphens, parentheses and other formatting.
  value = value.replace(/[^\d+]/g, "");

  // Nigerian local format:
  // 08012345678 -> +2348012345678
  if (/^0\d{10}$/.test(value)) {
    return `+234${value.slice(1)}`;
  }

  // Nigerian international format without "+":
  // 2348012345678 -> +2348012345678
  if (/^234\d{10}$/.test(value)) {
    return `+${value}`;
  }

  // Already canonical:
  // +2348012345678 -> +2348012345678
  if (/^\+234\d{10}$/.test(value)) {
    return value;
  }

  /*
   * Preserve valid international numbers that already
   * contain "+" rather than corrupting them.
   */
  if (value.startsWith("+")) {
    return value;
  }

  /*
   * For other international numbers without "+",
   * normalize by adding "+".
   */
  if (/^\d+$/.test(value)) {
    return `+${value}`;
  }

  return null;
}


export default normalizePhone;
