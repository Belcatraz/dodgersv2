import { useState } from 'react';
import { useGameStore } from '../store';

export default function LineupManager() {
  const [name, setName] = useState('');
  const { roster, addPlayerToRoster, removePlayerFromRoster, addToLineup, removeFromLineup,
          lineup, gameStarted, setGameStarted, startNextAtBat, setMode } = useGameStore();

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      addPlayerToRoster(name.trim());
      setName('');
    }
  };

  const playing = roster.filter(p => lineup.includes(p.id));
  const sittingOut = roster.filter(p => !lineup.includes(p.id));

  return (
    <div className="flex-col h-full p-md gap-md">
      <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', marginTop: '16px'}}>Team Roster</h1>

      <form onSubmit={handleAddPlayer} className="flex-row gap-sm">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player Name"
          style={{flex: 1, padding: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid #333', fontSize: '1.125rem'}}
        />
        <button type="submit" className="huge-btn btn-primary" style={{padding: '0 24px', width: 'auto'}}>
          Add
        </button>
      </form>

      <div className="flex-col gap-sm flex-1 overflow-y-auto">

        {/* Playing today */}
        <h2 style={{fontSize: '1rem', fontWeight: 'bold', color: '#4caf50', marginBottom: '4px'}}>
          Playing Today ({playing.length})
        </h2>
        {playing.map(p => (
          <div key={p.id} className="flex-row justify-between items-center p-md"
            style={{backgroundColor: 'var(--bg-card)', borderRadius: '8px'}}>
            <span style={{fontSize: '1.125rem', fontWeight: 'bold'}}>{p.name}</span>
            <div className="flex-row items-center" style={{gap: '8px'}}>
              <button
                className="huge-btn btn-secondary"
                style={{height: '36px', fontSize: '0.75rem', padding: '0 12px', width: 'auto'}}
                onClick={() => removeFromLineup(p.id)}
              >
                Sit Out
              </button>
              <button
                style={{height: '36px', padding: '0 10px', background: 'none', border: '1px solid #333',
                        color: '#555', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem'}}
                onClick={() => { if (confirm(`Remove ${p.name} from the team permanently?`)) removePlayerFromRoster(p.id); }}
                title="Delete from team permanently"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {/* Sitting out */}
        {sittingOut.length > 0 && (
          <>
            <h2 style={{fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '4px'}}>
              Sitting Out ({sittingOut.length})
            </h2>
            {sittingOut.map(p => (
              <div key={p.id} className="flex-row justify-between items-center p-md"
                style={{backgroundColor: 'var(--bg-card)', borderRadius: '8px', opacity: 0.6}}>
                <span style={{fontSize: '1.125rem'}}>{p.name}</span>
                <div className="flex-row items-center" style={{gap: '8px'}}>
                  <button
                    className="huge-btn btn-secondary"
                    style={{height: '36px', fontSize: '0.75rem', padding: '0 12px', width: 'auto', color: '#4caf50', borderColor: '#4caf50'}}
                    onClick={() => addToLineup(p.id)}
                  >
                    Add to Game
                  </button>
                  <button
                    style={{height: '36px', padding: '0 10px', background: 'none', border: '1px solid #333',
                            color: '#555', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem'}}
                    onClick={() => { if (confirm(`Remove ${p.name} from the team permanently?`)) removePlayerFromRoster(p.id); }}
                    title="Delete from team permanently"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {roster.length > 0 && (
        <button
          className="huge-btn btn-primary w-full"
          onClick={() => {
            if (!gameStarted) {
              setGameStarted(true);
              startNextAtBat();
            }
            setMode('offense');
          }}
          style={{marginTop: '24px'}}
        >
          {gameStarted ? 'Return to Game' : 'Start Game'}
        </button>
      )}
    </div>
  );
}
