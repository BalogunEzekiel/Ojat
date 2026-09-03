import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  authenticate,
} from "../middleware/auth.js";

import {
  initializeOrderPayment,
} from "../services/paystack.service.js";

import {
  ok,
} from "../lib/response.js";


const r =
  Router();


/* =========================================================
   ALL PAYMENT ROUTES REQUIRE AUTHENTICATION
========================================================= */

r.use(
  authenticate
);


/* =========================================================
   INITIALIZE ORDER PAYMENT
========================================================= */

r.post(
  "/orders/:orderId/pay",
  async (
    req,
    res,
    next
  ) => {

    try {

      const {
        orderId,
      } =
        z.object({
          orderId:
            z.string()
              .min(1),
        })
        .parse(
          req.params
        );


      const result =
        await initializeOrderPayment({
          businessId:
            req.user.businessId,

          orderId,
        });


      ok(
        res,

        result,

        "Payment initialized"
      );

    } catch (
      error
    ) {

      next(error);
    }
  }
);


export default r;