export type LichessGame = {
  white: string;
  black: string;
  pgn: string;
};

export async function searchPlayers(term: string): Promise<string[]> {
  if (!term.trim()) return [];
  const res = await fetch(`https://lichess.org/api/player/autocomplete?term=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error('Player search failed.');
  return res.json();
}

export async function fetchRecentGames(username: string, max = 15): Promise<LichessGame[]> {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=true`;
  const res = await fetch(url, { headers: { Accept: 'application/x-ndjson' } });
  if (!res.ok) {
    throw new Error(res.status === 404 ? `No account found for "${username}".` : 'Could not fetch games from Lichess.');
  }
  const text = await res.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((raw): LichessGame => ({
      white: raw.players?.white?.user?.name ?? 'Anonymous',
      black: raw.players?.black?.user?.name ?? 'Anonymous',
      pgn: raw.pgn ?? '',
    }))
    .filter((game) => game.pgn);
}
