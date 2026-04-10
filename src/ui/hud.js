export function createHud() {
  const statusElement = document.getElementById('status-text');
  const pinPanel = document.getElementById('pin-panel');
  const pinInput = document.getElementById('pin-input');
  const pinSubmit = document.getElementById('pin-submit');
  const musicToggle = document.getElementById('music-toggle');
  const inventoryPanel = createInventoryPanel();
  const inventoryItems = inventoryPanel.querySelector('.inventory-items');
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
    resetInventory() {
      inventoryItems.innerHTML = '';
    },
    showInventory() {
      inventoryPanel.classList.add('is-visible');
    },
    hideInventory() {
      inventoryPanel.classList.remove('is-visible');
    },
    addInventoryItem({ imageUrl, label }) {
      const item = document.createElement('div');
      item.className = 'inventory-item';

      const image = document.createElement('img');
      image.className = 'inventory-item-image';
      image.src = imageUrl;
      image.alt = label;

      const caption = document.createElement('div');
      caption.className = 'inventory-item-label';
      caption.textContent = label;

      item.append(image, caption);
      inventoryItems.appendChild(item);
    },
    async mergeInventoryItems({ finalImageUrl } = {}) {
      const items = Array.from(inventoryItems.querySelectorAll('.inventory-item'));
      if (items.length < 2) {
        return;
      }

      const leftImageUrl = items[0].querySelector('img')?.src ?? '';
      const rightImageUrl = items[1].querySelector('img')?.src ?? '';
      const mergeCard = document.createElement('div');
      mergeCard.className = 'inventory-merge-card';
      mergeCard.innerHTML = `
        <div class="inventory-merge-halves">
          <img class="inventory-merge-half inventory-merge-half--left" src="${leftImageUrl}" alt="" />
          <img class="inventory-merge-half inventory-merge-half--right" src="${rightImageUrl}" alt="" />
        </div>
        <img class="inventory-merge-final" src="${finalImageUrl ?? ''}" alt="Кольцо собрано" />
        <div class="inventory-item-label">Кольцо собрано</div>
      `;

      inventoryItems.innerHTML = '';
      inventoryItems.appendChild(mergeCard);

      requestAnimationFrame(() => {
        mergeCard.classList.add('is-merging');
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 1400);
      });

      inventoryItems.innerHTML = '';
      if (finalImageUrl) {
        const finalItem = document.createElement('div');
        finalItem.className = 'inventory-item';

        const image = document.createElement('img');
        image.className = 'inventory-item-image';
        image.src = finalImageUrl;
        image.alt = 'Кольцо собрано';

        const caption = document.createElement('div');
        caption.className = 'inventory-item-label';
        caption.textContent = 'Кольцо собрано';

        finalItem.append(image, caption);
        inventoryItems.appendChild(finalItem);
      }
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

function createInventoryPanel() {
  const panel = document.createElement('aside');
  panel.id = 'inventory-panel';
  panel.innerHTML = `
    <div class="inventory-title">Инвентарь</div>
    <div class="inventory-items"></div>
  `;
  document.body.appendChild(panel);
  return panel;
}
