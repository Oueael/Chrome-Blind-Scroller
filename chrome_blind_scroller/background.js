chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg?.cmd === "inject") {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: msg.tabId },
        files: ["content.js"]
      });
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }

  if (msg?.cmd === "start" || msg?.cmd === "stop" || msg?.cmd === "status") {
    chrome.tabs.sendMessage(msg.tabId, { cmd: msg.cmd }, (resp) => {
      sendResponse(resp || { ok: false, error: chrome.runtime.lastError?.message });
    });
    return true;
  }
});
