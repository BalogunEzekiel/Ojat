import { prisma } from "../lib/prisma.js";

import {
  normalizePhone,
} from "./phone.service.js";

/* =========================================================
   GENERATE ORDER NUMBER
========================================================= */

function generateOrderNumber() {

  const timestamp =
    Date.now()
      .toString()
      .slice(-8);

  const random =
    Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();

  return `OJ-${timestamp}-${random}`;
}

/* =========================================================
   RESOLVE CUSTOMER
========================================================= */

async function resolveCustomer(
  businessId,
  {
    name,
    phone,
    email,
  }
) {

  if (!businessId) {
    throw new Error(
      "Business ID is required"
    );
  }


  const normalizedPhone =
    normalizePhone(phone);


  if (!normalizedPhone) {
    throw new Error(
      "Customer phone number is required"
    );
  }


  let customer =
    await prisma.customer.findUnique({
      where: {
        businessId_phone: {
          businessId,

          phone:
            normalizedPhone,
        },
      },
    });


  /* -----------------------------------------
     EXISTING CUSTOMER
  ----------------------------------------- */

  if (customer) {

    const updateData = {};


    if (
      name?.trim() &&
      customer.name !== name.trim()
    ) {
      updateData.name =
        name.trim();
    }


    if (
      email?.trim() &&
      customer.email !== email.trim()
    ) {
      updateData.email =
        email.trim();
    }


    if (
      Object.keys(updateData).length
    ) {

      customer =
        await prisma.customer.update({
          where: {
            id:
              customer.id,
          },

          data:
            updateData,
        });
    }


    return customer;
  }


  /* -----------------------------------------
     NEW CUSTOMER
  ----------------------------------------- */

  return prisma.customer.create({
    data: {
      businessId,

      name:
        name?.trim() ||
        "Customer",

      phone:
        normalizedPhone,

      email:
        email?.trim() ||
        null,
    },
  });
}


/* =========================================================
   CREATE PROPOSED ORDER
========================================================= */

export async function createProposedOrder({
  businessId,
  customer,
  product,
  quantity,
  deliveryLocation,
  rawMessage,
  extractedIntent = "ORDER",
  aiConfidence = 0,
  customerMatchConfidence,
  productMatchConfidence,
  conversationId,
}) {

  if (!businessId) {
    throw new Error(
      "Business ID is required"
    );
  }


  if (!product?.id) {
    throw new Error(
      "Product is required"
    );
  }


  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Quantity must be a positive integer"
    );
  }


  const resolvedCustomer =
    await resolveCustomer(
      businessId,
      customer
    );


  const dbProduct =
    await prisma.product.findFirst({
      where: {
        id:
          product.id,

        businessId,

        active:
          true,
      },

      include: {
        inventory:
          true,
      },
    });


  if (!dbProduct) {
    throw new Error(
      "Product no longer exists"
    );
  }


  const availableStock =
    dbProduct.inventory
      ? (
          dbProduct.inventory.quantity -
          dbProduct.inventory.reserved
        )
      : 0;


  const unitPrice =
    Number(
      dbProduct.sellingPrice
    );


  const subtotal =
    unitPrice *
    quantity;


  const order =
    await prisma.order.create({
      data: {

        businessId,

        customerId:
          resolvedCustomer.id,

        number:
          generateOrderNumber(),

        status:
          "PENDING",

        subtotal,

        discount:
          0,

        deliveryFee:
          0,

        total:
          subtotal,

        deliveryAddress:
          deliveryLocation?.trim() ||
          null,

        items: {
          create: [
            {
              productId:
                dbProduct.id,

              quantity,

              unitPrice,

              total:
                subtotal,
            },
          ],
        },
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


  const proposal = await prisma.aiOrderProposal.create({
    data: {
      businessId,
      customerId: resolvedCustomer.id,
      conversationId: conversationId || null,
      orderId: order.id,
      matchedProductId: dbProduct.id,
      rawMessage: rawMessage || "",
      extractedIntent,
      aiConfidence,
      customerMatchConfidence: customerMatchConfidence ?? null,
      productMatchConfidence: productMatchConfidence ?? null,
      requestedQuantity: quantity,
      availableInventory: availableStock,
      proposedUnitPrice: unitPrice,
      proposedTotal: subtotal,
    },
    include: {
      customer: true,
      matchedProduct: true,
      order: { include: { items: { include: { product: true } } } },
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      action: "AI_PROPOSAL_CREATED",
      resource: "AI_ORDER_PROPOSAL",
      resourceId: proposal.id,
      after: { status: proposal.status, orderId: order.id },
    },
  });

  return {
    order,
    proposal,

    inventory: {

      requested:
        quantity,

      available:
        availableStock,

      sufficient:
        availableStock >=
        quantity,
    },
  };
}


/* =========================================================
   APPROVE ORDER
========================================================= */

/*
  IMPORTANT:

  Inventory reservation is protected by a SERIALIZABLE
  transaction.

  This prevents two simultaneous approvals from both reading
  the same available stock and overselling inventory.

  PostgreSQL may abort one transaction with Prisma error P2034
  when concurrent writes conflict. We retry a few times.
*/

export async function approveOrder(
  businessId,
  orderId
) {

  const MAX_RETRIES = 3;


  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {

    try {

      return await prisma.$transaction(
        async tx => {

          const order =
            await tx.order.findFirst({
              where: {
                id:
                  orderId,

                businessId,
              },

              include: {
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
            });


          if (!order) {
            throw new Error(
              "Order not found"
            );
          }


          if (
            order.status !==
            "PENDING"
          ) {
            throw new Error(
              `Order cannot be approved. Current status: ${order.status}`
            );
          }


          /* =====================================
             VALIDATE PRODUCTS
          ===================================== */

          for (
            const item of order.items
          ) {

            if (
              !item.product ||
              !item.product.active
            ) {
              throw new Error(
                `Product for order item ${item.id} is no longer available`
              );
            }


            const inventory =
              item.product.inventory;


            if (!inventory) {
              throw new Error(
                `No inventory record for ${item.product.name}`
              );
            }


            const available =
              inventory.quantity -
              inventory.reserved;


            if (
              available <
              item.quantity
            ) {
              throw new Error(
                `Insufficient stock for ${item.product.name}. Available: ${available}, Requested: ${item.quantity}`
              );
            }
          }


          /* =====================================
             RESERVE STOCK

             Because the entire transaction runs
             at SERIALIZABLE isolation, concurrent
             approvals cannot silently oversell.
          ===================================== */

          for (
            const item of order.items
          ) {

            await tx.inventory.update({
              where: {
                productId:
                  item.productId,
              },

              data: {
                reserved: {
                  increment:
                    item.quantity,
                },
              },
            });


            await tx.inventoryTransaction.create({
              data: {

                businessId,

                productId:
                  item.productId,

                type:
                  "RESERVATION",

                quantity:
                  item.quantity,

                reference:
                  order.number,

                note:
                  `Stock reserved for order ${order.number}`,
              },
            });
          }


          /* =====================================
             CONFIRM ORDER
          ===================================== */

          const updatedOrder =
            await tx.order.update({
              where: {
                id:
                  order.id,
              },

              data: {
                status:
                  "CONFIRMED",
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


          return updatedOrder;

        },

        {
          isolationLevel:
            "Serializable",
        }
      );

    } catch (error) {

      /*
        Prisma P2034 =
        transaction conflict / serialization failure.

        Retry only that class of failure.
      */

      if (
        error?.code === "P2034" &&
        attempt < MAX_RETRIES
      ) {

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              50 * attempt
            )
        );

        continue;
      }


      throw error;
    }
  }


  throw new Error(
    "Unable to approve order after multiple transaction attempts"
  );
}


/* =========================================================
   REJECT ORDER
========================================================= */

export async function rejectOrder(
  businessId,
  orderId
) {

  const order =
    await prisma.order.findFirst({
      where: {
        id:
          orderId,

        businessId,
      },
    });


  if (!order) {
    throw new Error(
      "Order not found"
    );
  }


  if (
    order.status !==
    "PENDING"
  ) {
    throw new Error(
      "Only pending orders can be rejected"
    );
  }


  return prisma.order.update({
    where: {
      id:
        order.id,
    },

    data: {
      status:
        "CANCELLED",
    },
  });
}
