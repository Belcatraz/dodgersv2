import { useState, useRef } from 'react';
import { useGameStore } from '../store';
import type { HitType, OutType, HitTrajectory } from '../store';

export default function BaseballField() {
  const { mode, initiateHit, logOffensiveOut, logOffensiveError, initiateForceOut,
          logDefensiveAction, scoreOpponentRun, roster, bases,
          pendingRunnerResolution, resolveNextRunner, pendingForceOut, resolveForceOut, opponentRunsThisInning } = useGameStore();
  const [tapLocation, setTapLocation] = useState<{x: number, y: number} | null>(null);
  const [pendingOutcome, setPendingOutcome] = useState<{type: 'hit' | 'out' | 'error', detail: string} | null>(null);
  
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
  };

  const handleInitialOutcome = (type: 'hit' | 'out' | 'error', detail: string) => {
    if (type === 'out') {
      // Outs don't need trajectory — handle immediately
      if (!tapLocation) return;
      if ((detail === 'Forceout' || detail === 'Groundout') && (bases.first || bases.second || bases.third)) {
        initiateForceOut(detail as OutType, tapLocation.x, tapLocation.y);
      } else {
        logOffensiveOut(detail as OutType, tapLocation.x, tapLocation.y);
      }
      setTapLocation(null);
      setPendingOutcome(null);
      return;
    }
    // Hits and errors go to trajectory picker
    setPendingOutcome({ type, detail });
  };

  const finalizeOffensiveOutcome = (trajectory: HitTrajectory) => {
    if (!tapLocation || !pendingOutcome) return;
    const { type, detail } = pendingOutcome;

    if (type === 'hit') {
      initiateHit(detail as HitType, trajectory, tapLocation.x, tapLocation.y);
    }
    if (type === 'error') {
      logOffensiveError(trajectory, tapLocation.x, tapLocation.y);
    }

    setTapLocation(null);
    setPendingOutcome(null);
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

      </svg>

      {/* Defense Mode: Simple Button Controls */}
      {mode === 'defense' && (
        <>
          {/* Opponent Runs at Top */}
          <div style={{position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 5}}>
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: '8px', padding: '8px 14px',
              textAlign: 'center'
            }}>
              <span style={{color: '#ff9800', fontSize: '0.85rem', fontWeight: 'bold'}}>
                Opp Runs This Inning: {opponentRunsThisInning}
              </span>
            </div>
          </div>

          {/* Three Control Buttons */}
          <div style={{position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '8px', width: '90%', maxWidth: '300px'}}>
            <button
              className="huge-btn"
              style={{backgroundColor: '#1a237e', border: '2px solid #3f51b5', color: 'white', fontSize: '1rem', fontWeight: 'bold', height: '48px', borderRadius: '10px'}}
              onClick={() => logDefensiveAction('K', 'Out')}
            >
              K — Strikeout
            </button>
            <button
              className="huge-btn"
              style={{backgroundColor: '#4caf50', color: 'white', fontSize: '1rem', fontWeight: 'bold', height: '48px', borderRadius: '10px'}}
              onClick={() => scoreOpponentRun()}
            >
              Opponent Scored
            </button>
            <button
              className="huge-btn"
              style={{backgroundColor: 'var(--dodger-red)', color: 'white', fontSize: '1rem', fontWeight: 'bold', height: '48px', borderRadius: '10px'}}
              onClick={() => logDefensiveAction('DEF', 'Out')}
            >
              Recorded Out
            </button>
          </div>
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

    </div>
  );
}
