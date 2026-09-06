import { prisma } from "../lib/prisma.js";

import {
  approveOrder,
} from "./order.service.js";

import {
  queueWhatsAppOutbound,
} from "../queues/whatsapp.queue.js";

import {
  initializeOrderPayment,
} from "./paystack.service.js";


/* =========================================================
   PROPOSAL INCLUDE
========================================================= */

const proposalInclude = {
  customer: true,

  matchedProduct: {
    include: {
      inventory: true,
    },
  },

  order: {
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  },

  reviewedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
};


/* =========================================================
   FORMAT NGN
========================================================= */

function formatNaira(amount) {
  return new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 2,
    }
  ).format(
    Number(amount)
  );
}


/* =========================================================
   RESOLVE CUSTOMER CONVERSATION
========================================================= */

async function resolveCustomerConversation({
  businessId,
  customerId,
  conversationId,
}) {
  if (conversationId) {
    const conversation =
      await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          businessId,
          customerId,
        },
      });

    if (conversation) {
      return conversation;
    }
  }

  return prisma.conversation.findFirst({
    where: {
      businessId,
      customerId,
    },

    orderBy: {
      updatedAt: "desc",
    },
  });
}


/* =========================================================
   SEND APPROVAL MESSAGE
========================================================= */

async function sendApprovalMessage({
  businessId,
  proposal,
  order,
}) {
  const customer =
    proposal.customer ||
    order.customer;

  if (!customer?.phone) {
    console.warn(
      `Unable to send approval message for order ${order.id}: customer has no phone`
    );

    return {
      queued: false,
      reason: "CUSTOMER_PHONE_MISSING",
    };
  }


  const conversation =
    await resolveCustomerConversation({
      businessId,

      customerId:
        customer.id,

      conversationId:
        proposal.conversationId,
    });


  if (!conversation) {
    console.warn(
      `Unable to send approval message for order ${order.id}: conversation not found`
    );

    return {
      queued: false,
      reason: "CONVERSATION_NOT_FOUND",
    };
  }


  /* =======================================================
     CUSTOMER EMAIL MISSING
  ======================================================= */

  if (!customer.email) {
    const message =
      `Good news! Your order ${order.number} has been approved and reserved. ` +
      `The total is ${formatNaira(order.total)}.\n\n` +
      `Please reply with your email address so I can generate your secure payment link.`;

    await queueWhatsAppOutbound({
      businessId,

      conversationId:
        conversation.id,

      to:
        customer.phone,

      message,

      idempotencyKey:
        `order-approved-email-required-${order.id}`,

      context: {
        type:
          "ORDER_APPROVED_EMAIL_REQUIRED",

        orderId:
          order.id,

        orderNumber:
          order.number,

        proposalId:
          proposal.id,
      },
    });

    return {
      queued: true,

      paymentInitialized: false,

      requiresCustomerEmail: true,
    };
  }


  /* =======================================================
     INITIALIZE PAYMENT
  ======================================================= */

  let paymentResult;

  try {
    paymentResult =
      await initializeOrderPayment({
        businessId,

        orderId:
          order.id,
      });

  } catch (error) {
    /*
      The order has already been approved and inventory
      reserved. A temporary Paystack failure must NOT
      turn the successful approval into a failed request.

      We notify the customer that the order is confirmed
      and payment is being prepared rather than making a
      false claim that payment has been initialized.
    */

    console.error(
      `Paystack initialization failed for approved order ${order.number}:`,
      error
    );


    const message =
      `Your order ${order.number} has been approved and reserved. ` +
      `We are currently preparing your secure payment link. ` +
      `Please wait for the payment message.`;

    await queueWhatsAppOutbound({
      businessId,

      conversationId:
        conversation.id,

      to:
        customer.phone,

      message,

      idempotencyKey:
        `order-approved-payment-pending-${order.id}`,

      context: {
        type:
          "ORDER_APPROVED_PAYMENT_PENDING",

        orderId:
          order.id,

        orderNumber:
          order.number,

        proposalId:
          proposal.id,

        error:
          error.message,
      },
    });


    return {
      queued: true,

      paymentInitialized: false,

      paymentInitializationFailed: true,

      error:
        error.message,
    };
  }


  /* =======================================================
     PAYMENT LINK
  ======================================================= */

  const paymentUrl =
    paymentResult.authorizationUrl;


  if (!paymentUrl) {
    throw new Error(
      `Paystack did not return a payment URL for order ${order.number}`
    );
  }


  const message =
    `Your order ${order.number} has been confirmed and your items have been reserved.\n\n` +
    `Total: ${formatNaira(order.total)}\n\n` +
    `Please click the link below to pay securely:\n` +
    `${paymentUrl}\n\n` +
    `Once your payment is confirmed, I'll let you know and your order will move into processing.`;


  await queueWhatsAppOutbound({
    businessId,

    conversationId:
      conversation.id,

    to:
      customer.phone,

    message,

    idempotencyKey:
      `order-payment-link-${order.id}-${paymentResult.reference}`,

    context: {
      type:
        "ORDER_PAYMENT_LINK",

      orderId:
        order.id,

      orderNumber:
        order.number,

      proposalId:
        proposal.id,

      paymentId:
        paymentResult.payment.id,

      reference:
        paymentResult.reference,
    },
  });


  return {
    queued: true,

    paymentInitialized: true,

    requiresCustomerEmail: false,

    payment:
      paymentResult,
  };
}


/* =========================================================
   LIST PENDING PROPOSALS
========================================================= */

export async function listPendingProposals(
  businessId,
  isPlatformAdmin = false
) {
  return prisma.aIOrderProposal.findMany({
    where: {
      ...(isPlatformAdmin
        ? {}
        : {
            businessId,
          }),

      status: "PENDING",
    },

    include: proposalInclude,

    orderBy: {
      createdAt: "asc",
    },
  });
}


/* =========================================================
   GET PROPOSAL
========================================================= */

export async function getProposal(
  businessId,
  proposalId
) {
  const proposal =
    await prisma.aIOrderProposal.findFirst({
      where: {
        id:
          proposalId,

        businessId,
      },

      include:
        proposalInclude,
    });


  if (!proposal) {
    throw new Error(
      "AI order proposal not found"
    );
  }


  return proposal;
}


/* =========================================================
   GET PROPOSAL AUDIT
========================================================= */

export async function getProposalAudit(
  businessId,
  proposalId
) {
  await getProposal(
    businessId,
    proposalId
  );


  return prisma.auditLog.findMany({
    where: {
      businessId,

      resource:
        "AI_ORDER_PROPOSAL",

      resourceId:
        proposalId,
    },

    orderBy: {
      createdAt:
        "asc",
    },
  });
}


/* =========================================================
   APPROVE PROPOSAL
========================================================= */

export async function approveProposal({
  businessId,
  proposalId,
  reviewerId,
}) {
  /*
    First verify the proposal belongs to this business.
  */

  const proposal =
    await getProposal(
      businessId,
      proposalId
    );


  if (
    proposal.status !==
    "PENDING"
  ) {
    throw new Error(
      `Proposal cannot be approved. Current status: ${proposal.status}`
    );
  }


  /* =======================================================
     APPROVE ORDER

     approveOrder() performs the inventory reservation
     transaction and changes the order to CONFIRMED.
  ======================================================= */

  const order =
    await approveOrder(
      businessId,
      proposal.orderId
    );


  /* =======================================================
     UPDATE PROPOSAL
  ======================================================= */

  const updated =
    await prisma.aIOrderProposal.update({
      where: {
        id:
          proposalId,
      },

      data: {
        status:
          "APPROVED",

        reviewedAt:
          new Date(),

        reviewedById:
          reviewerId,
      },

      include:
        proposalInclude,
    });


  /* =======================================================
     AUDIT APPROVAL
  ======================================================= */

  await prisma.auditLog.create({
    data: {
      businessId,

      actorId:
        reviewerId,

      action:
        "ORDER_APPROVED",

      resource:
        "AI_ORDER_PROPOSAL",

      resourceId:
        proposalId,

      before: {
        status:
          proposal.status,

        orderStatus:
          proposal.order?.status,
      },

      after: {
        status:
          updated.status,

        orderId:
          order.id,

        orderStatus:
          order.status,
      },
    },
  });


  /* =======================================================
     AUTOMATIC PAYMENT WORKFLOW
  ======================================================= */

  let paymentWorkflow = null;

  try {
    paymentWorkflow =
      await sendApprovalMessage({
        businessId,

        proposal:
          updated,

        order,
      });

  } catch (error) {
    /*
      Approval itself has already succeeded.

      Do not roll back a valid inventory reservation simply
      because WhatsApp/payment notification encountered a
      temporary external failure.
    */

    console.error(
      `Post-approval payment workflow failed for proposal ${proposalId}:`,
      error
    );


    paymentWorkflow = {
      queued:
        false,

      paymentInitialized:
        false,

      failed:
        true,

      error:
        error.message,
    };


    await prisma.auditLog.create({
      data: {
        businessId,

        actorId:
          reviewerId,

        action:
          "ORDER_APPROVAL_NOTIFICATION_FAILED",

        resource:
          "AI_ORDER_PROPOSAL",

        resourceId:
          proposalId,

        before: {
          status:
            "APPROVED",
        },

        after: {
          status:
            "APPROVED",

          orderId:
            order.id,

          error:
            error.message,
        },
      },
    });
  }


  return {
    ...updated,

    paymentWorkflow,
  };
}


/* =========================================================
   REJECT PROPOSAL
========================================================= */

export async function rejectProposal({
  businessId,
  proposalId,
  reviewerId,
  rejectionReason,
}) {
  const proposal =
    await getProposal(
      businessId,
      proposalId
    );


  if (
    proposal.status !==
    "PENDING"
  ) {
    throw new Error(
      `Proposal cannot be rejected. Current status: ${proposal.status}`
    );
  }


  const updated =
    await prisma.$transaction(
      async (tx) => {

        const result =
          await tx.aIOrderProposal.update({
            where: {
              id:
                proposalId,
            },

            data: {
              status:
                "REJECTED",

              reviewedAt:
                new Date(),

              reviewedById:
                reviewerId,

              rejectionReason,
            },

            include:
              proposalInclude,
          });


        await tx.order.update({
          where: {
            id:
              proposal.orderId,
          },

          data: {
            status:
              "CANCELLED",
          },
        });


        await tx.auditLog.create({
          data: {
            businessId,

            actorId:
              reviewerId,

            action:
              "ORDER_REJECTED",

            resource:
              "AI_ORDER_PROPOSAL",

            resourceId:
              proposalId,

            before: {
              status:
                proposal.status,
            },

            after: {
              status:
                result.status,

              rejectionReason,
            },
          },
        });


        return result;
      }
    );


  return updated;
}
