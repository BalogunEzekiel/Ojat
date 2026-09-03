import OpenAI from "openai";
import { env } from "../config/env.js";

let currentKeyIndex = 0;

/* =========================================================
   GROQ CLIENT
========================================================= */

function getGroqClient() {
  if (!env.groqKeys.length) {
    throw new Error("No GROQ_API_KEY configured");
  }

  const apiKey =
    env.groqKeys[
      currentKeyIndex % env.groqKeys.length
    ];

  currentKeyIndex++;

  return new OpenAI({
    apiKey,
    baseURL: env.groqBaseUrl,
  });
}


/* =========================================================
   COMMERCE EXTRACTION
========================================================= */

export async function extractCommerce(text) {
  if (!text?.trim()) {
    throw new Error("Message text is required");
  }

  const client = getGroqClient();

  const systemPrompt = `
You are OJAT AI, an intelligent conversational commerce
agent specialized in African and Nigerian informal businesses.

Your job is to convert a customer's natural-language message
into STRICT structured commerce data.

Customers may use:

- Nigerian English
- Nigerian Pidgin
- informal English
- abbreviations
- incomplete sentences
- slang
- conversational language
- spelling variations

Examples:

"Abeg send two red shoes to Ikeja"

"I wan buy 5 red shoe"

"Madam I need 3 peach bags"

"Please deliver two peach bags to Lekki"

"How much is the red shoe?"

"Do you have the peach bag in stock?"

"I want to pay for the red shoes"

"Where is my order?"

"Abeg where una dey?"

=========================================================
VALID INTENTS
=========================================================

ORDER
PRODUCT_INQUIRY
STOCK_INQUIRY
PAYMENT
DELIVERY_INQUIRY
COMPLAINT
GREETING
UNKNOWN

=========================================================
EXTRACTION FIELDS
=========================================================

You MUST return ALL of these fields:

intent
confidence
customerName
productQuery
quantity
deliveryLocation
paymentIntent

=========================================================
FIELD RULES
=========================================================

intent:
- Determine the customer's primary commercial intent.
- Use exactly one of the valid intents listed above.

confidence:
- Number between 0 and 1.
- Reflect how confident you are in the extracted intent and entities.

customerName:
- Extract the customer's name only when explicitly provided.
- Otherwise return null.

productQuery:
- Extract the product being discussed or requested.
- Preserve the meaningful product description from the customer's message.
- Remove unnecessary ordering words such as:
  "send me", "give me", "I want", "I need", "please send", "abeg send".
- Example:
  "Abeg send two red shoes to Ikeja"
  -> "red shoes"
- Example:
  "I wan buy 5 red shoe"
  -> "red shoe"
- Example:
  "How much is the peach bag?"
  -> "peach bag"
- If no product is identifiable, return null.

quantity:
- Extract the requested quantity when explicitly stated.
- Convert number words into numbers.
- Examples:
  "two" -> 2
  "three" -> 3
  "five" -> 5
  "one" -> 1
- If no quantity is stated or strongly implied, return null.
- Do not invent a quantity.

deliveryLocation:
- Extract the delivery destination/location when mentioned.
- Examples:
  "to Ikeja" -> "Ikeja"
  "deliver to Lekki" -> "Lekki"
  "send it to Yaba" -> "Yaba"
- Preserve the meaningful location name.
- If no delivery location is mentioned, return null.

paymentIntent:
- Extract payment-related intent only when the customer expresses one.
- Examples:
  "I want to pay" -> "PAY"
  "Can I pay now?" -> "PAY"
  "send your account details" -> "PAY"
- If there is no payment intent, return null.

=========================================================
IMPORTANT INTERPRETATION RULES
=========================================================

1. NEVER invent information.

2. Extract entities directly from the customer's message.

3. Nigerian Pidgin must be understood semantically.

4. "wan buy", "want to buy", "need", "order", "send me",
   "give me" and similar expressions can indicate ORDER
   when the customer identifies a product.

5. Number words must be converted to numeric quantities.

6. A phrase such as:
   "two red shoes to Ikeja"
   contains:
   quantity = 2
   productQuery = "red shoes"
   deliveryLocation = "Ikeja"

7. Do not confuse a delivery location with a product.

8. Do not confuse a quantity with part of a product name.

9. Do not include explanatory text outside the JSON.

10. Return ONLY valid JSON.

=========================================================
REQUIRED JSON STRUCTURE
=========================================================

{
  "intent": "ORDER",
  "confidence": 0.98,
  "customerName": null,
  "productQuery": "red shoes",
  "quantity": 2,
  "deliveryLocation": "Ikeja",
  "paymentIntent": null
}
`;

  const userPrompt = `
Analyze this customer message:

"${text}"

Extract every commerce field that can be reliably determined.
Pay particular attention to:

- product
- quantity
- delivery location
- customer name
- payment intent

Return ONLY the required JSON object.
`;

  const response =
    await client.chat.completions.create({
      model: env.groqModel,

      temperature: 0.1,

      response_format: {
        type: "json_object",
      },

      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

  const content =
    response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty response");
  }

  let result;

  try {
    result = JSON.parse(content);
  } catch {
    console.error("Invalid Groq JSON:", content);

    throw new Error(
      "Unable to parse Groq AI response"
    );
  }


  /* =======================================================
     NORMALIZATION
  ======================================================= */

  const validIntents = new Set([
    "ORDER",
    "PRODUCT_INQUIRY",
    "STOCK_INQUIRY",
    "PAYMENT",
    "DELIVERY_INQUIRY",
    "COMPLAINT",
    "GREETING",
    "UNKNOWN",
  ]);

  const intent =
    validIntents.has(result.intent)
      ? result.intent
      : "UNKNOWN";


  const confidenceNumber =
    Number(result.confidence);

  const confidence =
    Number.isFinite(confidenceNumber)
      ? Math.min(
          1,
          Math.max(
            0,
            confidenceNumber
          )
        )
      : 0;


  const quantityNumber =
    result.quantity === null ||
    result.quantity === undefined ||
    result.quantity === ""
      ? null
      : Number(result.quantity);

  const quantity =
    Number.isFinite(quantityNumber) &&
    quantityNumber > 0
      ? quantityNumber
      : null;


  const cleanString = (value) => {
    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }

    const valueString =
      String(value).trim();

    return valueString
      ? valueString
      : null;
  };


  return {
    intent,

    confidence,

    customerName:
      cleanString(
        result.customerName
      ),

    productQuery:
      cleanString(
        result.productQuery
      ),

    quantity,

    deliveryLocation:
      cleanString(
        result.deliveryLocation
      ),

    paymentIntent:
      cleanString(
        result.paymentIntent
      ),
  };
}