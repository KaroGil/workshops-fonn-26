<template>
  <div class="shell">
    <div class="card">
      <p class="label">TABLE TENNIS</p>

      <!-- Score grid -->
      <div
        class="score-grid"
        :style="{
          gridTemplateColumns: `auto repeat(${state.totalSets}, 3rem)`,
        }"
      >
        <!-- Header row: set numbers -->
        <div class="grid-cell header-cell name-col" />
        <div
          v-for="s in state.totalSets"
          :key="s"
          class="grid-cell header-cell"
        >
          {{ s }}
        </div>

        <!-- One row per player -->
        <template v-for="(player, pi) in state.players" :key="pi">
          <!-- Name / button -->
          <div class="grid-cell name-col">
            <button
              class="score-btn"
              :disabled="connected !== 'server' || state.winner !== null"
              @click="score(pi as 0 | 1)"
            >
              {{ player.name }}{{ player.name
              }}{{ getServingPlayerIndex() === pi ? " *" : "" }}
            </button>
          </div>

          <!-- Set scores -->
          <div
            v-for="s in state.totalSets"
            :key="s"
            class="grid-cell score-cell"
            :class="{
              'set-won': setWinner(s - 1) === pi,
              'set-lost': setWinner(s - 1) !== null && setWinner(s - 1) !== pi,
            }"
          >
            <span v-if="s - 1 < state.setHistory.length">
              {{ state.setHistory[s - 1][pi] }}
            </span>
            <span v-else-if="s === state.currentSet">
              {{ player.points }}
            </span>
            <!-- future sets: empty -->
          </div>
        </template>
      </div>

      <!-- Match winner banner -->
      <div v-if="state.winner !== null" class="winner-banner">
        🏓 {{ state.players[state.winner].name }} wins the match!
        <button class="reset-btn" @click="reset">New game</button>
      </div>

      <!-- Connection badge -->
      <div class="source-badge" :class="connected">
        <span class="dot" />
        <span v-if="connected === 'server'">live from server</span>
        <span v-else-if="connected === 'connecting'">connecting…</span>
        <span v-else>disconnected — reconnecting…</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

type SetScore = [number, number];

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

// Returns the winner (0 or 1) of a completed set by index, or null
function setWinner(setIndex: number): 0 | 1 | null {
  const scores = state.value.setHistory[setIndex];
  if (!scores) return null;
  return scores[0] > scores[1] ? 0 : 1;
}

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

function score(playerIndex: 0 | 1) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "score", playerIndex }));
  }
}

function reset() {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "reset" }));
  }
}

onMounted(connect);
onUnmounted(() => {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  ws?.close();
});

function getServingPlayerIndex(): 0 | 1 {
  const p0Points = state.value.players[0].points;
  const p1Points = state.value.players[1].points;

  const currentSetIndex = state.value.currentSet - 1; // set 1 -> 0, set 2 -> 1, ...
  const totalPointsInCurrentSet = p0Points + p1Points;

  // Hvem starter med serve i dette settet:
  // set 1 -> player 0
  // set 2 -> player 1
  // set 3 -> player 0
  const firstServerThisSet = (currentSetIndex % 2) as 0 | 1;

  // Ved 10-10 eller mer: bytt serve for hvert poeng
  const serveBlockSize = p0Points >= 10 && p1Points >= 10 ? 1 : 2;

  const serveChanges = Math.floor(totalPointsInCurrentSet / serveBlockSize);

  return ((firstServerThisSet + serveChanges) % 2) as 0 | 1;
}
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:wght@300;400;500&display=swap");

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #0b0c0f;
  --card: #13151a;
  --border: #1f2229;
  --accent: #c8f060;
  --text-primary: #e8eaf0;
  --text-muted: #555b6e;
  --text-dim: #2e3340;
  --radius: 20px;
  --row-font-size: 1rem;
}

body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: "DM Sans", sans-serif;
  min-height: 100dvh;
  display: grid;
  place-items: center;
}
</style>

<style scoped>
.shell {
  padding: 2rem;
  width: 100%;
  display: flex;
  justify-content: center;
}

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 3rem 4rem;
  min-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
  box-shadow:
    0 0 0 1px var(--dim),
    0 40px 80px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.card::before {
  content: "";
  position: absolute;
  top: -1px;
  left: 15%;
  right: 15%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  border-radius: 999px;
  opacity: 0.6;
}

.label {
  font-family: "DM Mono", monospace;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: var(--text-muted);
  text-transform: uppercase;
}

/* Score grid: 1 name column + N set columns (set dynamically via inline style) */
.score-grid {
  display: grid;
  align-items: center;
  row-gap: 0.5rem;
  column-gap: 0;
}

.grid-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "DM Mono", monospace;
  font-size: var(--row-font-size);
}

.name-col {
  justify-content: flex-start;
  padding-right: 1.5rem;
}

/* Header row */
.header-cell {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--text-muted);
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border);
}

.header-cell.name-col {
  border-bottom: 1px solid var(--border);
}

/* Score cells */
.score-cell {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  min-height: 2.5rem;
}

.score-cell.set-won {
  color: var(--accent);
  font-weight: 500;
}

.score-cell.set-lost {
  color: var(--text-primary);
}

/* Score button */
.score-btn {
  font-family: "DM Mono", monospace;
  font-size: var(--row-font-size);
  letter-spacing: 0.05em;
  color: var(--bg);
  background: var(--accent);
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1.25rem;
  cursor: pointer;
  transition:
    opacity 0.15s,
    transform 0.1s;
  min-width: 10rem;
}

.score-btn:hover:not(:disabled) {
  opacity: 0.85;
}
.score-btn:active:not(:disabled) {
  transform: scale(0.97);
}
.score-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

/* Winner banner */
.winner-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(200, 240, 96, 0.08);
  border: 1px solid rgba(200, 240, 96, 0.2);
  border-radius: 10px;
  padding: 0.75rem 1.25rem;
  font-family: "DM Mono", monospace;
  font-size: 0.8rem;
  color: var(--accent);
  letter-spacing: 0.03em;
}

.reset-btn {
  font-family: "DM Mono", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--bg);
  background: var(--accent);
  border: none;
  border-radius: 6px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.reset-btn:hover {
  opacity: 0.85;
}

/* Connection badge */
.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: "DM Mono", monospace;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  align-self: flex-start;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-dim);
  flex-shrink: 0;
}

.source-badge.server .dot {
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
  animation: pulse 2.5s ease-in-out infinite;
}
.source-badge.connecting .dot {
  background: #888;
  animation: pulse 1s ease-in-out infinite;
}
.source-badge.disconnected .dot {
  background: #e05555;
  box-shadow: 0 0 6px #e05555;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
