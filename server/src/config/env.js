import "dotenv/config";

const required = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Missing required env: ${key}`);
  }
}

const groqKeys = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
].filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT || 10000),

  databaseUrl: process.env.DATABASE_URL,

  clientUrl:
    process.env.CLIENT_URL ||
    "http://localhost:5173",

  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET,

  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET,

  accessExpires:
    process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",

  refreshExpires:
    process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",

  redisUrl:
    process.env.REDIS_URL ||
    "redis://127.0.0.1:6379",

  whatsappGraphVersion:
    process.env.WHATSAPP_GRAPH_VERSION || "v22.0",

  whatsappMediaDir:
    process.env.WHATSAPP_MEDIA_DIR ||
    "uploads/whatsapp",

  groqTranscriptionModel:
    process.env.GROQ_TRANSCRIPTION_MODEL ||
    "whisper-large-v3",

  // ==========================================
  // GROQ AI
  // ==========================================

  groqKeys,

  groqBaseUrl:
    process.env.GROQ_BASE_URL ||
    "https://api.groq.com/openai/v1",

  groqModel:
    process.env.GROQ_MODEL_NAME ||
    "openai/gpt-oss-120b",

  // ==========================================
  // META WHATSAPP
  // ==========================================

  whatsappVerifyToken:
    process.env.WHATSAPP_VERIFY_TOKEN,

  whatsappToken:
    process.env.WHATSAPP_ACCESS_TOKEN,

  whatsappPhoneId:
    process.env.WHATSAPP_PHONE_NUMBER_ID,

  whatsappAppSecret:
    process.env.WHATSAPP_APP_SECRET,

  // ==========================================
  // PAYSTACK
  // ==========================================

  paystackSecret:
    process.env.PAYSTACK_SECRET_KEY,

  paystackPublic:
    process.env.PAYSTACK_PUBLIC_KEY,

  // ==========================================
  // CLOUDINARY
  // ==========================================

  cloudinaryCloudName:
    process.env.CLOUDINARY_CLOUD_NAME,

  cloudinaryApiKey:
    process.env.CLOUDINARY_API_KEY,

  cloudinaryApiSecret:
    process.env.CLOUDINARY_API_SECRET,

  cloudinaryFolder:
    process.env.CLOUDINARY_FOLDER ||
    (
      process.env.NODE_ENV === "production"
        ? "ojat-prod"
        : "ojat-dev"
    ),
};