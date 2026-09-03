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
  WHATSAPP_QUEUE_NAME,
} from "../queues/whatsapp.queue.js";

import {
  processCommerceMessage,
} from "../services/agent.service.js";

import {
  processWhatsAppAudio,
} from "../services/whatsapp-media.service.js";


/* =========================================================
   WHATSAPP WORKER
========================================================= */

export const whatsappWorker =
  new Worker(

    WHATSAPP_QUEUE_NAME,

    async (job) => {

      const {

        eventId,

        businessId,

        messageId,

        conversationId,

        messageType,

        mediaId,

        customer,

      } =
        job.data;


      console.log(
        `Processing WhatsApp job ${job.id}`
      );


      /* =====================================
         IDEMPOTENCY CHECK
      ===================================== */

      const webhookEvent =
        await prisma.webhookEvent.findUnique({

          where: {
            eventId,
          },

        });


      if (!webhookEvent) {

        throw new Error(
          `Webhook event not found: ${eventId}`
        );

      }


      if (
        webhookEvent.processed
      ) {

        console.log(
          `Webhook already processed: ${eventId}`
        );

        return {
          skipped:
            true,
        };

      }


      /* =====================================
         RETRIEVE MESSAGE
      ===================================== */

      let message =
        await prisma.message.findUnique({

          where: {
            id:
              messageId,
          },

        });


      if (!message) {

        throw new Error(
          `Message not found: ${messageId}`
        );

      }


      let processableText =
        message.content;


      /* =====================================
         AUDIO PROCESSING
      ===================================== */

      if (
        messageType === "AUDIO"
      ) {

        if (!mediaId) {

          throw new Error(
            "Audio message has no media ID"
          );

        }


        console.log(
          `Processing audio media: ${mediaId}`
        );


        const mediaResult =
          await processWhatsAppAudio({

            messageId,

            mediaId,

          });


        processableText =
          mediaResult.transcription;


        console.log(
          `Audio transcription: ${processableText}`
        );


        /*
         * Refresh message after transcription.
         */

        message =
          await prisma.message.findUnique({

            where: {
              id:
                messageId,
            },

          });

      }


      /* =====================================
         IMAGE PROCESSING

         Media is stored for now.

         Vision extraction will be added later.
      ===================================== */

      if (
        messageType === "IMAGE"
      ) {

        console.log(
          "Image received. Vision processing pending."
        );


        /*
         * Do not fail webhook.
         * Mark event processed.
         */

        await prisma.webhookEvent.update({

          where: {
            eventId,
          },

          data: {
            processed:
              true,
          },

        });


        return {

          success:
            true,

          message:
            "Image stored for future vision processing",

        };

      }


      /* =====================================
         DOCUMENT PROCESSING

         Document extraction will be added later.
      ===================================== */

      if (
        messageType === "DOCUMENT"
      ) {

        console.log(
          "Document received. Document extraction pending."
        );


        await prisma.webhookEvent.update({

          where: {
            eventId,
          },

          data: {
            processed:
              true,
          },

        });


        return {

          success:
            true,

          message:
            "Document stored for future processing",

        };

      }


      /* =====================================
         VALIDATE PROCESSABLE TEXT
      ===================================== */

      if (
        !processableText?.trim()
      ) {

        throw new Error(
          "Message contains no processable text"
        );

      }


      /* =====================================
         AI COMMERCE AGENT
      ===================================== */

      console.log(
        "Sending message to OJAT AI Agent"
      );


      const result =
        await processCommerceMessage({

          businessId,

          message:
            processableText,

          customer,

          messageId,

          conversationId,

        });


      /* =====================================
         MARK WEBHOOK PROCESSED
      ===================================== */

      await prisma.webhookEvent.update({

        where: {
          eventId,
        },

        data: {
          processed:
            true,
        },

      });


      console.log(
        `WhatsApp message processed successfully: ${eventId}`
      );


      return result;

    },

    {

      connection:
        redis,

      concurrency:
        5,

    }

  );


/* =========================================================
   WORKER EVENTS
========================================================= */

whatsappWorker.on(
  "completed",

  (job) => {

    console.log(
      `WhatsApp job completed: ${job.id}`
    );

  }
);


whatsappWorker.on(
  "failed",

  (job, error) => {

    console.error(
      `WhatsApp job failed: ${job?.id}`,
      error.message
    );

  }
);


console.log(
  "OJAT WhatsApp Worker started"
);