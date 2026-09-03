import { prisma } from "../lib/prisma.js";

import {
  extractCommerce,
} from "./ai.service.js";

import {
  matchProduct,
} from "./product-matching.service.js";

import {
  createProposedOrder,
  approveOrder,
  rejectOrder,
} from "./order.service.js";


/* =========================================================
   PROCESS COMMERCE MESSAGE
========================================================= */

export async function processCommerceMessage({
  businessId,
  message,
  customer,
  messageId,
  conversationId,
}) {

  /* =====================================
     STEP 1 — AI EXTRACTION
  ===================================== */

  const extraction =
    await extractCommerce(
      message
    );


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


  /* =====================================
     CREATE AGENT EXECUTION
  ===================================== */

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


  /* =====================================
     STEP 2 — VALIDATE INTENT
  ===================================== */

  if (
    extraction.intent !==
    "ORDER"
  ) {

    const result = {

      success:
        false,

      decision:
        "NOT_AN_ORDER",

      extraction,

      message:
        "The message was not identified as an order.",
    };


    await prisma.agentExecution.update({
      where: {
        id:
          execution.id,
      },

      data: {

        status:
          "REQUIRES_APPROVAL",

        output:
          result,
      },
    });


    return {

      executionId:
        execution.id,

      ...result,
    };
  }


  /* =====================================
     STEP 3 — VALIDATE PRODUCT QUERY
  ===================================== */

  if (
    !extraction.productQuery
  ) {

    const result = {

      success:
        false,

      decision:
        "PRODUCT_REQUIRED",

      extraction,

      message:
        "The AI could not determine the requested product.",
    };


    await prisma.agentExecution.update({
      where: {
        id:
          execution.id,
      },

      data: {

        status:
          "REQUIRES_APPROVAL",

        output:
          result,
      },
    });


    return {

      executionId:
        execution.id,

      ...result,
    };
  }


  /* =====================================
     STEP 4 — PRODUCT MATCHING
  ===================================== */

  const productMatch =
    await matchProduct(
      businessId,
      extraction.productQuery
    );


  /* =====================================
     AMBIGUOUS PRODUCT
  ===================================== */

  if (
    productMatch.ambiguous
  ) {

    const result = {

      success:
        false,

      decision:
        "PRODUCT_AMBIGUOUS",

      extraction,

      productMatch,

      message:
        `Multiple products closely match "${extraction.productQuery}". Customer clarification is required.`,
    };


    await prisma.agentExecution.update({
      where: {
        id:
          execution.id,
      },

      data: {

        status:
          "REQUIRES_APPROVAL",

        output:
          result,
      },
    });


    return {

      executionId:
        execution.id,

      ...result,
    };
  }


  /* =====================================
     PRODUCT NOT FOUND
  ===================================== */

  if (
    !productMatch.matched
  ) {

    const result = {

      success:
        false,

      decision:
        "PRODUCT_NOT_FOUND",

      extraction,

      productMatch,

      message:
        `No reliable product match found for "${extraction.productQuery}".`,
    };


    await prisma.agentExecution.update({
      where: {
        id:
          execution.id,
      },

      data: {

        status:
          "REQUIRES_APPROVAL",

        output:
          result,
      },
    });


    return {

      executionId:
        execution.id,

      ...result,
    };
  }


  /* =====================================
     STEP 5 — QUANTITY VALIDATION
  ===================================== */

  /*
    We intentionally require a positive integer.

    The AI extractor may return null when the customer
    didn't specify quantity.

    For now, Ojat keeps the existing business rule:
    unspecified quantity = 1.
  */

  const quantity =
    extraction.quantity ||
    1;


  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {

    const result = {

      success:
        false,

      decision:
        "INVALID_QUANTITY",

      extraction,

      productMatch,

      message:
        "The requested quantity is invalid.",
    };


    await prisma.agentExecution.update({
      where: {
        id:
          execution.id,
      },

      data: {

        status:
          "REQUIRES_APPROVAL",

        output:
          result,
      },
    });


    return {

      executionId:
        execution.id,

      ...result,
    };
  }


  /* =====================================
     STEP 6 — CUSTOMER VALIDATION
  ===================================== */

  if (
    !customer?.phone
  ) {

    const result = {

      success:
        false,

      decision:
        "CUSTOMER_PHONE_REQUIRED",

      extraction,

      productMatch,

      message:
        "Customer phone number is required before creating an order.",
    };


    await prisma.agentExecution.update({
      where: {
        id:
          execution.id,
      },

      data: {

        status:
          "REQUIRES_APPROVAL",

        output:
          result,
      },
    });


    return {

      executionId:
        execution.id,

      ...result,
    };
  }


  /* =====================================
     STEP 7 — CREATE ORDER PROPOSAL
  ===================================== */

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

      rawMessage:
        message,

      extractedIntent:
        extraction.intent,

      aiConfidence:
        extraction.confidence,

      productMatchConfidence:
        productMatch.confidence,
    });


  /* =====================================
     STEP 8 — DETERMINE DECISION
  ===================================== */

  const sufficientStock =
    proposal.inventory.sufficient;


  const result = {

    success:
      sufficientStock,

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
        ? "Order proposal successfully created and awaiting approval."
        : "Order proposal created, but inventory is insufficient.",
  };


  await prisma.agentExecution.update({
    where: {
      id:
        execution.id,
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


  return {

    executionId:
      execution.id,

    ...result,
  };
}


/* =========================================================
   APPROVE AGENT ORDER
========================================================= */

export async function approveAgentOrder({
  businessId,
  orderId,
}) {

  const order =
    await approveOrder(
      businessId,
      orderId
    );


  await prisma.agentExecution.updateMany({
    where: {

      businessId,

      action:
        "PROCESS_COMMERCE_MESSAGE",

      output: {

        path: [
          "order",
          "id",
        ],

        equals:
          orderId,
      },
    },

    data: {

      status:
        "EXECUTED",
    },
  });


  return order;
}


/* =========================================================
   REJECT AGENT ORDER
========================================================= */

export async function rejectAgentOrder({
  businessId,
  orderId,
}) {

  const order =
    await rejectOrder(
      businessId,
      orderId
    );


  await prisma.agentExecution.updateMany({
    where: {

      businessId,

      action:
        "PROCESS_COMMERCE_MESSAGE",

      output: {

        path: [
          "order",
          "id",
        ],

        equals:
          orderId,
      },
    },

    data: {

      status:
        "FAILED",
    },
  });


  return order;
}