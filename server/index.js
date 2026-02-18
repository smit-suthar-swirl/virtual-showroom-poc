import "dotenv/config";
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { handleConnection } from "./streamHandler.js";

const PORT = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set in .env");
  process.exit(1);
}

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (clientWs) => {
  console.log("[WS] Client connected");
  handleConnection(clientWs);
});

server.listen(PORT, () => {
  console.log(`\n  BYD Seal Voice Assistant`);
  console.log(`  http://localhost:${PORT}\n`);
});
