import { useState } from 'react';
import { useGameStore } from '../store';

export default function PitchTracker() {
  const {
    currentAtBat, logPitch, roster, lineup, currentBatterIndex,
    pushToLineup, isLineupSet, setCurrentBatterIndex, battedThisCycle,
    addLateJoinerToLineup, pendingRunnerResolution, pendingForceOut,
  } = useGameStore();

  // Lock pitch buttons while a baserunner-resolution or force-out overlay is up.
  // Otherwise stray taps mutate the wrong at-bat and the strike count drifts.
  const pitchLocked = !!pendingRunnerResolution || !!pendingForceOut;

  const [pickerOpen, setPickerOpen] = useState(false);

  if (!currentAtBat) return null;

  const currentBatter = roster.find(p => p.id === currentAtBat.batterId);
  const nextBatterId = isLineupSet ? lineup[(currentBatterIndex + 1) % Math.max(1, lineup.length)] : null;
  const nextBatter = nextBatterId ? roster.find(p => p.id === nextBatterId) : null;

  // Players on roster not yet in the batting order
  const rosterNotInLineup = roster.filter(p => !lineup.includes(p.id));

  // Lineup enriched with status
  const lineupPlayers = lineup.map((id, i) => ({
    id,
    name: roster.find(p => p.id === id)?.name ?? '?',
    index: i,
    isCurrent: id === currentAtBat.batterId,
    hasBatted: battedThisCycle.includes(id),
  }));

  const handleSelect = (id: string) => {
    if (!id) return;
    if (!isLineupSet) {
      if (lineup.includes(id)) {
        setCurrentBatterIndex(lineup.indexOf(id));
      } else {
        pushToLineup(id);
      }
    } else {
      const idx = lineup.indexOf(id);
      if (idx !== -1) setCurrentBatterIndex(idx);
    }
    setPickerOpen(false);
  };

  const handleAddLateJoiner = (id: string) => {
    addLateJoinerToLineup(id);
    setPickerOpen(false);
  };

  const allBatted = battedThisCycle.length >= lineup.length && lineup.length > 0;

  return (
    <div className="flex-col gap-md" style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderBottom: '1px solid #333' }}>

      {/* Batter selector button */}
      <div className="flex-row justify-between items-center">
        <div className="flex-col" style={{ flex: 1 }}>
          <div className="flex-row items-center gap-xs">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Now Batting</span>
            {!isLineupSet && lineup.length > 0 && (
              <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--dodger-blue)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                Building Order
              </span>
            )}
            {isLineupSet && (
              <span style={{ fontSize: '0.65rem', backgroundColor: '#2a5a2a', color: '#4caf50', padding: '2px 6px', borderRadius: '4px' }}>
                Order Set
              </span>
            )}
          </div>

          {/* Tap to open picker */}
          <button
            onClick={() => setPickerOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              backgroundColor: 'var(--bg-dark)', border: '1px solid #444',
              borderRadius: '6px', padding: '8px 12px', marginTop: '4px',
              cursor: 'pointer', textAlign: 'left', maxWidth: '240px',
            }}
          >
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {currentBatter ? currentBatter.name : '— Select Batter —'}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>▾</span>
          </button>

          {nextBatter && isLineupSet && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px' }}>
              On Deck: <span style={{ color: 'var(--text-primary)' }}>{nextBatter.name}</span>
            </span>
          )}
        </div>

        <div className="flex-row gap-md">
          <div className="flex-col items-center">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Pitches</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{currentAtBat.pitches}</span>
          </div>
          <div className="flex-col items-center">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Strikes</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--dodger-red)' }}>{currentAtBat.strikes}</span>
          </div>
        </div>
      </div>

      {/* Pitch buttons */}
      <div className="flex-row gap-sm mt-sm">
        <button
          className="huge-btn flex-1"
          style={{ backgroundColor: 'var(--dodger-red)', color: 'white', opacity: pitchLocked ? 0.4 : 1 }}
          onClick={() => logPitch('strike')}
          disabled={pitchLocked}
        >
          Strike
        </button>
        <button
          className="huge-btn flex-1"
          style={{ backgroundColor: '#ff9800', color: 'white', opacity: pitchLocked ? 0.4 : 1 }}
          onClick={() => logPitch('foul')}
          disabled={pitchLocked}
        >
          Foul
        </button>
        <button
          className="huge-btn btn-secondary flex-1"
          onClick={() => logPitch('no-swing')}
          disabled={pitchLocked}
          style={{ opacity: pitchLocked ? 0.4 : 1 }}
        >
          No Swing
        </button>
      </div>
      {pitchLocked && (
        <div style={{ fontSize: '0.7rem', color: '#888', textAlign: 'center', marginTop: '4px' }}>
          Finish the play below before logging more pitches.
        </div>
      )}

      {/* Bottom-sheet picker overlay */}
      {pickerOpen && (
        <div
          onClick={() => setPickerOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            zIndex: 999,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#1e1e1e',
              borderRadius: '16px 16px 0 0',
              maxHeight: '75vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #333',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'sticky', top: 0, backgroundColor: '#1e1e1e', zIndex: 1,
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '1.125rem', color: 'white' }}>Select Batter</span>
              {!isLineupSet && allBatted && (
                <span style={{ fontSize: '0.75rem', color: '#4caf50' }}>All batted — next pick locks order</span>
              )}
              <button
                onClick={() => setPickerOpen(false)}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.25rem', cursor: 'pointer', padding: '4px 8px' }}
              >✕</button>
            </div>

            {/* Lineup players */}
            {lineupPlayers.length > 0 && (
              <div>
                {!isLineupSet && (
                  <div style={{ padding: '6px 20px', backgroundColor: '#151515', color: '#666', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
                    BATTING ORDER
                  </div>
                )}
                {lineupPlayers.map(player => {
                  const disabled = player.hasBatted && !allBatted;
                  return (
                    <div
                      key={player.id}
                      onClick={() => !disabled && handleSelect(player.id)}
                      style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid #2a2a2a',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: player.isCurrent ? 'rgba(0,90,156,0.25)' : 'transparent',
                        cursor: disabled ? 'default' : 'pointer',
                        opacity: disabled ? 0.35 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: '#555', fontSize: '0.85rem', minWidth: '20px' }}>{player.index + 1}.</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: '600', color: disabled ? '#666' : 'white' }}>
                          {player.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {player.isCurrent && (
                          <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--dodger-blue)', color: 'white', padding: '3px 8px', borderRadius: '4px' }}>
                            AT BAT
                          </span>
                        )}
                        {player.hasBatted && !player.isCurrent && (
                          <span style={{ fontSize: '0.75rem', color: '#4caf50' }}>✓ batted</span>
                        )}
                        {!player.hasBatted && !player.isCurrent && isLineupSet && (
                          <span style={{ fontSize: '0.75rem', color: '#888' }}>up next</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Players not yet in lineup (building order mode) */}
            {!isLineupSet && rosterNotInLineup.length > 0 && (
              <div>
                <div style={{ padding: '6px 20px', backgroundColor: '#151515', color: '#666', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
                  NOT IN ORDER YET — TAP TO ADD
                </div>
                {rosterNotInLineup.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p.id)}
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid #2a2a2a',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '1.15rem', fontWeight: '600', color: 'var(--dodger-blue)' }}>{p.name}</span>
                    <span style={{ fontSize: '0.75rem', color: '#555' }}>+ add to order</span>
                  </div>
                ))}
              </div>
            )}

            {/* Late joiners section (locked order) */}
            {isLineupSet && rosterNotInLineup.length > 0 && (
              <div>
                <div style={{ padding: '6px 20px', backgroundColor: '#151515', color: '#666', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
                  LATE JOINERS
                </div>
                {rosterNotInLineup.map(p => (
                  <div
                    key={p.id}
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid #2a2a2a',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '1.15rem', fontWeight: '600', color: 'white' }}>{p.name}</span>
                    <button
                      onClick={() => handleAddLateJoiner(p.id)}
                      style={{
                        backgroundColor: 'var(--dodger-blue)', color: 'white',
                        border: 'none', borderRadius: '6px',
                        padding: '8px 14px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                      }}
                    >
                      Add to Order
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '16px 20px' }}>
              <button
                onClick={() => setPickerOpen(false)}
                style={{
                  width: '100%', padding: '14px',
                  backgroundColor: '#2a2a2a', color: '#aaa',
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
