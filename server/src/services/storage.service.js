import { cloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";


/* =========================================================
   OJAT CLOUDINARY FOLDER STRUCTURE
========================================================= */

export const StorageFolders = {
  PRODUCTS: "products",

  BUSINESSES: "businesses",

  USERS: "users",

  WHATSAPP: "whatsapp",

  WHATSAPP_IMAGES: "whatsapp/images",

  WHATSAPP_AUDIO: "whatsapp/audio",

  WHATSAPP_DOCUMENTS: "whatsapp/documents",

  INVOICES: "invoices",
};


/* =========================================================
   BUILD SAFE OJAT FOLDER PATH
========================================================= */

function buildFolder(subFolder = "") {
  const baseFolder = env.cloudinaryFolder;

  return subFolder
    ? `${baseFolder}/${subFolder}`
    : baseFolder;
}


/* =========================================================
   BUILD BUSINESS-SPECIFIC FOLDER PATH
========================================================= */

function buildBusinessFolder(
  businessId,
  subFolder = ""
) {
  if (!businessId) {
    throw new Error("Business ID is required");
  }

  const base =
    `${env.cloudinaryFolder}/businesses/${businessId}`;

  return subFolder
    ? `${base}/${subFolder}`
    : base;
}


/* =========================================================
   UPLOAD PLATFORM FILE
========================================================= */

export async function uploadFile(
  file,
  {
    folder = "",
    resourceType = "auto",
    publicId,
    tags = [],
  } = {}
) {
  if (!file) {
    throw new Error("File is required for upload");
  }

  const uploadOptions = {
    folder: buildFolder(folder),

    resource_type: resourceType,

    tags: [
      "ojat",
      env.nodeEnv,
      ...tags,
    ],

    use_filename: true,

    unique_filename: true,

    overwrite: false,
  };

  if (publicId) {
    uploadOptions.public_id = publicId;
  }

  const result =
    await cloudinary.uploader.upload(
      file,
      uploadOptions
    );

  return {
    publicId: result.public_id,

    url: result.secure_url,

    resourceType: result.resource_type,

    format: result.format,

    bytes: result.bytes,

    folder: result.folder,
  };
}


/* =========================================================
   UPLOAD BUSINESS / TENANT FILE
========================================================= */

export async function uploadBusinessFile(
  file,
  businessId,
  {
    folder = "",
    resourceType = "auto",
    publicId,
    tags = [],
  } = {}
) {
  if (!file) {
    throw new Error("File is required");
  }

  if (!businessId) {
    throw new Error("Business ID is required");
  }

  const uploadOptions = {
    folder: buildBusinessFolder(
      businessId,
      folder
    ),

    resource_type: resourceType,

    tags: [
      "ojat",
      env.nodeEnv,
      `business:${businessId}`,
      ...tags,
    ],

    use_filename: true,

    unique_filename: true,

    overwrite: false,
  };

  if (publicId) {
    uploadOptions.public_id = publicId;
  }

  const result =
    await cloudinary.uploader.upload(
      file,
      uploadOptions
    );

  return {
    publicId: result.public_id,

    url: result.secure_url,

    resourceType: result.resource_type,

    format: result.format,

    bytes: result.bytes,

    folder: result.folder,
  };
}


/* =========================================================
   DELETE FILE
========================================================= */

export async function deleteFile(
  publicId,
  resourceType = "image"
) {
  if (!publicId) {
    return null;
  }

  return cloudinary.uploader.destroy(
    publicId,
    {
      resource_type: resourceType,
    }
  );
}


/* =========================================================
   GET OJAT BASE FOLDER
========================================================= */

export function getStorageBaseFolder() {
  return env.cloudinaryFolder;
}


/* =========================================================
   GET BUSINESS BASE FOLDER
========================================================= */

export function getBusinessStorageFolder(
  businessId
) {
  return buildBusinessFolder(
    businessId
  );
}
