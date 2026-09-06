import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  ok,
} from "../lib/response.js";

import {
  authenticate,
} from "../middleware/auth.js";

import {
  createBusiness,
  getBusiness,
  listUserBusinesses,
  updateBusiness,
} from "../services/business.service.js";


const r =
  Router();


/* =========================================================
   VALIDATION
========================================================= */

const createBusinessSchema =
  z.object({

    name:
      z.string()
        .trim()
        .min(2)
        .max(120),

    currency:
      z.string()
        .trim()
        .length(3)
        .optional(),
  });


const updateBusinessSchema =
  z.object({

    name:
      z.string()
        .trim()
        .min(2)
        .max(120)
        .optional(),

    currency:
      z.string()
        .trim()
        .length(3)
        .optional(),

  })
  .refine(
    data =>
      Object.keys(data).length > 0,
    {
      message:
        "At least one field is required",
    }
  );


/* =========================================================
   ALL BUSINESS ROUTES REQUIRE AUTHENTICATION
========================================================= */

r.use(authenticate);

/* =========================================================
   LIST MY BUSINESSES
========================================================= */

r.get(
  "/",

  async (
    req,
    res,
    next
  ) => {

    try {

      const businesses =
        await listUserBusinesses(
          req.user.sub
        );


      return ok(
        res,
        businesses,
        "Businesses retrieved"
      );

    } catch (error) {

      return next(
        error
      );

    }

  }
);


/* =========================================================
   CREATE BUSINESS

   Supports multi-business accounts.
========================================================= */

r.post(
  "/",

  async (
    req,
    res,
    next
  ) => {

    try {

      const input =
        createBusinessSchema.parse(
          req.body
        );


      const business =
        await createBusiness(
          req.user.sub,
          input
        );


      return ok(
        res,
        business,
        "Business created",
        201
      );

    } catch (error) {

      return next(
        error
      );

    }

  }
);


/* =========================================================
   GET CURRENT BUSINESS
========================================================= */

r.get(
  "/current",

  async (
    req,
    res,
    next
  ) => {

    try {

      if (
        !req.user.businessId
      ) {
        throw Object.assign(
          new Error(
            "No active business selected"
          ),
          {
            status: 400,
          }
        );
      }


      const business =
        await getBusiness(
          req.user.businessId,
          req.user.sub
        );


      return ok(
        res,
        business,
        "Business retrieved"
      );

    } catch (error) {

      return next(
        error
      );

    }

  }
);


/* =========================================================
   UPDATE CURRENT BUSINESS
========================================================= */

r.patch(
  "/current",

  async (
    req,
    res,
    next
  ) => {

    try {

      if (
        !req.user.businessId
      ) {
        throw Object.assign(
          new Error(
            "No active business selected"
          ),
          {
            status: 400,
          }
        );
      }


      const input =
        updateBusinessSchema.parse(
          req.body
        );


      const business =
        await updateBusiness(
          req.user.businessId,
          req.user.sub,
          input
        );


      return ok(
        res,
        business,
        "Business updated"
      );

    } catch (error) {

      return next(
        error
      );

    }

  }
);


export default r;
