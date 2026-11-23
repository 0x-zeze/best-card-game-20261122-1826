// TIDECHART DUEL — the deck. A card is { suit, value, atk, def, name }:
// ATK is its value (1-9), DEF is 10 minus its value, so a heavy card hits
// hard but blocks badly and a light card is the opposite. 4 suits x values
// 1-9 is 36 cards; the seeded shuffle takes the top 30, so every game deals
// a different 30-card chart from the same seed.
import { SUITS, DECK_SIZE, cardName } from './config.js';

export function buildDeck(random) {
  const cards = [];
  for (const suit of SUITS) {
    for (let value = 1; value <= 9; value += 1) {
      cards.push({
        suit: suit.id,
        value,
        atk: value,
        def: 10 - value,
        name: cardName(suit, value),
      });
    }
  }
  // Fisher-Yates with the seeded generator: same seed, same deck.
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
  }
  return cards.slice(0, DECK_SIZE);
}

export function suitOf(card) {
  return SUITS.find((s) => s.id === card.suit);
}
