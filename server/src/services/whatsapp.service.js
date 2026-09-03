import axios from "axios";
import { env } from "../config/env.js";

const GRAPH_API_VERSION = "v23.0";

export async function sendWhatsAppText({
  to,
  message,
}) {
  if (
    !env.whatsappToken ||
    !env.whatsappPhoneId
  ) {
    throw new Error(
      "WhatsApp integration is not configured"
    );
  }

  const url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/` +
    `${env.whatsappPhoneId}/messages`;

  const response = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: message,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${env.whatsappToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}