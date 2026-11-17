// EMBERDRIFT — keyboard and mouse state. One job: turn raw DOM events into a
// small, honest snapshot the world reads each step (which keys are held, where
// the mouse is in field coordinates, which buttons were just pressed). The
// world never touches an event listener itself.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const name = keyName(event);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(name);
    keys.add(name);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(keyName(event));
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left - offsetX) / scale;
    mouse.y = (event.clientY - rect.top - offsetY) / scale;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    /** Tell the input how the field maps onto the canvas, for mouse aim. */
    setViewport(viewScale, viewOffsetX, viewOffsetY) {
      scale = viewScale;
      offsetX = viewOffsetX;
      offsetY = viewOffsetY;
    },
    held(...names) {
      return names.some((name) => keys.has(name));
    },
    /** True once for the step after the key went down, then cleared. */
    wasPressed(...names) {
      return names.some((name) => pressed.has(name));
    },
    /** True once for the step after a mouse click, then cleared. */
    wasClicked() {
      return mouse.clicked;
    },
    /** Clear the one-shot presses at the end of each step. */
    endStep() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
