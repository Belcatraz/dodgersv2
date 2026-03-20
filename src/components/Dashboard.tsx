import { useGameStore } from '../store';
import type { AtBatState, InningLogEntry, HistoricalGame } from '../store';
import { useMemo, useState } from 'react';
import { isCoachView, coachViewUrl } from '../isCoachView';

// ── Spray chart helpers ──────────────────────────────────────────────────────

type HitPlot = { x: number; y: number; type: string; trajectory?: string; hitType?: string };

function extractHits(abs: AtBatState[]): HitPlot[] {
  const hits: HitPlot[] = [];
  abs.forEach(ab => {
    ab.events.forEach(ev => {
      if ((ev.type === 'hit' || ev.type === 'out' || ev.type === 'error') && ev.x !== undefined && ev.y !== undefined) {
        hits.push({
          x: ev.x, y: ev.y, type: ev.type,
          trajectory: 'trajectory' in ev ? (ev as { trajectory?: string }).trajectory : undefined,
          hitType: ev.type === 'hit' ? (ev as { hitType?: string }).hitType : undefined,
        });
      }
    });
  });
  return hits;
}

function SprayChart({ hits }: { hits: HitPlot[] }) {
  let s1 = 0, s2 = 0, s3 = 0, hr = 0, o = 0, e = 0;
  hits.forEach(h => {
    if (h.type === 'hit') { if (h.hitType === '1B') s1++; else if (h.hitType === '2B') s2++; else if (h.hitType === '3B') s3++; else if (h.hitType === 'HR') hr++; }
    else if (h.type === 'out') o++;
    else if (h.type === 'error') e++;
  });
  return (
    <>
      <div style={{ width: '100%', backgroundColor: '#2e7d32', borderRadius: '10px' }}>
        <svg viewBox="-6 8 112 92" style={{ width: '100%', display: 'block' }}>
          <rect x="-10" y="0" width="120" height="110" fill="#2e7d32" />
          <path d="M 50,87 L 5,35 A 55 55 0 0 1 95 35 Z" fill="#e0a96d" />
          <path d="M 50,30 L 72,52 L 50,75 L 28,52 Z" fill="#2e7d32" />
          <line x1="50" y1="87" x2="0" y2="35" stroke="white" strokeWidth="0.5" />
          <line x1="50" y1="87" x2="100" y2="35" stroke="white" strokeWidth="0.5" />
          <polygon points="50,88 52,86 52,84 48,84 48,86" fill="white" />
          {hits.map((h, i) => {
            const color = h.type === 'hit' ? '#4caf50' : h.type === 'error' ? '#ff9800' : '#ef5350';
            const dash = h.trajectory === 'Grounder' ? '2,2' : h.trajectory === 'Blooper' ? '0.5,2' : '';
            return (
              <g key={i}>
                <line x1="50" y1="87" x2={h.x} y2={h.y} stroke={color} strokeWidth="1.2" strokeDasharray={dash} strokeLinecap="round" opacity={0.85} />
                <circle cx={h.x} cy={h.y} r="2" fill={color} stroke="white" strokeWidth="0.4" />
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '4px' }}>
        <span>{s1}1B {s2}2B {s3}3B {hr}HR</span>
        <span>{o} Outs · {e} Reached on Error</span>
      </div>
    </>
  );
}

// ── Batter picker (native select, dark-styled) ───────────────────────────────

function BatterSelect({ players, value, onChange }: {
  players: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '10px', marginBottom: '6px', backgroundColor: 'var(--bg-card)', color: 'white', borderRadius: '8px', border: '1px solid #333', fontSize: '0.95rem' }}>
      {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

// ── Patience helpers ─────────────────────────────────────────────────────────

// takeRate = fraction of pitches NOT swung at (no-swing / total pitches seen)
function patienceColor(takeRate: number): string {
  if (takeRate >= 0.5) return '#4caf50';
  if (takeRate >= 0.25) return '#ff9800';
  return '#ef5350';
}

function patienceLabel(takeRate: number): string {
  if (takeRate >= 0.5) return 'Patient';
  if (takeRate >= 0.25) return 'Average';
  return 'Aggressive';
}

function countPitchTypes(abs: AtBatState[]): { takes: number; total: number } {
  let takes = 0, total = 0;
  abs.forEach(ab => {
    ab.events.forEach(ev => {
      if (ev.type === 'pitch') {
        total++;
        if (ev.result === 'no-swing') takes++;
      }
    });
  });
  return { takes, total };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

type ViewTab = 'stats' | 'log' | 'season' | 'history';

export default function Dashboard() {
  const { roster, atBats, gameStarted, endAndSaveGame, gameHistory, inningLog, deleteHistoricalGame, updateInningLogEntries, toggleGameExclusion } = useGameStore();

  const coachView = isCoachView();
  const [activeTab, setActiveTab] = useState<ViewTab>(coachView ? 'season' : 'stats');
  const [endGameMode, setEndGameMode] = useState(false);
  const [opponentName, setOpponentName] = useState('');
  const [opponentScore, setOpponentScore] = useState('');

  // Current-game spray chart
  const [selectedBatter, setSelectedBatter] = useState('');

  // Season spray chart
  const [seasonBatter, setSeasonBatter] = useState('');

  // History
  const [selectedHistoryGame, setSelectedHistoryGame] = useState<HistoricalGame | null>(null);
  const [historyDetailTab, setHistoryDetailTab] = useState<'log' | 'stats'>('log');
  const [historySprayBatter, setHistorySprayBatter] = useState('');

  // Game log editing
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [editingInning, setEditingInning] = useState(1);

  // Delete confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleEndGame = () => {
    if (opponentName.trim()) {
      endAndSaveGame(opponentName.trim(), parseInt(opponentScore) || 0);
      setEndGameMode(false);
      setOpponentName('');
      setOpponentScore('');
    }
  };

  // ── Current-game batting stats ─────────────────────────────────────────────
  const battingStats = useMemo(() => {
    return roster.map(p => {
      const playerABs = atBats.filter(ab => ab.batterId === p.id);
      let hits = 0, singles = 0, doubles = 0, triples = 0, hrs = 0, totalPitches = 0, rbis = 0;
      playerABs.forEach(ab => {
        totalPitches += ab.pitches;
        ab.events.forEach(ev => {
          if (ev.type === 'hit') {
            hits++;
            if (ev.hitType === '1B') singles++;
            if (ev.hitType === '2B') doubles++;
            if (ev.hitType === '3B') triples++;
            if (ev.hitType === 'HR') hrs++;
          }
        });
      });
      inningLog.filter(e => e.batterId === p.id && e.isOffense).forEach(e => { rbis += e.rbis; });
      const { takes, total: pitchTotal } = countPitchTypes(playerABs);
      const abCount = playerABs.length;
      return { id: p.id, name: p.name, ab: abCount, hits, avg: abCount > 0 ? (hits / abCount).toFixed(3) : '.000', singles, doubles, triples, hrs, totalPitches, ppa: abCount > 0 ? (totalPitches / abCount).toFixed(1) : '0.0', rbis, takeRate: pitchTotal > 0 ? takes / pitchTotal : 0, pitchTotal };
    }).filter(s => s.ab > 0 || roster.length <= 15);
  }, [atBats, roster, inningLog]);

  const activeBatter = selectedBatter || roster[0]?.id || '';
  const currentGameHits = useMemo(() => extractHits(atBats.filter(ab => ab.batterId === activeBatter)), [atBats, activeBatter]);

  // ── Inning log grouped ─────────────────────────────────────────────────────
  const groupedLog = useMemo(() => {
    const groups: { key: string; inning: number; isOffense: boolean; entries: InningLogEntry[]; indices: number[] }[] = [];
    let currentGroupingKey = '';
    inningLog.forEach((entry, idx) => {
      const groupingKey = `${entry.inning}-${entry.isOffense}`;
      if (groupingKey !== currentGroupingKey) {
        groups.push({ key: `${groupingKey}-${groups.length}`, inning: entry.inning, isOffense: entry.isOffense, entries: [entry], indices: [idx] });
        currentGroupingKey = groupingKey;
      } else {
        groups[groups.length - 1].entries.push(entry);
        groups[groups.length - 1].indices.push(idx);
      }
    });
    return groups;
  }, [inningLog]);

  // ── Season stats (non-excluded historical games + current) ────────────────
  const includedGames = gameHistory.filter(g => !g.excluded);
  const excludedCount = gameHistory.length - includedGames.length;

  const { seasonStats, seasonPlayerList } = useMemo(() => {
    const allAtBats = [...includedGames.flatMap(g => g.atBats), ...atBats];
    const allLogs = [...includedGames.flatMap(g => g.inningLog ?? []), ...inningLog];

    // Build name map: roster first, then fill from inning logs
    const nameMap: Record<string, string> = {};
    roster.forEach(p => { nameMap[p.id] = p.name; });
    allLogs.forEach(e => { if (e.batterId && e.batterName && !nameMap[e.batterId]) nameMap[e.batterId] = e.batterName; });

    const statMap: Record<string, { name: string; ab: number; hits: number; singles: number; doubles: number; triples: number; hrs: number; rbis: number; totalPitches: number; takes: number; pitchTotal: number }> = {};
    allAtBats.forEach(ab => {
      if (!statMap[ab.batterId]) statMap[ab.batterId] = { name: nameMap[ab.batterId] ?? '?', ab: 0, hits: 0, singles: 0, doubles: 0, triples: 0, hrs: 0, rbis: 0, totalPitches: 0, takes: 0, pitchTotal: 0 };
      const s = statMap[ab.batterId];
      s.ab++;
      s.totalPitches += ab.pitches;
      ab.events.forEach(ev => {
        if (ev.type === 'hit') { s.hits++; if (ev.hitType === '1B') s.singles++; else if (ev.hitType === '2B') s.doubles++; else if (ev.hitType === '3B') s.triples++; else if (ev.hitType === 'HR') s.hrs++; }
        if (ev.type === 'pitch') { s.pitchTotal++; if (ev.result === 'no-swing') s.takes++; }
      });
    });
    allLogs.filter(e => e.isOffense && e.batterId).forEach(e => { if (statMap[e.batterId!]) statMap[e.batterId!].rbis += e.rbis; });

    const seasonStats = Object.entries(statMap).map(([id, s]) => ({ id, ...s, avg: s.ab > 0 ? (s.hits / s.ab).toFixed(3) : '.000', ppa: s.ab > 0 ? (s.totalPitches / s.ab).toFixed(1) : '0.0', takeRate: s.pitchTotal > 0 ? s.takes / s.pitchTotal : 0 })).sort((a, b) => b.ab - a.ab);
    const seasonPlayerList = seasonStats.map(s => ({ id: s.id, name: s.name }));
    return { seasonStats, seasonPlayerList };
  }, [includedGames, atBats, inningLog, roster]);

  const activeSeasonBatter = seasonBatter || seasonPlayerList[0]?.id || '';
  const seasonHits = useMemo(() => {
    const allAtBats = [...includedGames.flatMap(g => g.atBats), ...atBats].filter(ab => ab.batterId === activeSeasonBatter);
    return extractHits(allAtBats);
  }, [includedGames, atBats, activeSeasonBatter]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-col p-md h-full overflow-y-auto" style={{ gap: '12px', paddingBottom: '24px' }}>

      {/* Tab Bar */}
      <div className="flex-row" style={{ backgroundColor: 'var(--bg-card)', borderRadius: '10px', padding: '3px', gap: '3px' }}>
        {(coachView ? ['season', 'history'] : ['stats', 'log', 'season', 'history'] as ViewTab[]).map(tab => (
          <button key={tab}
            className={`huge-btn flex-1 ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            style={{ height: '34px', fontSize: '0.7rem', border: 'none' }}
            onClick={() => { setActiveTab(tab as ViewTab); if (tab !== 'history') setSelectedHistoryGame(null); }}
          >
            {tab === 'stats' ? 'Stats' : tab === 'log' ? 'Game Log' : tab === 'season' ? `Season${excludedCount > 0 ? ` (${includedGames.length})` : ''}` : `History (${gameHistory.length})`}
          </button>
        ))}
      </div>

      {/* Coach link (owner only) */}
      {!coachView && (activeTab === 'season' || activeTab === 'history') && (
        <button
          onClick={() => navigator.clipboard.writeText(coachViewUrl()).then(() => alert('Coach link copied!'))}
          style={{ background: 'none', border: '1px solid #333', color: '#555', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.7rem', alignSelf: 'flex-end' }}
        >
          Copy coach-view link
        </button>
      )}

      {/* ===== STATS VIEW ===== */}
      {activeTab === 'stats' && (
        <>
          {gameStarted && !coachView && (
            !endGameMode ? (
              <button className="huge-btn btn-danger w-full" onClick={() => setEndGameMode(true)} style={{ height: '40px', fontSize: '0.875rem' }}>
                End & Save Game
              </button>
            ) : (
              <div className="flex-col gap-sm" style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Save game as:</span>
                <div className="flex-row gap-sm">
                  <input type="text" value={opponentName} onChange={e => setOpponentName(e.target.value)}
                    placeholder="Opponent name" autoFocus
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-dark)', color: 'white', border: '1px solid #444', fontSize: '1rem' }} />
                </div>
                <div className="flex-row gap-sm items-center">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Their final score:</span>
                  <input type="number" min="0" value={opponentScore} onChange={e => setOpponentScore(e.target.value)}
                    placeholder="0"
                    style={{ width: '72px', padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-dark)', color: 'white', border: '1px solid #444', fontSize: '1rem', textAlign: 'center' }} />
                  <button className="huge-btn btn-primary" style={{ height: '44px', padding: '0 16px', width: 'auto', fontSize: '0.875rem', flex: 1 }} onClick={handleEndGame}>Save</button>
                  <button className="huge-btn btn-secondary" style={{ height: '44px', padding: '0 12px', width: 'auto', fontSize: '0.875rem' }} onClick={() => { setEndGameMode(false); setOpponentName(''); setOpponentScore(''); }}>✕</button>
                </div>
              </div>
            )
          )}

          <section>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Batting</h3>
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #333' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '420px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>Player</th>
                    <th style={{ padding: '6px 3px', textAlign: 'center' }}>AB</th>
                    <th style={{ padding: '6px 3px', textAlign: 'center' }}>H</th>
                    <th style={{ padding: '6px 3px', textAlign: 'center' }}>AVG</th>
                    <th style={{ padding: '6px 3px', textAlign: 'center' }}>1B</th>
                    <th style={{ padding: '6px 3px', textAlign: 'center' }}>2B</th>
                    <th style={{ padding: '6px 3px', textAlign: 'center' }}>3B</th>
                    <th style={{ padding: '6px 3px', textAlign: 'center' }}>HR</th>
                    <th style={{ padding: '6px 3px', textAlign: 'center' }}>RBI</th>
                    <th style={{ padding: '6px 3px', textAlign: 'center' }}>Take%</th>
                  </tr>
                </thead>
                <tbody>
                  {battingStats.map((s, i) => (
                    <tr key={s.id} style={{ borderTop: '1px solid #2a2a2a', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '5px 4px', fontWeight: 'bold', whiteSpace: 'nowrap', position: 'sticky', left: 0, backgroundColor: i % 2 === 0 ? 'var(--bg-dark)' : '#1a1a1a', zIndex: 1 }}>{s.name}</td>
                      <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.ab}</td>
                      <td style={{ padding: '5px 3px', textAlign: 'center', color: '#4caf50' }}>{s.hits}</td>
                      <td style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 'bold' }}>{s.avg}</td>
                      <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.singles}</td>
                      <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.doubles}</td>
                      <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.triples}</td>
                      <td style={{ padding: '5px 3px', textAlign: 'center', color: s.hrs > 0 ? '#ff9800' : 'inherit' }}>{s.hrs}</td>
                      <td style={{ padding: '5px 3px', textAlign: 'center', color: s.rbis > 0 ? '#4caf50' : 'var(--text-secondary)' }}>{s.rbis}</td>
                      <td style={{ padding: '5px 3px', textAlign: 'center' }}>
                        <span style={{ color: patienceColor(s.takeRate), fontWeight: 'bold' }}>{Math.round(s.takeRate * 100)}%</span>
                        <div style={{ fontSize: '0.55rem', color: patienceColor(s.takeRate), opacity: 0.85 }}>{patienceLabel(s.takeRate)}</div>
                        {s.pitchTotal > 0 && <div style={{ fontSize: '0.5rem', color: 'var(--text-secondary)' }}>{s.ppa} pit/ab</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Spray Chart</h3>
            {roster.length > 0 && <BatterSelect players={roster} value={activeBatter} onChange={setSelectedBatter} />}
            <SprayChart hits={currentGameHits} />
          </section>

        </>
      )}

      {/* ===== GAME LOG VIEW ===== */}
      {activeTab === 'log' && (
        <section>
          {groupedLog.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', marginTop: '24px' }}>No plays recorded yet.</p>
          ) : (
            <div className="flex-col" style={{ gap: '12px' }}>
              {groupedLog.map(group => {
                const isEditing = editingGroupKey === group.key;
                const color = group.isOffense ? '#4caf50' : '#2196f3';
                return (
                  <div key={group.key}>
                    <div style={{
                      fontSize: '0.75rem', fontWeight: 'bold', color,
                      padding: '4px 8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '4px',
                      borderLeft: `3px solid ${color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>Inning</span>
                          <button onClick={() => setEditingInning(v => Math.max(1, v - 1))}
                            style={{ background: '#333', border: 'none', color: 'white', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>−</button>
                          <span style={{ minWidth: '20px', textAlign: 'center', fontSize: '1rem' }}>{editingInning}</span>
                          <button onClick={() => setEditingInning(v => v + 1)}
                            style={{ background: '#333', border: 'none', color: 'white', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>+</button>
                          <span>— {group.isOffense ? 'Offense' : 'Defense'}</span>
                        </div>
                      ) : (
                        <span>Inning {group.inning} — {group.isOffense ? 'Offense' : 'Defense'}</span>
                      )}
                      {!coachView && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {isEditing ? (
                            <>
                              <button onClick={() => { updateInningLogEntries(group.indices, editingInning); setEditingGroupKey(null); }}
                                style={{ background: '#4caf50', border: 'none', color: 'white', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>✓</button>
                              <button onClick={() => setEditingGroupKey(null)}
                                style={{ background: '#555', border: 'none', color: 'white', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                            </>
                          ) : (
                            <button onClick={() => { setEditingGroupKey(group.key); setEditingInning(group.inning); }}
                              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 4px' }}>✎ edit</button>
                          )}
                        </div>
                      )}
                    </div>
                    {group.entries.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 8px 4px 16px', fontSize: '0.8rem', borderBottom: '1px solid #1a1a1a' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>
                            <span style={{ fontWeight: 'bold' }}>{entry.batterName}</span>{' '}
                            <span style={{ color: entry.result.includes('Out') || entry.result === 'Strikeout' || entry.result === 'Flyout' || entry.result === 'Groundout' || entry.result === 'Forceout' || entry.result === 'Tagout' ? '#ef5350' : entry.result === '1B' || entry.result === '2B' || entry.result === '3B' || entry.result === 'HR' ? '#4caf50' : 'var(--text-secondary)' }}>
                              {entry.result}
                            </span>
                          </span>
                          {entry.details.length > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>{entry.details.join(' · ')}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                          {entry.rbis > 0 && <span style={{ fontSize: '0.65rem', backgroundColor: '#4caf50', color: 'white', padding: '1px 4px', borderRadius: '4px' }}>{entry.rbis} RBI</span>}
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{entry.outsAfter}/3 out</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ===== SEASON VIEW ===== */}
      {activeTab === 'season' && (
        <>
          {excludedCount > 0 && (
            <div style={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', padding: '8px 12px', fontSize: '0.75rem', color: '#888', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Showing <b style={{ color: 'white' }}>{includedGames.length}</b> of {gameHistory.length} games — {excludedCount} excluded</span>
              <span style={{ color: '#555', fontSize: '0.65rem' }}>Toggle in History tab</span>
            </div>
          )}
          {seasonStats.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', marginTop: '24px' }}>No games recorded yet.</p>
          ) : (
            <>
              <section>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Season Batting</h3>
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #333' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '420px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 4px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>Player</th>
                        <th style={{ padding: '6px 3px', textAlign: 'center' }}>AB</th>
                        <th style={{ padding: '6px 3px', textAlign: 'center' }}>H</th>
                        <th style={{ padding: '6px 3px', textAlign: 'center' }}>AVG</th>
                        <th style={{ padding: '6px 3px', textAlign: 'center' }}>1B</th>
                        <th style={{ padding: '6px 3px', textAlign: 'center' }}>2B</th>
                        <th style={{ padding: '6px 3px', textAlign: 'center' }}>3B</th>
                        <th style={{ padding: '6px 3px', textAlign: 'center' }}>HR</th>
                        <th style={{ padding: '6px 3px', textAlign: 'center' }}>RBI</th>
                        <th style={{ padding: '6px 3px', textAlign: 'center' }}>Take%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seasonStats.map((s, i) => (
                        <tr key={s.id} style={{ borderTop: '1px solid #2a2a2a', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '5px 4px', fontWeight: 'bold', whiteSpace: 'nowrap', position: 'sticky', left: 0, backgroundColor: i % 2 === 0 ? 'var(--bg-dark)' : '#1a1a1a', zIndex: 1 }}>{s.name}</td>
                          <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.ab}</td>
                          <td style={{ padding: '5px 3px', textAlign: 'center', color: '#4caf50' }}>{s.hits}</td>
                          <td style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 'bold' }}>{s.avg}</td>
                          <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.singles}</td>
                          <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.doubles}</td>
                          <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.triples}</td>
                          <td style={{ padding: '5px 3px', textAlign: 'center', color: s.hrs > 0 ? '#ff9800' : 'inherit' }}>{s.hrs}</td>
                          <td style={{ padding: '5px 3px', textAlign: 'center', color: s.rbis > 0 ? '#4caf50' : 'var(--text-secondary)' }}>{s.rbis}</td>
                          <td style={{ padding: '5px 3px', textAlign: 'center' }}>
                            <span style={{ color: patienceColor(s.takeRate), fontWeight: 'bold' }}>{Math.round(s.takeRate * 100)}%</span>
                            <div style={{ fontSize: '0.55rem', color: patienceColor(s.takeRate), opacity: 0.85 }}>{patienceLabel(s.takeRate)}</div>
                            {s.pitchTotal > 0 && <div style={{ fontSize: '0.5rem', color: 'var(--text-secondary)' }}>{s.ppa} pit/ab</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Season Spray Chart</h3>
                {seasonPlayerList.length > 0 && <BatterSelect players={seasonPlayerList} value={activeSeasonBatter} onChange={setSeasonBatter} />}
                <SprayChart hits={seasonHits} />
              </section>

            </>
          )}
        </>
      )}

      {/* ===== HISTORY LIST ===== */}
      {activeTab === 'history' && !selectedHistoryGame && (
        <section>
          {gameHistory.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', marginTop: '24px' }}>No games saved yet.</p>
          ) : (
            <div className="flex-col gap-sm">
              {[...gameHistory].reverse().map(g => (
                <div key={g.id} className="flex-col"
                  style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '12px', gap: '4px', cursor: 'pointer', opacity: g.excluded ? 0.5 : 1, border: g.excluded ? '1px solid #333' : '1px solid transparent' }}
                  onClick={() => { setSelectedHistoryGame(g); setHistoryDetailTab('log'); setHistorySprayBatter(''); }}
                >
                  <div className="flex-row justify-between items-center">
                    <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{g.excluded && <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: 'normal', marginRight: '6px' }}>EXCLUDED</span>}vs. {g.opponent}</span>
                    <div className="flex-row items-center" style={{ gap: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{new Date(g.date).toLocaleDateString()}</span>
                      {!coachView && (
                        <>
                          <button
                            style={{ background: g.excluded ? '#333' : '#1a3a1a', border: `1px solid ${g.excluded ? '#555' : '#2e7d32'}`, color: g.excluded ? '#666' : '#4caf50', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', padding: '2px 6px', whiteSpace: 'nowrap' }}
                            onClick={e => { e.stopPropagation(); toggleGameExclusion(g.id); }}
                          >{g.excluded ? 'Excluded' : 'In Stats'}</button>
                          {pendingDeleteId === g.id ? (
                            <div className="flex-row items-center" style={{ gap: '4px' }} onClick={e => e.stopPropagation()}>
                              <span style={{ fontSize: '0.6rem', color: '#ef5350' }}>Sure?</span>
                              <button style={{ background: '#ef5350', border: 'none', color: 'white', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', padding: '2px 6px', fontWeight: 'bold' }}
                                onClick={e => { e.stopPropagation(); deleteHistoricalGame(g.id); setPendingDeleteId(null); }}>Yes</button>
                              <button style={{ background: '#333', border: 'none', color: 'white', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', padding: '2px 6px' }}
                                onClick={e => { e.stopPropagation(); setPendingDeleteId(null); }}>No</button>
                            </div>
                          ) : (
                            <button style={{ background: 'none', border: 'none', color: '#ef5350', fontSize: '1rem', cursor: 'pointer', padding: '2px 6px' }}
                              onClick={e => { e.stopPropagation(); setPendingDeleteId(g.id); }}>✕</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-row items-center" style={{ gap: '12px', fontSize: '0.8rem' }}>
                    {(() => {
                      const win = g.runsScored > g.opponentScore;
                      const loss = g.runsScored < g.opponentScore;
                      return (
                        <>
                          <span style={{ fontWeight: 'bold', fontSize: '1rem', color: win ? '#4caf50' : loss ? '#ef5350' : 'var(--text-secondary)' }}>{win ? 'W' : loss ? 'L' : 'T'}</span>
                          <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{g.runsScored}–{g.opponentScore}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>ABs: <b>{g.atBats.length}</b></span>
                        </>
                      );
                    })()}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#555', marginTop: '2px' }}>Tap to view details →</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== HISTORY DETAIL ===== */}
      {activeTab === 'history' && selectedHistoryGame && (() => {
        const g = selectedHistoryGame;

        // Group log
        const gLog: { key: string; inning: number; isOffense: boolean; entries: InningLogEntry[] }[] = [];
        let curKey = '';
        (g.inningLog ?? []).forEach(entry => {
          const key = `${entry.inning}-${entry.isOffense}`;
          if (key !== curKey) { gLog.push({ key, inning: entry.inning, isOffense: entry.isOffense, entries: [entry] }); curKey = key; }
          else gLog[gLog.length - 1].entries.push(entry);
        });

        // Batting stats
        const nameMap: Record<string, string> = {};
        (g.inningLog ?? []).forEach(e => { if (e.batterId && e.batterName) nameMap[e.batterId] = e.batterName; });
        const statMap: Record<string, { id: string; name: string; ab: number; hits: number; singles: number; doubles: number; triples: number; hrs: number; rbis: number }> = {};
        (g.atBats ?? []).forEach(ab => {
          if (!statMap[ab.batterId]) statMap[ab.batterId] = { id: ab.batterId, name: nameMap[ab.batterId] ?? ab.batterId.slice(0, 6), ab: 0, hits: 0, singles: 0, doubles: 0, triples: 0, hrs: 0, rbis: 0 };
          const s = statMap[ab.batterId];
          s.ab++;
          ab.events.forEach(ev => {
            if (ev.type === 'hit') { s.hits++; if (ev.hitType === '1B') s.singles++; else if (ev.hitType === '2B') s.doubles++; else if (ev.hitType === '3B') s.triples++; else if (ev.hitType === 'HR') s.hrs++; }
          });
        });
        (g.inningLog ?? []).filter(e => e.isOffense && e.batterId).forEach(e => { if (statMap[e.batterId!]) statMap[e.batterId!].rbis += e.rbis; });
        const stats = Object.values(statMap).sort((a, b) => b.hits - a.hits);
        const historyPlayers = stats.map(s => ({ id: s.id, name: s.name }));

        // Spray chart for selected player
        const activeHistoryBatter = historySprayBatter || historyPlayers[0]?.id || '';
        const historyHits = extractHits((g.atBats ?? []).filter(ab => ab.batterId === activeHistoryBatter));

        return (
          <section>
            <div className="flex-row items-center" style={{ gap: '10px', marginBottom: '12px' }}>
              <button onClick={() => setSelectedHistoryGame(null)}
                style={{ background: 'none', border: '1px solid #444', color: 'white', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.875rem' }}>
                ← Back
              </button>
              <div className="flex-col" style={{ flex: 1 }}>
                <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>vs. {g.opponent}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(g.date).toLocaleDateString()} · {g.runsScored}–{g.opponentScore}</span>
              </div>
            </div>

            <div className="flex-row" style={{ backgroundColor: 'var(--bg-card)', borderRadius: '10px', padding: '3px', gap: '3px', marginBottom: '12px' }}>
              {(['log', 'stats'] as const).map(t => (
                <button key={t}
                  className={`huge-btn flex-1 ${historyDetailTab === t ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: '34px', fontSize: '0.8rem', border: 'none' }}
                  onClick={() => setHistoryDetailTab(t)}
                >
                  {t === 'log' ? 'Game Log' : 'Batting Stats'}
                </button>
              ))}
            </div>

            {historyDetailTab === 'log' && (
              gLog.length === 0
                ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', marginTop: '24px' }}>No plays recorded.</p>
                : <div className="flex-col" style={{ gap: '12px' }}>
                  {gLog.map(group => (
                    <div key={group.key}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: group.isOffense ? '#4caf50' : '#2196f3', padding: '4px 8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', marginBottom: '4px', borderLeft: `3px solid ${group.isOffense ? '#4caf50' : '#2196f3'}` }}>
                        Inning {group.inning} — {group.isOffense ? 'Offense' : 'Defense'}
                      </div>
                      {group.entries.map((entry, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 8px 4px 16px', fontSize: '0.8rem', borderBottom: '1px solid #1a1a1a' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>
                              <span style={{ fontWeight: 'bold' }}>{entry.batterName}</span>{' '}
                              <span style={{ color: ['Out', 'Strikeout', 'Flyout', 'Groundout', 'Forceout', 'Tagout'].some(x => entry.result.includes(x)) ? '#ef5350' : ['1B', '2B', '3B', 'HR'].includes(entry.result) ? '#4caf50' : 'var(--text-secondary)' }}>
                                {entry.result}
                              </span>
                            </span>
                            {entry.details.length > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>{entry.details.join(' · ')}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                            {entry.rbis > 0 && <span style={{ fontSize: '0.65rem', backgroundColor: '#4caf50', color: 'white', padding: '1px 4px', borderRadius: '4px' }}>{entry.rbis} RBI</span>}
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{entry.outsAfter}/3 out</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
            )}

            {historyDetailTab === 'stats' && (
              stats.length === 0
                ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', marginTop: '24px' }}>No at-bats recorded.</p>
                : <>
                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #333', marginBottom: '16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '360px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                          <th style={{ padding: '6px 4px', position: 'sticky', left: 0, backgroundColor: 'var(--bg-card)' }}>Player</th>
                          <th style={{ padding: '6px 3px', textAlign: 'center' }}>AB</th>
                          <th style={{ padding: '6px 3px', textAlign: 'center' }}>H</th>
                          <th style={{ padding: '6px 3px', textAlign: 'center' }}>AVG</th>
                          <th style={{ padding: '6px 3px', textAlign: 'center' }}>1B</th>
                          <th style={{ padding: '6px 3px', textAlign: 'center' }}>2B</th>
                          <th style={{ padding: '6px 3px', textAlign: 'center' }}>3B</th>
                          <th style={{ padding: '6px 3px', textAlign: 'center' }}>HR</th>
                          <th style={{ padding: '6px 3px', textAlign: 'center' }}>RBI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map((s, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #2a2a2a', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '5px 4px', fontWeight: 'bold', whiteSpace: 'nowrap', position: 'sticky', left: 0, backgroundColor: i % 2 === 0 ? 'var(--bg-dark)' : '#1a1a1a' }}>{s.name}</td>
                            <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.ab}</td>
                            <td style={{ padding: '5px 3px', textAlign: 'center', color: '#4caf50' }}>{s.hits}</td>
                            <td style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 'bold' }}>{s.ab > 0 ? (s.hits / s.ab).toFixed(3) : '.000'}</td>
                            <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.singles}</td>
                            <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.doubles}</td>
                            <td style={{ padding: '5px 3px', textAlign: 'center' }}>{s.triples}</td>
                            <td style={{ padding: '5px 3px', textAlign: 'center', color: s.hrs > 0 ? '#ff9800' : 'inherit' }}>{s.hrs}</td>
                            <td style={{ padding: '5px 3px', textAlign: 'center', color: s.rbis > 0 ? '#4caf50' : 'var(--text-secondary)' }}>{s.rbis}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Spray Chart</h3>
                  {historyPlayers.length > 0 && <BatterSelect players={historyPlayers} value={activeHistoryBatter} onChange={setHistorySprayBatter} />}
                  <SprayChart hits={historyHits} />
                </>
            )}
          </section>
        );
      })()}
    </div>
  );
}
