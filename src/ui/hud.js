export function createHud() {
  const statusElement = document.getElementById('status-text');
  const pinPanel = document.getElementById('pin-panel');
  const pinInput = document.getElementById('pin-input');
  const pinSubmit = document.getElementById('pin-submit');
  const musicToggle = document.getElementById('music-toggle');
  let lastPinSubmitAt = 0;

  function runOncePerTap(handler) {
    const now = Date.now();
    if (now - lastPinSubmitAt < 250) {
      return;
    }
    lastPinSubmitAt = now;
    handler();
  }

  return {
    getPinValue() {
      return pinInput.value.trim();
    },
    setStatus(text) {
      if (statusElement) {
        statusElement.innerText = text;
      }
    },
    showPinPanel() {
      pinPanel.style.display = 'block';
      pinInput.focus();
    },
    hidePinPanel() {
      pinPanel.style.display = 'none';
    },
    bindPinSubmit(handler) {
      pinSubmit.addEventListener('pointerup', () => runOncePerTap(handler));
      pinSubmit.addEventListener('click', () => runOncePerTap(handler));
      pinInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runOncePerTap(handler);
        }
      });
    },
    bindMusicToggle(handler) {
      musicToggle.addEventListener('click', handler);
    },
    setMusicToggleVisible(isVisible) {
      musicToggle.classList.toggle('is-visible', isVisible);
    },
    updateMusicToggle(isEnabled) {
      musicToggle.textContent = isEnabled ? '♫' : '✕';
      musicToggle.setAttribute(
        'aria-label',
        isEnabled ? 'Выключить музыку' : 'Включить музыку'
      );
    },
  };
}
