import crypto from "crypto";

import {
  env,
} from "../config/env.js";


/* =========================================================
   SAFE SIGNATURE COMPARISON
========================================================= */

function safeCompare(
  first,
  second
) {

  if (
    typeof first !== "string" ||
    typeof second !== "string"
  ) {
    return false;
  }


  const firstBuffer =
    Buffer.from(
      first,
      "utf8"
    );

  const secondBuffer =
    Buffer.from(
      second,
      "utf8"
    );


  if (
    firstBuffer.length !==
    secondBuffer.length
  ) {
    return false;
  }


  return crypto.timingSafeEqual(
    firstBuffer,
    secondBuffer
  );
}


/* =========================================================
   VERIFY PAYSTACK WEBHOOK
========================================================= */

export function verifyPaystackWebhook(
  req,
  res,
  next
) {

  try {

    const signature =
      req.headers[
        "x-paystack-signature"
      ];


    if (!signature) {

      console.warn(
        "Paystack webhook rejected: missing signature"
      );

      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Missing Paystack webhook signature",
        });
    }


    if (!req.rawBody) {

      console.error(
        "Paystack webhook rejected: raw request body unavailable"
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Webhook raw body is unavailable",
        });
    }


    if (
      !env.paystackWebhookSecret
    ) {

      console.error(
        "PAYSTACK_WEBHOOK_SECRET is not configured"
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Paystack webhook secret is not configured",
        });
    }


    const expectedSignature =
      crypto
        .createHmac(
          "sha512",
          env.paystackWebhookSecret
        )
        .update(
          req.rawBody
        )
        .digest("hex");


    if (
      !safeCompare(
        expectedSignature,
        signature
      )
    ) {

      console.warn(
        "Paystack webhook rejected: invalid signature"
      );

      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Invalid Paystack webhook signature",
        });
    }


    req.paystackSignatureVerified =
      true;


    next();

  } catch (error) {

    console.error(
      "Paystack webhook signature verification error:",
      error
    );

    return res
      .status(500)
      .json({
        success:
          false,

        message:
          "Webhook verification failed",
      });
  }
}


export default verifyPaystackWebhook;