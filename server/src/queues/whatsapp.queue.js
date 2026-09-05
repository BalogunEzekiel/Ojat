import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";

export const WHATSAPP_QUEUE_NAME = "whatsapp-processing";

export const whatsappQueue = new Queue(
  WHATSAPP_QUEUE_NAME,
  {
    connection: redis,

    defaultJobOptions: {
      attempts: 3,

      backoff: {
        type: "exponential",
        delay: 2000,
      },

      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1000,
      },

      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 5000,
      },
    },
  }
);


/* =========================================================
   INBOUND WHATSAPP MESSAGE
========================================================= */

export async function queueWhatsAppMessage(data) {
  if (!data?.eventId) {
    throw new Error(
      "eventId is required to queue an inbound WhatsApp message"
    );
  }

  return whatsappQueue.add(
    "process-inbound",
    data,
    {
      jobId: `inbound-${data.eventId}`,
    }
  );
}


/* =========================================================
   OUTBOUND WHATSAPP MESSAGE
========================================================= */

export async function queueWhatsAppOutbound({
  businessId,
  conversationId,
  to,
  message,
  idempotencyKey,
  context = {},
}) {
  if (!businessId) {
    throw new Error("businessId is required");
  }

  if (!conversationId) {
    throw new Error("conversationId is required");
  }

  if (!to) {
    throw new Error("WhatsApp recipient is required");
  }

  if (!message) {
    throw new Error("WhatsApp message is required");
  }

  if (!idempotencyKey) {
    throw new Error("idempotencyKey is required");
  }

  return whatsappQueue.add(
    "send-outbound",
    {
      businessId,
      conversationId,
      to,
      message,
      idempotencyKey,
      context,
    },
    {
      jobId: `outbound-${idempotencyKey}`,
    }
  );
}
