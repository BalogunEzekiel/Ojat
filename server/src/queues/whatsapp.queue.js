import {
  Queue,
} from "bullmq";

import {
  redis,
} from "../lib/redis.js";


export const WHATSAPP_QUEUE_NAME =
  "whatsapp-processing";


export const whatsappQueue =
  new Queue(
    WHATSAPP_QUEUE_NAME,
    {
      connection:
        redis,

      defaultJobOptions: {

        attempts:
          3,

        backoff: {
          type:
            "exponential",

          delay:
            2000,
        },

        removeOnComplete: {
          age:
            24 * 60 * 60,

          count:
            1000,
        },

        removeOnFail: {
          age:
            7 * 24 * 60 * 60,

          count:
            5000,
        },

      },
    }
  );


export async function queueWhatsAppMessage(
  data
) {

  return whatsappQueue.add(
    "process-message",
    data,
    {
      jobId:
        `whatsapp-${data.eventId}`,
    }
  );
}