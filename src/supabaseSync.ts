/**
 * Supabase Sync Layer for Dodgers Game Tracker
 *
 * Strategy:
 * - Players: synced on load + on add/remove
 * - Games: saved to Supabase when "End & Save Game" is called
 * - Live game state (at-bats, outs, bases): stays in localStorage only during play
 * - Coach view: reads directly from Supabase
 *
 * This keeps things fast during a game (no network calls on every pitch)
 * while ensuring all finished game data is backed up in the cloud.
 */

import { supabase } from './supabase';
import type { Player, AtBatState, InningLogEntry, DefensiveEvent, HistoricalGame } from './store';
import { useGameStore } from './store';

// ── Init: pull cloud data and merge with localStorage on app start ─────────

export async function initSupabaseSync(): Promise<void> {
  try {
    const [cloudPlayers, cloudGames] = await Promise.all([
      fetchPlayers(),
      fetchGameHistory(),
    ]);

    const state = useGameStore.getState();

    // Merge players: cloud is source of truth, but keep any local-only players
    // (in case they were added offline and haven't synced yet)
    const cloudPlayerIds = new Set(cloudPlayers.map(p => p.id));
    const localOnlyPlayers = state.roster.filter(p => !cloudPlayerIds.has(p.id));

    // Push any local-only players to Supabase
    for (const p of localOnlyPlayers) {
      upsertPlayer(p);
    }

    const mergedRoster = [...cloudPlayers, ...localOnlyPlayers];

    // Merge game history: use cloud as source of truth, keep local-only games
    const cloudGameIds = new Set(cloudGames.map(g => g.id));
    const localOnlyGames = state.gameHistory.filter(g => !cloudGameIds.has(g.id));

    // Push any local-only games to Supabase
    for (const g of localOnlyGames) {
      saveGameToSupabase(g);
    }

    const mergedHistory = [...cloudGames, ...localOnlyGames];

    // Update store with merged data
    useGameStore.setState({
      roster: mergedRoster,
      gameHistory: mergedHistory,
      // Update lineup to only include players still in roster
      lineup: state.lineup.filter(id => mergedRoster.some(p => p.id === id)),
    });

    console.log(`Supabase sync complete: ${mergedRoster.length} players, ${mergedHistory.length} games`);
  } catch (err) {
    console.error('Supabase sync failed (app will use localStorage):', err);
  }
}

// ── Player Sync ────────────────────────────────────────────────────────────

export async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, name')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch players:', error.message);
    return [];
  }
  return data ?? [];
}

export async function upsertPlayer(player: Player): Promise<void> {
  const { error } = await supabase
    .from('players')
    .upsert({ id: player.id, name: player.name }, { onConflict: 'id' });

  if (error) console.error('Failed to upsert player:', error.message);
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', id);

  if (error) console.error('Failed to delete player:', error.message);
}

// ── Game Sync ──────────────────────────────────────────────────────────────

export async function saveGameToSupabase(
  game: HistoricalGame
): Promise<void> {
  // 1. Insert the game record
  const { error: gameError } = await supabase
    .from('games')
    .upsert({
      id: game.id,
      date: game.date,
      opponent: game.opponent,
      runs_scored: game.runsScored,
      opponent_score: game.opponentScore,
      excluded: game.excluded ?? false,
    }, { onConflict: 'id' });

  if (gameError) {
    console.error('Failed to save game:', gameError.message);
    return;
  }

  // 2. Insert at-bats
  if (game.atBats.length > 0) {
    const atBatRows = game.atBats.map((ab: AtBatState, i: number) => ({
      game_id: game.id,
      batter_id: ab.batterId,
      inning: ab.inning,
      pitches: ab.pitches,
      strikes: ab.strikes,
      events: ab.events,
      bat_order: i,
    }));

    const { error: abError } = await supabase
      .from('at_bats')
      .insert(atBatRows);

    if (abError) console.error('Failed to save at-bats:', abError.message);
  }

  // 3. Insert defensive actions
  if (game.defensiveActions.length > 0) {
    const defRows = game.defensiveActions.map((da: { position: string; playerId: string | null; result: DefensiveEvent }, i: number) => ({
      game_id: game.id,
      player_id: da.playerId,
      position: da.position,
      result: da.result,
      action_order: i,
    }));

    const { error: defError } = await supabase
      .from('defensive_actions')
      .insert(defRows);

    if (defError) console.error('Failed to save defensive actions:', defError.message);
  }

  // 4. Insert inning log
  if (game.inningLog.length > 0) {
    const logRows = game.inningLog.map((entry: InningLogEntry, i: number) => ({
      game_id: game.id,
      inning: entry.inning,
      is_offense: entry.isOffense,
      batter_id: entry.batterId ?? null,
      batter_name: entry.batterName ?? null,
      result: entry.result,
      details: entry.details,
      rbis: entry.rbis,
      outs_after: entry.outsAfter,
      log_order: i,
    }));

    const { error: logError } = await supabase
      .from('inning_log')
      .insert(logRows);

    if (logError) console.error('Failed to save inning log:', logError.message);
  }

  console.log(`Game vs ${game.opponent} saved to Supabase`);
}

export async function fetchGameHistory(): Promise<HistoricalGame[]> {
  // Fetch all games
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .order('date', { ascending: true });

  if (gamesError) {
    console.error('Failed to fetch games:', gamesError.message);
    return [];
  }

  if (!games || games.length === 0) return [];

  const gameIds = games.map(g => g.id);

  // Fetch all related data in parallel
  const [atBatsResult, defActionsResult, inningLogResult] = await Promise.all([
    supabase.from('at_bats').select('*').in('game_id', gameIds).order('bat_order', { ascending: true }),
    supabase.from('defensive_actions').select('*').in('game_id', gameIds).order('action_order', { ascending: true }),
    supabase.from('inning_log').select('*').in('game_id', gameIds).order('log_order', { ascending: true }),
  ]);

  // Group by game_id
  const atBatsByGame: Record<string, AtBatState[]> = {};
  (atBatsResult.data ?? []).forEach(row => {
    if (!atBatsByGame[row.game_id]) atBatsByGame[row.game_id] = [];
    atBatsByGame[row.game_id].push({
      batterId: row.batter_id,
      inning: row.inning,
      pitches: row.pitches,
      strikes: row.strikes,
      events: row.events,
    });
  });

  const defActionsByGame: Record<string, { position: string; playerId: string | null; result: DefensiveEvent }[]> = {};
  (defActionsResult.data ?? []).forEach(row => {
    if (!defActionsByGame[row.game_id]) defActionsByGame[row.game_id] = [];
    defActionsByGame[row.game_id].push({
      position: row.position,
      playerId: row.player_id,
      result: row.result as DefensiveEvent,
    });
  });

  const inningLogByGame: Record<string, InningLogEntry[]> = {};
  (inningLogResult.data ?? []).forEach(row => {
    if (!inningLogByGame[row.game_id]) inningLogByGame[row.game_id] = [];
    inningLogByGame[row.game_id].push({
      inning: row.inning,
      isOffense: row.is_offense,
      batterId: row.batter_id ?? undefined,
      batterName: row.batter_name ?? undefined,
      result: row.result,
      details: row.details,
      rbis: row.rbis,
      outsAfter: row.outs_after,
    });
  });

  // Assemble HistoricalGame objects
  return games.map(g => ({
    id: g.id,
    date: g.date,
    opponent: g.opponent,
    runsScored: g.runs_scored,
    opponentScore: g.opponent_score,
    atBats: atBatsByGame[g.id] ?? [],
    defensiveActions: defActionsByGame[g.id] ?? [],
    inningLog: inningLogByGame[g.id] ?? [],
    excluded: g.excluded,
  }));
}

export async function deleteGameFromSupabase(id: string): Promise<void> {
  // CASCADE will handle at_bats, defensive_actions, inning_log
  const { error } = await supabase
    .from('games')
    .delete()
    .eq('id', id);

  if (error) console.error('Failed to delete game:', error.message);
}

export async function updateInningLogInSupabase(gameId: string, inningLog: InningLogEntry[]): Promise<void> {
  // Delete all existing log entries for this game, then re-insert
  const { error: delError } = await supabase
    .from('inning_log')
    .delete()
    .eq('game_id', gameId);

  if (delError) {
    console.error('Failed to delete inning log for update:', delError.message);
    return;
  }

  if (inningLog.length > 0) {
    const logRows = inningLog.map((entry: InningLogEntry, i: number) => ({
      game_id: gameId,
      inning: entry.inning,
      is_offense: entry.isOffense,
      batter_id: entry.batterId ?? null,
      batter_name: entry.batterName ?? null,
      result: entry.result,
      details: entry.details,
      rbis: entry.rbis,
      outs_after: entry.outsAfter,
      log_order: i,
    }));

    const { error: insError } = await supabase
      .from('inning_log')
      .insert(logRows);

    if (insError) console.error('Failed to re-insert inning log:', insError.message);
  }
}

export async function updateGameScoreInSupabase(id: string, fields: { opponent?: string; runsScored?: number; opponentScore?: number }): Promise<void> {
  const updateObj: Record<string, unknown> = {};
  if (fields.opponent !== undefined) updateObj.opponent = fields.opponent;
  if (fields.runsScored !== undefined) updateObj.runs_scored = fields.runsScored;
  if (fields.opponentScore !== undefined) updateObj.opponent_score = fields.opponentScore;

  const { error } = await supabase
    .from('games')
    .update(updateObj)
    .eq('id', id);

  if (error) console.error('Failed to update game score:', error.message);
}

export async function toggleGameExclusionInSupabase(id: string, excluded: boolean): Promise<void> {
  const { error } = await supabase
    .from('games')
    .update({ excluded })
    .eq('id', id);

  if (error) console.error('Failed to toggle game exclusion:', error.message);
}
