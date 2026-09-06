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

import businessRoutes from "./routes/business.routes.js";

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

   Preserve the ORIGINAL raw request body.
   
   This is required for cryptographic webhook 
   signature verification because Meta and Paystack 
   sign the exact bytes received over HTTP.
   
   IMPORTANT:
   Webhook signature middleware must use:

        req.rawBody 
   
   and NOT: 
   
        JSON.stringify(req.body)
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
  "/api/v1/businesses",
  businessRoutes
);

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
