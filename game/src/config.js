// TIDECHART DUEL — table layout and tuning numbers. One file, one job:
// every size, speed and rate the world and the renderer share.
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const HUD_HEIGHT = 64;
export const STEP = 1 / 60;

// The one mechanic: your deck IS your life. 30 cards each; damage mills cards
// off the top of the other deck; an empty deck loses. Every turn you also draw
// 1 card, so even a quiet game runs dry — attack or be outlasted.
export const DECK_SIZE = 30;
export const HAND_SIZE = 5;
export const TIDE_BONUS = 3; // high tide: ATK +3; low tide: DEF +3
export const SUIT_BONUS = 2; // same suit as the rival's card: +2 current damage
export const REVEAL_SECONDS = 1.8; // how long the played pair stays on the table

// The four suits of the harbour chart. Glyphs are plain text so the game
// needs no font or image files.
export const SUITS = [
  { id: 'compass', name: 'COMPASS', glyph: '◎', color: '#ffd166' },
  { id: 'anchor', name: 'ANCHOR', glyph: '⚓', color: '#7ec8e3' },
  { id: 'star', name: 'STAR', glyph: '✦', color: '#e8a7d8' },
  { id: 'wave', name: 'WAVE', glyph: '≈', color: '#5ec8a5' },
];

// Card names by value band: low cards are shoals, high cards are deep water.
export function cardName(suit, value) {
  const band = value <= 3 ? 'Shoal' : value <= 6 ? 'Channel' : 'Deep';
  return `${band} ${suit.name.charAt(0) + suit.name.slice(1).toLowerCase()}`;
}

// Card geometry on the 1280x720 table.
export const TABLE = {
  x: 24, y: 88, width: 1232, height: 612,
  rivalHandY: 92,
  rivalCardW: 96, rivalCardH: 120,
  playY: 240, playCardW: 150, playCardH: 190,
  handY: 492,
  cardW: 150, cardH: 204,
  deckX: 60, rivalDeckX: 1160,
};

export const BEST_KEY = 'tidechart-duel-best';
export const SEED = 20261122;
