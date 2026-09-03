import { prisma } from "../lib/prisma.js";


/* =========================================================
   NORMALIZE TEXT
========================================================= */

function normalizeText(value = "") {

  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}


/* =========================================================
   TOKENIZE
========================================================= */

function tokenize(value = "") {

  return normalizeText(value)
    .split(" ")
    .filter(Boolean);
}


/* =========================================================
   CALCULATE MATCH SCORE
========================================================= */

function calculateMatchScore(
  query,
  product
) {

  const normalizedQuery =
    normalizeText(query);

  const productName =
    normalizeText(product.name);

  const sku =
    normalizeText(product.sku);


  if (!normalizedQuery) {
    return 0;
  }


  /* -----------------------------------------
     EXACT PRODUCT NAME
  ----------------------------------------- */

  if (
    productName ===
    normalizedQuery
  ) {
    return 1;
  }


  /* -----------------------------------------
     EXACT SKU
  ----------------------------------------- */

  if (
    sku &&
    sku ===
    normalizedQuery
  ) {
    return 1;
  }


  /* -----------------------------------------
     PRODUCT NAME CONTAINS QUERY
  ----------------------------------------- */

  if (
    productName.includes(
      normalizedQuery
    )
  ) {
    return 0.95;
  }


  /* -----------------------------------------
     QUERY CONTAINS PRODUCT NAME
  ----------------------------------------- */

  if (
    normalizedQuery.includes(
      productName
    )
  ) {
    return 0.9;
  }


  const queryTokens =
    tokenize(query);

  const productTokens =
    tokenize(product.name);


  if (
    !queryTokens.length ||
    !productTokens.length
  ) {
    return 0;
  }


  /* -----------------------------------------
     TOKEN MATCHING
  ----------------------------------------- */

  let matches = 0;


  for (
    const token of queryTokens
  ) {

    if (
      productTokens.some(
        productToken =>
          productToken.includes(
            token
          ) ||
          token.includes(
            productToken
          )
      )
    ) {
      matches++;
    }
  }


  return (
    matches /
    Math.max(
      queryTokens.length,
      productTokens.length
    )
  );
}


/* =========================================================
   FORMAT PRODUCT
========================================================= */

function formatProduct(
  product,
  score
) {

  const inventory =
    product.inventory;


  const availableStock =
    inventory
      ? (
          inventory.quantity -
          inventory.reserved
        )
      : 0;


  return {

    id:
      product.id,

    name:
      product.name,

    sku:
      product.sku,

    price:
      Number(
        product.sellingPrice
      ),

    availableStock,

    totalStock:
      inventory
        ? inventory.quantity
        : 0,

    reservedStock:
      inventory
        ? inventory.reserved
        : 0,

    score:
      Number(
        score.toFixed(2)
      ),
  };
}


/* =========================================================
   MATCH PRODUCT
========================================================= */

export async function matchProduct(
  businessId,
  productQuery
) {

  if (!businessId) {
    throw new Error(
      "Business ID is required"
    );
  }


  if (
    !productQuery?.trim()
  ) {

    return {

      matched:
        false,

      ambiguous:
        false,

      product:
        null,

      alternatives:
        [],
    };
  }


  const products =
    await prisma.product.findMany({
      where: {

        businessId,

        active:
          true,
      },

      include: {
        inventory:
          true,
      },
    });


  if (!products.length) {

    return {

      matched:
        false,

      ambiguous:
        false,

      product:
        null,

      alternatives:
        [],
    };
  }


  const scoredProducts =
    products
      .map(product => ({

        product,

        score:
          calculateMatchScore(
            productQuery,
            product
          ),
      }))
      .sort(
        (a, b) =>
          b.score -
          a.score
      );


  const bestMatch =
    scoredProducts[0];


  const secondMatch =
    scoredProducts[1];


  const MATCH_THRESHOLD =
    0.45;


  /*
    If the best result is below this threshold,
    we don't have a reliable product match.
  */

  if (
    !bestMatch ||
    bestMatch.score <
    MATCH_THRESHOLD
  ) {

    return {

      matched:
        false,

      ambiguous:
        false,

      product:
        null,

      alternatives:
        scoredProducts
          .filter(
            item =>
              item.score >
              0.2
          )
          .slice(0, 5)
          .map(item =>
            formatProduct(
              item.product,
              item.score
            )
          ),
    };
  }


  /* =======================================================
     AMBIGUITY DETECTION

     Example:

     Red Shoe          0.95
     Red Shoe Premium  0.90

     The system should NOT blindly choose Red Shoe.
  ======================================================= */

  const ambiguityThreshold =
    0.60;

  const ambiguityGap =
    0.15;


  const ambiguous =
    Boolean(
      secondMatch &&
      secondMatch.score >=
        ambiguityThreshold &&
      (
        bestMatch.score -
        secondMatch.score
      ) <
        ambiguityGap
    );


  if (ambiguous) {

    return {

      matched:
        false,

      ambiguous:
        true,

      product:
        null,

      confidence:
        Number(
          bestMatch.score.toFixed(2)
        ),

      alternatives:
        scoredProducts
          .filter(
            item =>
              item.score >=
              ambiguityThreshold
          )
          .slice(0, 5)
          .map(item =>
            formatProduct(
              item.product,
              item.score
            )
          ),
    };
  }


  /* =======================================================
     RELIABLE MATCH
  ======================================================= */

  return {

    matched:
      true,

    ambiguous:
      false,

    confidence:
      Number(
        bestMatch.score.toFixed(2)
      ),

    product:
      formatProduct(
        bestMatch.product,
        bestMatch.score
      ),

    alternatives:
      scoredProducts
        .slice(1, 5)
        .filter(
          item =>
            item.score >
            0.2
        )
        .map(item =>
          formatProduct(
            item.product,
            item.score
          )
        ),
  };
}