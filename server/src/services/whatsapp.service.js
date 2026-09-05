import axios from "axios";
import { env } from "../config/env.js";


/* =========================================================
   META WHATSAPP API
========================================================= */

function getWhatsAppConfig() {
  if (!env.whatsappToken) {
    throw Object.assign(
      new Error("WhatsApp access token is not configured"),
      { status: 503 }
    );
  }

  if (!env.whatsappPhoneId) {
    throw Object.assign(
      new Error("WhatsApp phone number ID is not configured"),
      { status: 503 }
    );
  }

  return {
    token: env.whatsappToken,
    phoneNumberId: env.whatsappPhoneId,
    graphVersion: env.whatsappGraphVersion,
  };
}


/* =========================================================
   SEND TEXT MESSAGE
========================================================= */

export async function sendWhatsAppText({
  to,
  message,
}) {
  if (!to) {
    throw new Error("WhatsApp recipient is required");
  }

  if (!message) {
    throw new Error("WhatsApp message cannot be empty");
  }

  const {
    token,
    phoneNumberId,
    graphVersion,
  } = getWhatsAppConfig();

  const url =
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  const response =
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",

        recipient_type: "individual",

        to,

        type: "text",

        text: {
          preview_url: true,
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },

        timeout: 15000,
      }
    );

  return response.data;
}
