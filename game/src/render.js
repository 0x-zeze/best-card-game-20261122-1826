// TIDECHART DUEL — the renderer: a harbour table at dusk, two cartographers'
// charts laid out as cards, the tide banner across the top, deck piles that
// ARE each side's life total, and the played pair in the middle.
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, TABLE, TIDE_BONUS, SUIT_BONUS,
} from './config.js';
import { suitOf } from './deck.js';
import { TIDE_HIGH, TIDE_LOW, PHASE_REVEAL, PHASE_OVER, effective } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

/** Screen rects of the player's hand cards, for click handling in main.js. */
export function handRects(state) {
  const n = state.you.hand.length;
  const total = n * TABLE.cardW + (n - 1) * 12;
  const x0 = (CANVAS_WIDTH - total) / 2;
  return state.you.hand.map((card, i) => ({
    x: x0 + i * (TABLE.cardW + 12),
    y: TABLE.handY - (i === state.selected ? 16 : 0),
    w: TABLE.cardW,
    h: TABLE.cardH,
    index: i,
  }));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const scale = { x: 1, y: 1 };
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    scale.x = canvas.width / CANVAS_WIDTH;
    scale.y = canvas.height / CANVAS_HEIGHT;
  }
  window.addEventListener('resize', resize);
  resize();

  return { draw };

  function draw(state, screen, best, ui) {
    ctx.setTransform(scale.x, 0, 0, scale.y, 0, 0);
    drawTable(state, screen);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_OVER) drawEnd(state, false, best);
    else if (screen === SCREEN_WIN) drawEnd(state, true, best);
    else if (screen === SCREEN_PAUSED) drawPausedBanner();
  }

  /** Harbour table, both hands, both deck piles, tide banner, message line. */
  function drawTable(state, screen) {
    // Dusk harbour: deep teal felt, darker vignette, faint chart grid.
    ctx.fillStyle = '#0d2733';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = 'rgba(140,200,220,0.06)';
    ctx.lineWidth = 1;
    for (let x = TABLE.x; x <= TABLE.x + TABLE.width; x += 77) {
      ctx.beginPath(); ctx.moveTo(x, TABLE.y); ctx.lineTo(x, TABLE.y + TABLE.height); ctx.stroke();
    }
    for (let y = TABLE.y; y <= TABLE.y + TABLE.height; y += 77) {
      ctx.beginPath(); ctx.moveTo(TABLE.x, y); ctx.lineTo(TABLE.x + TABLE.width, y); ctx.stroke();
    }
    // A painted sea-chart arc across the middle of the table.
    ctx.strokeStyle = 'rgba(255,209,102,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(640, 380, 150, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(640, 380, 110, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();

    drawHud(state);
    drawRivalHand(state);
    drawDeckPile(1160, 100, state.rival.deck.length, state.rival.discard.length, 'RIVAL DECK');
    drawDeckPile(40, 500, state.you.deck.length, state.you.discard.length, 'YOUR DECK');
    drawPlayed(state, screen);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawMessage(state);
    drawPlayerHand(state, screen);
  }

  function drawHud(state) {
    ctx.fillStyle = '#081820';
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
    ctx.fillStyle = '#12303d';
    ctx.fillRect(0, HUD_HEIGHT - 2, CANVAS_WIDTH, 2);
    // Left: your deck = your life. Right: the rival's.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#7ee081';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`YOU  ·  DECK ${state.you.deck.length} = LIFE`, 24, 24);
    ctx.fillStyle = '#9fc6d4';
    ctx.font = '15px sans-serif';
    ctx.fillText(`damage dealt ${state.you.damageDealt}  ·  discard ${state.you.discard.length}`, 24, 48);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff8f8f';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`RIVAL  ·  DECK ${state.rival.deck.length} = LIFE`, CANVAS_WIDTH - 24, 24);
    ctx.fillStyle = '#9fc6d4';
    ctx.font = '15px sans-serif';
    ctx.fillText(`damage dealt ${state.rival.damageDealt}  ·  discard ${state.rival.discard.length}`, CANVAS_WIDTH - 24, 48);
    // Centre: the tide — the number that flips every turn.
    const high = state.tide === TIDE_HIGH;
    ctx.textAlign = 'center';
    ctx.fillStyle = high ? '#4fc3f7' : '#ffb74d';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(high ? '🌊 HIGH TIDE — ATK +3' : '🌙 LOW TIDE — DEF +3', CANVAS_WIDTH / 2, 22);
    ctx.fillStyle = '#d7ecf2';
    ctx.font = '15px sans-serif';
    ctx.fillText(`turn ${state.turn}  ·  values flip with the tide every turn`, CANVAS_WIDTH / 2, 47);
  }

  function drawDeckPile(x, y, count, discardCount, label) {
    // A stack of chart sheets; the number on it IS the life total.
    ctx.fillStyle = '#0a1a22';
    ctx.fillRect(x - 4, y - 4, 88, 124);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i === 0 ? '#f5eeda' : '#d8cfae';
      roundRect(ctx, x + i * 3, y + i * 3, 76, 108, 6);
      ctx.fill();
    }
    ctx.fillStyle = '#12303d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(String(count), x + 41, y + 48);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('CARDS', x + 41, y + 82);
    ctx.fillStyle = '#d7ecf2';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(label, x + 41, y - 18);
    ctx.fillStyle = '#9fc6d4';
    ctx.font = '13px sans-serif';
    ctx.fillText(`milled ${discardCount}`, x + 41, y + 136);
  }

  function drawRivalHand(state) {
    const n = state.rival.hand.length;
    const total = n * TABLE.rivalCardW + (n - 1) * 10;
    const x0 = (CANVAS_WIDTH - total) / 2;
    ctx.fillStyle = '#d7ecf2';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('RIVAL HAND — face down, count the backs', CANVAS_WIDTH / 2, TABLE.rivalHandY - 14);
    for (let i = 0; i < n; i += 1) {
      drawCardBack(x0 + i * (TABLE.rivalCardW + 10), TABLE.rivalHandY, TABLE.rivalCardW, TABLE.rivalCardH);
    }
  }

  function drawCardBack(x, y, w, h) {
    ctx.fillStyle = '#12303d';
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 6);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(w * 0.42)}px sans-serif`;
    ctx.fillText('◎', x + w / 2, y + h / 2 - 6);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('TIDECHART', x + w / 2, y + h - 20);
  }

  function drawCard(card, x, y, w, h, tide, opts) {
    const suit = suitOf(card);
    const eff = effective(card, tide);
    const selected = opts && opts.selected;
    const dim = opts && opts.dim;
    ctx.save();
    if (dim) ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#f5eeda';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffd166' : suit.color;
    ctx.lineWidth = selected ? 5 : 3;
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 8);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#12303d';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(card.name.toUpperCase(), x + w / 2, y + 22);
    ctx.fillStyle = suit.color;
    ctx.strokeStyle = '#12303d';
    ctx.lineWidth = 1;
    ctx.font = `bold ${Math.round(w * 0.44)}px sans-serif`;
    ctx.fillText(suit.glyph, x + w / 2, y + h * 0.42);
    ctx.fillStyle = '#12303d';
    ctx.font = `bold ${Math.round(w * 0.34)}px sans-serif`;
    ctx.fillText(String(card.value), x + w / 2, y + h * 0.66);
    // ATK and DEF boxes: the tide bonus is shown in green on the boosted one.
    const atkBoost = tide === TIDE_HIGH;
    const defBoost = !atkBoost;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = atkBoost ? '#0a7a3d' : '#12303d';
    ctx.textAlign = 'left';
    ctx.fillText(`ATK ${eff.atk}${atkBoost ? ' +3' : ''}`, x + 10, y + h - 20);
    ctx.fillStyle = defBoost ? '#0a7a3d' : '#12303d';
    ctx.textAlign = 'right';
    ctx.fillText(`DEF ${eff.def}${defBoost ? ' +3' : ''}`, x + w - 10, y + h - 20);
    ctx.restore();
  }

  function drawPlayerHand(state, screen) {
    const rects = handRects(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      ctx.fillStyle = '#d7ecf2';
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('YOUR HAND — click a card or press 1-5 to play it', CANVAS_WIDTH / 2, TABLE.handY - 16);
    }
    state.you.hand.forEach((card, i) => {
      const r = rects[i];
      drawCard(card, r.x, r.y, r.w, r.h, state.tide, { selected: i === state.selected });
    });
    // Key hints under each card.
    ctx.fillStyle = '#9fc6d4';
    ctx.font = 'bold 13px sans-serif';
    rects.forEach((r) => {
      ctx.fillText(`[${r.index + 1}]`, r.x + r.w / 2, TABLE.handY + TABLE.cardH + 14);
    });
  }

  function drawPlayed(state, screen) {
    if (!state.playedYou || !state.playedRival) {
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
        ctx.fillStyle = '#9fc6d4';
        ctx.textAlign = 'center';
        ctx.font = 'italic 18px sans-serif';
        ctx.fillText('No cards on the table yet — the first tide is yours to chart.', CANVAS_WIDTH / 2, 360);
      }
      return;
    }
    const cy = TABLE.playY;
    const youX = CANVAS_WIDTH / 2 - TABLE.playCardW - 70;
    const rivalX = CANVAS_WIDTH / 2 + 70;
    ctx.fillStyle = '#d7ecf2';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU PLAYED', youX + TABLE.playCardW / 2, cy - 18);
    ctx.fillText('RIVAL PLAYED', rivalX + TABLE.playCardW / 2, cy - 18);
    drawCard(state.playedYou, youX, cy, TABLE.playCardW, TABLE.playCardH, state.tide, {});
    drawCard(state.playedRival, rivalX, cy, TABLE.playCardW, TABLE.playCardH, state.tide, {});
    // Damage numbers stacked in the free column between the two cards.
    const d = state.lastDamage;
    if (d) {
      let lineY = cy + 64;
      ctx.textAlign = 'center';
      if (d.toRival > 0) {
        ctx.fillStyle = '#7ee081';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`-${d.toRival}`, CANVAS_WIDTH / 2, lineY);
        ctx.font = '15px sans-serif';
        ctx.fillText('milled from rival deck', CANVAS_WIDTH / 2, lineY + 22);
        lineY += 52;
      }
      if (d.toYou > 0) {
        ctx.fillStyle = '#ff8f8f';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`-${d.toYou}`, CANVAS_WIDTH / 2, lineY);
        ctx.font = '15px sans-serif';
        ctx.fillText('milled from your deck', CANVAS_WIDTH / 2, lineY + 22);
        lineY += 52;
      }
      if (d.toRival === 0 && d.toYou === 0) {
        ctx.fillStyle = '#d7ecf2';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('0 — 0', CANVAS_WIDTH / 2, lineY);
        ctx.font = '15px sans-serif';
        ctx.fillText('waves cancel out', CANVAS_WIDTH / 2, lineY + 22);
        lineY += 52;
      }
      if (d.suitBonus) {
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('SAME CURRENT +2', CANVAS_WIDTH / 2, lineY);
      }
    }
  }

  function drawMessage(state) {
    ctx.fillStyle = '#d7ecf2';
    ctx.textAlign = 'center';
    ctx.font = '16px sans-serif';
    const text = state.message.length > 150 ? state.message.slice(0, 147) + '…' : state.message;
    ctx.fillText(text, CANVAS_WIDTH / 2, 448);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(6,18,26,0.94)';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('TIDECHART DUEL', CANVAS_WIDTH / 2, 210);
    ctx.fillStyle = '#d7ecf2';
    ctx.font = '26px sans-serif';
    ctx.fillText('Two cartographers. One changing sea. Your deck is your life.', CANVAS_WIDTH / 2, 258);
    const rules = [
      'DECK IS LIFE — 30 cards each. Damage mills cards off the rival deck. Empty deck loses.',
      'THE TIDE FLIPS EVERY TURN — HIGH TIDE: attack +3. LOW TIDE: defence +3. Values flip with it.',
      'SAME CURRENT — play the rival’s suit and the higher attack mills +2 more.',
      'DRAW 1 EVERY TURN — even a quiet game runs dry. Attack, or be outlasted.',
    ];
    ctx.font = '18px sans-serif';
    rules.forEach((line, i) => ctx.fillText(line, CANVAS_WIDTH / 2, 318 + i * 32));
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('SPACE or CLICK to start  ·  1-5 / ← → + Enter to play  ·  P pause  ·  R restart', CANVAS_WIDTH / 2, 480);
    if (best > 0) {
      ctx.fillStyle = '#9fc6d4';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Best damage in one game: ${best}`, CANVAS_WIDTH / 2, 520);
    }
  }

  function drawEnd(state, won, best) {
    ctx.fillStyle = won ? 'rgba(10,60,35,0.94)' : 'rgba(60,12,18,0.94)';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#7ee081' : '#ff8f8f';
    ctx.font = 'bold 58px sans-serif';
    ctx.fillText(won ? 'CHARTED! YOU WIN' : 'ADRIFT — YOU LOSE', CANVAS_WIDTH / 2, 250);
    ctx.fillStyle = '#f5eeda';
    ctx.font = '22px sans-serif';
    ctx.fillText(
      won ? 'The rival’s deck is empty. The sea is yours to map.' : 'Your deck ran dry. The sea keeps its charts.',
      CANVAS_WIDTH / 2, 300,
    );
    ctx.font = '19px sans-serif';
    const lines = [
      `Turns played: ${state.turn}  ·  Damage you dealt: ${state.you.damageDealt}  ·  Damage taken: ${state.rival.damageDealt}`,
      `Your deck left: ${state.you.deck.length}  ·  Rival deck left: ${state.rival.deck.length}`,
      `Best damage in one game: ${Math.max(best, state.you.damageDealt)}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, CANVAS_WIDTH / 2, 352 + i * 32));
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press R or click to play again', CANVAS_WIDTH / 2, 480);
  }

  function drawPausedBanner() {
    ctx.fillStyle = 'rgba(6,18,26,0.75)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.fillStyle = '#d7ecf2';
    ctx.font = '20px sans-serif';
    ctx.fillText('P / Esc to resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 44);
  }
}
