(() => {
  let running = false;
  let totalSteps = 0;
  let stagnationCount = 0;
  let lastScrollHeight = 0;
  let lastItemCount = 0;
  let targetEl = null;

  const INTERVAL_MS = 250;
  const MAX_STAGNATION = 6;
  const MAX_TOTAL_STEPS = 20000;
  const NUDGE_EVERY = 10;
  const CHUNK = 0.9;
  const MIN_SIZE = 240;

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function isScrollable(el) {
    if (!el) return false;
    const cs = getComputedStyle(el);
    const overflowY = cs.overflowY;
    const canScrollY = (overflowY === 'auto' || overflowY === 'scroll');
    const scrollable = el.scrollHeight > el.clientHeight + 2;
    const bigEnough = el.clientHeight >= MIN_SIZE && el.clientWidth >= MIN_SIZE;
    return canScrollY && scrollable && bigEnough;
  }

  function allCandidates() {
    const list = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    while (node = walker.nextNode()) {
      if (!(node instanceof HTMLElement)) continue;
      if (isScrollable(node)) {
        const rect = node.getBoundingClientRect();
        const area = Math.max(0, rect.width) * Math.max(0, rect.height);
        list.push({ el: node, area, rect });
      }
    }
    const de = document.documentElement, b = document.body;
    list.push({ el: de, area: de.clientWidth * de.clientHeight });
    list.push({ el: b,  area: b.clientWidth  * b.clientHeight  });
    list.sort((a, b) => b.area - a.area);
    return list.map(x => x.el);
  }

  function pickScrollable(customSelector) {
    if (customSelector) {
      const bySel = document.querySelector(customSelector);
      if (bySel) return bySel;
    }
    for (const el of allCandidates()) {
      if (isScrollable(el)) return el;
    }
    return document.scrollingElement || document.documentElement;
  }

  function childCountHint(el) {
    let best = { node: null, count: 0 };
    for (const child of el.children) {
      const c = child.querySelectorAll(':scope > *').length || child.children.length;
      if (c > best.count) best = { node: child, count: c };
    }
    const direct = el.querySelectorAll(':scope > *').length;
    return Math.max(best.count, direct);
  }

  function statusText() {
    if (!running) return 'idle';
    return `running steps=${totalSteps} height=${lastScrollHeight} items=${lastItemCount}`;
  }

  async function loop(customSelector) {
    running = true;
    targetEl = pickScrollable(customSelector);

    lastScrollHeight = targetEl.scrollHeight;
    lastItemCount = childCountHint(targetEl);
    stagnationCount = 0;
    totalSteps = 0;

    while (running) {
      totalSteps++;

      const delta = Math.max(200, Math.floor(targetEl.clientHeight * CHUNK));
      targetEl.scrollBy(0, delta);

      if (totalSteps % NUDGE_EVERY === 0) {
        targetEl.dispatchEvent(new Event('scroll', { bubbles: true }));
        targetEl.scrollBy(0, -20);
        targetEl.scrollBy(0, 20);
      }

      await sleep(INTERVAL_MS);

      const h = targetEl.scrollHeight;
      const atBottom = (targetEl.scrollTop + targetEl.clientHeight) >= (h - 2);
      const items = childCountHint(targetEl);

      const grewByHeight = h > lastScrollHeight;
      const grewByItems  = items > lastItemCount;

      if (grewByHeight || grewByItems) {
        lastScrollHeight = h;
        lastItemCount = items;
        stagnationCount = 0;
      } else if (atBottom) {
        stagnationCount++;
      }

      if (stagnationCount >= MAX_STAGNATION) break;
      if (totalSteps >= MAX_TOTAL_STEPS) break;
    }

    targetEl.scrollTop = targetEl.scrollHeight;
    running = false;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.cmd) return;

    if (msg.cmd === 'start') {
      if (!running) loop(msg.selector).catch(() => { running = false; });
      sendResponse({ ok: true, status: statusText() });
      return true;
    }
    if (msg.cmd === 'stop') {
      running = false;
      sendResponse({ ok: true, status: statusText() });
      return true;
    }
    if (msg.cmd === 'status') {
      sendResponse({ ok: true, status: statusText() });
      return true;
    }
  });
})();
