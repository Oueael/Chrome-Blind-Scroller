async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureInjected(tabId) {
  const ping = await new Promise((res) => {
    chrome.tabs.sendMessage(tabId, { cmd: "status" }, (resp) => res(resp));
  });
  if (!ping || ping.error) {
    await new Promise((res, rej) => {
      chrome.runtime.sendMessage({ cmd: "inject", tabId }, (r) => {
        if (r?.ok) res();
        else rej(new Error(r?.error || "inject failed"));
      });
    });
  }
}

async function send(tabId, cmd) {
  return await new Promise((res) => {
    chrome.runtime.sendMessage({ cmd, tabId }, (resp) => res(resp));
  });
}

async function updateStatus(tabId) {
  const resp = await send(tabId, "status");
  document.getElementById("status").textContent =
    "Status: " + (resp?.status || resp?.error || "unknown");
}

document.getElementById("start").addEventListener("click", async () => {
  const tab = await getActiveTab();
  try {
    await ensureInjected(tab.id);
    const resp = await send(tab.id, "start");
    if (resp?.ok) await updateStatus(tab.id);
    else throw new Error(resp?.error || "start failed");
  } catch (e) {
    document.getElementById("status").textContent = "Error: " + e.message;
  }
});

document.getElementById("stop").addEventListener("click", async () => {
  const tab = await getActiveTab();
  const resp = await send(tab.id, "stop");
  if (resp?.ok) await updateStatus(tab.id);
  else document.getElementById("status").textContent = "Error: " + (resp?.error || "stop failed");
});

(async () => {
  const tab = await getActiveTab();
  try {
    await ensureInjected(tab.id);
  } catch {}
  await updateStatus(tab.id);
})();
