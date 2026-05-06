// Lightweight diagnostic logger.
// Subscribes to the Zustand store and records every meaningful state change
// in a ring buffer. Mirrors changes to the browser console for live debugging.

import { useGameStore, type GameState } from './store';

type StateSnapshot = {
  mode: string;
  inning: number;
  outs: number;
  runsThisInning: number;
  runsTotal: number;
  oppRunsThisInning: number;
  oppRunsTotal: number;
  bases: { first: string | null; second: string | null; third: string | null };
  currentAtBat: { batterId: string; strikes: number; pitches: number; eventCount: number } | null;
  pendingForceOut: boolean;
  pendingRunnerResolution: {
    hitType: string;
    runnerIndex: number;
    runnersToResolve: number;
    batterStep: boolean;
    batterFinalBase?: string;
  } | null;
  inningLogLength: number;
  pastStatesLength: number;
  currentBatterIndex: number;
};

export type DebugLogEntry = {
  timestamp: number;
  diff: string[];
  snapshot: StateSnapshot;
};

const MAX_LOG = 100;
const log: DebugLogEntry[] = [];
let prev: StateSnapshot | null = null;
let started = false;

const shortId = (id: string | null | undefined) => (id ? id.slice(0, 6) : 'empty');

const captureSnapshot = (state: GameState): StateSnapshot => ({
  mode: state.mode,
  inning: state.inning,
  outs: state.outs,
  runsThisInning: state.runsThisInning,
  runsTotal: state.runsTotal,
  oppRunsThisInning: state.opponentRunsThisInning,
  oppRunsTotal: state.opponentRunsTotal,
  bases: { ...state.bases },
  currentAtBat: state.currentAtBat
    ? {
        batterId: state.currentAtBat.batterId,
        strikes: state.currentAtBat.strikes,
        pitches: state.currentAtBat.pitches,
        eventCount: state.currentAtBat.events.length,
      }
    : null,
  pendingForceOut: !!state.pendingForceOut,
  pendingRunnerResolution: state.pendingRunnerResolution
    ? {
        hitType: String(state.pendingRunnerResolution.hitType),
        runnerIndex: state.pendingRunnerResolution.currentRunnerIndex,
        runnersToResolve: state.pendingRunnerResolution.runnersToResolve.length,
        batterStep: !!state.pendingRunnerResolution.batterStep,
        batterFinalBase: state.pendingRunnerResolution.batterFinalBase,
      }
    : null,
  inningLogLength: state.inningLog.length,
  pastStatesLength: state.pastStates.length,
  currentBatterIndex: state.currentBatterIndex,
});

const computeDiff = (a: StateSnapshot | null, b: StateSnapshot): string[] => {
  if (!a) return ['initial snapshot'];
  const d: string[] = [];

  if (a.mode !== b.mode) d.push(`mode: ${a.mode} → ${b.mode}`);
  if (a.inning !== b.inning) d.push(`inning: ${a.inning} → ${b.inning}`);
  if (a.outs !== b.outs) d.push(`outs: ${a.outs} → ${b.outs}`);
  if (a.runsThisInning !== b.runsThisInning) d.push(`runsInn: ${a.runsThisInning} → ${b.runsThisInning}`);
  if (a.runsTotal !== b.runsTotal) d.push(`runsTot: ${a.runsTotal} → ${b.runsTotal}`);
  if (a.oppRunsThisInning !== b.oppRunsThisInning) d.push(`oppInn: ${a.oppRunsThisInning} → ${b.oppRunsThisInning}`);
  if (a.oppRunsTotal !== b.oppRunsTotal) d.push(`oppTot: ${a.oppRunsTotal} → ${b.oppRunsTotal}`);

  if (a.bases.first !== b.bases.first) d.push(`1st: ${shortId(a.bases.first)} → ${shortId(b.bases.first)}`);
  if (a.bases.second !== b.bases.second) d.push(`2nd: ${shortId(a.bases.second)} → ${shortId(b.bases.second)}`);
  if (a.bases.third !== b.bases.third) d.push(`3rd: ${shortId(a.bases.third)} → ${shortId(b.bases.third)}`);

  if (!a.currentAtBat && b.currentAtBat) {
    d.push(`atBat: STARTED (${shortId(b.currentAtBat.batterId)})`);
  } else if (a.currentAtBat && !b.currentAtBat) {
    d.push('atBat: CLEARED');
  } else if (a.currentAtBat && b.currentAtBat) {
    if (a.currentAtBat.batterId !== b.currentAtBat.batterId) {
      d.push(`atBat: new batter (${shortId(b.currentAtBat.batterId)})`);
    }
    if (a.currentAtBat.strikes !== b.currentAtBat.strikes) {
      d.push(`strikes: ${a.currentAtBat.strikes} → ${b.currentAtBat.strikes}`);
    }
    if (a.currentAtBat.pitches !== b.currentAtBat.pitches) {
      d.push(`pitches: ${a.currentAtBat.pitches} → ${b.currentAtBat.pitches}`);
    }
    if (a.currentAtBat.eventCount !== b.currentAtBat.eventCount) {
      d.push(`events: ${a.currentAtBat.eventCount} → ${b.currentAtBat.eventCount}`);
    }
  }

  if (a.currentBatterIndex !== b.currentBatterIndex) {
    d.push(`batterIdx: ${a.currentBatterIndex} → ${b.currentBatterIndex}`);
  }

  if (a.pendingForceOut !== b.pendingForceOut) {
    d.push(`forceOut: ${a.pendingForceOut ? 'on' : 'off'} → ${b.pendingForceOut ? 'on' : 'off'}`);
  }

  if (!a.pendingRunnerResolution && b.pendingRunnerResolution) {
    d.push(
      `resolution: STARTED (${b.pendingRunnerResolution.hitType}, ${b.pendingRunnerResolution.runnersToResolve} runners)`
    );
  } else if (a.pendingRunnerResolution && !b.pendingRunnerResolution) {
    d.push('resolution: CLEARED');
  } else if (a.pendingRunnerResolution && b.pendingRunnerResolution) {
    if (a.pendingRunnerResolution.runnerIndex !== b.pendingRunnerResolution.runnerIndex) {
      d.push(`resolveIdx: ${a.pendingRunnerResolution.runnerIndex} → ${b.pendingRunnerResolution.runnerIndex}`);
    }
    if (a.pendingRunnerResolution.batterStep !== b.pendingRunnerResolution.batterStep) {
      d.push(`batterStep: ${a.pendingRunnerResolution.batterStep} → ${b.pendingRunnerResolution.batterStep}`);
    }
    if (a.pendingRunnerResolution.batterFinalBase !== b.pendingRunnerResolution.batterFinalBase) {
      d.push(
        `batterFinal: ${a.pendingRunnerResolution.batterFinalBase ?? 'unset'} → ${b.pendingRunnerResolution.batterFinalBase ?? 'unset'}`
      );
    }
  }

  if (a.inningLogLength !== b.inningLogLength) {
    const delta = b.inningLogLength - a.inningLogLength;
    d.push(`inningLog ${delta > 0 ? '+' : ''}${delta}`);
  }
  if (a.pastStatesLength !== b.pastStatesLength) {
    d.push(`undoStack: ${a.pastStatesLength} → ${b.pastStatesLength}`);
  }

  return d;
};

export function startDebugLog() {
  if (started) return;
  started = true;

  const initial = captureSnapshot(useGameStore.getState());
  prev = initial;
  log.push({ timestamp: Date.now(), diff: ['initial snapshot'], snapshot: initial });

  useGameStore.subscribe((state) => {
    const snap = captureSnapshot(state);
    const diff = computeDiff(prev, snap);
    if (diff.length === 0) return;
    log.push({ timestamp: Date.now(), diff, snapshot: snap });
    if (log.length > MAX_LOG) log.shift();
    prev = snap;

    const ts = new Date().toISOString().slice(11, 19);
    console.log(`%c[DODGERS ${ts}]`, 'color:#005A9C;font-weight:bold', diff.join(' | '));
  });
}

export function getDebugLog(): DebugLogEntry[] {
  return [...log];
}

export function clearDebugLog() {
  log.length = 0;
  prev = captureSnapshot(useGameStore.getState());
}

export function exportDebugLogText(): string {
  return log
    .map((e) => {
      const ts = new Date(e.timestamp).toISOString().slice(11, 23);
      return `[${ts}] ${e.diff.join(' | ')}`;
    })
    .join('\n');
}

export function exportDebugLogJson(): string {
  return JSON.stringify(log, null, 2);
}

// Debug-mode toggle — persisted to localStorage and also enabled by ?debug=1
const DEBUG_KEY = 'dodgers-debug-mode';

export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('debug') === '1') {
      window.localStorage.setItem(DEBUG_KEY, '1');
      return true;
    }
    if (url.searchParams.get('debug') === '0') {
      window.localStorage.removeItem(DEBUG_KEY);
      return false;
    }
    return window.localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDebugEnabled(on: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(DEBUG_KEY, '1');
    else window.localStorage.removeItem(DEBUG_KEY);
  } catch {
    /* ignore */
  }
}
