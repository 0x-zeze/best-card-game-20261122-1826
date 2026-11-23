// TIDECHART DUEL — keyboard + mouse input: 1-5 play a hand card, ←/→ move
// the selection, Enter/Space confirm, P or Escape pauses, R restarts, and a
// click on a hand card plays it (a click anywhere else confirms the title
// and end screens).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let playIndex = -1;
  let clicked = false;
  let clickPoint = null;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.add(key);
    if (event.key === ' ' || event.key === 'Enter') actions |= ACTION_CONFIRM;
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') actions |= ACTION_PAUSE;
    if (event.key === 'r' || event.key === 'R') actions |= ACTION_RESTART;
    if (event.key >= '1' && event.key <= '5') playIndex = Number(event.key) - 1;
  }

  function onKeyUp(event) {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  }

  function onClick(event) {
    const rect = canvas.getBoundingClientRect();
    clickPoint = {
      x: (event.clientX - rect.left) * (1280 / rect.width),
      y: (event.clientY - rect.top) * (720 / rect.height),
    };
    clicked = true;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('click', onClick);

  return {
    /** Left/right selection movement, read every frame. */
    selection() {
      const left = keys.has('a') || keys.has('ArrowLeft');
      const right = keys.has('d') || keys.has('ArrowRight');
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** Actions pressed since the last read (confirm / pause / restart). */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** A 1-5 key pressed since the last read, or -1. */
    takePlayIndex() {
      const taken = playIndex;
      playIndex = -1;
      return taken;
    },
    /** A click since the last read, in 1280x720 table coordinates, or null. */
    takeClick() {
      if (!clicked) return null;
      clicked = false;
      const point = clickPoint;
      clickPoint = null;
      return point;
    },
  };
}
