import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import {
  upsertPlayer, deletePlayer as deletePlayerFromDb,
  saveGameToSupabase, deleteGameFromSupabase, toggleGameExclusionInSupabase, updateGameScoreInSupabase, updateInningLogInSupabase,
} from './supabaseSync';

export type Player = { id: string; name: string };
export type HitTrajectory = 'Grounder' | 'Blooper' | 'Line Drive';
export type HitType = '1B' | '2B' | '3B' | 'HR';
export type OutType = 'Strikeout' | 'Flyout' | 'Groundout' | 'Forceout' | 'Tagout';
export type DefensiveEvent = 'Out' | 'Fielding Error' | 'Throwing Error' | 'Fielding & Throwing Error' | 'Fielded Cleanly';

export type AtBatEvent =
  | { type: 'pitch'; result: 'strike' | 'no-swing' | 'foul' }
  | { type: 'hit'; hitType: HitType; trajectory: HitTrajectory; x: number; y: number }
  | { type: 'out'; outType: OutType; x?: number; y?: number }
  | { type: 'error'; trajectory: HitTrajectory; x: number; y: number };

export type Bases = {
  first: string | null;
  second: string | null;
  third: string | null;
};

export type InningLogEntry = {
  inning: number;
  isOffense: boolean;
  batterId?: string;
  batterName?: string;
  result: string;
  details: string[];  // ["Caleb scored", "Swain → 2nd"]
  rbis: number;
  outsAfter: number;
};

export type AtBatState = {
  batterId: string;
  inning: number;
  pitches: number;
  strikes: number;
  events: AtBatEvent[];
};

export type HistoricalGame = {
  id: string;
  date: string;
  opponent: string;
  runsScored: number;
  opponentScore: number;
  opponentRunsTotal?: number;  // Added for opponent run tracking
  atBats: AtBatState[];
  defensiveActions: { position: string; playerId: string | null; result: DefensiveEvent }[];
  inningLog: InningLogEntry[];
  excluded?: boolean;  // if true, excluded from season stats calculations
};

// State that the baserunner resolution overlay needs
export type PendingRunnerResolution = {
  batterId: string;
  hitType: HitType | 'error' | 'forceout';
  trajectory?: HitTrajectory;
  x?: number;
  y?: number;
  runnersToResolve: { playerId: string; fromBase: 'first' | 'second' | 'third' }[];
  resolvedRunners: { playerId: string; fromBase: string; toBase: string }[];
  currentRunnerIndex: number;
  batterPlaced: boolean;  // has batter been placed on base yet
  skipOutCount?: boolean;  // for forceout: don't count another out
  batterStep?: boolean;  // currently resolving the batter (after all runners done)
  batterFinalBase?: 'first' | 'second' | 'third' | 'scored' | 'out';  // chosen outcome for the batter
};

export type PendingForceOut = {
  batterId: string;
  outType: OutType;
  x?: number;
  y?: number;
  occupiedBases: { base: 'first' | 'second' | 'third'; playerId: string }[];
};

export interface GameState {
  gameStarted: boolean;
  mode: 'offense' | 'defense' | 'dashboard' | 'lineup';
  startingSide: 'offense' | 'defense';
  inning: number;
  outs: number;
  runsThisInning: number;
  runsTotal: number;
  opponentRunsThisInning: number;
  opponentRunsTotal: number;
  bases: Bases;

  roster: Player[];
  lineup: string[];
  currentBatterIndex: number;
  isLineupSet: boolean;
  battedThisCycle: string[];

  currentAtBat: AtBatState | null;
  atBats: AtBatState[];
  defensiveAssignments: Record<string, string | null>;
  defensiveActions: { position: string; playerId: string | null; result: DefensiveEvent }[];
  pastStates: string[];
  gameHistory: HistoricalGame[];
  inningLog: InningLogEntry[];

  // Pending resolution states (UI-driven)
  pendingRunnerResolution: PendingRunnerResolution | null;
  pendingForceOut: PendingForceOut | null;

  // Actions
  undo: () => void;
  setGameStarted: (started: boolean) => void;
  setMode: (mode: 'offense' | 'defense' | 'dashboard' | 'lineup') => void;
  setStartingSide: (side: 'offense' | 'defense') => void;
  assignDefensivePosition: (position: string, playerId: string | null) => void;
  addPlayerToRoster: (name: string) => void;
  removePlayerFromRoster: (id: string) => void;
  addToLineup: (playerId: string) => void;
  removeFromLineup: (playerId: string) => void;
  reorderLineup: (startIndex: number, endIndex: number) => void;
  setLineupSet: (set: boolean) => void;
  pushToLineup: (playerId: string) => void;
  addLateJoinerToLineup: (playerId: string) => void;

  startNextAtBat: () => void;
  logPitch: (result: 'strike' | 'no-swing' | 'foul') => void;
  
  // New: initiates baserunner resolution instead of auto-completing
  initiateHit: (hitType: HitType, trajectory: HitTrajectory, x: number, y: number) => void;
  resolveNextRunner: (toBase: 'scored' | 'third' | 'second' | 'first' | 'out') => void;
  resolveBatter: (outcome: 'first' | 'second' | 'third' | 'scored' | 'out') => void;
  finalizeHitResolution: () => void;

  // Force out flow
  initiateForceOut: (outType: OutType, x?: number, y?: number) => void;
  resolveForceOut: (forcedPlayerId: string | null, forcedAt: string) => void;
  
  logOffensiveOut: (outType: OutType, x?: number, y?: number) => void;
  logOffensiveError: (trajectory: HitTrajectory, x: number, y: number) => void;
  logDefensiveAction: (position: string, result: DefensiveEvent) => void;
  manualNextInning: () => void;
  setManualInning: (inning: number) => void;
  setCurrentBatterIndex: (index: number) => void;
  manualSwitchToDefense: () => void;
  manualSwitchToOffense: () => void;
  injectMockGame: () => void;
  deleteHistoricalGame: (id: string) => void;
  updateInningLogEntries: (indices: number[], newInning: number) => void;

  scoreRun: () => void;
  scoreOpponentRun: () => void;
  endAndSaveGame: (opponentName: string, opponentScore: number) => void;
  toggleGameExclusion: (id: string) => void;
  updateHistoricalGameScore: (id: string, fields: { opponent?: string; runsScored?: number; opponentScore?: number }) => void;
  updateInningLogEntry: (index: number, fields: Partial<InningLogEntry>) => void;
  updateHistoricalInningLogEntry: (gameId: string, entryIndex: number, fields: Partial<InningLogEntry>) => void;
}

const initialState = {
  gameStarted: false,
  mode: 'lineup' as const,
  startingSide: 'offense' as 'offense' | 'defense',
  inning: 1,
  outs: 0,
  runsThisInning: 0,
  runsTotal: 0,
  opponentRunsThisInning: 0,
  opponentRunsTotal: 0,
  bases: { first: null, second: null, third: null } as Bases,
  roster: [] as Player[],
  lineup: [] as string[],
  currentBatterIndex: 0,
  isLineupSet: false,
  battedThisCycle: [] as string[],
  currentAtBat: null as AtBatState | null,
  atBats: [] as AtBatState[],
  defensiveAssignments: {} as Record<string, string | null>,
  defensiveActions: [] as { position: string; playerId: string | null; result: DefensiveEvent }[],
  pastStates: [] as string[],
  gameHistory: [] as HistoricalGame[],
  inningLog: [] as InningLogEntry[],
  pendingRunnerResolution: null as PendingRunnerResolution | null,
  pendingForceOut: null as PendingForceOut | null,
};

// Omit all function keys for serialization
const functionKeys: (keyof GameState)[] = [
  'undo', 'setGameStarted', 'setMode', 'setStartingSide', 'assignDefensivePosition',
  'addPlayerToRoster', 'removePlayerFromRoster', 'addToLineup', 'removeFromLineup',
  'reorderLineup', 'startNextAtBat', 'logPitch', 'initiateHit', 'resolveNextRunner',
  'resolveBatter', 'finalizeHitResolution', 'initiateForceOut', 'resolveForceOut',
  'logOffensiveOut', 'logOffensiveError', 'logDefensiveAction',
  'scoreRun', 'scoreOpponentRun', 'endAndSaveGame', 'manualNextInning', 'manualSwitchToDefense',
  'manualSwitchToOffense', 'injectMockGame', 'deleteHistoricalGame', 'pastStates',
  'setManualInning', 'setCurrentBatterIndex', 'setLineupSet', 'pushToLineup',
  'addLateJoinerToLineup', 'updateInningLogEntries', 'toggleGameExclusion', 'updateHistoricalGameScore',
  'updateInningLogEntry', 'updateHistoricalInningLogEntry'
];

const serializeState = (state: GameState): string => {
  const obj: Record<string, unknown> = {};
  for (const key of Object.keys(state)) {
    if (!functionKeys.includes(key as keyof GameState) && typeof (state as unknown as Record<string, unknown>)[key] !== 'function') {
      obj[key] = (state as unknown as Record<string, unknown>)[key];
    }
  }
  return JSON.stringify(obj);
};

const pushUndo = (state: GameState): string[] => {
  const prev = serializeState(state);
  const newPast = [...state.pastStates, prev];
  if (newPast.length > 50) newPast.shift();
  return newPast;
};

// After a batter completes an at-bat, track them. Auto-lock order when first full cycle finishes.
const completeBatterCycle = (state: GameState, batterId: string): { battedThisCycle: string[]; isLineupSet: boolean } => {
  if (state.isLineupSet) return { battedThisCycle: state.battedThisCycle, isLineupSet: true };
  if (!state.lineup.includes(batterId)) return { battedThisCycle: state.battedThisCycle, isLineupSet: false };
  const newBatted = state.battedThisCycle.includes(batterId)
    ? state.battedThisCycle
    : [...state.battedThisCycle, batterId];
  if (newBatted.length >= state.lineup.length && state.lineup.length > 0) {
    return { battedThisCycle: [], isLineupSet: true };
  }
  return { battedThisCycle: newBatted, isLineupSet: false };
};

// Returns the next inning that hasn't had both offense and defense recorded
const computeNextInning = (inningLog: InningLogEntry[]): number => {
  const offenseInnings = new Set(inningLog.filter(e => e.isOffense).map(e => e.inning));
  const defenseInnings = new Set(inningLog.filter(e => !e.isOffense).map(e => e.inning));
  let maxComplete = 0;
  offenseInnings.forEach(n => { if (defenseInnings.has(n) && n > maxComplete) maxComplete = n; });
  if (maxComplete > 0) return maxComplete + 1;
  const allInnings = [...offenseInnings, ...defenseInnings];
  return allInnings.length > 0 ? Math.max(...allInnings) : 1;
};

// Side-aware inning advancement. Called at the moment a half-inning ends.
// endingHalf: which half just ended ('offense' or 'defense').
// Rule: if we started on offense (away), our half-order is offense→defense, so the
// inning ticks after defense ends. If we started on defense (home), half-order is
// defense→offense, so the inning ticks after offense ends.
const advanceInningIfNeeded = (
  currentInning: number,
  startingSide: 'offense' | 'defense',
  endingHalf: 'offense' | 'defense'
): number => {
  const secondHalf = startingSide === 'offense' ? 'defense' : 'offense';
  return endingHalf === secondHalf ? currentInning + 1 : currentInning;
};

const getPlayerName = (state: GameState, id: string | null): string => {
  if (!id) return 'Unknown';
  return state.roster.find(p => p.id === id)?.name || 'Unknown';
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
  ...initialState,

  undo: () => set((state) => {
    if (state.pastStates.length === 0) return state;
    const newPast = [...state.pastStates];
    const prevStr = newPast.pop();
    if (!prevStr) return state;
    try {
      const prev = JSON.parse(prevStr);
      return { ...state, ...prev, pastStates: newPast };
    } catch { return state; }
  }),

  setGameStarted: (gameStarted) => set((state) => ({
    gameStarted,
    // Clear undo history on game start so pre-game setup can't be undone
    ...(gameStarted ? { pastStates: [] as string[], battedThisCycle: [] as string[] } : {}),
    ...(gameStarted ? {} : { battedThisCycle: state.battedThisCycle }),
  })),
  setMode: (mode) => set({ mode }),
  setStartingSide: (side) => set({ startingSide: side }),

  assignDefensivePosition: (position, playerId) =>
    set((state) => {
      const newAssignments = { ...state.defensiveAssignments, [position]: playerId };
      // Remove player from any other position they were already assigned to
      if (playerId) {
        Object.keys(newAssignments).forEach(pos => {
          if (pos !== position && newAssignments[pos] === playerId) {
            newAssignments[pos] = null;
          }
        });
      }
      return { defensiveAssignments: newAssignments };
    }),

  addPlayerToRoster: (name) => set((state) => {
    const newPlayer = { id: uuidv4(), name };
    // Fire-and-forget sync to Supabase
    upsertPlayer(newPlayer);
    return {
      roster: [...state.roster, newPlayer],
      lineup: [...state.lineup, newPlayer.id],
    };
  }),

  removePlayerFromRoster: (id) => set((state) => {
    const newLineup = state.lineup.filter(pid => pid !== id);
    const newAssignments = { ...state.defensiveAssignments };
    Object.keys(newAssignments).forEach(key => {
      if (newAssignments[key] === id) newAssignments[key] = null;
    });
    // Fire-and-forget sync to Supabase
    deletePlayerFromDb(id);
    return { roster: state.roster.filter(p => p.id !== id), lineup: newLineup, defensiveAssignments: newAssignments };
  }),

  addToLineup: (playerId) => set((state) => {
    if (state.lineup.includes(playerId)) return state;
    return { lineup: [...state.lineup, playerId] };
  }),

  removeFromLineup: (playerId) => set((state) => ({
    lineup: state.lineup.filter((id) => id !== playerId),
  })),

  reorderLineup: (startIndex, endIndex) => set((state) => {
    const result = Array.from(state.lineup);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return { lineup: result };
  }),

  setLineupSet: (isLineupSet) => set({ isLineupSet }),

  pushToLineup: (playerId) => {
    const state = get();
    if (state.lineup.includes(playerId)) return;
    const newLineup = [...state.lineup, playerId];
    set({
      lineup: newLineup,
      currentBatterIndex: newLineup.length - 1,
      currentAtBat: state.currentAtBat ? { ...state.currentAtBat, batterId: playerId } : null
    });
  },

  addLateJoinerToLineup: (playerId) => {
    const state = get();
    if (state.lineup.includes(playerId)) return;
    const newPast = pushUndo(state);
    set({ pastStates: newPast, lineup: [...state.lineup, playerId] });
  },

  startNextAtBat: () => {
    const { lineup, currentBatterIndex, inning } = get();
    let nextBatterId = '';

    if (lineup.length > 0) {
      // Clamp index to valid range to prevent out-of-bounds lookups
      const safeIndex = currentBatterIndex % Math.max(1, lineup.length);
      nextBatterId = lineup[safeIndex] ?? '';
      // If the index was out of bounds, correct it in state
      if (safeIndex !== currentBatterIndex) {
        set({ currentBatterIndex: safeIndex });
      }
    }
    
    set({
      currentAtBat: {
        batterId: nextBatterId,
        inning,
        pitches: 0,
        strikes: 0,
        events: [],
      },
    });
  },

  logPitch: (result) => {
    const state = get();
    if (!state.currentAtBat) return;

    let { pitches, strikes, events } = state.currentAtBat;
    pitches++;
    if (result === 'strike') strikes++;
    else if (result === 'foul' && strikes < 2) strikes++;
    events = [...events, { type: 'pitch', result }];

    let isOut = false;
    if (strikes >= 3) isOut = true;
    else if (pitches >= 5 && result !== 'foul') isOut = true;

    if (isOut) {
      // Update the at-bat with final pitch before logging the out.
      // logOffensiveOut will handle pushing undo (capturing this updated state).
      set({
        currentAtBat: { ...state.currentAtBat, pitches, strikes, events },
      });
      get().logOffensiveOut('Strikeout');
    } else {
      const newPast = pushUndo(state);
      set({
        pastStates: newPast,
        currentAtBat: { ...state.currentAtBat, pitches, strikes, events },
      });
    }
  },

  // === BASERUNNER HIT FLOW ===
  initiateHit: (hitType, trajectory, x, y) => {
    const state = get();
    if (!state.currentAtBat) return;

    // HR = auto-resolve everyone scores
    if (hitType === 'HR') {
      const newPast = pushUndo(state);
      const { lineup, currentBatterIndex, atBats, currentAtBat, bases } = state;
      const { battedThisCycle: newBatted, isLineupSet: newIsLineupSet } = completeBatterCycle(state, currentAtBat.batterId);
      const nextIndex = (currentBatterIndex + 1) % Math.max(1, lineup.length);
      
      const completedAtBat = {
        ...currentAtBat,
        events: [...currentAtBat.events, { type: 'hit' as const, hitType, trajectory, x, y }]
      };

      let runsScored = 1; // batter scores
      const details: string[] = [];
      if (bases.third) { runsScored++; details.push(`${getPlayerName(state, bases.third)} scored`); }
      if (bases.second) { runsScored++; details.push(`${getPlayerName(state, bases.second)} scored`); }
      if (bases.first) { runsScored++; details.push(`${getPlayerName(state, bases.first)} scored`); }
      details.push(`${getPlayerName(state, currentAtBat.batterId)} scored (HR)`);

      let nextRunsInning = state.runsThisInning + runsScored;
      const nextRunsTotal = state.runsTotal + runsScored;
      const nextInning = state.inning;
      let nextOuts = state.outs;
      let nextMode = state.mode;

      const logEntry: InningLogEntry = {
        inning: state.inning, isOffense: true, batterId: currentAtBat.batterId,
        batterName: getPlayerName(state, currentAtBat.batterId),
        result: `HR`, details, rbis: runsScored, outsAfter: state.outs
      };

      // 5-run rule check
      if (nextRunsInning >= 5) {
        nextMode = 'defense';
        nextOuts = 0;
        nextRunsInning = 0;
      }

      set({
        pastStates: newPast,
        atBats: [...atBats, completedAtBat],
        currentAtBat: null,
        currentBatterIndex: nextIndex,
        bases: { first: null, second: null, third: null },
        runsThisInning: nextRunsInning,
        runsTotal: nextRunsTotal,
        inning: nextInning,
        outs: nextOuts,
        mode: nextMode,
        inningLog: [...state.inningLog, logEntry],
        battedThisCycle: newBatted,
        isLineupSet: newIsLineupSet,
      });
      get().startNextAtBat();
      return;
    }

    // For 1B/2B/3B — need to resolve runners
    const runnersToResolve: PendingRunnerResolution['runnersToResolve'] = [];
    // Resolve from 3rd → 2nd → 1st (furthest first)
    if (state.bases.third) runnersToResolve.push({ playerId: state.bases.third, fromBase: 'third' });
    if (state.bases.second) runnersToResolve.push({ playerId: state.bases.second, fromBase: 'second' });
    if (state.bases.first) runnersToResolve.push({ playerId: state.bases.first, fromBase: 'first' });

    if (runnersToResolve.length === 0) {
      // No runners — just place batter and finalize
      const newPast = pushUndo(state);
      const { lineup, currentBatterIndex, atBats, currentAtBat } = state;
      const { battedThisCycle: newBatted, isLineupSet: newIsLineupSet } = completeBatterCycle(state, currentAtBat.batterId);
      const nextIndex = (currentBatterIndex + 1) % Math.max(1, lineup.length);
      const completedAtBat = {
        ...currentAtBat,
        events: [...currentAtBat.events, { type: 'hit' as const, hitType, trajectory, x, y }]
      };

      const newBases = { ...state.bases };
      if (hitType === '1B') newBases.first = currentAtBat.batterId;
      if (hitType === '2B') newBases.second = currentAtBat.batterId;
      if (hitType === '3B') newBases.third = currentAtBat.batterId;

      const logEntry: InningLogEntry = {
        inning: state.inning, isOffense: true, batterId: currentAtBat.batterId,
        batterName: getPlayerName(state, currentAtBat.batterId),
        result: hitType, details: [], rbis: 0, outsAfter: state.outs
      };

      set({
        pastStates: newPast,
        atBats: [...atBats, completedAtBat],
        currentAtBat: null,
        currentBatterIndex: nextIndex,
        bases: newBases,
        inningLog: [...state.inningLog, logEntry],
        battedThisCycle: newBatted,
        isLineupSet: newIsLineupSet,
      });
      get().startNextAtBat();
      return;
    }

    // Has runners — enter resolution mode.
    // pushUndo here (at start of play) so undo restores the pristine "batter up" state.
    const newPast = pushUndo(state);
    set({
      pastStates: newPast,
      pendingRunnerResolution: {
        batterId: state.currentAtBat.batterId,
        hitType, trajectory, x, y,
        runnersToResolve,
        resolvedRunners: [],
        currentRunnerIndex: 0,
        batterPlaced: false,
      }
    });
  },

  resolveNextRunner: (toBase) => {
    const state = get();
    const pending = state.pendingRunnerResolution;
    if (!pending) return;

    const runner = pending.runnersToResolve[pending.currentRunnerIndex];
    const newResolved = [...pending.resolvedRunners, {
      playerId: runner.playerId,
      fromBase: runner.fromBase,
      toBase,
    }];

    const nextIndex = pending.currentRunnerIndex + 1;

    if (nextIndex >= pending.runnersToResolve.length) {
      // All existing runners resolved.
      // For forceout, batter is already placed/already out — skip batter step.
      if (pending.hitType === 'forceout') {
        set({
          pendingRunnerResolution: { ...pending, resolvedRunners: newResolved, currentRunnerIndex: nextIndex, batterPlaced: true }
        });
        setTimeout(() => get().finalizeHitResolution(), 0);
      } else {
        // Enter batter step — let the user choose where the batter ended up
        // (covers stretching, scoring, and out-on-bases scenarios).
        set({
          pendingRunnerResolution: { ...pending, resolvedRunners: newResolved, currentRunnerIndex: nextIndex, batterStep: true }
        });
      }
    } else {
      set({
        pendingRunnerResolution: { ...pending, resolvedRunners: newResolved, currentRunnerIndex: nextIndex }
      });
    }
  },

  resolveBatter: (outcome) => {
    const state = get();
    const pending = state.pendingRunnerResolution;
    if (!pending) return;
    set({
      pendingRunnerResolution: { ...pending, batterFinalBase: outcome, batterPlaced: true }
    });
    setTimeout(() => get().finalizeHitResolution(), 0);
  },

  finalizeHitResolution: () => {
    const state = get();
    const pending = state.pendingRunnerResolution;
    if (!pending || !state.currentAtBat) return;

    // Undo snapshot was already taken when the play was initiated — don't re-snapshot here,
    // otherwise undo would restore an in-progress resolution and the outcome menu would be blocked.
    const { lineup, currentBatterIndex, atBats, currentAtBat } = state;
    const { battedThisCycle: newBatted, isLineupSet: newIsLineupSet } = completeBatterCycle(state, currentAtBat.batterId);
    const nextIndex = (currentBatterIndex + 1) % Math.max(1, lineup.length);

    const isError = pending.hitType === 'error';
    const isForceout = pending.hitType === 'forceout';

    let completedAtBat;
    if (isForceout) {
      // For forceout, we already have the out event from resolveForceOut
      completedAtBat = { ...currentAtBat };
    } else if (isError) {
      completedAtBat = { ...currentAtBat, events: [...currentAtBat.events, { type: 'error' as const, trajectory: pending.trajectory!, x: pending.x!, y: pending.y! }] };
    } else {
      completedAtBat = { ...currentAtBat, events: [...currentAtBat.events, { type: 'hit' as const, hitType: pending.hitType as HitType, trajectory: pending.trajectory!, x: pending.x!, y: pending.y! }] };
    }

    // Build new bases from current bases (for forceout, bases are already updated)
    const newBases: Bases = { ...state.bases };
    let runsScored = 0;
    let newOuts = state.outs;
    const details: string[] = [];

    // CRITICAL: Clear all runners from their original bases FIRST
    // Without this, runners who advance or score leave phantom copies behind
    pending.runnersToResolve.forEach(r => {
      if (r.fromBase === 'first') newBases.first = null;
      if (r.fromBase === 'second') newBases.second = null;
      if (r.fromBase === 'third') newBases.third = null;
    });

    // Apply runner resolutions
    pending.resolvedRunners.forEach(r => {
      const name = getPlayerName(state, r.playerId);
      if (r.toBase === 'scored') {
        runsScored++;
        details.push(`${name} scored`);
      } else if (r.toBase === 'out') {
        newOuts++;
        details.push(`${name} out`);
      } else if (r.toBase === 'third') {
        newBases.third = r.playerId;
        details.push(`${name} → 3rd`);
      } else if (r.toBase === 'second') {
        newBases.second = r.playerId;
        details.push(`${name} → 2nd`);
      } else if (r.toBase === 'first') {
        newBases.first = r.playerId;
      }
    });

    // Place batter (or apply chosen outcome) — skip for forceout (batter already placed/out)
    if (!pending.skipOutCount) {
      const batterName = getPlayerName(state, pending.batterId);
      if (pending.batterFinalBase) {
        // User explicitly chose where the batter ended up (via batter step)
        if (pending.batterFinalBase === 'scored') {
          runsScored++;
          details.push(`${batterName} scored`);
        } else if (pending.batterFinalBase === 'out') {
          newOuts++;
          details.push(`${batterName} out advancing`);
        } else if (pending.batterFinalBase === 'first') {
          newBases.first = pending.batterId;
        } else if (pending.batterFinalBase === 'second') {
          newBases.second = pending.batterId;
        } else if (pending.batterFinalBase === 'third') {
          newBases.third = pending.batterId;
        }
      } else {
        // No batter step (e.g. bases were empty) — auto-place by hit type
        if (pending.hitType === '1B' || pending.hitType === 'error') newBases.first = pending.batterId;
        if (pending.hitType === '2B') newBases.second = pending.batterId;
        if (pending.hitType === '3B') newBases.third = pending.batterId;
      }
    }

    let nextRunsInning = state.runsThisInning + runsScored;
    const nextRunsTotal = state.runsTotal + runsScored;
    let nextInning = state.inning;
    let nextMode = state.mode;

    // RBIs on errors = 0, forceout = 0.
    // RBIs are credited for runners scoring AND for the batter scoring (e.g. inside-the-park / on-base error),
    // but NOT lost just because the batter himself made a baserunning out — the runs already scored still count.
    let resultStr = pending.hitType as string;
    let rbis = runsScored;
    if (isError) resultStr = 'ROE';
    if (isForceout) rbis = 0;

    // Recompute the log entry with potentially-updated runsScored/newOuts (batter step may have changed them)
    const logEntry: InningLogEntry = {
      inning: state.inning, isOffense: true, batterId: currentAtBat.batterId,
      batterName: getPlayerName(state, currentAtBat.batterId),
      result: resultStr, details, rbis, outsAfter: newOuts
    };

    // Check 3-out rule
    if (newOuts >= 3) {
      newOuts = 0;
      nextMode = 'defense';
      nextRunsInning = 0;
      newBases.first = null;
      newBases.second = null;
      newBases.third = null;
      nextInning = advanceInningIfNeeded(state.inning, state.startingSide, 'offense');
    }
    // Check 5-run rule
    else if (nextRunsInning >= 5) {
      nextMode = 'defense';
      nextRunsInning = 0;
      newOuts = 0;
      newBases.first = null;
      newBases.second = null;
      newBases.third = null;
      nextInning = advanceInningIfNeeded(state.inning, state.startingSide, 'offense');
    }

    set({
      atBats: [...atBats, completedAtBat],
      currentAtBat: null,
      currentBatterIndex: nextIndex,
      bases: newBases,
      outs: newOuts,
      runsThisInning: nextRunsInning,
      runsTotal: nextRunsTotal,
      inning: nextInning,
      mode: nextMode,
      inningLog: [...state.inningLog, logEntry],
      pendingRunnerResolution: null,
      battedThisCycle: newBatted,
      isLineupSet: newIsLineupSet,
    });
    get().startNextAtBat();
  },

  // === FORCE OUT FLOW ===
  initiateForceOut: (outType, x, y) => {
    const state = get();
    if (!state.currentAtBat) return;

    const occupied: PendingForceOut['occupiedBases'] = [];
    if (state.bases.first) occupied.push({ base: 'first', playerId: state.bases.first });
    if (state.bases.second) occupied.push({ base: 'second', playerId: state.bases.second });
    if (state.bases.third) occupied.push({ base: 'third', playerId: state.bases.third });

    if (occupied.length === 0) {
      // No runners — just a normal out on the batter
      get().logOffensiveOut(outType, x, y);
      return;
    }

    // Snapshot at start so undo restores the pristine "batter up" state and dismisses the prompt.
    const newPast = pushUndo(state);
    set({
      pastStates: newPast,
      pendingForceOut: {
        batterId: state.currentAtBat.batterId,
        outType, x, y,
        occupiedBases: occupied,
      }
    });
  },

  resolveForceOut: (forcedPlayerId, forcedAt) => {
    const state = get();
    const pending = state.pendingForceOut;
    if (!pending || !state.currentAtBat) return;

    // Undo snapshot was taken in initiateForceOut — don't re-snapshot here.
    const nextOuts = state.outs + 1;
    const newBases = { ...state.bases };
    const details: string[] = [];

    // Remove the forced out player from bases
    const forcedName = getPlayerName(state, forcedPlayerId);
    if (forcedPlayerId === pending.batterId) {
      details.push(`${forcedName} out at 1st`);
    } else {
      details.push(`${forcedName} forced out at ${forcedAt}`);
      // Remove from base they were on
      if (newBases.first === forcedPlayerId) newBases.first = null;
      if (newBases.second === forcedPlayerId) newBases.second = null;
      if (newBases.third === forcedPlayerId) newBases.third = null;
      // Batter reaches first on a fielder's choice (someone else was forced out)
      newBases.first = pending.batterId;
    }

    // Check if 3 outs achieved
    if (nextOuts >= 3) {
      // End of inning — finalize immediately
      const completedAtBat = {
        ...state.currentAtBat,
        events: [...state.currentAtBat.events, { type: 'out' as const, outType: pending.outType, x: pending.x, y: pending.y }]
      };
      const { lineup, currentBatterIndex } = state;
      const { battedThisCycle: newBatted, isLineupSet: newIsLineupSet } = completeBatterCycle(state, state.currentAtBat.batterId);
      const nextIndex = (currentBatterIndex + 1) % Math.max(1, lineup.length);

      const logEntry: InningLogEntry = {
        inning: state.inning, isOffense: true, batterId: state.currentAtBat.batterId,
        batterName: getPlayerName(state, state.currentAtBat.batterId),
        result: pending.outType, details, rbis: 0, outsAfter: nextOuts
      };

      const newLog = [...state.inningLog, logEntry];
      const nextInning = advanceInningIfNeeded(state.inning, state.startingSide, 'offense');
      set({
        atBats: [...state.atBats, completedAtBat],
        currentAtBat: null,
        currentBatterIndex: nextIndex,
        outs: 0,
        inning: nextInning,
        runsThisInning: 0,
        bases: { first: null, second: null, third: null },
        mode: 'defense',
        inningLog: newLog,
        pendingForceOut: null,
        battedThisCycle: newBatted,
        isLineupSet: newIsLineupSet,
      });
      get().startNextAtBat();
      return;
    }

    // 3 outs not reached — check if there are remaining runners
    const remainingRunners: PendingRunnerResolution['runnersToResolve'] = [];
    // Don't include the forced player or the batter
    if (newBases.third && newBases.third !== forcedPlayerId) {
      remainingRunners.push({ playerId: newBases.third, fromBase: 'third' });
    }
    if (newBases.second && newBases.second !== forcedPlayerId) {
      remainingRunners.push({ playerId: newBases.second, fromBase: 'second' });
    }
    if (newBases.first && newBases.first !== forcedPlayerId && newBases.first !== pending.batterId) {
      remainingRunners.push({ playerId: newBases.first, fromBase: 'first' });
    }

    if (remainingRunners.length === 0) {
      // No remaining runners — just finalize normally
      const completedAtBat = {
        ...state.currentAtBat,
        events: [...state.currentAtBat.events, { type: 'out' as const, outType: pending.outType, x: pending.x, y: pending.y }]
      };
      const { lineup, currentBatterIndex } = state;
      const { battedThisCycle: newBatted, isLineupSet: newIsLineupSet } = completeBatterCycle(state, state.currentAtBat.batterId);
      const nextIndex = (currentBatterIndex + 1) % Math.max(1, lineup.length);

      const logEntry: InningLogEntry = {
        inning: state.inning, isOffense: true, batterId: state.currentAtBat.batterId,
        batterName: getPlayerName(state, state.currentAtBat.batterId),
        result: pending.outType, details, rbis: 0, outsAfter: nextOuts
      };

      set({
        atBats: [...state.atBats, completedAtBat],
        currentAtBat: null,
        currentBatterIndex: nextIndex,
        outs: nextOuts,
        inning: state.inning,
        runsThisInning: state.runsThisInning,
        bases: newBases,
        mode: state.mode,
        inningLog: [...state.inningLog, logEntry],
        pendingForceOut: null,
        battedThisCycle: newBatted,
        isLineupSet: newIsLineupSet,
      });
      get().startNextAtBat();
      return;
    }

    // Remaining runners exist — enter resolution mode
    set({
      pendingRunnerResolution: {
        batterId: state.currentAtBat.batterId,
        hitType: 'forceout',
        runnersToResolve: remainingRunners,
        resolvedRunners: [],
        currentRunnerIndex: 0,
        batterPlaced: true,
        skipOutCount: true,
      },
      bases: newBases,
      outs: nextOuts,
      pendingForceOut: null,
    });
  },

  logOffensiveOut: (outType, x, y) => {
    const state = get();
    if (!state.currentAtBat) return;
    const newPast = pushUndo(state);

    let nextOuts = state.outs + 1;
    const nextInning = state.inning;
    let nextRuns = state.runsThisInning;
    let nextMode = state.mode;
    const newBases = { ...state.bases };

    const { lineup, currentBatterIndex, atBats, currentAtBat } = state;
    const { battedThisCycle: newBatted, isLineupSet: newIsLineupSet } = completeBatterCycle(state, currentAtBat.batterId);
    const nextIndex = (currentBatterIndex + 1) % Math.max(1, lineup.length);

    const completedAtBat = {
      ...currentAtBat,
      events: [...currentAtBat.events, { type: 'out' as const, outType, x, y }]
    };

    const logEntry: InningLogEntry = {
      inning: state.inning, isOffense: true, batterId: currentAtBat.batterId,
      batterName: getPlayerName(state, currentAtBat.batterId),
      result: outType, details: [], rbis: 0, outsAfter: nextOuts
    };

    if (nextOuts >= 3) {
      nextOuts = 0;
      nextMode = 'defense';
      nextRuns = 0;
      newBases.first = null;
      newBases.second = null;
      newBases.third = null;
    }

    const newLog = [...state.inningLog, logEntry];
    const advancedInning = nextMode === 'defense'
      ? advanceInningIfNeeded(nextInning, state.startingSide, 'offense')
      : nextInning;

    set({
      pastStates: newPast,
      outs: nextOuts,
      inning: advancedInning,
      runsThisInning: nextRuns,
      atBats: [...atBats, completedAtBat],
      currentAtBat: null,
      currentBatterIndex: nextIndex,
      bases: newBases,
      mode: nextMode,
      inningLog: newLog,
      battedThisCycle: newBatted,
      isLineupSet: newIsLineupSet,
    });
    get().startNextAtBat();
  },

  logOffensiveError: (trajectory, x, y) => {
    const state = get();
    if (!state.currentAtBat) return;

    // Check if there are runners on base — if so, use runner resolution prompt
    const runnersToResolve: PendingRunnerResolution['runnersToResolve'] = [];
    if (state.bases.third) runnersToResolve.push({ playerId: state.bases.third, fromBase: 'third' });
    if (state.bases.second) runnersToResolve.push({ playerId: state.bases.second, fromBase: 'second' });
    if (state.bases.first) runnersToResolve.push({ playerId: state.bases.first, fromBase: 'first' });

    if (runnersToResolve.length > 0) {
      // Has runners — enter resolution mode (same as hits).
      // Snapshot at start of play so undo wipes the whole error → resolution sequence.
      const newPast = pushUndo(state);
      set({
        pastStates: newPast,
        pendingRunnerResolution: {
          batterId: state.currentAtBat.batterId,
          hitType: 'error',
          trajectory, x, y,
          runnersToResolve,
          resolvedRunners: [],
          currentRunnerIndex: 0,
          batterPlaced: false,
        }
      });
      return;
    }

    // No runners on base — just place batter on first and move on
    const newPast = pushUndo(state);
    const { lineup, currentBatterIndex, atBats, currentAtBat } = state;
    const { battedThisCycle: newBatted, isLineupSet: newIsLineupSet } = completeBatterCycle(state, currentAtBat.batterId);
    const nextIndex = (currentBatterIndex + 1) % Math.max(1, lineup.length);

    const completedAtBat = {
      ...currentAtBat,
      events: [...currentAtBat.events, { type: 'error' as const, trajectory, x, y }]
    };

    const logEntry: InningLogEntry = {
      inning: state.inning, isOffense: true, batterId: currentAtBat.batterId,
      batterName: getPlayerName(state, currentAtBat.batterId),
      result: 'ROE', details: [], rbis: 0, outsAfter: state.outs
    };

    set({
      pastStates: newPast,
      atBats: [...atBats, completedAtBat],
      currentAtBat: null,
      currentBatterIndex: nextIndex,
      bases: { ...state.bases, first: currentAtBat.batterId },
      inningLog: [...state.inningLog, logEntry],
      battedThisCycle: newBatted,
      isLineupSet: newIsLineupSet,
    });
    get().startNextAtBat();
  },

  logDefensiveAction: (position, result) => {
    const state = get();
    const newPast = pushUndo(state);

    let nextOuts = state.outs;
    let nextRuns = state.runsThisInning;
    let nextMode = state.mode;
    let nextOpponentRunsInning = state.opponentRunsThisInning;

    if (result === 'Out') {
      nextOuts++;
      if (nextOuts >= 3) {
        nextOuts = 0;
        nextRuns = 0;
        nextOpponentRunsInning = 0;
        nextMode = 'offense';
      }
    }

    const playerId = state.defensiveAssignments[position] || null;
    const logEntry: InningLogEntry = {
      inning: state.inning, isOffense: false,
      result: `${position}: ${result}`,
      details: [],
      batterName: getPlayerName(state, playerId),
      rbis: 0, outsAfter: nextOuts
    };

    const newLog = [...state.inningLog, logEntry];
    // Advance inning when defense half-inning ends (3 outs)
    const nextInning = nextMode === 'offense'
      ? advanceInningIfNeeded(state.inning, state.startingSide, 'defense')
      : state.inning;

    set({
      pastStates: newPast,
      outs: nextOuts,
      inning: nextInning,
      runsThisInning: nextRuns,
      opponentRunsThisInning: nextOpponentRunsInning,
      mode: nextMode,
      defensiveActions: [...state.defensiveActions, { position, playerId, result }],
      inningLog: newLog,
    });

    if (nextMode === 'offense') {
      get().startNextAtBat();
    }
  },

  scoreRun: () => {
    const state = get();
    const newPast = pushUndo(state);
    let nextRunsInning = state.runsThisInning + 1;
    const nextRunsTotal = state.runsTotal + 1;
    let nextInning = state.inning;
    let nextOuts = state.outs;
    let nextMode = state.mode;

    if (nextRunsInning >= 5) {
      nextMode = 'defense';
      nextRunsInning = 0;
      nextOuts = 0;
      nextInning = advanceInningIfNeeded(state.inning, state.startingSide, 'offense');
    }

    set({
      pastStates: newPast,
      runsThisInning: nextRunsInning,
      runsTotal: nextRunsTotal,
      inning: nextInning,
      outs: nextOuts,
      mode: nextMode,
    });
  },

  scoreOpponentRun: () => {
    const state = get();
    const newPast = pushUndo(state);
    const nextOpponentRunsInning = state.opponentRunsThisInning + 1;
    const nextOpponentRunsTotal = state.opponentRunsTotal + 1;

    // If opponent hits 5 runs, auto-switch to offense
    if (nextOpponentRunsInning >= 5) {
      const nextInning = advanceInningIfNeeded(state.inning, state.startingSide, 'defense');
      set({
        pastStates: newPast,
        opponentRunsThisInning: 0,
        opponentRunsTotal: nextOpponentRunsTotal,
        mode: 'offense',
        inning: nextInning,
        outs: 0,
        runsThisInning: 0,
        bases: { first: null, second: null, third: null },
      });
      get().startNextAtBat();
      return;
    }

    set({
      pastStates: newPast,
      opponentRunsThisInning: nextOpponentRunsInning,
      opponentRunsTotal: nextOpponentRunsTotal,
    });
  },

  manualNextInning: () => {
    const state = get();
    const newPast = pushUndo(state);
    set({
      pastStates: newPast,
      inning: state.inning + 1,
      outs: 0,
      runsThisInning: 0,
      bases: { first: null, second: null, third: null },
    });
  },

  setManualInning: (inning) => {
    const state = get();
    const newPast = pushUndo(state);
    set({ pastStates: newPast, inning });
  },

  setCurrentBatterIndex: (index) => {
    const state = get();
    if (index < 0 || index >= state.lineup.length) return;
    const newPast = pushUndo(state);
    set({
      pastStates: newPast,
      currentBatterIndex: index,
      currentAtBat: state.currentAtBat ? {
        ...state.currentAtBat,
        batterId: state.lineup[index]
      } : null,
    });
  },

  manualSwitchToDefense: () => {
    const state = get();
    const newPast = pushUndo(state);
    const nextInning = advanceInningIfNeeded(state.inning, state.startingSide, 'offense');
    set({
      pastStates: newPast,
      mode: 'defense',
      inning: nextInning,
      outs: 0,
      runsThisInning: 0,
      opponentRunsThisInning: 0,
      bases: { first: null, second: null, third: null },
    });
  },

  manualSwitchToOffense: () => {
    const state = get();
    const newPast = pushUndo(state);
    const nextInning = advanceInningIfNeeded(state.inning, state.startingSide, 'defense');
    set({
      pastStates: newPast,
      mode: 'offense',
      inning: nextInning,
      outs: 0,
      runsThisInning: 0,
      opponentRunsThisInning: 0,
      bases: { first: null, second: null, third: null },
    });
    get().startNextAtBat();
  },

  deleteHistoricalGame: (id) => set((state) => {
    // Fire-and-forget sync to Supabase (CASCADE deletes related rows)
    deleteGameFromSupabase(id);
    return { gameHistory: state.gameHistory.filter(g => g.id !== id) };
  }),

  toggleGameExclusion: (id) => set((state) => {
    const game = state.gameHistory.find(g => g.id === id);
    const newExcluded = game ? !game.excluded : false;
    // Fire-and-forget sync to Supabase
    toggleGameExclusionInSupabase(id, newExcluded);
    return { gameHistory: state.gameHistory.map(g => g.id === id ? { ...g, excluded: newExcluded } : g) };
  }),

  updateHistoricalGameScore: (id, fields) => set((state) => {
    // Fire-and-forget sync to Supabase
    updateGameScoreInSupabase(id, fields);
    return {
      gameHistory: state.gameHistory.map(g =>
        g.id === id ? {
          ...g,
          ...(fields.opponent !== undefined && { opponent: fields.opponent }),
          ...(fields.runsScored !== undefined && { runsScored: fields.runsScored }),
          ...(fields.opponentScore !== undefined && { opponentScore: fields.opponentScore }),
        } : g
      ),
    };
  }),

  updateInningLogEntries: (indices, newInning) => set((state) => {
    const newLog = [...state.inningLog];
    indices.forEach(i => {
      if (i >= 0 && i < newLog.length) newLog[i] = { ...newLog[i], inning: newInning };
    });
    return { inningLog: newLog, inning: Math.max(state.inning, computeNextInning(newLog)) };
  }),

  updateInningLogEntry: (index, fields) => set((state) => {
    const newLog = [...state.inningLog];
    if (index >= 0 && index < newLog.length) {
      newLog[index] = { ...newLog[index], ...fields };
    }
    return { inningLog: newLog };
  }),

  updateHistoricalInningLogEntry: (gameId, entryIndex, fields) => set((state) => {
    const newHistory = state.gameHistory.map(g => {
      if (g.id !== gameId) return g;
      const newLog = [...(g.inningLog ?? [])];
      if (entryIndex >= 0 && entryIndex < newLog.length) {
        newLog[entryIndex] = { ...newLog[entryIndex], ...fields };
      }
      // Fire-and-forget sync to Supabase
      updateInningLogInSupabase(gameId, newLog);
      return { ...g, inningLog: newLog };
    });
    return { gameHistory: newHistory };
  }),

  endAndSaveGame: (opponentName, opponentScore) => {
    const state = get();
    const newGame: HistoricalGame = {
      id: uuidv4(),
      date: new Date().toISOString(),
      opponent: opponentName || 'Unknown Opponent',
      runsScored: state.runsTotal,
      opponentScore,
      opponentRunsTotal: state.opponentRunsTotal,
      atBats: state.atBats,
      defensiveActions: state.defensiveActions,
      inningLog: state.inningLog,
    };
    // Fire-and-forget sync to Supabase
    saveGameToSupabase(newGame);
    set({
      gameHistory: [...state.gameHistory, newGame],
      gameStarted: false, mode: 'lineup', inning: 1, outs: 0,
      runsThisInning: 0, runsTotal: 0, opponentRunsThisInning: 0, opponentRunsTotal: 0,
      bases: { first: null, second: null, third: null },
      lineup: [], currentBatterIndex: 0, currentAtBat: null, isLineupSet: false,
      atBats: [], defensiveAssignments: {}, defensiveActions: [],
      pastStates: [], inningLog: [], battedThisCycle: [],
      pendingRunnerResolution: null, pendingForceOut: null,
    });
  },

  injectMockGame: () => {
    const mockRoster = [
      { id: uuidv4(), name: 'Caleb C.' },
      { id: uuidv4(), name: 'Johnny M.' },
      { id: uuidv4(), name: 'Tommy B.' },
      { id: uuidv4(), name: 'Bobby T.' },
      { id: uuidv4(), name: 'Jimmy K.' },
      { id: uuidv4(), name: 'Ricky R.' },
      { id: uuidv4(), name: 'Danny F.' },
      { id: uuidv4(), name: 'Mikey G.' },
      { id: uuidv4(), name: 'Sammy S.' },
      { id: uuidv4(), name: 'Joey Trib.' }
    ];
    const lineup = mockRoster.map(p => p.id);
    const defPositions = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'LC', 'RC', 'RF'];
    const mockDefAssignments: Record<string, string | null> = {};
    defPositions.forEach((pos, i) => { mockDefAssignments[pos] = lineup[i] || null; });

    const mockAtBats: AtBatState[] = [];
    const mockDefActions: { position: string; playerId: string | null; result: DefensiveEvent }[] = [];
    const mockLog: InningLogEntry[] = [];
    let mockRunsTotal = 0;
    let currentOuts = 0, currentInning = 1, runsThisInning = 0, batterIndex = 0;

    const hitTypes: HitType[] = ['1B', '2B', '3B', 'HR'];
    const trajectories: HitTrajectory[] = ['Grounder', 'Blooper', 'Line Drive'];
    const outTypes: OutType[] = ['Strikeout', 'Groundout', 'Flyout', 'Forceout'];
    const defResults: DefensiveEvent[] = ['Out', 'Out', 'Fielded Cleanly', 'Fielding Error', 'Throwing Error'];
    const fieldPos = ['1B', '2B', 'SS', '3B', 'P', 'LF', 'RF'];

    const genCoord = () => {
      const angle = (Math.random() * 90 + 45) * Math.PI / 180;
      const dist = 15 + Math.random() * 45;
      return { x: 50 + Math.cos(angle) * dist * 0.7, y: 87 - Math.sin(angle) * dist };
    };

    while (currentInning <= 6) {
      // Offense half
      currentOuts = 0; runsThisInning = 0;
      while (currentOuts < 3 && runsThisInning < 5) {
        const batterId = lineup[batterIndex];
        const pitchCount = 2 + Math.floor(Math.random() * 4);
        const strikeCount = Math.min(pitchCount - 1, 1 + Math.floor(Math.random() * 2));
        const isHit = Math.random() > 0.55;
        const events: AtBatEvent[] = [];
        for (let p = 0; p < pitchCount - 1; p++) {
          events.push({ type: 'pitch', result: (['strike', 'no-swing', 'foul'] as const)[Math.floor(Math.random() * 3)] });
        }
        const { x, y } = genCoord();
        let result = '';
        if (isHit) {
          const ht = hitTypes[Math.floor(Math.random() * 4)];
          events.push({ type: 'hit', hitType: ht, trajectory: trajectories[Math.floor(Math.random() * 3)], x, y });
          runsThisInning++; mockRunsTotal++; result = ht;
        } else {
          const ot = outTypes[Math.floor(Math.random() * outTypes.length)];
          events.push({ type: 'out', outType: ot, x, y });
          currentOuts++; result = ot;
        }
        mockAtBats.push({ batterId, inning: currentInning, pitches: pitchCount, strikes: strikeCount, events });
        const bName = mockRoster.find(r => r.id === batterId)?.name || '';
        mockLog.push({ inning: currentInning, isOffense: true, batterId, batterName: bName, result, details: [], rbis: isHit ? 1 : 0, outsAfter: currentOuts });
        batterIndex = (batterIndex + 1) % 10;
      }

      // Defense half
      currentOuts = 0;
      while (currentOuts < 3) {
        const fp = fieldPos[Math.floor(Math.random() * fieldPos.length)];
        const pid = mockDefAssignments[fp] || lineup[0];
        const dr = defResults[Math.floor(Math.random() * defResults.length)];
        mockDefActions.push({ position: fp, playerId: pid, result: dr });
        if (dr === 'Out') currentOuts++;
        const pName = mockRoster.find(r => r.id === pid)?.name || '';
        mockLog.push({ inning: currentInning, isOffense: false, batterName: pName, result: `${fp}: ${dr}`, details: [], rbis: 0, outsAfter: currentOuts });
      }

      currentInning++;
    }

    set({
      gameStarted: true, mode: 'dashboard', inning: 6, outs: 0,
      runsThisInning: 0, runsTotal: mockRunsTotal,
      opponentRunsThisInning: 0, opponentRunsTotal: 0,
      bases: { first: null, second: null, third: null },
      roster: mockRoster, lineup, currentBatterIndex: batterIndex,
      currentAtBat: null, atBats: mockAtBats,
      defensiveAssignments: mockDefAssignments,
      defensiveActions: mockDefActions,
      pastStates: [], inningLog: mockLog,
      pendingRunnerResolution: null, pendingForceOut: null,
    });
  },
}),
    {
      name: 'dodgers-stats-storage-v2', // New storage key to avoid conflicts with old data
    }
  )
);

// Attach to window for dev debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).useGameStore = useGameStore;
}

