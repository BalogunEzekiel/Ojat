import { Router } from "express";
import { z } from "zod";

import {
  authenticate,
} from "../middleware/auth.js";

import {
  extractCommerce,
} from "../services/ai.service.js";

import {
  processCommerceMessage,
} from "../services/agent.service.js";

import {
  prisma,
} from "../lib/prisma.js";

import {
  ok,
} from "../lib/response.js";


const r = Router();


r.use(authenticate);


/* =========================================================
   AI EXTRACTION ONLY
========================================================= */

r.post(
  "/extract",

  async (req, res, next) => {

    try {

      const {
        message,
      } =
        z.object({
          message:
            z.string()
              .min(1),
        })
        .parse(req.body);


      const result =
        await extractCommerce(
          message
        );


      await prisma.aIExtraction.create({
        data: {
          businessId:
            req.user.businessId,

          intent:
            result.intent,

          confidence:
            result.confidence,

          extracted:
            result,

          model:
            process.env.GROQ_MODEL_NAME,
        },
      });


      ok(
        res,
        result
      );

    } catch (error) {

      next(error);

    }

  }
);


/* =========================================================
   PROCESS COMPLETE ORDER
========================================================= */

r.post(
  "/process-order",

  async (req, res, next) => {

    try {

      const bodySchema =
        z.object({

          message:
            z.string()
              .min(1),

          customer:
            z.object({

              name:
                z.string()
                  .optional()
                  .nullable(),

              phone:
                z.string()
                  .min(5),

              email:
                z.string()
                  .email()
                  .optional()
                  .nullable(),

            }),

        });


      const data =
        bodySchema.parse(
          req.body
        );


      const result =
        await processCommerceMessage({
          businessId:
            req.user.businessId,

          message:
            data.message,

          customer:
            data.customer,
        });


      ok(
        res,
        result
      );

    } catch (error) {

      next(error);

    }

  }
);


export default r;