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


      /*
       * PLATFORM ADMIN SANDBOX
       *
       * Platform admins do not have a businessId.
       * The AI Extractor can still be used as a
       * testing/playground tool, but there is no
       * tenant-owned AIExtraction record to persist.
       */
      if (
        req.user.role ===
        "PLATFORM_ADMIN"
      ) {

        return ok(
          res,
          {
            ...result,

            meta: {
              persisted: false,
              mode:
                "PLATFORM_SANDBOX",
            },
          }
        );

      }


      /*
       * BUSINESS USER
       *
       * A business context is mandatory when
       * persisting an AI extraction.
       */
      if (
        !req.user.businessId
      ) {

        return res.status(403).json({
          success: false,
          message:
            "Business context is required for AI extraction",
        });

      }


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


      return ok(
        res,
        {
          ...result,

          meta: {
            persisted: true,
            mode:
              "BUSINESS",
          },
        }
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

      /*
       * Platform admins cannot process an order
       * without a business context.
       *
       * This endpoint creates tenant-owned commerce
       * records and therefore must never operate with
       * businessId = null.
       */
      if (
        req.user.role ===
        "PLATFORM_ADMIN"
      ) {

        return res.status(403).json({
          success: false,
          message:
            "A business account is required to process an order",
        });

      }


      if (!req.user.businessId) {

        return res.status(403).json({
          success: false,
          message:
            "Business context is required to process an order",
        });

      }


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


      return ok(
        res,
        result
      );

    } catch (error) {

      next(error);

    }

  }
);


export default r;
