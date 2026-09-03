import {
  Router,
} from "express";

import {
  env,
} from "../config/env.js";

import {
  prisma,
} from "../lib/prisma.js";

import {
  verifyPaystackWebhook,
} from "../middleware/paystackWebhook.js";

import {
  queueWhatsAppMessage,
} from "../queues/whatsapp.queue.js";


const r =
  Router();


/* =========================================================
   WHATSAPP WEBHOOK VERIFICATION
========================================================= */

r.get(
  "/whatsapp",

  (req, res) => {

    const mode =
      req.query["hub.mode"];

    const verifyToken =
      req.query["hub.verify_token"];

    const challenge =
      req.query["hub.challenge"];


    if (
      mode === "subscribe" &&
      verifyToken === env.whatsappVerifyToken
    ) {

      console.log(
        "WhatsApp webhook verified successfully"
      );

      return res
        .status(200)
        .send(challenge);

    }


    console.warn(
      "WhatsApp webhook verification failed"
    );

    return res.sendStatus(403);

  }
);


/* =========================================================
   WHATSAPP WEBHOOK EVENTS
========================================================= */

r.post(
  "/whatsapp",

  async (
    req,
    res,
    next
  ) => {

    try {

      const payload =
        req.body;


      /* =====================================
         PROCESS EACH WEBHOOK ENTRY
      ===================================== */

      for (
        const entry of payload.entry || []
      ) {

        for (
          const change of entry.changes || []
        ) {

          const value =
            change.value;


          if (!value) {
            continue;
          }


          /* =====================================
             RESOLVE WHATSAPP ACCOUNT
          ===================================== */

          const phoneNumberId =
            value.metadata?.phone_number_id;


          if (!phoneNumberId) {
            continue;
          }


          const account =
            await prisma.whatsAppAccount.findUnique({

              where: {
                phoneNumberId,
              },

            });


          if (!account) {

            console.warn(
              "WhatsApp account not found:",
              phoneNumberId
            );

            continue;

          }


          /* =====================================
             PROCESS INCOMING MESSAGES
          ===================================== */

          for (
            const incomingMessage of
              value.messages || []
          ) {

            const eventId =
              incomingMessage.id;


            if (!eventId) {
              continue;
            }


            /* =====================================
               IDEMPOTENCY CHECK
            ===================================== */

            const existingEvent =
              await prisma.webhookEvent.findUnique({

                where: {
                  eventId,
                },

              });


            if (existingEvent) {

              console.log(
                `Duplicate webhook ignored: ${eventId}`
              );

              continue;

            }


            /* =====================================
               STORE WEBHOOK EVENT
            ===================================== */

            try {

              await prisma.webhookEvent.create({

                data: {

                  provider:
                    "WHATSAPP",

                  eventId,

                  payload,

                  processed:
                    false,

                },

              });

            } catch (error) {

              /*
               * Unique constraint race condition.
               * Another request may have already
               * inserted this event.
               */

              if (
                error.code === "P2002"
              ) {
                continue;
              }

              throw error;

            }


            /* =====================================
               CUSTOMER IDENTITY
            ===================================== */

            const phone =
              incomingMessage.from;


            if (!phone) {

              console.warn(
                "Incoming message has no sender"
              );

              continue;

            }


            const contact =
              value.contacts?.find(
                item =>
                  item.wa_id === phone
              );


            const customerName =
              contact?.profile?.name ||
              null;


            /* =====================================
               FIND OR CREATE CUSTOMER
            ===================================== */

            const customer =
              await prisma.customer.upsert({

                where: {

                  businessId_phone: {

                    businessId:
                      account.businessId,

                    phone,

                  },

                },

                update: {

                  ...(customerName
                    ? {
                        name:
                          customerName,
                      }
                    : {}),

                },

                create: {

                  businessId:
                    account.businessId,

                  phone,

                  name:
                    customerName,

                },

              });


            /* =====================================
               FIND OR CREATE CONVERSATION
            ===================================== */

            let conversation =
              await prisma.conversation.findFirst({

                where: {

                  businessId:
                    account.businessId,

                  customerId:
                    customer.id,

                  externalId:
                    phone,

                },

                orderBy: {

                  updatedAt:
                    "desc",

                },

              });


            if (!conversation) {

              conversation =
                await prisma.conversation.create({

                  data: {

                    businessId:
                      account.businessId,

                    customerId:
                      customer.id,

                    externalId:
                      phone,

                  },

                });

            }


            /* =====================================
               DETERMINE MESSAGE TYPE
            ===================================== */

            let messageType =
              "SYSTEM";


            switch (
              incomingMessage.type
            ) {

              case "text":
                messageType =
                  "TEXT";
                break;

              case "audio":
                messageType =
                  "AUDIO";
                break;

              case "image":
                messageType =
                  "IMAGE";
                break;

              case "document":
                messageType =
                  "DOCUMENT";
                break;

              case "interactive":
                messageType =
                  "INTERACTIVE";
                break;

            }


            /* =====================================
               STORE MESSAGE
            ===================================== */

            const message =
              await prisma.message.create({

                data: {

                  conversationId:
                    conversation.id,

                  externalId:
                    eventId,

                  direction:
                    "INBOUND",

                  type:
                    messageType,

                  content:
                    incomingMessage.text?.body ||
                    null,

                  rawPayload:
                    incomingMessage,

                },

              });


            /* =====================================
               QUEUE MESSAGE

               DO NOT PROCESS AI HERE.

               Meta needs a fast HTTP response.
            ===================================== */

            await queueWhatsAppMessage({

              eventId,

              businessId:
                account.businessId,

              messageId:
                message.id,

              conversationId:
                conversation.id,

              messageType,

              mediaId:

                incomingMessage.audio?.id ||

                incomingMessage.image?.id ||

                incomingMessage.document?.id ||

                null,

              customer: {

                id:
                  customer.id,

                name:
                  customer.name,

                phone:
                  customer.phone,

                email:
                  customer.email,

              },

            });


            console.log(
              `WhatsApp message queued: ${eventId}`
            );

          }

        }

      }


      /*
       * Respond immediately to Meta.
       */

      return res.sendStatus(200);

    } catch (error) {

      console.error(
        "WhatsApp webhook error:",
        error
      );

      return next(error);

    }

  }
);


/* =========================================================
   PAYSTACK WEBHOOK
========================================================= */

r.post(
  "/paystack",

  verifyPaystackWebhook,

  async (
    req,
    res,
    next
  ) => {

    try {

      const event =
        req.body;


      const eventId =
        event.data?.reference ||
        `paystack-${Date.now()}`;


      /* =====================================
         IDEMPOTENCY CHECK
      ===================================== */

      const exists =
        await prisma.webhookEvent.findUnique({

          where: {
            eventId,
          },

        });


      if (exists) {

        return res.sendStatus(200);

      }


      /* =====================================
         STORE EVENT
      ===================================== */

      await prisma.webhookEvent.create({

        data: {

          provider:
            "PAYSTACK",

          eventId,

          payload:
            event,

          processed:
            false,

        },

      });


      /* =====================================
         PROCESS SUCCESSFUL PAYMENT
      ===================================== */

      if (
        event.event === "charge.success"
      ) {

        await prisma.payment.updateMany({

          where: {

            reference:
              event.data?.reference,

          },

          data: {

            status:
              "SUCCESS",

          },

        });

      }


      /* =====================================
         MARK AS PROCESSED
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


      return res.sendStatus(200);

    } catch (error) {

      return next(error);

    }

  }
);


export default r;