import {
  Worker,
} from "bullmq";

import {
  redis,
} from "../lib/redis.js";

import {
  prisma,
} from "../lib/prisma.js";

import {
  processCommerceMessage,
} from "../services/agent.service.js";

import {
  sendWhatsAppText,
} from "../services/whatsapp.service.js";

import {
  processWhatsAppAudio,
} from "../services/whatsapp-media.service.js";

import {
  WHATSAPP_QUEUE_NAME,
} from "../queues/whatsapp.queue.js";


/* =========================================================
   MARK INBOUND WEBHOOK PROCESSED
========================================================= */

async function markWebhookProcessed(eventId) {
  await prisma.webhookEvent.update({
    where: {
      eventId,
    },

    data: {
      processed: true,
    },
  });
}


/* =========================================================
   PROCESS INBOUND
========================================================= */

async function processInbound(job) {
  const {
    eventId,
    businessId,
    messageId,
    conversationId,
    messageType,
    mediaId,
    customer,
  } = job.data;

  const webhookEvent =
    await prisma.webhookEvent.findUnique({
      where: {
        eventId,
      },
    });

  if (!webhookEvent) {
    throw new Error(
      `Webhook event ${eventId} not found`
    );
  }

  /*
    processed=true now means the previous attempt actually
    completed successfully.
  */

  if (webhookEvent.processed) {
    return {
      skipped: true,
      reason: "Webhook already processed",
    };
  }


  let message =
    await prisma.message.findUnique({
      where: {
        id: messageId,
      },
    });

  if (!message) {
    throw new Error(
      `Message ${messageId} not found`
    );
  }


  /* =======================================================
     AUDIO
  ======================================================= */

  if (messageType === "AUDIO") {
    if (!mediaId) {
      throw new Error(
        "Audio message has no media ID"
      );
    }

    const transcription =
      await processWhatsAppAudio({
        mediaId,
        messageId,
      });

    message =
      await prisma.message.findUnique({
        where: {
          id: messageId,
        },
      });

    if (!message) {
      throw new Error(
        `Message ${messageId} disappeared after transcription`
      );
    }

    if (!transcription) {
      throw new Error(
        "Audio transcription failed"
      );
    }
  }


  /* =======================================================
     NON-TEXT / UNSUPPORTED
  ======================================================= */

  if (
    messageType === "IMAGE" ||
    messageType === "DOCUMENT"
  ) {
    await markWebhookProcessed(eventId);

    return {
      skipped: true,
      reason: `${messageType} processing is not implemented yet`,
    };
  }


  const processableText =
    message.transcription ||
    message.content;


  if (!processableText?.trim()) {
    throw new Error(
      "WhatsApp message contains no processable text"
    );
  }


  /* =======================================================
     COMMERCE AGENT
  ======================================================= */

  const result =
    await processCommerceMessage({
      businessId,

      message:
        processableText.trim(),

      customer,

      messageId,

      conversationId,
    });


  /* =======================================================
     ONLY MARK PROCESSED AFTER SUCCESS
  ======================================================= */

  await markWebhookProcessed(eventId);

  return result;
}


/* =========================================================
   PROCESS OUTBOUND
========================================================= */

async function processOutbound(job) {
  const {
    businessId,
    conversationId,
    to,
    message,
    idempotencyKey,
    context,
  } = job.data;

  if (!businessId) {
    throw new Error(
      "Outbound message has no businessId"
    );
  }

  if (!conversationId) {
    throw new Error(
      "Outbound message has no conversationId"
    );
  }

  /*
    We currently use the existing Message model.

    The provider message ID is saved after Meta accepts the
    message. This gives us conversation history even though
    the schema does not yet contain a dedicated outbox table.
  */

  const existing =
    await prisma.message.findFirst({
      where: {
        conversationId,

        direction: "OUTBOUND",

        content: message,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  /*
    This protects against a retry after the outbound message
    was already persisted.

    The queue's deterministic job ID provides the first layer
    of idempotency; this is a second defensive layer.
  */

  if (
    existing?.rawPayload &&
    typeof existing.rawPayload === "object" &&
    existing.rawPayload.idempotencyKey === idempotencyKey
  ) {
    return {
      skipped: true,
      reason: "Outbound message already persisted",
      messageId: existing.id,
    };
  }


  const response =
    await sendWhatsAppText({
      to,
      message,
    });


  const providerMessageId =
    response?.messages?.[0]?.id ||
    null;


  const outboundMessage =
    await prisma.message.create({
      data: {
        conversationId,

        direction: "OUTBOUND",

        type: "TEXT",

        content: message,

        externalId:
          providerMessageId,

        rawPayload: {
          idempotencyKey,

          provider:
            "META_WHATSAPP",

          response,

          context,
        },
      },
    });


  await prisma.conversation.update({
    where: {
      id: conversationId,
    },

    data: {
      updatedAt: new Date(),
    },
  });


  return {
    success: true,

    messageId:
      outboundMessage.id,

    providerMessageId,
  };
}


/* =========================================================
   WORKER
========================================================= */

export const whatsappWorker =
  new Worker(
    WHATSAPP_QUEUE_NAME,

    async (job) => {
      console.log(
        `[WhatsApp Worker] ${job.name} ${job.id}`
      );

      switch (job.name) {
        case "process-inbound":
          return processInbound(job);

        case "send-outbound":
          return processOutbound(job);

        default:
          throw new Error(
            `Unknown WhatsApp job type: ${job.name}`
          );
      }
    },

    {
      connection: redis,

      concurrency: 5,
    }
  );


whatsappWorker.on(
  "completed",
  (job) => {
    console.log(
      `[WhatsApp Worker] completed ${job.name}:${job.id}`
    );
  }
);


whatsappWorker.on(
  "failed",
  (job, error) => {
    console.error(
      `[WhatsApp Worker] failed ${job?.name}:${job?.id}`,
      error
    );
  }
);
