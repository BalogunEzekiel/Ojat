import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { extractCommerce } from "./ai.service.js";


/* =========================================================
   CONFIGURATION
========================================================= */

const META_GRAPH_VERSION =
  process.env.META_GRAPH_VERSION || "v26.0";

const META_GRAPH_URL =
  `https://graph.facebook.com/${META_GRAPH_VERSION}`;

const GROQ_TRANSCRIPTION_URL =
  `${env.groqBaseUrl}/audio/transcriptions`;

const TRANSCRIPTION_MODEL =
  process.env.GROQ_TRANSCRIPTION_MODEL ||
  "whisper-large-v3-turbo";

/* =========================================================
   GROQ API KEY ROTATION
========================================================= */

let transcriptionKeyIndex = 0;


function getGroqTranscriptionKey() {

  if (
    !env.groqKeys ||
    !env.groqKeys.length
  ) {

    throw new Error(
      "No Groq API keys configured for transcription"
    );

  }


  const apiKey =
    env.groqKeys[
      transcriptionKeyIndex %
      env.groqKeys.length
    ];


  transcriptionKeyIndex++;


  return apiKey;

}

/* =========================================================
   INTERNAL HELPERS
========================================================= */

/**
 * Get the WhatsApp access token.
 *
 * The account-specific token can be supplied when the service
 * is called. Otherwise the global environment token is used.
 */
function getAccessToken(account = null) {

  return (
    account?.accessToken ||
    env.whatsappToken
  );

}


/**
 * Generate a temporary filename.
 */
function createTempFile(extension = ".bin") {

  const id =
    crypto.randomBytes(16).toString("hex");

  return path.join(
    os.tmpdir(),
    `ojat-whatsapp-${id}${extension}`
  );

}


/**
 * Convert a MIME type into a safe file extension.
 */
function extensionFromMimeType(mimeType = "") {

  const mime =
    mimeType.toLowerCase().split(";")[0].trim();

  const extensions = {

    "audio/ogg": ".ogg",

    "audio/opus": ".opus",

    "audio/mpeg": ".mp3",

    "audio/mp3": ".mp3",

    "audio/wav": ".wav",

    "audio/x-wav": ".wav",

    "audio/mp4": ".m4a",

    "audio/x-m4a": ".m4a",

    "audio/aac": ".aac",

    "audio/webm": ".webm",

    "video/mp4": ".mp4",

    "image/jpeg": ".jpg",

    "image/png": ".png",

    "image/webp": ".webp",

    "application/pdf": ".pdf",

  };

  return extensions[mime] || ".bin";

}


/**
 * Safely delete a temporary file.
 */
async function removeFile(filePath) {

  if (!filePath) {
    return;
  }

  try {

    await fs.unlink(filePath);

  } catch {
    // Ignore cleanup errors.
  }

}


/* =========================================================
   1. GET MEDIA METADATA FROM META
========================================================= */

/**
 * Retrieve metadata for a WhatsApp media object.
 *
 * Meta returns information such as:
 *
 * {
 *   id,
 *   mime_type,
 *   sha256,
 *   file_size
 * }
 */
export async function getWhatsAppMediaMetadata(
  mediaId,
  accessToken = env.whatsappToken
) {

  if (!mediaId) {
    throw new Error(
      "WhatsApp media ID is required"
    );
  }

  if (!accessToken) {
    throw new Error(
      "WhatsApp access token is not configured"
    );
  }

  const response =
    await fetch(
      `${META_GRAPH_URL}/${encodeURIComponent(mediaId)}`,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(
      `Meta media metadata request failed: ${
        data?.error?.message ||
        response.statusText
      }`
    );

  }

  return data;

}


/* =========================================================
   2. RETRIEVE TEMPORARY DOWNLOAD URL
========================================================= */

/**
 * Meta's media metadata response contains a temporary
 * download URL.
 *
 * This function obtains that URL.
 */
export async function getWhatsAppMediaUrl(
  mediaId,
  accessToken = env.whatsappToken
) {

  const metadata =
    await getWhatsAppMediaMetadata(
      mediaId,
      accessToken
    );

  if (!metadata.url) {

    throw new Error(
      "Meta did not return a media download URL"
    );

  }

  return {
    ...metadata,
    downloadUrl: metadata.url,
  };

}


/* =========================================================
   3. DOWNLOAD MEDIA SECURELY
========================================================= */

/**
 * Download media from Meta into a temporary local file.
 *
 * IMPORTANT:
 * The URL returned by Meta is temporary and should not be
 * stored as the permanent media URL.
 */
export async function downloadWhatsAppMedia(
  mediaId,
  accessToken = env.whatsappToken
) {

  const media =
    await getWhatsAppMediaUrl(
      mediaId,
      accessToken
    );

  const extension =
    extensionFromMimeType(
      media.mime_type
    );

  const tempFile =
    createTempFile(extension);

  const response =
    await fetch(
      media.downloadUrl,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

      }
    );

  if (!response.ok) {

    await removeFile(tempFile);

    throw new Error(
      `WhatsApp media download failed: ${
        response.status
      }`
    );

  }

  const arrayBuffer =
    await response.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  /*
   * Basic safety limit.
   *
   * Do not allow unexpectedly large files to consume
   * server memory.
   */
  const maxBytes =
    Number(
      process.env.WHATSAPP_MEDIA_MAX_BYTES ||
      25 * 1024 * 1024
    );

  if (buffer.length > maxBytes) {

    throw new Error(
      `WhatsApp media exceeds maximum allowed size of ${maxBytes} bytes`
    );

  }

  await fs.writeFile(
    tempFile,
    buffer
  );

  return {

    filePath:
      tempFile,

    mimeType:
      media.mime_type,

    fileSize:
      buffer.length,

    sha256:
      media.sha256,

    mediaId,

  };

}


/* =========================================================
   4. UPLOAD / STORE MEDIA
========================================================= */

/**
 * Upload media to Cloudinary when Cloudinary credentials
 * are configured.
 *
 * If Cloudinary is not configured, the temporary file is
 * retained only for the duration of processing.
 */
export async function uploadWhatsAppMedia(
  filePath,
  {
    folder = env.cloudinaryFolder ||
      "ojat-whatsapp",
    resourceType = "auto",
  } = {}
) {

  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret
  ) {

    console.warn(
      "Cloudinary is not configured. Media will remain temporary."
    );

    return {
      stored: false,
      url: null,
      publicId: null,
    };

  }


  /*
   * Cloudinary upload API uses multipart/form-data.
   */
  const timestamp =
    Math.floor(
      Date.now() / 1000
    );

  const publicId =
    `whatsapp-${crypto
      .randomBytes(12)
      .toString("hex")}`;

  /*
   * Cloudinary signature:
   *
   * folder=...
   * public_id=...
   * timestamp=...
   */
  const paramsToSign =
    `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;

  const signature =
    crypto
      .createHash("sha1")
      .update(
        paramsToSign +
        env.cloudinaryApiSecret
      )
      .digest("hex");


  const fileBuffer =
    await fs.readFile(filePath);

  const blob =
    new Blob([
      fileBuffer,
    ]);


  const form =
    new FormData();

  form.append(
    "file",
    blob,
    path.basename(filePath)
  );

  form.append(
    "api_key",
    env.cloudinaryApiKey
  );

  form.append(
    "timestamp",
    String(timestamp)
  );

  form.append(
    "signature",
    signature
  );

  form.append(
    "folder",
    folder
  );

  form.append(
    "public_id",
    publicId
  );


  const uploadUrl =
    `https://api.cloudinary.com/v1_1/${
      env.cloudinaryCloudName
    }/${resourceType}/upload`;


  const response =
    await fetch(
      uploadUrl,
      {
        method: "POST",
        body: form,
      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      `Cloudinary upload failed: ${
        data?.error?.message ||
        response.statusText
      }`
    );

  }


  return {

    stored: true,

    url:
      data.secure_url,

    publicId:
      data.public_id,

    resourceType:
      data.resource_type,

    format:
      data.format,

    bytes:
      data.bytes,

  };

}


/* =========================================================
   5. TRANSCRIBE AUDIO
========================================================= */

/**
 * Send audio to Groq Whisper for transcription.
 *
 * Requires:
 *
 * GROQ_API_KEY_1
 * or
 * GROQ_API_KEY_2
 */
export async function transcribeWhatsAppAudio(
  filePath,
  {
    language = null,
    prompt = null,
  } = {}
) {

  const apiKey =
    getGroqTranscriptionKey();

  const audioBuffer =
    await fs.readFile(filePath);

  const blob =
    new Blob([
      audioBuffer,
    ]);

  const form =
    new FormData();

  form.append(
    "file",
    blob,
    path.basename(filePath)
  );

  form.append(
    "model",
    TRANSCRIPTION_MODEL
  );

  form.append(
    "response_format",
    "json"
  );


  if (language) {

    form.append(
      "language",
      language
    );

  }


  if (prompt) {

    form.append(
      "prompt",
      prompt
    );

  }


  const response =
    await fetch(
      GROQ_TRANSCRIPTION_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,
        },

        body: form,
      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      `Groq transcription failed: ${
        data?.error?.message ||
        response.statusText
      }`
    );

  }


  return {

    text:
      data.text?.trim() || "",

    raw:
      data,

  };

}


/* =========================================================
   6. SAVE TRANSCRIPTION
========================================================= */

export async function saveWhatsAppTranscription(
  messageId,
  transcription
) {

  if (!messageId) {

    throw new Error(
      "Message ID is required to save transcription"
    );

  }

  if (!transcription?.text?.trim()) {

    throw new Error(
      "Transcription text is empty"
    );

  }


  const text =
    transcription.text.trim();


  const updatedMessage =
    await prisma.message.update({

      where: {
        id: messageId,
      },

      data: {

        /*
         * transcription keeps the original
         * speech-to-text output.
         */
        transcription:
          text,


        /*
         * content becomes the normalized
         * conversational message used by
         * downstream AI processing.
         */
        content:
          text,

      },

    });


  return updatedMessage;

}


/* =========================================================
  7. OPTIONAL AI COMMERCE EXTRACTION
========================================================= */

export async function extractWhatsAppCommerce(
  {
    businessId,
    messageId,
    text,
  }
) {

  if (!businessId) {

    throw new Error(
      "businessId is required for AI extraction"
    );

  }

  if (!messageId) {

    throw new Error(
      "messageId is required for AI extraction"
    );

  }

  if (!text?.trim()) {

    throw new Error(
      "Text is required for AI extraction"
    );

  }


  const extraction =
    await extractCommerce(
      text
    );


  const aiExtraction =
    await prisma.aIExtraction.create({

      data: {

        businessId,

        messageId,

        intent:
          extraction.intent,

        confidence:
          extraction.confidence,

        extracted:
          extraction,

      },

    });


  return {

    extraction,

    record:
      aiExtraction,

  };

}


/* =========================================================
   COMPLETE AUDIO PROCESSING PIPELINE
========================================================= */

/**
 * Main production service.
 *
 * Flow:
 *
 * WhatsApp media ID
 *       ↓
 * Meta metadata
 *       ↓
 * temporary download URL
 *       ↓
 * secure download
 *       ↓
 * Cloudinary storage
 *       ↓
 * Groq Whisper
 *       ↓
 * save transcription
 *
 * Commerce extraction is performed by the shared WhatsApp
 * worker path after this function returns.
 */
export async function processWhatsAppAudio(
  {
    mediaId,
    messageId,
    businessId,
    accessToken = env.whatsappToken,

    language = null,

    transcriptionPrompt =
      "This is a WhatsApp customer message for a commerce assistant. "
      + "Transcribe accurately, preserving product names, quantities, "
      + "prices, currencies, phone numbers, dates and order details.",

  }
) {

  if (!mediaId) {

    throw new Error(
      "mediaId is required"
    );

  }

  if (!messageId) {

    throw new Error(
      "messageId is required"
    );

  }

  let downloaded = null;


  try {

    /* =====================================================
       DOWNLOAD FROM META
    ===================================================== */

    downloaded =
      await downloadWhatsAppMedia(
        mediaId,
        accessToken
      );


    /* =====================================================
       STORE MEDIA
    ===================================================== */

    const stored =
      await uploadWhatsAppMedia(
        downloaded.filePath,
        {
          folder:
            env.cloudinaryFolder
              ? `${env.cloudinaryFolder}/whatsapp`
              : "ojat-whatsapp",
        }
      );


    /* =====================================================
       TRANSCRIBE
    ===================================================== */

    const transcription =
      await transcribeWhatsAppAudio(
        downloaded.filePath,
        {
          language,
          prompt:
            transcriptionPrompt,
        }
      );


    if (!transcription.text) {

      throw new Error(
        "Audio transcription returned empty text"
      );

    }


    /* =====================================================
       SAVE TRANSCRIPTION
    ===================================================== */

    const message =
      await saveWhatsAppTranscription(
        messageId,
        transcription
      );


    return {

      success: true,

      media: {

        mediaId,

        mimeType:
          downloaded.mimeType,

        fileSize:
          downloaded.fileSize,

        sha256:
          downloaded.sha256,

        storedUrl:
          stored.url,

        publicId:
          stored.publicId,

      },

      transcription: {

        text:
          transcription.text,

        raw:
          transcription.raw,

      },

      message,

    };

  } finally {

    /*
     * Never leave WhatsApp media sitting in /tmp.
     */
    if (downloaded?.filePath) {

      await removeFile(
        downloaded.filePath
      );

    }

  }

}


/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {

  getWhatsAppMediaMetadata,

  getWhatsAppMediaUrl,

  downloadWhatsAppMedia,

  uploadWhatsAppMedia,

  transcribeWhatsAppAudio,

  saveWhatsAppTranscription,

  extractWhatsAppCommerce,

  processWhatsAppAudio,

};
