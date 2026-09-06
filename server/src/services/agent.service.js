import { prisma } from "../lib/prisma.js";

import {
  extractCommerce,
} from "./ai.service.js";

import {
  matchProduct,
} from "./product-matching.service.js";

import {
  createProposedOrder,
} from "./order.service.js";

import {
  queueWhatsAppOutbound,
} from "../queues/whatsapp.queue.js";


/* =========================================================
   HELPERS
========================================================= */

function naira(amount) {
  return new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 2,
    }
  ).format(Number(amount));
}


function availableStock(product) {
  if (!product?.inventory) {
    return 0;
  }

  return Math.max(
    0,
    Number(product.inventory.quantity) -
    Number(product.inventory.reserved)
  );
}


async function sendConversationMessage({
  businessId,
  conversationId,
  customer,
  message,
  idempotencyKey,
  context = {},
}) {
  if (!customer?.phone) {
    return null;
  }

  return queueWhatsAppOutbound({
    businessId,
    conversationId,
    to: customer.phone,
    message,
    idempotencyKey,
    context,
  });
}


/* =========================================================
   AGENT EXECUTION RESULT
========================================================= */

async function finishExecution({
  executionId,
  status,
  result,
}) {
  await prisma.agentExecution.update({
    where: {
      id: executionId,
    },

    data: {
      status,
      output: result,
    },
  });

  return {
    executionId,
    ...result,
  };
}


/* =========================================================
   PRODUCT INQUIRY
========================================================= */

async function handleProductInquiry({
  businessId,
  extraction,
  customer,
  conversationId,
  executionId,
}) {
  if (!extraction.productQuery) {
    return finishExecution({
      executionId,

      status: "REQUIRES_APPROVAL",

      result: {
        success: false,

        decision: "PRODUCT_REQUIRED",

        extraction,

        message:
          "Which product would you like to know about?",
      },
    });
  }

  const productMatch =
    await matchProduct(
      businessId,
      extraction.productQuery
    );

  if (productMatch.ambiguous) {
    const alternatives =
      productMatch.alternatives || [];

    const names =
      alternatives
        .slice(0, 3)
        .map((item) => item.product?.name || item.name)
        .filter(Boolean);

    const message =
      names.length
        ? `I found a few products that may match: ${names.join(", ")}. Which one do you mean?`
        : `I found more than one product matching "${extraction.productQuery}". Which product do you mean?`;

    await sendConversationMessage({
      businessId,
      conversationId,
      customer,
      message,
      idempotencyKey:
        `inquiry-${conversationId}-${executionId}`,
    });

    return finishExecution({
      executionId,
      status: "REQUIRES_APPROVAL",

      result: {
        success: false,
        decision: "PRODUCT_AMBIGUOUS",
        extraction,
        productMatch,
        message,
      },
    });
  }

  if (!productMatch.matched) {
    const message =
      `I couldn't find a product matching "${extraction.productQuery}". Please send the product name or SKU.`;

    await sendConversationMessage({
      businessId,
      conversationId,
      customer,
      message,
      idempotencyKey:
        `inquiry-${conversationId}-${executionId}`,
    });

    return finishExecution({
      executionId,
      status: "REQUIRES_APPROVAL",

      result: {
        success: false,
        decision: "PRODUCT_NOT_FOUND",
        extraction,
        productMatch,
        message,
      },
    });
  }

  const product =
    productMatch.product;

  const available =
    availableStock(product);

  const price =
    naira(product.sellingPrice);

  const message =
    available > 0
      ? `${product.name} costs ${price}. We currently have ${available} available. Would you like to place an order?`
      : `${product.name} costs ${price}, but it is currently out of stock. Would you like me to help you with another product?`;

  await sendConversationMessage({
    businessId,
    conversationId,
    customer,
    message,
    idempotencyKey:
      `inquiry-${conversationId}-${executionId}`,
  });

  return finishExecution({
    executionId,

    status: "EXECUTED",

    result: {
      success: true,
      decision: "PRODUCT_INQUIRY_ANSWERED",
      extraction,
      productMatch,
      availableInventory: available,
      message,
    },
  });
}


/* =========================================================
   STOCK INQUIRY
========================================================= */

async function handleStockInquiry({
  businessId,
  extraction,
  customer,
  conversationId,
  executionId,
}) {
  if (!extraction.productQuery) {
    const message =
      "Sure. Which product would you like me to check?";

    await sendConversationMessage({
      businessId,
      conversationId,
      customer,
      message,
      idempotencyKey:
        `stock-${conversationId}-${executionId}`,
    });

    return finishExecution({
      executionId,
      status: "EXECUTED",

      result: {
        success: true,
        decision: "PRODUCT_REQUIRED",
        extraction,
        message,
      },
    });
  }

  const productMatch =
    await matchProduct(
      businessId,
      extraction.productQuery
    );

  if (!productMatch.matched) {
    const message =
      `I couldn't find "${extraction.productQuery}". Please send the product name or SKU.`;

    await sendConversationMessage({
      businessId,
      conversationId,
      customer,
      message,
      idempotencyKey:
        `stock-${conversationId}-${executionId}`,
    });

    return finishExecution({
      executionId,
      status: "EXECUTED",

      result: {
        success: false,
        decision: "PRODUCT_NOT_FOUND",
        extraction,
        productMatch,
        message,
      },
    });
  }

  const product =
    productMatch.product;

  const available =
    availableStock(product);

  const message =
    available > 0
      ? `Yes. We currently have ${available} ${product.name}${available === 1 ? "" : "s"} available.`
      : `Sorry, ${product.name} is currently out of stock.`;

  await sendConversationMessage({
    businessId,
    conversationId,
    customer,
    message,
    idempotencyKey:
      `stock-${conversationId}-${executionId}`,
  });

  return finishExecution({
    executionId,
    status: "EXECUTED",

    result: {
      success: true,
      decision: "STOCK_INQUIRY_ANSWERED",
      extraction,
      productMatch,
      availableInventory: available,
      message,
    },
  });
}


/* =========================================================
   GREETING
========================================================= */

async function handleGreeting({
  businessId,
  customer,
  conversationId,
  executionId,
  extraction,
}) {
  const message =
    "Hello! 👋 Welcome to Ojat. How can I help you today? You can ask about a product, check stock, or place an order.";

  await sendConversationMessage({
    businessId,
    conversationId,
    customer,
    message,
    idempotencyKey:
      `greeting-${conversationId}-${executionId}`,
  });

  return finishExecution({
    executionId,
    status: "EXECUTED",

    result: {
      success: true,
      decision: "GREETING_HANDLED",
      extraction,
      message,
    },
  });
}


/* =========================================================
   UNKNOWN
========================================================= */

async function handleUnknown({
  businessId,
  customer,
  conversationId,
  executionId,
  extraction,
}) {
  const message =
    "I'm sorry, I didn't quite understand that. You can ask me about a product, check availability, or tell me what you'd like to order.";

  await sendConversationMessage({
    businessId,
    conversationId,
    customer,
    message,
    idempotencyKey:
      `unknown-${conversationId}-${executionId}`,
  });

  return finishExecution({
    executionId,
    status: "EXECUTED",

    result: {
      success: true,
      decision: "CLARIFICATION_REQUESTED",
      extraction,
      message,
    },
  });
}


/* =========================================================
   COMMERCE MESSAGE
========================================================= */

export async function processCommerceMessage({
  businessId,
  message,
  customer,
  messageId,
  conversationId,
}) {

  /*
   * Commerce processing is always tenant-scoped.
   *
   * Unlike the platform AI Extractor sandbox,
   * this function creates business-owned records,
   * matches products, creates orders and can trigger
   * WhatsApp/payment workflows.
   */
  if (!businessId) {
    throw new Error(
      "businessId is required for commerce message processing"
    );
  }


  const extraction =
    await extractCommerce(message);


  await prisma.aIExtraction.create({
    data: {
      businessId,

      messageId,

      intent:
        extraction.intent,

      confidence:
        extraction.confidence,

      extracted:
        extraction,

      model:
        process.env.GROQ_MODEL_NAME,
    },
  });

  const execution =
    await prisma.agentExecution.create({
      data: {
        businessId,

        status:
          "PROPOSED",

        action:
          "PROCESS_COMMERCE_MESSAGE",

        input: {
          message,
          customer,
        },

        output: {
          extraction,
        },
      },
    });


  /* =======================================================
     INTENT ROUTER
  ======================================================= */

  switch (extraction.intent) {

    case "PRODUCT_INQUIRY":
      return handleProductInquiry({
        businessId,
        extraction,
        customer,
        conversationId,
        executionId: execution.id,
      });


    case "STOCK_INQUIRY":
      return handleStockInquiry({
        businessId,
        extraction,
        customer,
        conversationId,
        executionId: execution.id,
      });


    case "GREETING":
      return handleGreeting({
        businessId,
        customer,
        conversationId,
        executionId: execution.id,
        extraction,
      });


    case "ORDER":
      break;


    default:
      return handleUnknown({
        businessId,
        customer,
        conversationId,
        executionId: execution.id,
        extraction,
      });
  }


  /* =======================================================
     ORDER VALIDATION
  ======================================================= */

  if (!extraction.productQuery) {
    const result = {
      success: false,

      decision: "PRODUCT_REQUIRED",

      extraction,

      message:
        "What product would you like to order?",
    };

    await sendConversationMessage({
      businessId,
      conversationId,
      customer,
      message: result.message,
      idempotencyKey:
        `order-product-${conversationId}-${execution.id}`,
    });

    return finishExecution({
      executionId: execution.id,

      status: "REQUIRES_APPROVAL",

      result,
    });
  }


  const productMatch =
    await matchProduct(
      businessId,
      extraction.productQuery
    );


  if (productMatch.ambiguous) {
    const message =
      `I found more than one product matching "${extraction.productQuery}". Please tell me which one you want.`;

    await sendConversationMessage({
      businessId,
      conversationId,
      customer,
      message,
      idempotencyKey:
        `order-ambiguous-${conversationId}-${execution.id}`,
    });

    return finishExecution({
      executionId: execution.id,

      status: "REQUIRES_APPROVAL",

      result: {
        success: false,
        decision: "PRODUCT_AMBIGUOUS",
        extraction,
        productMatch,
        message,
      },
    });
  }


  if (!productMatch.matched) {
    const message =
      `I couldn't find "${extraction.productQuery}". Please check the product name or SKU and try again.`;

    await sendConversationMessage({
      businessId,
      conversationId,
      customer,
      message,
      idempotencyKey:
        `order-not-found-${conversationId}-${execution.id}`,
    });

    return finishExecution({
      executionId: execution.id,

      status: "REQUIRES_APPROVAL",

      result: {
        success: false,
        decision: "PRODUCT_NOT_FOUND",
        extraction,
        productMatch,
        message,
      },
    });
  }


  const quantity =
    extraction.quantity || 1;


  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    const message =
      "Please tell me a valid quantity, for example 2.";

    await sendConversationMessage({
      businessId,
      conversationId,
      customer,
      message,
      idempotencyKey:
        `order-quantity-${conversationId}-${execution.id}`,
    });

    return finishExecution({
      executionId: execution.id,

      status: "REQUIRES_APPROVAL",

      result: {
        success: false,
        decision: "INVALID_QUANTITY",
        extraction,
        productMatch,
        message,
      },
    });
  }


  if (!customer?.phone) {
    return finishExecution({
      executionId: execution.id,

      status: "REQUIRES_APPROVAL",

      result: {
        success: false,

        decision:
          "CUSTOMER_PHONE_REQUIRED",

        extraction,
        productMatch,

        message:
          "Customer phone number is required before creating an order.",
      },
    });
  }


  /* =======================================================
     CREATE PROPOSAL
  ======================================================= */

  const proposal =
    await createProposedOrder({
      businessId,

      customer: {
        name:
          customer.name ||
          extraction.customerName ||
          "Customer",

        phone:
          customer.phone,

        email:
          customer.email ||
          null,
      },

      product:
        productMatch.product,

      quantity,

      deliveryLocation:
        extraction.deliveryLocation,

      rawMessage:
        message,

      extractedIntent:
        extraction.intent,

      aiConfidence:
        extraction.confidence,

      productMatchConfidence:
        productMatch.confidence,

      conversationId,
    });


  const sufficientStock =
    proposal.inventory.sufficient;


  const result = {
    success: sufficientStock,

    decision:
      sufficientStock
        ? "ORDER_PROPOSED"
        : "INSUFFICIENT_STOCK",

    extraction,

    productMatch,

    order:
      proposal.order,

    proposal:
      proposal.proposal,

    inventory:
      proposal.inventory,

    message:
      sufficientStock
        ? "Your order request has been created and is awaiting approval."
        : "I found the product, but there is not enough stock available right now.",
  };


  await prisma.agentExecution.update({
    where: {
      id: execution.id,
    },

    data: {
      status:
        sufficientStock
          ? "PROPOSED"
          : "REQUIRES_APPROVAL",

      output:
        result,
    },
  });


  /*
    Tell the customer what happened.

    Importantly, this does NOT tell the customer that
    the order is confirmed. Human approval is still required.
  */

  if (customer?.phone) {
    await sendConversationMessage({
      businessId,
      conversationId,
      customer,

      message:
        sufficientStock
          ? `I've received your request for ${quantity} × ${productMatch.product.name}. It has been sent for approval. I'll let you know when the order is confirmed.`
          : result.message,

      idempotencyKey:
        `order-proposal-${proposal.proposal.id}`,
    });
  }


  return {
    executionId: execution.id,
    ...result,
  };
}
