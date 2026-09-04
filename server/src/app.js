import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

import routes from "./routes/index.js";

import { env } from "./config/env.js";

import {
  notFound,
  errorHandler,
} from "./middleware/error.js";


const app =
  express();


/* =========================================================
   SECURITY
========================================================= */

app.use(
  helmet()
);


app.use(
  cors({
    origin:
      env.clientUrl,

    credentials:
      true,
  })
);


app.use(
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max:
      500,
  })
);


/* =========================================================
   JSON BODY PARSER

   rawBody is required for Paystack webhook signature
   verification.
========================================================= */

app.use(
  express.json({
    limit:
      "2mb",

    verify:
      (req, res, buffer) => {
        req.rawBody =
          Buffer.from(buffer);
      },
  })
);


/* =========================================================
   LOGGING
========================================================= */

app.use(
  morgan(
    "combined"
  )
);


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/health",
  (req, res) =>
    res.json({
      ok:
        true,

      service:
        "Ojat AI API",
    })
);


/* =========================================================
   API ROUTES
========================================================= */

app.use(
  "/api/v1",
  routes
);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Ojat AI API is running",
    environment: process.env.NODE_ENV,
  });
});

/* =========================================================
   ERROR HANDLING
========================================================= */

app.use(
  notFound
);

app.use(
  errorHandler
);


export default app;
