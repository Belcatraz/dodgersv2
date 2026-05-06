import { useEffect, useState } from 'react';
import { useGameStore } from '../store';
import {
  getDebugLog,
  clearDebugLog,
  exportDebugLogText,
  exportDebugLogJson,
  setDebugEnabled,
  type DebugLogEntry,
} from '../debugLog';

type Props = { onClose: () => void };

export default function DebugPanel({ onClose }: Props) {
  const state = useGameStore();
  const [entries, setEntries] = useState<DebugLogEntry[]>([]);
  const [copyMsg, setCopyMsg] = useState('');

  useEffect(() => {
    const tick = () => setEntries(getDebugLog().slice().reverse());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  const copyLog = async (format: 'text' | 'json') => {
    const data = format === 'text' ? exportDebugLogText() : exportDebugLogJson();
    try {
      await navigator.clipboard.writeText(data);
      setCopyMsg(`Copied ${format} log!`);
    } catch {
      setCopyMsg('Copy failed — log printed to console instead');
      console.log(data);
    }
    setTimeout(() => setCopyMsg(''), 2500);
  };

  const handleClear = () => {
    clearDebugLog();
    setEntries([]);
  };

  const handleDisable = () => {
    setDebugEnabled(false);
    onClose();
    // Force a reload-free refresh of the indicator button by reloading once
    if (typeof window !== 'undefined') window.location.reload();
  };

  const tsString = (ts: number) => new Date(ts).toISOString().slice(11, 19);

  const currentBatterName = state.currentAtBat
    ? state.roster.find((p) => p.id === state.currentAtBat!.batterId)?.name || '(unknown)'
    : '(none)';

  const baseGlyph = (id: string | null) => (id ? '●' : '○');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.92)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.75rem',
        color: '#0f0',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong style={{ color: '#fff', fontSize: '0.95rem' }}>🐞 Debug Panel</strong>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleDisable}
            style={{
              background: '#3a1f1f',
              color: '#ff8a8a',
              border: '1px solid #5a2d2d',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
            }}
          >
            Turn off debug
          </button>
          <button
            onClick={onClose}
            style={{
              background: '#222',
              color: '#fff',
              border: '1px solid #555',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.85rem',
            }}
          >
            Close
          </button>
        </div>
      </div>

      <div
        style={{
          backgroundColor: '#111',
          border: '1px solid #333',
          borderRadius: '6px',
          padding: '8px',
          marginBottom: '8px',
          lineHeight: 1.5,
        }}
      >
        <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>CURRENT STATE</div>
        <div>
          mode: <span style={{ color: '#ff0' }}>{state.mode}</span> | inning: {state.inning} | outs: {state.outs}
        </div>
        <div>
          runs: {state.runsThisInning} (tot {state.runsTotal}) | opp: {state.opponentRunsThisInning} (tot{' '}
          {state.opponentRunsTotal})
        </div>
        <div>
          bases: 1st={baseGlyph(state.bases.first)} 2nd={baseGlyph(state.bases.second)} 3rd={baseGlyph(state.bases.third)}
        </div>
        <div>
          at-bat: <span style={{ color: '#ff0' }}>{currentBatterName}</span>
          {state.currentAtBat && ` (P${state.currentAtBat.pitches} S${state.currentAtBat.strikes})`}
        </div>
        <div>
          pending: forceOut={state.pendingForceOut ? 'YES' : 'no'} | resolution=
          {state.pendingRunnerResolution
            ? `${state.pendingRunnerResolution.hitType}@${state.pendingRunnerResolution.currentRunnerIndex}/${state.pendingRunnerResolution.runnersToResolve.length}${
                state.pendingRunnerResolution.batterStep ? ' [batterStep]' : ''
              }`
            : 'no'}
        </div>
        <div>
          batterIdx: {state.currentBatterIndex} | undo stack: {state.pastStates.length} | inningLog:{' '}
          {state.inningLog.length}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <button
          onClick={() => copyLog('text')}
          style={{
            flex: 1,
            background: '#005A9C',
            color: '#fff',
            border: 'none',
            padding: '8px',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        >
          Copy log (text)
        </button>
        <button
          onClick={() => copyLog('json')}
          style={{
            flex: 1,
            background: '#0a4a72',
            color: '#fff',
            border: 'none',
            padding: '8px',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        >
          Copy (JSON)
        </button>
        <button
          onClick={handleClear}
          style={{
            flex: '0 0 auto',
            background: '#5a2d2d',
            color: '#fff',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        >
          Clear
        </button>
      </div>
      {copyMsg && <div style={{ color: '#0f0', textAlign: 'center', marginBottom: '6px' }}>{copyMsg}</div>}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: '#111',
          border: '1px solid #333',
          borderRadius: '6px',
          padding: '8px',
        }}
      >
        <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>
          RECENT ACTIONS (newest first, max 100)
        </div>
        {entries.length === 0 && <div style={{ color: '#666' }}>No activity yet.</div>}
        {entries.map((entry, i) => (
          <div key={i} style={{ borderBottom: '1px solid #222', padding: '4px 0' }}>
            <span style={{ color: '#888' }}>{tsString(entry.timestamp)}</span>{' '}
            <span style={{ color: '#ccc' }}>{entry.diff.join(' | ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
