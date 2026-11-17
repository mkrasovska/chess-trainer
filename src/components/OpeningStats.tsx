import { useState } from 'react';
import type { OpeningStat } from '../lib/gameStats';

type StatsMode = 'opening' | 'firstMove';

type OpeningStatsProps = {
  openingStats: OpeningStat[];
  firstMoveStats: OpeningStat[];
};

export function OpeningStats({ openingStats, firstMoveStats }: OpeningStatsProps) {
  const [mode, setMode] = useState<StatsMode>('opening');

  if (openingStats.length === 0 && firstMoveStats.length === 0) return null;

  const stats = mode === 'opening' ? openingStats : firstMoveStats;
  const columnLabel = mode === 'opening' ? 'Opening' : 'First move';

  return (
    <div className="opening-stats-section">
      <div className="opening-stats__switcher">
        <button
          type="button"
          className={mode === 'opening' ? 'opening-stats__switch opening-stats__switch--active' : 'opening-stats__switch'}
          onClick={() => setMode('opening')}
        >
          By opening
        </button>
        <button
          type="button"
          className={mode === 'firstMove' ? 'opening-stats__switch opening-stats__switch--active' : 'opening-stats__switch'}
          onClick={() => setMode('firstMove')}
        >
          By first move
        </button>
      </div>

      {stats.length === 0 ? (
        <p className="archive-import__status">No data for this view.</p>
      ) : (
        <div className="opening-stats-wrap">
          <table className="opening-stats">
            <thead>
              <tr>
                <th>{columnLabel}</th>
                <th>Games</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>Win %</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.name}>
                  <td>{stat.name}</td>
                  <td>{stat.count}</td>
                  <td>{stat.wins}</td>
                  <td>{stat.losses}</td>
                  <td>{stat.draws}</td>
                  <td>{Math.round((stat.wins / stat.count) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
