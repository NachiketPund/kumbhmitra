import { app } from "./app.js";
import { config } from "./config/env.js";
import { db } from "./db/connection.js";

const server = app.listen(config.port, () => {
  console.log("==========================================");
  console.log(` KumbhMitra Backend Service Running`);
  console.log(` Environment : ${config.nodeEnv}`);
  console.log(` Port        : ${config.port}`);
  console.log(` Health Probe: http://localhost:${config.port}/api/health`);
  console.log("==========================================");
});

// Graceful shutdown handling
function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      try {
        await db.close();
        console.log("Database connection closed cleanly.");
      } catch (err) {
        console.error("Error during database shutdown:", err);
      }
      console.log("KumbhMitra server shut down successfully.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

export default server;
