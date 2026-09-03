import crypto from "crypto";
import { env } from "../config/env.js";

export function verifyMetaSignature(
  req,
  res,
  next
) {
  const signature =
    req.get("X-Hub-Signature-256");

  if (!signature) {
    return res.status(401).json({
      success: false,
      message: "Missing webhook signature",
    });
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac(
        "sha256",
        env.whatsappAppSecret
      )
      .update(
        JSON.stringify(req.body)
      )
      .digest("hex");

  const signatureBuffer =
    Buffer.from(signature);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    signatureBuffer.length !==
      expectedBuffer.length ||
    !crypto.timingSafeEqual(
      signatureBuffer,
      expectedBuffer
    )
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid webhook signature",
    });
  }

  next();
}