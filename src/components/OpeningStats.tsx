import type { OpeningStat } from '../lib/gameStats';

type OpeningStatsProps = {
  stats: OpeningStat[];
  columnLabel: string;
};

export function OpeningStats({ stats, columnLabel }: OpeningStatsProps) {
  if (stats.length === 0) return null;

  return (
    <div className="opening-stats-section">
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
              <th>Loss %</th>
              <th>Draw %</th>
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
                <td>{Math.round((stat.losses / stat.count) * 100)}%</td>
                <td>{Math.round((stat.draws / stat.count) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
