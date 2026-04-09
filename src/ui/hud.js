export function createHud() {
  const statusElement = document.getElementById('status-text');
  const pinPanel = document.getElementById('pin-panel');
  const pinInput = document.getElementById('pin-input');
  const pinSubmit = document.getElementById('pin-submit');
  const musicToggle = document.getElementById('music-toggle');

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
    },
    hidePinPanel() {
      pinPanel.style.display = 'none';
    },
    bindPinSubmit(handler) {
      pinSubmit.addEventListener('click', handler);
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
