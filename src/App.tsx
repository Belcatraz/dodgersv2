import { useGameStore } from './store';
import LineupManager from './components/LineupManager';
import PitchTracker from './components/PitchTracker';
import BaseballField from './components/BaseballField';
import Dashboard from './components/Dashboard';
import { isCoachView } from './isCoachView';
import './App.css';

function App() {
  const { mode, inning, outs, runsThisInning, runsTotal, opponentRunsThisInning, opponentRunsTotal, gameStarted, undo, pastStates,
          bases, roster, manualSwitchToDefense, manualSwitchToOffense } = useGameStore();

  if (isCoachView()) {
    return (
      <div className="flex-col w-full" style={{ height: '100%', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#0a2a4a', borderBottom: '1px solid #1a4a7a', padding: '8px 16px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#5b9bd5', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Coach View — Read Only
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Dashboard />
        </div>
      </div>
    );
  }

  if (!gameStarted && mode !== 'lineup' && mode !== 'dashboard') {
    useGameStore.getState().setMode('lineup');
  }

  const getPlayerName = (id: string | null) => {
    if (!id) return '';
    return roster.find(p => p.id === id)?.name || '';
  };

  // Base runner display for header
  const baseIndicators = [
    { label: '1st', occupied: !!bases.first, name: getPlayerName(bases.first) },
    { label: '2nd', occupied: !!bases.second, name: getPlayerName(bases.second) },
    { label: '3rd', occupied: !!bases.third, name: getPlayerName(bases.third) },
  ];

  return (
    <div className="flex-col w-full" style={{ height: '100%', overflow: 'hidden' }}>
      {gameStarted && mode !== 'lineup' && (
        <header className="flex-col" style={{backgroundColor: 'var(--bg-card)', borderBottom: '1px solid #333', padding: '8px 16px'}}>
          {/* Top Row: Undo + Inning + Runs + Outs */}
          <div className="flex-row justify-between items-center">
            <div className="flex-row items-center" style={{gap: '8px'}}>
              <button 
                className="huge-btn btn-secondary" 
                style={{height: '28px', fontSize: '0.75rem', padding: '0 8px'}}
                onClick={undo}
                disabled={pastStates.length === 0}
              >
                ↩ Undo
              </button>
              <div className="flex-col" style={{lineHeight: 1.1}}>
                <span style={{color: 'var(--text-secondary)', fontSize: '0.65rem', textAlign: 'center'}}>Inning</span>
                <span style={{fontSize: '1.25rem', fontWeight: 'bold', minWidth: '16px', textAlign: 'center'}}>{inning}</span>
              </div>
            </div>
            {mode === 'defense' ? (
              <div className="flex-col items-center" style={{lineHeight: 1.1}}>
                <span style={{color: 'var(--text-secondary)', fontSize: '0.65rem'}}>Opp Runs</span>
                <span style={{fontSize: '1rem', fontWeight: 'bold'}}>{opponentRunsThisInning} <span style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>(Tot: {opponentRunsTotal})</span></span>
              </div>
            ) : (
              <div className="flex-col items-center" style={{lineHeight: 1.1}}>
                <span style={{color: 'var(--text-secondary)', fontSize: '0.65rem'}}>Runs</span>
                <span style={{fontSize: '1rem', fontWeight: 'bold'}}>{runsThisInning} <span style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>(Tot: {runsTotal})</span></span>
              </div>
            )}
            <div className="flex-col items-end" style={{lineHeight: 1.1}}>
              <span style={{color: 'var(--text-secondary)', fontSize: '0.65rem'}}>Outs</span>
              <span style={{fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--dodger-red)'}}>{outs}</span>
            </div>
          </div>
          
          {/* Base Runners Row (only show on offense) */}
          {mode === 'offense' && (bases.first || bases.second || bases.third) && (
            <div className="flex-row" style={{gap: '6px', marginTop: '4px'}}>
              {baseIndicators.filter(b => b.occupied).map(b => (
                <span key={b.label} style={{fontSize: '0.65rem', backgroundColor: '#ffeb3b', color: '#000', borderRadius: '4px', padding: '1px 6px', fontWeight: 'bold'}}>
                  {b.label}: {b.name.substring(0, 8)}
                </span>
              ))}
            </div>
          )}
        </header>
      )}

      <main className="flex-1 overflow-y-auto" style={{position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0}}>
        {mode === 'offense' ? (
          <div className="flex-col overflow-y-auto w-full h-full">
            <PitchTracker />
            <div style={{flex: 1, display: 'flex', width: '100%', padding: '16px', minHeight: '300px', maxHeight: '55vh'}}>
              <BaseballField />
            </div>
          </div>
        ) : mode === 'defense' ? (
          <div className="flex-col h-full">
             <div style={{flex: 1, display: 'flex', width: '100%', height: '100%', padding: '16px'}}>
              <BaseballField />
            </div>
          </div>
        ) : mode === 'dashboard' ? (
          <Dashboard />
        ) : (
          <div className="flex-1 overflow-y-auto w-full h-full">
            <LineupManager />
          </div>
        )}
      </main>

      <footer className="p-md border-t" style={{backgroundColor: 'var(--bg-card)', borderColor: '#333'}}>
        <div className="flex-row gap-sm">
          <button 
            className={`huge-btn flex-1 ${mode === 'offense' ? 'btn-primary' : 'btn-secondary'}`}
            style={{fontSize: '0.9rem', opacity: gameStarted ? 1 : 0.5}}
            onClick={() => {
              if (gameStarted) {
                if (mode === 'defense') {
                  // Switching from defense to offense = new inning
                  manualSwitchToOffense();
                } else {
                  useGameStore.getState().setMode('offense');
                }
              }
            }}
            disabled={!gameStarted}
          >
            Offense
          </button>
          <button 
            className={`huge-btn flex-1 ${mode === 'defense' ? 'btn-primary' : 'btn-secondary'}`}
            style={{fontSize: '0.9rem', opacity: gameStarted ? 1 : 0.5}}
            onClick={() => {
              if (gameStarted) {
                if (mode === 'offense') {
                  manualSwitchToDefense();
                } else {
                  useGameStore.getState().setMode('defense');
                }
              }
            }}
            disabled={!gameStarted}
          >
            Defense
          </button>
          <button 
            className={`huge-btn flex-1 ${mode === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{fontSize: '0.9rem'}}
            onClick={() => useGameStore.getState().setMode('dashboard')}
          >
            Stats
          </button>
          <button 
            className={`huge-btn flex-1 ${(mode as string) === 'lineup' ? 'btn-primary' : 'btn-secondary'}`}
            style={{fontSize: '0.9rem'}}
            onClick={() => useGameStore.getState().setMode('lineup')}
          >
            Lineup
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
