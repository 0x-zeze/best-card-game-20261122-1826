// TIDECHART DUEL — the four screenshot scenes (?shot=title|play|win|loss).
// Each one stages the real world state directly (hands, decks, tide, played
// pair, damage) and lets the renderer paint it, so every shot is a true
// render of the game.
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, SCREEN_OVER } from './render.js';
import { TIDE_HIGH, TIDE_LOW, PHASE_REVEAL, PHASE_OVER } from './world.js';
import { SUITS } from './config.js';

function card(suitId, value) {
  const suit = SUITS.find((s) => s.id === suitId);
  return { suit: suitId, value, atk: value, def: 10 - value, name: `${value <= 3 ? 'Shoal' : value <= 6 ? 'Channel' : 'Deep'} ${suit.name.charAt(0) + suit.name.slice(1).toLowerCase()}` };
}

/**
 * Stage the named scene on a fresh world and return the screen to draw.
 * Unknown names fall back to the title shot.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'play') {
    // Mid-game, everything in one frame: both hands, both deck piles as
    // life totals, the tide banner, the played pair and the mill numbers.
    state.turn = 7;
    state.tide = TIDE_HIGH;
    state.phase = PHASE_REVEAL;
    state.revealTimer = 99;
    state.you.hand = [card('compass', 8), card('wave', 3), card('star', 6), card('anchor', 9), card('compass', 2)];
    state.rival.hand = [card('star', 4), card('wave', 7), card('anchor', 5), card('compass', 1), card('star', 8)];
    state.you.deck.length = 21;
    state.rival.deck.length = 17;
    state.you.discard.length = 4;
    state.rival.discard.length = 8;
    state.you.damageDealt = 13;
    state.rival.damageDealt = 9;
    state.playedYou = card('compass', 8);
    state.playedRival = card('compass', 5);
    state.lastDamage = { toRival: 6, toYou: 0, suitBonus: true };
    state.selected = 2;
    state.message = 'HIGH TIDE (ATK +3) — you played Deep Compass 8, rival played Channel Compass 5. Same current: +2. You mill 6 rival cards.';
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    // The win screen: the rival deck milled to zero.
    state.turn = 14;
    state.tide = TIDE_LOW;
    state.you.deck.length = 9;
    state.rival.deck.length = 0;
    state.you.discard.length = 16;
    state.rival.discard.length = 25;
    state.you.damageDealt = 30;
    state.rival.damageDealt = 21;
    state.won = true;
    state.phase = PHASE_OVER;
    state.message = 'Rival deck milled to zero (4 cards this turn). You win!';
    return { screen: SCREEN_WIN, best: 30 };
  }
  if (name === 'loss') {
    // The loss screen: your own deck ran dry.
    state.turn = 12;
    state.tide = TIDE_HIGH;
    state.you.deck.length = 0;
    state.rival.deck.length = 11;
    state.you.discard.length = 25;
    state.rival.discard.length = 14;
    state.you.damageDealt = 19;
    state.rival.damageDealt = 30;
    state.lost = true;
    state.phase = PHASE_OVER;
    state.message = 'Your deck milled to zero (5 cards this turn). The sea takes you.';
    return { screen: SCREEN_OVER, best: 19 };
  }
  // title: a fresh deal under the title overlay.
  state.tide = TIDE_HIGH;
  return { screen: SCREEN_TITLE, best: 0 };
}
