import { ref, onMounted, onUnmounted, computed } from "vue";

export type SetScore = [number, number];

interface PlayerState {
  name: string;
  points: number;
  sets: number;
}

interface State {
  players: [PlayerState, PlayerState];
  totalSets: number;
  currentSet: number;
  setHistory: SetScore[];
  winner: 0 | 1 | null;
}

type PointIndicator = {
  kind: "game" | "match";
  playerIndex: 0 | 1;
  count: number;
} | null;

const state = ref<State>({
  players: [
    { name: "…", points: 0, sets: 0 },
    { name: "…", points: 0, sets: 0 },
  ],
  totalSets: 3,
  currentSet: 1,
  setHistory: [],
  winner: null,
});

const connected = ref<"server" | "connecting" | "disconnected">("connecting");

let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

export function setWinner(setIndex: number): 0 | 1 | null {
  const scores = state.value.setHistory[setIndex];
  if (!scores) return null;
  return scores[0] > scores[1] ? 0 : 1;
}

export function getServingPlayerIndex(): 0 | 1 {
  const p0Points = state.value.players[0].points;
  const p1Points = state.value.players[1].points;

  const currentSetIndex = state.value.currentSet - 1;
  const totalPointsInCurrentSet = p0Points + p1Points;

  const firstServerThisSet = (currentSetIndex % 2) as 0 | 1;
  const serveBlockSize = p0Points >= 10 && p1Points >= 10 ? 1 : 2;
  const serveChanges = Math.floor(totalPointsInCurrentSet / serveBlockSize);

  return ((firstServerThisSet + serveChanges) % 2) as 0 | 1;
}

export function getPointIndicator(stateValue: State): PointIndicator {
  if (stateValue.winner !== null) return null;

  const p0 = stateValue.players[0];
  const p1 = stateValue.players[1];
  const setsToWin = Math.ceil(stateValue.totalSets / 2);

  for (const i of [0, 1] as const) {
    const mine = i === 0 ? p0.points : p1.points;
    const theirs = i === 0 ? p1.points : p0.points;
    const mySets = stateValue.players[i].sets;

    const isSetPoint = mine >= 10 && mine === theirs + 1;

    if (!isSetPoint) continue;

    const isMatchPoint = mySets === setsToWin - 1;

    let count = 1;

    if (mine === 10 && theirs >= 1) {
      count = theirs;
    } else if (mine > 10) {
      count = 1;
    }

    return {
      kind: isMatchPoint ? "match" : "game",
      playerIndex: i,
      count,
    };
  }

  return null;
}

export const pointIndicatorText = computed(() => {
  const indicator = getPointIndicator(state.value);
  if (!indicator) return "";

  const base = indicator.kind === "match" ? "Match point" : "Game point";
  return indicator.count > 1 ? `${base} #${indicator.count}` : base;
});

function connect() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${location.host}/ws`);

  ws.onopen = () => {
    connected.value = "server";
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
  };

  ws.onmessage = (event: MessageEvent) => {
    state.value = JSON.parse(event.data as string) as State;
  };

  ws.onclose = () => {
    connected.value = "disconnected";
    reconnectTimeout = setTimeout(connect, 2000);
  };

  ws.onerror = () => ws?.close();
}

export function score(playerIndex: 0 | 1) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "score", playerIndex }));
  }
}

export function reset() {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "reset" }));
  }
}

onMounted(connect);
onUnmounted(() => {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  ws?.close();
});
