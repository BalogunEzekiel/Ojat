import crypto from "crypto";

import {
  Prisma,
} from "@prisma/client";

import {
  prisma,
} from "../lib/prisma.js";

import {
  env,
} from "../config/env.js";


/* =========================================================
   PAYSTACK API
========================================================= */

const PAYSTACK_BASE_URL =
  "https://api.paystack.co";


/* =========================================================
   GENERATE PAYMENT REFERENCE
========================================================= */

function generatePaymentReference() {

  return [
    "OJ",
    Date.now(),
    crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase(),
  ].join("-");
}


/* =========================================================
   PAYSTACK REQUEST
========================================================= */

async function paystackRequest(
  path,
  options = {}
) {

  if (
    !env.paystackSecret
  ) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not configured"
    );
  }


  const response =
    await fetch(
      `${PAYSTACK_BASE_URL}${path}`,
      {
        ...options,

        headers: {
          Authorization:
            `Bearer ${env.paystackSecret}`,

          "Content-Type":
            "application/json",

          ...(options.headers ||
            {}),
        },
      }
    );


  let data;


  try {

    data =
      await response.json();

  } catch {

    throw new Error(
      "Invalid response received from Paystack"
    );
  }


  if (
    !response.ok ||
    !data?.status
  ) {

    throw new Error(
      data?.message ||
      `Paystack request failed with HTTP ${response.status}`
    );
  }


  return data;
}


/* =========================================================
   CONVERT NGN TO KOBO
========================================================= */

function toSubunit(
  amount
) {

  const decimal =
    new Prisma.Decimal(
      amount
    );


  return decimal
    .mul(100)
    .toFixed(0);
}


/* =========================================================
   INITIALIZE PAYMENT FOR ORDER
========================================================= */

export async function initializeOrderPayment({
  businessId,
  orderId,
}) {

  /*
    Everything required to initialize the payment is
    validated from the database rather than trusting data
    supplied by the frontend.
  */

  const order =
    await prisma.order.findFirst({
      where: {

        id:
          orderId,

        businessId,

      },

      include: {

        customer:
          true,

        items: {
          include: {
            product:
              true,
          },
        },

        invoice:
          true,
      },
    });


  if (!order) {
    throw new Error(
      "Order not found"
    );
  }


  if (
    order.status !==
    "CONFIRMED"
  ) {

    throw new Error(
      `Only confirmed orders can be paid. Current status: ${order.status}`
    );
  }


  if (
    !order.customer?.email
  ) {

    throw new Error(
      "Customer email is required before initializing Paystack payment"
    );
  }


  /* =======================================================
     REUSE EXISTING PENDING PAYMENT
  ======================================================= */

  if (
    order.invoice
  ) {

    const existingPayment =
      await prisma.payment.findFirst({
        where: {

          invoiceId:
            order.invoice.id,

          status:
            "PENDING",

          provider:
            "PAYSTACK",
        },

        orderBy: {
          createdAt:
            "desc",
        },
      });


    if (
      existingPayment
    ) {

      return {
        invoice:
          order.invoice,

        payment:
          existingPayment,

        authorizationUrl:
          existingPayment.authorizationUrl,

        reference:
          existingPayment.reference,

        reused:
          true,
      };
    }
  }


  /* =======================================================
     CREATE INVOICE
  ======================================================= */

  const invoice =
    order.invoice ||
    await prisma.invoice.create({
      data: {

        businessId,

        customerId:
          order.customerId,

        orderId:
          order.id,

        number:
          `INV-${order.number}`,

        status:
          "SENT",

        total:
          order.total,
      },
    });


  /* =======================================================
     GENERATE UNIQUE PAYMENT REFERENCE
  ======================================================= */

  const reference =
    generatePaymentReference();


  /* =======================================================
     INITIALIZE PAYSTACK TRANSACTION
  ======================================================= */

  const paystack =
    await paystackRequest(
      "/transaction/initialize",
      {
        method:
          "POST",

        body:
          JSON.stringify({

            email:
              order.customer.email,

            amount:
              toSubunit(
                order.total
              ),

            currency:
              "NGN",

            reference,

            metadata:
              JSON.stringify({
                businessId,

                orderId:
                  order.id,

                orderNumber:
                  order.number,

                invoiceId:
                  invoice.id,
              }),
          }),
      }
    );


  const authorizationUrl =
    paystack.data
      ?.authorization_url;


  if (
    !authorizationUrl
  ) {

    throw new Error(
      "Paystack did not return an authorization URL"
    );
  }


  /* =======================================================
     CREATE LOCAL PAYMENT
  ======================================================= */

  const payment =
    await prisma.payment.create({
      data: {

        businessId,

        invoiceId:
          invoice.id,

        provider:
          "PAYSTACK",

        reference,

        amount:
          order.total,

        status:
          "PENDING",

        authorizationUrl,

        rawPayload:
          paystack,
      },
    });


  return {

    invoice,

    payment,

    authorizationUrl,

    reference,

    reused:
      false,
  };
}


/* =========================================================
   VERIFY PAYSTACK TRANSACTION
========================================================= */

export async function verifyPaystackTransaction(
  reference
) {

  if (
    !reference
  ) {
    throw new Error(
      "Payment reference is required"
    );
  }


  const response =
    await paystackRequest(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method:
          "GET",
      }
    );


  return response.data;
}


/* =========================================================
   FINALIZE SUCCESSFUL PAYMENT
========================================================= */

export async function finalizeSuccessfulPayment(
  reference,
  verifiedTransaction
) {

  if (
    !reference
  ) {
    throw new Error(
      "Payment reference is required"
    );
  }


  return prisma.$transaction(
    async tx => {

      /* =====================================
         FIND PAYMENT
      ===================================== */

      const payment =
        await tx.payment.findUnique({
          where: {
            reference,
          },

          include: {
            invoice: {
              include: {
                order: {
                  include: {
                    customer:
                      true,

                    items: {
                      include: {
                        product: {
                          include: {
                            inventory:
                              true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });


      if (!payment) {

        throw new Error(
          `Payment not found for reference ${reference}`
        );
      }


      /* =====================================
         IDEMPOTENCY

         If payment was already finalized,
         do not deduct inventory again.
      ===================================== */

      if (
        payment.status ===
        "SUCCESS"
      ) {

        return {

          alreadyProcessed:
            true,

          payment,
        };
      }


      const order =
        payment.invoice.order;


      /* =====================================
         VALIDATE PAYSTACK RESULT
      ===================================== */

      if (
        verifiedTransaction.status !==
        "success"
      ) {

        throw new Error(
          `Paystack transaction is not successful. Status: ${verifiedTransaction.status}`
        );
      }


      if (
        verifiedTransaction.reference !==
        payment.reference
      ) {

        throw new Error(
          "Paystack reference does not match local payment"
        );
      }


      /* =====================================
         VALIDATE AMOUNT
      ===================================== */

      const expectedAmount =
        new Prisma.Decimal(
          payment.amount
        )
          .mul(100)
          .toFixed(0);


      const receivedAmount =
        String(
          verifiedTransaction.amount
        );


      if (
        expectedAmount !==
        receivedAmount
      ) {

        throw new Error(
          `Payment amount mismatch. Expected ${expectedAmount}, received ${receivedAmount}`
        );
      }


      /* =====================================
         VALIDATE CURRENCY
      ===================================== */

      if (
        verifiedTransaction.currency &&
        verifiedTransaction.currency !==
          "NGN"
      ) {

        throw new Error(
          `Unexpected payment currency: ${verifiedTransaction.currency}`
        );
      }


      /* =====================================
         ORDER STATUS VALIDATION
      ===================================== */

      if (
        order.status !==
        "CONFIRMED"
      ) {

        /*
          A payment should not silently finalize
          against an order that has already been
          cancelled/refunded/completed.
        */

        if (
          order.status ===
          "PROCESSING"
        ) {

          return {

            alreadyProcessed:
              true,

            payment,
          };
        }


        throw new Error(
          `Order cannot be finalized from status ${order.status}`
        );
      }


      /* =====================================
         FINALIZE EACH ORDER ITEM
      ===================================== */

      for (
        const item of order.items
      ) {

        const inventory =
          item.product.inventory;


        if (!inventory) {

          throw new Error(
            `No inventory record for ${item.product.name}`
          );
        }


        /*
          At approval:

          reserved += quantity

          At payment:

          quantity -= quantity
          reserved -= quantity
        */

        if (
          inventory.reserved <
          item.quantity
        ) {

          throw new Error(
            `Reserved stock mismatch for ${item.product.name}. Reserved: ${inventory.reserved}, Required: ${item.quantity}`
          );
        }


        if (
          inventory.quantity <
          item.quantity
        ) {

          throw new Error(
            `Physical stock is insufficient for ${item.product.name}`
          );
        }


        await tx.inventory.update({
          where: {

            productId:
              item.productId,
          },

          data: {

            quantity: {
              decrement:
                item.quantity,
            },

            reserved: {
              decrement:
                item.quantity,
            },
          },
        });


        /* ===================================
           STOCK OUT
        =================================== */

        await tx.inventoryTransaction.create({
          data: {

            businessId:
              payment.businessId,

            productId:
              item.productId,

            type:
              "STOCK_OUT",

            quantity:
              item.quantity,

            reference:
              order.number,

            note:
              `Stock deducted for paid order ${order.number}`,
          },
        });


        /* ===================================
           RELEASE RESERVATION

           We deliberately record the release
           separately so the inventory audit trail
           clearly shows:

           RESERVATION +2
           RELEASE -2

           while STOCK_OUT records the physical
           movement.
        =================================== */

        await tx.inventoryTransaction.create({
          data: {

            businessId:
              payment.businessId,

            productId:
              item.productId,

            type:
              "RELEASE",

            quantity:
              item.quantity,

            reference:
              order.number,

            note:
              `Reservation released after payment for order ${order.number}`,
          },
        });
      }


      /* =====================================
         PAYMENT SUCCESS
      ===================================== */

      const updatedPayment =
        await tx.payment.update({
          where: {

            id:
              payment.id,
          },

          data: {

            status:
              "SUCCESS",

            rawPayload:
              verifiedTransaction,
          },
        });


      /* =====================================
         INVOICE PAID
      ===================================== */

      await tx.invoice.update({
        where: {

          id:
            payment.invoiceId,
        },

        data: {

          status:
            "PAID",
        },
      });


      /* =====================================
         ORDER PROCESSING
      ===================================== */

      const updatedOrder =
        await tx.order.update({
          where: {

            id:
              order.id,
          },

          data: {

            status:
              "PROCESSING",
          },

          include: {

            customer:
              true,

            items: {
              include: {
                product:
                  true,
              },
            },
          },
        });


      return {

        alreadyProcessed:
          false,

        payment:
          updatedPayment,

        order:
          updatedOrder,
      };
    },

    {
      isolationLevel:
        "Serializable",
    }
  );
}


/* =========================================================
   HANDLE PAYSTACK SUCCESS
========================================================= */

export async function handlePaystackSuccess(
  reference
) {

  const transaction =
    await verifyPaystackTransaction(
      reference
    );


  return finalizeSuccessfulPayment(
    reference,
    transaction
  );
}

/* =========================================================
   CUSTOMER PAYMENT CONFIRMATION
========================================================= */

export async function handlePaystackSuccess(reference) {
  const transaction =
    await verifyPaystackTransaction(reference);

  const result =
    await finalizeSuccessfulPayment(
      reference,
      transaction
    );

  if (
    result.alreadyProcessed ||
    !result.order
  ) {
    return result;
  }

  const order =
    result.order;

  const conversation =
    await prisma.conversation.findFirst({
      where: {
        businessId: order.businessId,
        customerId: order.customerId,
      },

      orderBy: {
        updatedAt: "desc",
      },
    });

  if (conversation && order.customer?.phone) {
    await queueWhatsAppOutbound({
      businessId:
        order.businessId,

      conversationId:
        conversation.id,

      to:
        order.customer.phone,

      message:
        `Payment received successfully for order ${order.number}. ` +
        `Your order is now being processed. Thank you for shopping with us!`,

      idempotencyKey:
        `payment-success-${result.payment.id}`,

      context: {
        type: "PAYMENT_SUCCESS",

        orderId:
          order.id,

        paymentId:
          result.payment.id,
      },
    });
  }

  return result;
}
