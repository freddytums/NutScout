import type { GameConfig } from '../types/game';
import game2025 from './2025';
import game2026 from './2026';

const games: Record<number, GameConfig> = {
  2025: game2025,
  2026: game2026,
};

export function getGameConfig(year: number): GameConfig {
  const config = games[year];
  if (!config) throw new Error(`No game config for year ${year}`);
  return config;
}

export function getAvailableYears(): number[] {
  return Object.keys(games).map(Number).sort((a, b) => b - a);
}

export default games;
