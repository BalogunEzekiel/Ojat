import crypto from "crypto";

import { env } from "../config/env.js";


function safeCompare(first, second) {
  if (
    typeof first !== "string" ||
    typeof second !== "string"
  ) {
    return false;
  }

  const firstBuffer =
    Buffer.from(first, "utf8");

  const secondBuffer =
    Buffer.from(second, "utf8");

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


export function verifyMetaSignature(
  req,
  res,
  next
) {
  try {
    const signature =
      req.get("X-Hub-Signature-256");

    if (!signature) {
      return res.status(401).json({
        success: false,
        message:
          "Missing webhook signature",
      });
    }


    if (!env.whatsappAppSecret) {
      console.error(
        "WhatsApp app secret is not configured"
      );

      return res.status(500).json({
        success: false,
        message:
          "WhatsApp app secret is not configured",
      });
    }


    if (!Buffer.isBuffer(req.rawBody)) {
      console.error(
        "Webhook raw body is unavailable"
      );

      return res.status(500).json({
        success: false,
        message:
          "Webhook raw body is unavailable",
      });
    }


    const expected =
      "sha256=" +
      crypto
        .createHmac(
          "sha256",
          env.whatsappAppSecret
        )
        .update(req.rawBody)
        .digest("hex");


    if (
      !safeCompare(
        signature,
        expected
      )
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid webhook signature",
      });
    }


    req.metaSignatureVerified = true;

    next();

  } catch (error) {
    console.error(
      "Meta webhook signature verification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Webhook verification failed",
    });
  }
}


export default verifyMetaSignature;
