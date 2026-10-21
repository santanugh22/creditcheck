import os from "os";
import { app } from "./app";
import { env } from "./config/env";
import { initializeDatabase, pool } from "./db/pool";

function getLocalLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

async function bootstrap(): Promise<void> {
  try {
    await initializeDatabase();

    const lanIp = getLocalLanIp();
    const server = app.listen(env.PORT, "0.0.0.0", () => {
      console.log("");
      console.log(
        "╔══════════════════════════════════════════════════════════════════╗",
      );
      console.log(
        "║        🇮🇳 MINILEDGER (BHARAT EDITION) BACKEND SERVER READY       ║",
      );
      console.log(
        "╠══════════════════════════════════════════════════════════════════╣",
      );
      console.log(
        `║  🌐 Local URL       : http://localhost:${env.PORT}/api/v1`.padEnd(
          67,
          " ",
        ) + "║",
      );
      console.log(
        `║  📱 Expo Go LAN URL : http://${lanIp}:${env.PORT}/api/v1`.padEnd(
          67,
          " ",
        ) + "║",
      );
      console.log(
        `║  🖼️  Receipts Dir    : ${env.UPLOAD_DIR}/`.padEnd(67, " ") + "║",
      );
      console.log(
        "╚══════════════════════════════════════════════════════════════════╝",
      );
      console.log("");
    });

    const shutdown = async (signal: string) => {
      console.log(
        `\n🛑 [${signal}] Shutting down MiniLedger server gracefully...`,
      );
      server.close(async () => {
        await pool.end();
        console.log("✅ PostgreSQL pool closed. Goodbye!");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("❌ Failed to start MiniLedger Backend Server:", error);
    process.exit(1);
  }
}

bootstrap();
