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

import {
  handlePaystackSuccess,
} from "../services/payment.service.js";

import {
  normalizePhone,
} from "../services/phone.service.js";

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

            const rawPhone =
              incomingMessage.from;

            const phone =
              normalizePhone(rawPhone);


            if (!phone) {

              console.warn(
                "Incoming WhatsApp message has invalid sender phone:",
                rawPhone
              );

              continue;

            }


            const contact =
              value.contacts?.find(
                item =>
                  normalizePhone(item.wa_id) === phone
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


      const reference =
        event.data?.reference;


      /* =====================================
         BASIC VALIDATION
      ===================================== */

      if (
        !reference
      ) {

        console.warn(
          "Paystack webhook received without transaction reference"
        );

        /*
         * The webhook signature has already been
         * verified by verifyPaystackWebhook.
         *
         * There is nothing safe to process without
         * a transaction reference.
         */

        return res.sendStatus(200);

      }


      /*
       * Paystack can send multiple event types for
       * the same transaction.
       *
       * Therefore, reference alone should not be
       * treated as the universal webhook event ID.
       */

      const eventId =
        event.id
          ? String(event.id)
          : `${event.event}:${reference}`;


      /* =====================================
         FIND EXISTING WEBHOOK EVENT
      ===================================== */

      const existingEvent =
        await prisma.webhookEvent.findUnique({

          where: {
            eventId,
          },

        });


      if (
        existingEvent?.processed
      ) {

        console.log(
          `Duplicate processed Paystack webhook ignored: ${eventId}`
        );

        return res.sendStatus(200);

      }


      /* =====================================
         STORE WEBHOOK EVENT
      ===================================== */

      if (
        !existingEvent
      ) {

        try {

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

        } catch (error) {

          /*
           * Another webhook request may have inserted
           * the same event concurrently.
           */

          if (
            error?.code === "P2002"
          ) {

            console.log(
              `Paystack webhook race detected: ${eventId}`
            );

          } else {

            throw error;

          }

        }

      }


      /* =====================================
         PROCESS SUCCESSFUL PAYMENT
      ===================================== */

      if (
        event.event === "charge.success"
      ) {

        /*
         * IMPORTANT:
         *
         * Do NOT update payment.status directly.
         *
         * handlePaystackSuccess() performs:
         *
         * 1. Paystack verification
         * 2. Reference validation
         * 3. Amount validation
         * 4. Currency validation
         * 5. Order validation
         * 6. Inventory deduction
         * 7. Reservation release
         * 8. Inventory transaction creation
         * 9. Payment SUCCESS
         * 10. Invoice PAID
         * 11. Order PROCESSING
         *
         * It is also idempotent.
         */

        const result =
          await handlePaystackSuccess(
            reference
          );


        console.log(
          "Paystack payment finalized:",
          {
            reference,
            alreadyProcessed:
              result?.alreadyProcessed,
            paymentId:
              result?.payment?.id,
            orderId:
              result?.order?.id,
          }
        );

      }


      /* =====================================
         MARK WEBHOOK AS PROCESSED
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

      console.error(
        "Paystack webhook processing error:",
        error
      );


      /*
       * VERY IMPORTANT:
       *
       * Do not mark the webhook as processed here.
       *
       * processed remains false, allowing Paystack
       * to retry the webhook.
       *
       * The payment finalization transaction is also
       * atomic, so a failed finalization will roll back
       * its database changes.
       */

      return next(error);

    }

  }
);


export default r;
