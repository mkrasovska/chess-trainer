import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import type { OpeningStat } from '../lib/gameStats';

type OpeningStatsProps = {
  stats: OpeningStat[];
  columnLabel: string;
};

export function OpeningStats({ stats, columnLabel }: OpeningStatsProps) {
  if (stats.length === 0) return null;

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 260 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>{columnLabel}</TableCell>
            <TableCell align="right">Games</TableCell>
            <TableCell align="right">Win %</TableCell>
            <TableCell align="right">Loss %</TableCell>
            <TableCell align="right">Draw %</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {stats.map((stat) => (
            <TableRow key={stat.name}>
              <TableCell>{stat.name}</TableCell>
              <TableCell align="right">{stat.count}</TableCell>
              <TableCell align="right">{Math.round((stat.wins / stat.count) * 100)}%</TableCell>
              <TableCell align="right">{Math.round((stat.losses / stat.count) * 100)}%</TableCell>
              <TableCell align="right">{Math.round((stat.draws / stat.count) * 100)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
