import { useState, useRef } from 'react';
import { useGameStore } from '../store';
import type { HitType, OutType, HitTrajectory, DefensiveEvent } from '../store';

const DEFENSIVE_POSITIONS = [
  { id: 'P', name: 'Pitcher', x: 50, y: 65 },
  { id: 'C', name: 'Catcher', x: 50, y: 95 },
  { id: '1B', name: '1st Base', x: 75, y: 48 },
  { id: '2B', name: '2nd Base', x: 65, y: 35 },
  { id: 'SS', name: 'Shortstop', x: 35, y: 35 },
  { id: '3B', name: '3rd Base', x: 25, y: 48 },
  { id: 'LF', name: 'Left Field', x: 15, y: 20 },
  { id: 'LC', name: 'Left Center', x: 35, y: 15 },
  { id: 'RC', name: 'Right Center', x: 65, y: 15 },
  { id: 'RF', name: 'Right Field', x: 85, y: 20 },
  { id: 'UTIL', name: 'Utility', x: 50, y: 7 },
];

export default function BaseballField() {
  const { mode, initiateHit, logOffensiveOut, logOffensiveError, initiateForceOut, 
          logDefensiveAction, roster, bases, defensiveAssignments, assignDefensivePosition,
          pendingRunnerResolution, resolveNextRunner, pendingForceOut, resolveForceOut } = useGameStore();
  const [tapLocation, setTapLocation] = useState<{x: number, y: number} | null>(null);
  const [pendingOutcome, setPendingOutcome] = useState<{type: 'hit' | 'out' | 'error', detail: string} | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [isSetupDefense, setIsSetupDefense] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const getPlayerName = (id: string | null) => {
    if (!id) return '';
    return roster.find(p => p.id === id)?.name || '';
  };

  const handleSVGClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (mode === 'defense') return;
    if (!svgRef.current) return;
    
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    
    setTapLocation({ x: svgP.x, y: svgP.y });
  };

  const cancelTap = () => {
    setTapLocation(null);
    setPendingOutcome(null);
    setSelectedPosition(null);
  };

  const handleInitialOutcome = (type: 'hit' | 'out' | 'error', detail: string) => {
    setPendingOutcome({ type, detail });
  };

  const finalizeOffensiveOutcome = (trajectory: HitTrajectory) => {
    if (!tapLocation || !pendingOutcome) return;
    const { type, detail } = pendingOutcome;
    
    if (type === 'hit') {
      initiateHit(detail as HitType, trajectory, tapLocation.x, tapLocation.y);
    }
    if (type === 'out') {
      // Check if it's a forceout/groundout and runners are on base
      if ((detail === 'Forceout' || detail === 'Groundout') && (bases.first || bases.second || bases.third)) {
        initiateForceOut(detail as OutType, tapLocation.x, tapLocation.y);
      } else {
        logOffensiveOut(detail as OutType, tapLocation.x, tapLocation.y);
      }
    }
    if (type === 'error') {
      logOffensiveError(trajectory, tapLocation.x, tapLocation.y);
    }
    
    setTapLocation(null);
    setPendingOutcome(null);
  };

  const handleDefensiveOutcome = (result: DefensiveEvent) => {
    if (!selectedPosition) return;
    logDefensiveAction(selectedPosition, result);
    setSelectedPosition(null);
  };

  const handlePositionClick = (e: React.MouseEvent, posId: string) => {
    if (mode !== 'defense') return;
    e.stopPropagation();
    setSelectedPosition(posId);
  };

  // Current runner being resolved
  const currentResolveRunner = pendingRunnerResolution && 
    pendingRunnerResolution.currentRunnerIndex < pendingRunnerResolution.runnersToResolve.length
    ? pendingRunnerResolution.runnersToResolve[pendingRunnerResolution.currentRunnerIndex]
    : null;

  return (
    <div style={{position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column'}}>
      {/* SVG Field */}
      <svg 
        ref={svgRef}
        viewBox="0 0 100 100" 
        style={{width: '100%', height: '100%', backgroundColor: '#2e7d32', userSelect: 'none', borderRadius: '12px'}}
        onClick={handleSVGClick}
      >
        <rect width="100" height="100" fill="#2e7d32" />
        <path d="M 50,87 L 5,35 A 55 55 0 0 1 95 35 Z" fill="#e0a96d" />
        <path d="M 50,30 L 72,52 L 50,75 L 28,52 Z" fill="#2e7d32" />
        
        {/* Basepaths */}
        <line x1="50" y1="75" x2="72" y2="52" stroke="white" strokeWidth="0.4" opacity="0.6" />
        <line x1="72" y1="52" x2="50" y2="30" stroke="white" strokeWidth="0.4" opacity="0.6" />
        <line x1="50" y1="30" x2="28" y2="52" stroke="white" strokeWidth="0.4" opacity="0.6" />
        <line x1="28" y1="52" x2="50" y2="75" stroke="white" strokeWidth="0.4" opacity="0.6" />
        
        {/* Bases with runner indicators */}
        <rect x="48.5" y="28.5" width="3" height="3" fill={bases.second ? '#ffeb3b' : 'white'} transform="rotate(45 50 30)" />
        <rect x="70.5" y="50.5" width="3" height="3" fill={bases.first ? '#ffeb3b' : 'white'} transform="rotate(45 72 52)" />
        <rect x="26.5" y="50.5" width="3" height="3" fill={bases.third ? '#ffeb3b' : 'white'} transform="rotate(45 28 52)" />
        <polygon points="50,88 52,86 52,84 48,84 48,86" fill="white" />
        
        {/* Runner names on bases */}
        {bases.first && (
          <text x="72" y="46" fontSize="3" fill="white" textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 2px black'}}>
            {getPlayerName(bases.first).substring(0, 6)}
          </text>
        )}
        {bases.second && (
          <text x="50" y="25" fontSize="3" fill="white" textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 2px black'}}>
            {getPlayerName(bases.second).substring(0, 6)}
          </text>
        )}
        {bases.third && (
          <text x="28" y="46" fontSize="3" fill="white" textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 2px black'}}>
            {getPlayerName(bases.third).substring(0, 6)}
          </text>
        )}
        
        {/* Foul Lines */}
        <line x1="50" y1="87" x2="0" y2="35" stroke="white" strokeWidth="0.5" />
        <line x1="50" y1="87" x2="100" y2="35" stroke="white" strokeWidth="0.5" />

        {/* Tap Indicator (Offense) */}
        {tapLocation && mode === 'offense' && (
          <circle cx={tapLocation.x} cy={tapLocation.y} r="3" fill="var(--dodger-red)" />
        )}

        {/* Defensive Positions Overlay */}
        {mode === 'defense' && DEFENSIVE_POSITIONS.map(pos => {
          const isSelected = selectedPosition === pos.id;
          const assignedPlayerId = defensiveAssignments[pos.id];
          const assignedPlayer = roster.find(p => p.id === assignedPlayerId);
          const isUnassigned = !assignedPlayer;
          const dotColor = isSelected ? 'var(--dodger-red)' : (isSetupDefense && isUnassigned) ? '#ffb300' : (!isUnassigned ? 'var(--dodger-blue)' : '#555');
          const r = isSetupDefense ? "6" : "4";
          return (
            <g key={pos.id} onClick={(e) => handlePositionClick(e, pos.id)} style={{cursor: 'pointer'}}>
              <circle cx={pos.x} cy={pos.y} r={r} fill={dotColor} stroke="white" strokeWidth="0.5" />
              <text x={pos.x} y={pos.y + 1} fontSize={isSetupDefense ? "3.5" : "3"} fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold" pointerEvents="none">
                {pos.id}
              </text>
              {/* Always show player name in setup mode; show outside dot in play mode */}
              {assignedPlayer && isSetupDefense && (
                <text x={pos.x} y={pos.y - 8} fontSize="3" fill="white" textAnchor="middle" fontWeight="bold" stroke="black" strokeWidth="0.4" paintOrder="stroke" pointerEvents="none">
                  {assignedPlayer.name.substring(0, 8)}
                </text>
              )}
              {assignedPlayer && !isSetupDefense && (
                <text x={pos.x} y={pos.y - 5} fontSize="3" fill="white" textAnchor="middle" fontWeight="bold" stroke="black" strokeWidth="0.4" paintOrder="stroke" pointerEvents="none">
                  {assignedPlayer.name.substring(0, 6)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Defense Setup Toggle + assignment summary */}
      {mode === 'defense' && !selectedPosition && (
        <>
          <div style={{position: 'absolute', top: '16px', right: '16px', zIndex: 5}}>
            <button
              className={`huge-btn ${isSetupDefense ? 'btn-danger' : 'btn-secondary'}`}
              style={{fontSize: '0.875rem', height: '40px'}}
              onClick={() => setIsSetupDefense(!isSetupDefense)}
            >
              {isSetupDefense ? 'Done' : 'Change Positions'}
            </button>
          </div>
          {!isSetupDefense && (
            <div style={{position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 5}}>
              <button
                className="huge-btn"
                style={{backgroundColor: '#1a237e', border: '2px solid #3f51b5', color: 'white', fontSize: '1.1rem', fontWeight: 'bold', height: '48px', padding: '0 24px', borderRadius: '10px', letterSpacing: '0.05em'}}
                onClick={() => logDefensiveAction('K', 'Out')}
              >
                K — Strikeout
              </button>
            </div>
          )}
          {isSetupDefense && (() => {
            const assigned = DEFENSIVE_POSITIONS.filter(p => defensiveAssignments[p.id]);
            const unassigned = DEFENSIVE_POSITIONS.filter(p => !defensiveAssignments[p.id]);
            return (
              <div style={{
                position: 'absolute', top: '16px', left: '16px', zIndex: 5,
                backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: '8px', padding: '6px 10px',
              }}>
                <span style={{color: '#4caf50', fontSize: '0.8rem', fontWeight: 'bold'}}>{assigned.length} assigned</span>
                {unassigned.length > 0 && (
                  <span style={{color: '#ffb300', fontSize: '0.8rem', marginLeft: '8px'}}>{unassigned.length} open</span>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* ===== BASERUNNER RESOLUTION OVERLAY ===== */}
      {pendingRunnerResolution && currentResolveRunner && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, 
          backgroundColor: 'var(--bg-card)', padding: '16px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.5)', zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          <h3 style={{textAlign: 'center', fontSize: '1rem', color: 'var(--text-secondary)'}}>
            Runner on {currentResolveRunner.fromBase}
          </h3>
          <h2 style={{textAlign: 'center', fontSize: '1.25rem', margin: '0'}}>
            Where did <span style={{color: 'var(--dodger-blue)'}}>{getPlayerName(currentResolveRunner.playerId)}</span> end up?
          </h2>
          <div className="flex-row gap-sm" style={{marginTop: '4px'}}>
            <button className="huge-btn flex-1" style={{backgroundColor: '#4caf50', color: 'white', fontSize: '1rem'}} onClick={() => resolveNextRunner('scored')}>
              Scored
            </button>
            {currentResolveRunner.fromBase !== 'third' && (
              <button className="huge-btn flex-1" style={{backgroundColor: '#ff9800', color: 'white', fontSize: '1rem'}} onClick={() => resolveNextRunner('third')}>
                → 3rd
              </button>
            )}
          </div>
          <div className="flex-row gap-sm">
            {currentResolveRunner.fromBase === 'first' && (
              <button className="huge-btn flex-1" style={{backgroundColor: '#2196f3', color: 'white', fontSize: '1rem'}} onClick={() => resolveNextRunner('second')}>
                → 2nd
              </button>
            )}
            <button className="huge-btn flex-1" style={{backgroundColor: 'var(--dodger-red)', color: 'white', fontSize: '1rem'}} onClick={() => resolveNextRunner('out')}>
              Out
            </button>
          </div>
        </div>
      )}

      {/* ===== FORCE OUT RESOLUTION OVERLAY ===== */}
      {pendingForceOut && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, 
          backgroundColor: 'var(--bg-card)', padding: '16px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.5)', zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          <h3 style={{textAlign: 'center', fontSize: '1.125rem'}}>Who was forced out?</h3>
          <div className="flex-col gap-sm">
            <button className="huge-btn" style={{backgroundColor: 'var(--dodger-red)', color: 'white', fontSize: '1rem'}}
              onClick={() => resolveForceOut(pendingForceOut.batterId, '1st')}>
              Batter ({getPlayerName(pendingForceOut.batterId)}) out at 1st
            </button>
            {pendingForceOut.occupiedBases.map(ob => (
              <button key={ob.base} className="huge-btn" style={{backgroundColor: '#ff9800', color: 'white', fontSize: '1rem'}}
                onClick={() => resolveForceOut(ob.playerId, ob.base)}>
                {getPlayerName(ob.playerId)} forced at {ob.base === 'first' ? '2nd' : ob.base === 'second' ? '3rd' : 'Home'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Offense Outcome Menu */}
      {tapLocation && mode === 'offense' && !pendingRunnerResolution && !pendingForceOut && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, 
          backgroundColor: 'var(--bg-card)', padding: '16px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.5)', zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          {!pendingOutcome ? (
            <>
              <h3 style={{marginBottom: '4px', textAlign: 'center'}}>Offensive Outcome</h3>
              <div className="flex-row gap-sm">
                <button className="huge-btn flex-1" style={{backgroundColor: '#4caf50', color: 'white'}} onClick={() => handleInitialOutcome('hit', '1B')}>1B</button>
                <button className="huge-btn flex-1" style={{backgroundColor: '#4caf50', color: 'white'}} onClick={() => handleInitialOutcome('hit', '2B')}>2B</button>
                <button className="huge-btn flex-1" style={{backgroundColor: '#4caf50', color: 'white'}} onClick={() => handleInitialOutcome('hit', '3B')}>3B</button>
                <button className="huge-btn flex-1" style={{backgroundColor: '#4caf50', color: 'white'}} onClick={() => handleInitialOutcome('hit', 'HR')}>HR</button>
              </div>
              <div className="flex-row gap-sm">
                 <button className="huge-btn flex-1" style={{backgroundColor: 'var(--dodger-red)', color: 'white'}} onClick={() => handleInitialOutcome('out', 'Flyout')}>Flyout</button>
                 <button className="huge-btn flex-1" style={{backgroundColor: 'var(--dodger-red)', color: 'white'}} onClick={() => handleInitialOutcome('out', 'Groundout')}>Groundout</button>
                 <button className="huge-btn flex-1" style={{backgroundColor: 'var(--dodger-red)', color: 'white'}} onClick={() => handleInitialOutcome('out', 'Forceout')}>Forceout</button>
              </div>
              <div className="flex-row gap-sm">
                 <button className="huge-btn flex-1" style={{backgroundColor: '#ff9800', color: 'white'}} onClick={() => handleInitialOutcome('error', 'Error')}>Error (Safe)</button>
                 <button className="huge-btn btn-secondary flex-1" onClick={cancelTap}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <h3 style={{marginBottom: '4px', textAlign: 'center'}}>Hit Trajectory?</h3>
              <div className="flex-col gap-sm">
                <button className="huge-btn" style={{backgroundColor: '#2196f3', color: 'white'}} onClick={() => finalizeOffensiveOutcome('Grounder')}>Grounder</button>
                <button className="huge-btn" style={{backgroundColor: '#9c27b0', color: 'white'}} onClick={() => finalizeOffensiveOutcome('Blooper')}>Blooper</button>
                <button className="huge-btn" style={{backgroundColor: '#ff9800', color: 'white'}} onClick={() => finalizeOffensiveOutcome('Line Drive')}>Line Drive</button>
                <button className="huge-btn btn-secondary" onClick={() => setPendingOutcome(null)}>Back</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Defense Outcome Menu */}
      {selectedPosition && mode === 'defense' && !isSetupDefense && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, 
          backgroundColor: 'var(--bg-card)', padding: '16px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.5)', zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          {(() => {
            const pid = defensiveAssignments[selectedPosition];
            const p = roster.find(r => r.id === pid);
            return <h3 style={{marginBottom: '4px', textAlign: 'center'}}>{selectedPosition} {p ? `(${p.name})` : ''} Action</h3>;
          })()}
          <div className="flex-row gap-sm">
             <button className="huge-btn flex-1" style={{backgroundColor: '#4caf50', color: 'white', fontSize: '1rem'}} onClick={() => handleDefensiveOutcome('Out')}>Recorded Out</button>
             <button className="huge-btn flex-1" style={{backgroundColor: '#2196f3', color: 'white', fontSize: '1rem'}} onClick={() => handleDefensiveOutcome('Fielded Cleanly')}>Clean / No Out</button>
          </div>
          <div className="flex-row gap-sm">
             <button className="huge-btn flex-1" style={{backgroundColor: 'var(--dodger-red)', color: 'white', fontSize: '0.875rem'}} onClick={() => handleDefensiveOutcome('Fielding Error')}>Fielding Error</button>
             <button className="huge-btn flex-1" style={{backgroundColor: 'var(--dodger-red)', color: 'white', fontSize: '0.875rem'}} onClick={() => handleDefensiveOutcome('Throwing Error')}>Throwing Error</button>
          </div>
          <div className="flex-row gap-sm">
             <button className="huge-btn flex-1" style={{backgroundColor: '#b71c1c', color: 'white', fontSize: '0.875rem'}} onClick={() => handleDefensiveOutcome('Fielding & Throwing Error')}>Both Errors</button>
             <button className="huge-btn btn-secondary flex-1" onClick={cancelTap}>Cancel</button>
          </div>
        </div>
      )}

      {/* Defense Setup Menu — custom player picker */}
      {selectedPosition && mode === 'defense' && isSetupDefense && (() => {
        const posInfo = DEFENSIVE_POSITIONS.find(p => p.id === selectedPosition);
        const currentAssigneeId = defensiveAssignments[selectedPosition];

        // Build a map: playerId → positionId they're assigned to
        const playerPosMap: Record<string, string> = {};
        Object.entries(defensiveAssignments).forEach(([pos, pid]) => {
          if (pid) playerPosMap[pid] = pos;
        });

        return (
          <div
            onClick={() => setSelectedPosition(null)}
            style={{
              position: 'absolute', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 10,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                backgroundColor: '#1e1e1e',
                borderRadius: '16px 16px 0 0',
                maxHeight: '70vh',
                overflowY: 'auto',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid #333',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                position: 'sticky', top: 0, backgroundColor: '#1e1e1e', zIndex: 1,
              }}>
                <div>
                  <span style={{fontWeight: 'bold', fontSize: '1.1rem', color: 'white'}}>
                    Assign {posInfo?.name ?? selectedPosition}
                  </span>
                  {currentAssigneeId && (
                    <span style={{fontSize: '0.75rem', color: '#aaa', marginLeft: '8px'}}>
                      currently: {getPlayerName(currentAssigneeId)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPosition(null)}
                  style={{background: 'none', border: 'none', color: '#888', fontSize: '1.25rem', cursor: 'pointer', padding: '4px 8px'}}
                >✕</button>
              </div>

              {/* Clear option */}
              {currentAssigneeId && (
                <div
                  onClick={() => { assignDefensivePosition(selectedPosition, null); setSelectedPosition(null); }}
                  style={{
                    padding: '14px 20px', borderBottom: '1px solid #2a2a2a',
                    display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                  }}
                >
                  <span style={{fontSize: '1.1rem', color: 'var(--dodger-red)'}}>✕ Clear position</span>
                </div>
              )}

              {/* Roster players */}
              {roster.map(p => {
                const isCurrent = p.id === currentAssigneeId;
                const assignedPos = playerPosMap[p.id];
                const isElsewhere = assignedPos && assignedPos !== selectedPosition;

                return (
                  <div
                    key={p.id}
                    onClick={() => { assignDefensivePosition(selectedPosition, p.id); setSelectedPosition(null); }}
                    style={{
                      padding: '14px 20px', borderBottom: '1px solid #2a2a2a',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      cursor: 'pointer',
                      backgroundColor: isCurrent ? 'rgba(0,90,156,0.25)' : 'transparent',
                    }}
                  >
                    <span style={{
                      fontSize: '1.15rem', fontWeight: '600',
                      color: isElsewhere ? '#888' : 'white',
                    }}>
                      {p.name}
                    </span>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      {isCurrent && (
                        <span style={{fontSize: '0.7rem', backgroundColor: 'var(--dodger-blue)', color: 'white', padding: '3px 8px', borderRadius: '4px'}}>
                          HERE
                        </span>
                      )}
                      {isElsewhere && (
                        <span style={{fontSize: '0.75rem', backgroundColor: '#333', color: '#aaa', padding: '3px 8px', borderRadius: '4px'}}>
                          at {assignedPos}
                        </span>
                      )}
                      {!isCurrent && !isElsewhere && (
                        <span style={{fontSize: '0.75rem', color: '#4caf50'}}>available</span>
                      )}
                    </div>
                  </div>
                );
              })}

              <div style={{padding: '16px 20px'}}>
                <button
                  onClick={() => setSelectedPosition(null)}
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
        );
      })()}
    </div>
  );
}
