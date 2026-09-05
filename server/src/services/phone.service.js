/* =========================================================
   OJAT PHONE NORMALIZATION SERVICE

   Canonical Nigerian format:

   08012345678
       ↓
   +2348012345678

   2348012345678
       ↓
   +2348012345678

   +2348012345678
       ↓
   +2348012345678
========================================================= */

export function normalizePhone(phone) {

  if (
    phone === null ||
    phone === undefined
  ) {
    return null;
  }


  let value =
    String(phone)
      .trim()
      .replace(/[^\d+]/g, "");


  if (!value) {
    return null;
  }


  /* =========================================
     NIGERIAN LOCAL FORMAT

     08012345678
     07012345678
     08112345678
     etc.
  ========================================= */

  if (
    /^0\d{10}$/.test(value)
  ) {

    return (
      "+234" +
      value.slice(1)
    );

  }


  /* =========================================
     NIGERIAN INTERNATIONAL FORMAT
     WITHOUT +

     2348012345678
  ========================================= */

  if (
    /^234\d{10}$/.test(value)
  ) {

    return (
      "+" +
      value
    );

  }


  /* =========================================
     NIGERIAN INTERNATIONAL FORMAT
     WITH +

     +2348012345678
  ========================================= */

  if (
    /^\+234\d{10}$/.test(value)
  ) {

    return value;

  }


  /* =========================================
     OTHER INTERNATIONAL NUMBERS

     Preserve already formatted international
     numbers instead of corrupting them.
  ========================================= */

  if (
    /^\+\d{7,15}$/.test(value)
  ) {

    return value;

  }


  /*
   * Digits-only international number.
   *
   * Example:
   * 14155552671 -> +14155552671
   */

  if (
    /^\d{7,15}$/.test(value)
  ) {

    return "+" + value;

  }


  return null;
}


export default normalizePhone;
