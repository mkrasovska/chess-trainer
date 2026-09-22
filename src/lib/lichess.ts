export type LichessGame = {
  id: string;
  white: string;
  black: string;
  whiteRating: number | null;
  blackRating: number | null;
  winner: 'white' | 'black' | null;
  speed: string;
  createdAt: number;
  openingName: string | null;
  pgn: string;
};

export async function searchPlayers(term: string): Promise<string[]> {
  if (!term.trim()) return [];
  const res = await fetch(`https://lichess.org/api/player/autocomplete?term=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error('Player search failed.');
  return res.json();
}

export async function fetchRecentGames(username: string, max = 15): Promise<LichessGame[]> {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=true&opening=true`;
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
      id: raw.id,
      white: raw.players?.white?.user?.name ?? 'Anonymous',
      black: raw.players?.black?.user?.name ?? 'Anonymous',
      whiteRating: raw.players?.white?.rating ?? null,
      blackRating: raw.players?.black?.rating ?? null,
      winner: raw.winner ?? null,
      speed: raw.speed ?? 'unknown',
      createdAt: raw.createdAt,
      openingName: raw.opening?.name ?? null,
      pgn: raw.pgn ?? '',
    }))
    .filter((game) => game.pgn);
}
