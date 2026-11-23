// TIDECHART DUEL — pure world simulation (no DOM, no canvas): the tide,
// the deck-as-life rule, turn resolution and the rival AI. main.js drives
// it; render.js only paints the state.
import {
  DECK_SIZE, HAND_SIZE, TIDE_BONUS, SUIT_BONUS, REVEAL_SECONDS, SEED,
} from './config.js';
import { createRandom } from './random.js';
import { buildDeck } from './deck.js';

export const EVENT_PLAY = 1;
export const EVENT_WIN = 2;
export const EVENT_LOSS = 4;
export const EVENT_TIDE = 8;

export const TIDE_HIGH = 'high';
export const TIDE_LOW = 'low';
export const PHASE_CHOOSE = 'choose';
export const PHASE_REVEAL = 'reveal';
export const PHASE_OVER = 'over';

/** Effective ATK / DEF of a card under the current tide. */
export function effective(card, tide) {
  return {
    atk: card.atk + (tide === TIDE_HIGH ? TIDE_BONUS : 0),
    def: card.def + (tide === TIDE_LOW ? TIDE_BONUS : 0),
  };
}

/**
 * Damage one played card deals to the other side: attack minus the other
 * card's defence, never below zero, plus SUIT_BONUS when both cards ride
 * the same current (same suit) and this card's attack is the higher one.
 */
export function damageDealt(mine, theirs, tide) {
  const a = effective(mine, tide);
  const b = effective(theirs, tide);
  let damage = Math.max(0, a.atk - b.def);
  if (mine.suit === theirs.suit && a.atk > b.atk) damage += SUIT_BONUS;
  return damage;
}

function drawOne(side) {
  if (side.deck.length === 0) return;
  side.hand.push(side.deck.pop());
}

function mill(side, count) {
  let milled = 0;
  while (milled < count && side.deck.length > 0) {
    side.discard.push(side.deck.pop());
    milled += 1;
  }
  return milled;
}

/** The rival AI: play the card that maximises (damage dealt - damage taken). */
export function aiPick(rivalHand, yourCard, tide) {
  let best = 0;
  let bestNet = -Infinity;
  for (let i = 0; i < rivalHand.length; i += 1) {
    const card = rivalHand[i];
    const net = damageDealt(card, yourCard, tide) - damageDealt(yourCard, card, tide);
    if (net > bestNet || (net === bestNet && effective(card, tide).atk > effective(rivalHand[best], tide).atk)) {
      bestNet = net;
      best = i;
    }
  }
  return best;
}

export function createWorld() {
  const state = freshState();
  return { state, reset, step, playCard };

  function freshState() {
    const random = createRandom(SEED);
    const you = { deck: buildDeck(random), hand: [], discard: [], damageDealt: 0 };
    const rival = { deck: buildDeck(random), hand: [], discard: [], damageDealt: 0 };
    for (let i = 0; i < HAND_SIZE; i += 1) {
      drawOne(you);
      drawOne(rival);
    }
    return {
      time: 0,
      turn: 1,
      tide: TIDE_HIGH,
      phase: PHASE_CHOOSE,
      revealTimer: 0,
      selected: 0,
      you,
      rival,
      playedYou: null,
      playedRival: null,
      lastDamage: null, // { toRival, toYou, suitBonus }
      message: 'Your turn — play a card (click it, or keys 1-5).',
      won: false,
      lost: false,
      best: 0,
    };
  }

  function reset() {
    const next = freshState();
    // Keep the persistent best score across restarts in this visit.
    next.best = state.best;
    Object.assign(state, next);
  }

  /**
   * Play the player's hand[index] card. Resolves the whole turn at once:
   * the rival answers, damage mills decks, both draw 1, then the reveal
   * phase shows the pair until the tide flips. Returns an event bitmask.
   */
  function playCard(index) {
    if (state.phase !== PHASE_CHOOSE || state.won || state.lost) return 0;
    if (index < 0 || index >= state.you.hand.length) return 0;
    const youCard = state.you.hand.splice(index, 1)[0];
    const rivalIndex = aiPick(state.rival.hand, youCard, state.tide);
    const rivalCard = state.rival.hand.splice(rivalIndex, 1)[0];
    const toRival = damageDealt(youCard, rivalCard, state.tide);
    const toYou = damageDealt(rivalCard, youCard, state.tide);
    const suitBonus = youCard.suit === rivalCard.suit && effective(youCard, state.tide).atk > effective(rivalCard, state.tide).atk;
    state.playedYou = youCard;
    state.playedRival = rivalCard;
    state.lastDamage = { toRival, toYou, suitBonus };
    state.you.damageDealt += toRival;
    state.rival.damageDealt += toYou;
    const milledRival = mill(state.rival, toRival);
    const milledYou = mill(state.you, toYou);
    state.you.discard.push(youCard);
    state.rival.discard.push(rivalCard);
    state.phase = PHASE_REVEAL;
    state.revealTimer = REVEAL_SECONDS;
    let events = EVENT_PLAY;
    if (state.rival.deck.length === 0 && state.you.deck.length === 0) {
      // Both charts ran dry on the same tide: the heavier blow wins.
      if (toRival >= toYou) { state.won = true; events |= EVENT_WIN; }
      else { state.lost = true; events |= EVENT_LOSS; }
      state.phase = PHASE_OVER;
      state.message = state.won
        ? 'Both decks ran dry — your blow was heavier. You charted the sea.'
        : 'Both decks ran dry — the rival’s blow was heavier.';
    } else if (state.rival.deck.length === 0) {
      state.won = true;
      events |= EVENT_WIN;
      state.phase = PHASE_OVER;
      state.message = `Rival deck milled to zero (${milledRival} cards this turn). You win!`;
    } else if (state.you.deck.length === 0) {
      state.lost = true;
      events |= EVENT_LOSS;
      state.phase = PHASE_OVER;
      state.message = `Your deck milled to zero (${milledYou} cards this turn). The sea takes you.`;
    } else {
      state.message = describeTurn(youCard, rivalCard, toRival, toYou, suitBonus);
    }
    return events;
  }

  function describeTurn(youCard, rivalCard, toRival, toYou, suitBonus) {
    const tideWord = state.tide === TIDE_HIGH ? 'HIGH TIDE (ATK +3)' : 'LOW TIDE (DEF +3)';
    const parts = [`${tideWord} — you played ${youCard.name} ${youCard.value}, rival played ${rivalCard.name} ${rivalCard.value}.`];
    if (suitBonus) parts.push('Same current: +2.');
    if (toRival > 0) parts.push(`You mill ${toRival} rival card${toRival > 1 ? 's' : ''}.`);
    if (toYou > 0) parts.push(`Rival mills ${toYou} of yours.`);
    if (toRival === 0 && toYou === 0) parts.push('No damage — the waves cancel out.');
    return parts.join(' ');
  }

  /** Advance one fixed step: only the reveal timer moves the world. */
  function step(dt) {
    if (state.won || state.lost) return 0;
    state.time += dt;
    if (state.phase !== PHASE_REVEAL) return 0;
    state.revealTimer -= dt;
    if (state.revealTimer > 0) return 0;
    // Next turn: draw 1 each (drawing mills your own deck by 1), flip tide.
    drawOne(state.you);
    drawOne(state.rival);
    if (state.rival.deck.length === 0 && state.you.deck.length === 0) {
      state.won = state.you.damageDealt >= state.rival.damageDealt;
      state.lost = !state.won;
      state.phase = PHASE_OVER;
      state.message = 'Both decks ran dry on the draw. The heavier chart wins.';
      return state.won ? EVENT_WIN : EVENT_LOSS;
    }
    if (state.rival.deck.length === 0) {
      state.won = true; state.phase = PHASE_OVER;
      state.message = 'The rival’s deck ran dry on the draw. You win!';
      return EVENT_WIN;
    }
    if (state.you.deck.length === 0) {
      state.lost = true; state.phase = PHASE_OVER;
      state.message = 'Your deck ran dry on the draw. The sea takes you.';
      return EVENT_LOSS;
    }
    state.turn += 1;
    state.tide = state.tide === TIDE_HIGH ? TIDE_LOW : TIDE_HIGH;
    state.playedYou = null;
    state.playedRival = null;
    state.lastDamage = null;
    state.selected = Math.min(state.selected, state.you.hand.length - 1);
    state.phase = PHASE_CHOOSE;
    state.message = state.tide === TIDE_HIGH
      ? `Turn ${state.turn} — HIGH TIDE: attack +3. Your turn, play a card.`
      : `Turn ${state.turn} — LOW TIDE: defence +3. Your turn, play a card.`;
    return EVENT_TIDE;
  }
}

export { DECK_SIZE, HAND_SIZE };
