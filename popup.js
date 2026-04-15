async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function setUI(enabled) {
  const btn = document.getElementById('toggleBtn');
  const label = document.getElementById('toggleLabel');
  if (enabled) {
    btn.classList.add('active');
    label.textContent = 'Disable Overlay';
  } else {
    btn.classList.remove('active');
    label.textContent = 'Enable Overlay';
  }
}

async function init() {
  const tab = await getActiveTab();

  try {
    const state = await browser.tabs.sendMessage(tab.id, { action: 'getState' });
    setUI(state.enabled);
  } catch {
    setUI(false);
  }

  document.getElementById('toggleBtn').addEventListener('click', async () => {
    const tab = await getActiveTab();
    try {
      const res = await browser.tabs.sendMessage(tab.id, { action: 'toggle' });
      setUI(res.enabled);
    } catch (e) {
      console.error('Alignment Lines: could not reach content script.', e);
    }
  });

  document.getElementById('clearBtn').addEventListener('click', async () => {
    const tab = await getActiveTab();
    try {
      await browser.tabs.sendMessage(tab.id, { action: 'clear' });
    } catch (e) {
      console.error('Alignment Lines: could not reach content script.', e);
    }
  });
}

init();
