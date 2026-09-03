import app from "./app.js";
import { env } from "./config/env.js";
import { whatsappWorker } from "./workers/whatsapp.worker.js";

/* =========================================================
   HTTP SERVER
========================================================= */

const server = app.listen(
  env.port,
  "0.0.0.0",
  () => {
    console.log(
      `Ojat API running on ${env.port}`
    );

    console.log(
      "OJAT WhatsApp Worker running in API process"
    );
  }
);


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

const shutdown = async (signal) => {

  console.log(
    `${signal} received. Shutting down OJAT...`
  );

  server.close(async () => {

    try {

      await whatsappWorker.close();

      console.log(
        "OJAT WhatsApp Worker stopped"
      );

      process.exit(0);

    } catch (error) {

      console.error(
        "Error shutting down WhatsApp Worker:",
        error
      );

      process.exit(1);

    }

  });

};


/* =========================================================
   PROCESS SIGNALS
========================================================= */

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);
