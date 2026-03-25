import express, { Request, Response } from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { makeState, updateState, State, useTimeout } from "./game";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "../../client/dist")));
app.get("/data", (_req: Request, res: Response) => {
  res.json(state);
});
app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

// Player names and total sets from CLI arguments:
// npm run start -- 'Player One' 'Player Two' 5
const [player1Name, player2Name] = [
  process.argv[2] ?? "Player 1",
  process.argv[3] ?? "Player 2",
];
const totalSets = parseInt(process.argv[4] ?? "3", 10);
console.log(`Players: ${player1Name}, ${player2Name} — best of ${totalSets}`);

// --- State ---

let state: State = makeState(player1Name, player2Name, totalSets);

// --- Dispatch ---

function dispatch(): void {
  const message = JSON.stringify(state);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// --- WebSocket ---

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected");
  ws.send(JSON.stringify(state));

  ws.on("message", (data) => {
    const { type, playerIndex } = JSON.parse(data.toString()) as {
      type: string;
      playerIndex?: 0 | 1;
    };

    if (type === "score" && (playerIndex === 0 || playerIndex === 1)) {
      state = updateState(state, playerIndex);
      dispatch();
    } else if (type === "reset") {
      state = makeState(player1Name, player2Name, totalSets);
      dispatch();
    } else if (type === "timeout") {
      console.log(
        `Timeout called by ${playerIndex === 0 ? player1Name : player2Name}`,
      );
      state = useTimeout(state, playerIndex!);
      dispatch();
    }
  });

  ws.on("close", () => console.log("Client disconnected"));
  ws.on("error", (err) => console.error("WebSocket error:", err));
});

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
