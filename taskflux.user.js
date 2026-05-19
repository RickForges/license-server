// ==UserScript==
// @name         TaskFlux Auto Claimer (Licensed)
// @namespace    taskflux.auto.claim.bb
// @version      9.0.0
// @description  Auto‑activates from download link. License required.
// @match        https://taskflux.net/dashboard*
// @match        https://www.reddit.com/r/*/about*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  // INTEGRITY_START
  const SERVER_URL = 'https://license-server-9ukzdg.fly.dev/';
  const EMBEDDED_LICENSE = "%%LICENSE%%";
  const EXPECTED_HASH = "%%INTEGRITY%%";

  function getFingerprint() {
    return [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'na',
      navigator.deviceMemory || 'na'
    ].join('###');
  }

  function apiCall(endpoint, data) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: SERVER_URL + endpoint,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(data),
        onload: (r) => {
          try { resolve(JSON.parse(r.responseText)); } catch { reject('Bad JSON'); }
        },
        onerror: () => reject('Network error'),
        ontimeout: () => reject('Timeout')
      });
    });
  }

  async function checkLicense() {
    // Self-integrity check
    if (EXPECTED_HASH !== '%%INTEGRITY%%') {
      const start = document.currentScript?.textContent.indexOf('// INTEGRITY_START');
      const end = document.currentScript?.textContent.indexOf('// INTEGRITY_END');
      if (start !== -1 && end !== -1) {
        const moduleSource = document.currentScript.textContent.slice(start, end + '// INTEGRITY_END'.length);
        const computed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(moduleSource))
          .then(hashBuffer => Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join(''));
        if (computed !== EXPECTED_HASH) {
          GM_setValue('lic_key', '');
          GM_setValue('lic_token', '');
          throw new Error('Integrity check failed');
        }
      }
    }

    // If license key was embedded, use it immediately
    if (EMBEDDED_LICENSE && EMBEDDED_LICENSE !== '%%LICENSE%%') {
      GM_setValue('lic_key', EMBEDDED_LICENSE);
    }

    let license = GM_getValue('lic_key', '');
    let token = GM_getValue('lic_token', '');

    if (license && token) {
      try {
        const val = await apiCall('/validate', { license, token });
        if (val.status === 'valid') return true;
      } catch {}
      const lastValid = GM_getValue('lic_last_valid', 0);
      if (Date.now() - lastValid < 24 * 60 * 60 * 1000) return true;
    }

    if (!license) {
      alert('License key missing. Please re-download the script from your purchase link.');
      return false;
    }

    try {
      const fp = getFingerprint();
      const result = await apiCall('/activate', { license, fingerprint: fp });
      if (result.status === 'ok') {
        GM_setValue('lic_key', license);
        GM_setValue('lic_token', result.token);
        GM_setValue('lic_last_valid', Date.now());
        return true;
      } else if (result.status === 'already_bound') {
        alert('This license is already used on another device.\nContact support.');
        return false;
      } else {
        alert('Invalid license key.');
        GM_setValue('lic_key', '');
        return false;
      }
    } catch {
      alert('Could not contact license server.\nPlease try again later.');
      return false;
    }
  }
  // INTEGRITY_END

  (async function() {
    const ok = await checkLicense().catch(() => false);
    if (!ok) return;

    // ===== TASKFLUX BOT CODE (unchanged) =====
    const CONFIG = {
      reloadDelayMs: 3200,
      initialStartDelayMs: 1200,
      storagePrefix: 'tfbot.',
      maxPageWaitRetries: 10,
      pageWaitIntervalMs: 400,
      bbHistoryMax: 10
    };

    const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

    const DEFAULT_SAFE = [
      'aicompanions','aivideos','amazonsellercentral','asknyc','athleanx',
      'badenwuerttemberg','boardgames','coinmarketcap','coldemail',
      'companionsonar','contentcreators','cryptoscams','dropshipping',
      'emailforsmallbusiness','generativeseostrategy','growmybusiness',
      'gymowner','hiringpakistan','hoboken','lakers','linkbuilding',
      'martialfetish','medspa','micro_saas','mounjarodeutschland','norway',
      'onlinegambling','ouraring','passive_income','pestcontrol','proteomics',
      'saassales','sgexams','sit_singapore','socialmediamarketing',
      'southflorida','stlouis','sweatystartup','westpalmbeach'
    ];
    const DEFAULT_IGNORED = [
      '30plusskincare','adhs','adulting','aipartners','askanaustralian',
      'askbrits','askmen','askphoenix','askredditnsfw','asksingapore',
      'asksouthafrica','askto','aussie','bayarea','beyondthebump',
      'bigbudgetbrides','bogleheads','businessideas','businesstantrums',
      'buycanadian','campinggear','catownerhacks','ceh','characterairunaways',
      'chatgpt','claudeai','coloranalysis','cryptomarkets','cybersecurity',
      'cybersecurity_help','devpt','digitalminimalism','dragonquest','driving',
      'emailprivacy','expats','explainthejoke','femalefashionadvice','finanzen',
      'firsttimehomebuyer','g2g_com','gamblingaddiction','gaming','generativeai',
      'goldendoodles','hairtransplants','headshots','henryuk','herahaven',
      'hiking','instagram','interesting','interestingasfuck','iosgaming',
      'japanlife','karate','labrats','landlord','leadgeneration','legaladviceuk',
      'life','lifeadvice','lifeprotips','linkedin','listentothis','localllama',
      'longhair','longreads','makeup','makeupaddiction','masturbation','meme',
      'memes','mentalhealth','mississauga','mommit','money','motouk',
      'muradgussahokya','n8n','neweracaps','newparents','northcountry',
      'northcounty','oculusquest','parenting','pregnant','prepping','privacy',
      'productivity','productmanagement','recruitinghell','rheumatoid',
      'sacramento','savannah','scams','seo','sidehustle','sideproject',
      'skincareaddiction','smallbusinessuk','smma','socialmedia','software',
      'softwarelabs','stablediffusion','startup','stocks','studytips','sysadmin',
      'tax','techgore','technology','techsales','tempe','toddlers','topazlabs',
      'transhumanism','travelhacks','trt','trueoffmychest','ukpolitics',
      'unitedkingdom','vegas','vibecoding','virginiabeach','virtualreality',
      'webscraping','wimbledon','womensfashion','zepbound','zerowaste'
    ];

    const STORAGE = {
      safe: `${CONFIG.storagePrefix}safeSubs`,
      ignored: `${CONFIG.storagePrefix}ignoredSubs`,
      stopped: `${CONFIG.storagePrefix}stopped`,
      lastClaimed: `${CONFIG.storagePrefix}lastClaimed`,
      bbQueue: `${CONFIG.storagePrefix}bbQueue`,
      bbInProgress: `${CONFIG.storagePrefix}bbInProgress`,
      filteringMode: `${CONFIG.storagePrefix}filteringMode`,
      bbCheckedSubs: `${CONFIG.storagePrefix}bbCheckedSubs`
    };

    const AUTO_KEY = 'tfbot_auto_mode';
    const QUEUE_KEY = 'tfbot_auto_queue';

    const state = {
      running: false,
      mode: 'overview',
      lastDetectedTask: null,
      pendingUnknown: [],
      lastKnownCount: 0,
      currentTimer: null,
      ui: null,
      bbQueue: [],
      bbInProgress: false,
      filteringMode: false,
      bbCheckedSubs: [],
      popup: null
    };

    function normalizeSub(sub) {
      return String(sub || '').replace(/^r\//i, '').trim().toLowerCase();
    }

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function loadList(key, fallback) {
      try {
        const raw = GM_getValue(key);
        return raw ? new Set(JSON.parse(raw).map(normalizeSub).filter(Boolean)) : new Set(fallback.map(normalizeSub));
      } catch {
        return new Set(fallback.map(normalizeSub));
      }
    }

    function saveList(key, set) {
      GM_setValue(key, JSON.stringify([...set].sort()));
    }

    function loadFlag(key, fallback = false) {
      const v = GM_getValue(key, null);
      return v !== null ? v === true || v === 'true' : fallback;
    }

    function saveFlag(key, value) {
      GM_setValue(key, value);
    }

    function loadJSON(key, fallback = []) {
      try {
        const raw = GM_getValue(key, null);
        return raw ? JSON.parse(raw) : fallback;
      } catch { return fallback; }
    }

    function saveJSON(key, value) {
      GM_setValue(key, JSON.stringify(value));
    }

    let safeSubs = loadList(STORAGE.safe, DEFAULT_SAFE);
    let ignoredSubs = loadList(STORAGE.ignored, DEFAULT_IGNORED);
    state.bbCheckedSubs = loadJSON(STORAGE.bbCheckedSubs, []);
    state.bbQueue = [];
    saveJSON(STORAGE.bbQueue, []);
    state.bbInProgress = false;
    saveFlag(STORAGE.bbInProgress, false);
    state.filteringMode = loadFlag(STORAGE.filteringMode, false);
    const isStopped = () => loadFlag(STORAGE.stopped, true);

    function persistLists() {
      saveList(STORAGE.safe, safeSubs);
      saveList(STORAGE.ignored, ignoredSubs);
    }

    function addSafe(sub) {
      const s = normalizeSub(sub);
      if (!s) return false;
      if (ignoredSubs.has(s)) ignoredSubs.delete(s);
      const added = !safeSubs.has(s);
      safeSubs.add(s);
      persistLists();
      if (state.ui) renderBoard();
      return added;
    }

    function addIgnored(sub) {
      const s = normalizeSub(sub);
      if (!s) return false;
      if (safeSubs.has(s)) safeSubs.delete(s);
      const added = !ignoredSubs.has(s);
      ignoredSubs.add(s);
      persistLists();
      if (state.ui) renderBoard();
      return added;
    }

    function createOverlay() {
      const wrap = document.createElement('div');
      wrap.id = 'tfbot-overlay';
      wrap.style.cssText = [
        'position:fixed','top:10px','right:10px','z-index:2147483646',
        'width:340px','max-width:92vw','background:#0b0f14','color:#d7ffd7',
        'border:1px solid #2f4f2f','border-radius:14px',
        'padding:10px','font-family:system-ui,sans-serif','font-size:13px',
        'box-shadow:0 8px 24px rgba(0,0,0,.35)','max-height:85vh','overflow-y:auto'
      ].join(';');

      wrap.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-weight:800;font-size:14px">TaskFlux Control</div>
          <div id="tfbot-indicator" style="width:10px;height:10px;border-radius:50%;background:#666"></div>
        </div>
        <div style="margin-bottom:8px;line-height:1.4">
          <div>Status: <span id="tfbot-status">Stopped</span></div>
          <div>State: <span id="tfbot-state">STOPPED</span></div>
          <div>Safe: <span id="tfbot-safe-count">0</span> | Ignored: <span id="tfbot-ignore-count">0</span></div>
          <div>Unknown: <span id="tfbot-unknown-count">0</span> | BB Checked: <span id="tfbot-bbchecked-count">0</span></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <button data-act="start" style="flex:1;background:#2f4f2f;">▶ Start</button>
          <button data-act="stop" style="flex:1;background:#4f2f2f;">⏹ Stop</button>
          <button data-act="toggle-filter" id="filter-toggle-btn" style="flex:1;">Filter: OFF</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <button data-act="add-subs" style="flex:1;">Add Subs</button>
          <button data-act="remove-subs" style="flex:1;">Remove Subs</button>
          <button data-act="bulk-import" style="flex:1;">Bulk Import</button>
        </div>
        <div id="sub-action-panel" style="display:none;margin-bottom:8px;border:1px solid #2f4f2f;border-radius:8px;padding:6px;background:#101820">
          <div id="sub-action-inner"></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <button data-act="view-safe" style="flex:1;">View Safe</button>
          <button data-act="view-ignore" style="flex:1;">View Ignored</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <button data-act="clear-view" style="flex:1;">Overview</button>
          <button data-act="hide" style="flex:1;background:#333;">Hide</button>
        </div>
        <div id="tfbot-summary" style="padding:8px;border:1px solid #2f4f2f;border-radius:10px;margin-bottom:8px;background:#101820;line-height:1.4"></div>
        <div id="tfbot-content" style="max-height:280px;overflow:auto;border-top:1px solid #2f4f2f;padding-top:8px"></div>
      `;

      const style = document.createElement('style');
      style.textContent = `
        #tfbot-overlay button{
          background:#182533; color:#fff; border:1px solid #2f4f2f;
          border-radius:8px; padding:6px 8px; font-size:12px; cursor:pointer;
        }
        #tfbot-overlay button:active{transform:scale(.97)}
        #tfbot-overlay .task-card{
          border:1px solid #2f4f2f; border-radius:10px; padding:8px;
          margin-bottom:8px; background:#101820;
        }
        #tfbot-overlay .task-actions{display:flex; gap:4px; flex-wrap:wrap; margin-top:6px;}
        #tfbot-overlay .task-actions button{flex:1; min-width:60px;}
        #tfbot-overlay .list-item{padding:5px 0; border-bottom:1px dashed rgba(255,255,255,.08);}
        #tfbot-overlay input, #tfbot-overlay textarea{
          width:100%; padding:6px; background:#0b0f14; border:1px solid #2f4f2f;
          color:#fff; border-radius:6px; font-size:12px; box-sizing:border-box;
        }
        #tfbot-overlay textarea{resize:vertical;}
      `;
      document.head.appendChild(style);
      document.body.appendChild(wrap);

      state.ui = {
        root: wrap,
        indicator: wrap.querySelector('#tfbot-indicator'),
        status: wrap.querySelector('#tfbot-status'),
        state: wrap.querySelector('#tfbot-state'),
        safeCount: wrap.querySelector('#tfbot-safe-count'),
        ignoreCount: wrap.querySelector('#tfbot-ignore-count'),
        unknownCount: wrap.querySelector('#tfbot-unknown-count'),
        bbCheckedCount: wrap.querySelector('#tfbot-bbchecked-count'),
        summary: wrap.querySelector('#tfbot-summary'),
        content: wrap.querySelector('#tfbot-content'),
        subActionPanel: wrap.querySelector('#sub-action-panel'),
        subActionInner: wrap.querySelector('#sub-action-inner'),
        modeToggleBtn: document.getElementById('filter-toggle-btn')
      };

      wrap.querySelectorAll('button[data-act]').forEach(btn => {
        btn.addEventListener('click', () => handleAction(btn.dataset.act));
      });
    }

    function createManualBBButton() {
      if (document.getElementById('bbcheck-fab')) return;
      const btn = document.createElement('div');
      btn.id = 'bbcheck-fab';
      btn.textContent = 'BB';
      btn.style.cssText = [
        'position:fixed','bottom:20px','right:20px','z-index:99998',
        'width:44px','height:44px','border-radius:50%',
        'background:#182533','color:#d7ffd7','border:2px solid #2f4f2f',
        'font-weight:bold','font-size:16px','line-height:40px','text-align:center',
        'cursor:pointer','box-shadow:0 4px 12px rgba(0,0,0,.35)',
        'touch-action:manipulation','user-select:none'
      ].join(';');
      btn.addEventListener('click', openManualBBModal);
      document.body.appendChild(btn);
    }

    function openManualBBModal() {
      const existing = document.getElementById('bbcheck-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'bbcheck-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
      modal.innerHTML = `
        <div style="background:#0b0f14;border:1px solid #2f4f2f;border-radius:14px;padding:20px;min-width:280px;max-width:90vw;color:#d7ffd7;font:14px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.5);">
          <div style="font-weight:700;font-size:16px;margin-bottom:12px;">🔍 Manual BB Check</div>
          <input id="bbcheck-input" type="text" placeholder="r/AskReddit or sub name" style="width:100%;padding:8px;border:1px solid #2f4f2f;background:#101820;color:#fff;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:12px;">
          <div style="display:flex;gap:8px;">
            <button id="bbcheck-go" style="flex:1;background:#2f4f2f;border:none;color:white;padding:8px;border-radius:6px;font-weight:600;">Check</button>
            <button id="bbcheck-cancel" style="background:#444;border:none;color:white;padding:8px 16px;border-radius:6px;">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#bbcheck-input').focus();
      modal.querySelector('#bbcheck-cancel').addEventListener('click', () => modal.remove());
      modal.querySelector('#bbcheck-go').addEventListener('click', () => {
        const input = modal.querySelector('#bbcheck-input').value.trim();
        const sub = normalizeSub(input);
        if (!sub) {
          alert('❌ Could not extract a valid subreddit name.');
          return;
        }
        modal.remove();
        location.href = `https://www.reddit.com/r/${sub}/about`;
      });
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    function setStatus(text) { if (state.ui) state.ui.status.textContent = text; }
    function setRunningVisual(running) {
      if (!state.ui) return;
      state.ui.state.textContent = running ? 'RUNNING' : 'STOPPED';
      state.ui.indicator.style.background = running ? '#55ff88' : '#ff6666';
    }

    function renderBoard() {
      if (!state.ui) return;
      state.ui.safeCount.textContent = safeSubs.size;
      state.ui.ignoreCount.textContent = ignoredSubs.size;
      state.ui.unknownCount.textContent = state.pendingUnknown.length;
      state.ui.bbCheckedCount.textContent = state.bbCheckedSubs.length;
      state.ui.modeToggleBtn.textContent = `Filter: ${state.filteringMode ? 'ON' : 'OFF'}`;

      if (state.mode === 'safe') {
        renderListView('Safe Subs', [...safeSubs].sort());
      } else if (state.mode === 'ignored') {
        renderListView('Ignored Subs', [...ignoredSubs].sort());
      } else {
        renderMainView();
      }
    }

    function renderMainView() {
      if (!state.ui) return;

      const lastTask = state.lastDetectedTask
        ? `<div><b>Last task:</b> r/${escapeHtml(state.lastDetectedTask.subreddit)}<br><small>${escapeHtml(state.lastDetectedTask.link)}</small></div>`
        : '<div>No task selected yet.</div>';

      state.ui.summary.innerHTML = `
        <div><b>Overview</b></div>
        <div><b>Tasks visible:</b> ${state.lastKnownCount || '?'}</div>
        ${lastTask}
      `;

      let html = '';
      html += '<div style="margin-bottom:12px;"><b>📌 Unknown Tasks:</b></div>';
      if (state.pendingUnknown.length) {
        state.pendingUnknown.forEach((task, idx) => {
          html += `
            <div class="task-card">
              <div><b>${idx+1}. r/${escapeHtml(task.subreddit)}</b></div>
              <div><small>${escapeHtml(task.link)}</small></div>
              <div class="task-actions">
                <button data-unk-act="claim" data-link="${escapeHtml(task.link)}">Claim</button>
                <button data-unk-act="claim-safe" data-link="${escapeHtml(task.link)}">Claim+Safe</button>
                <button data-unk-act="ignore" data-link="${escapeHtml(task.link)}" data-sub="${escapeHtml(task.subreddit)}">Add Ignored</button>
              </div>
            </div>
          `;
        });
      } else {
        html += '<div>None</div>';
      }

      html += '<div style="margin-top:12px;margin-bottom:8px;"><b>📦 Last BB‑Checked Subs:</b></div>';
      if (state.bbCheckedSubs.length) {
        const recent = state.bbCheckedSubs.slice(-CONFIG.bbHistoryMax).reverse();
        recent.forEach(entry => {
          html += `
            <div class="task-card">
              <div><b>r/${escapeHtml(entry.sub)}</b> – ${escapeHtml(entry.result)}</div>
              <div class="task-actions">
                <button data-bb-act="safe" data-sub="${escapeHtml(entry.sub)}">Add Safe</button>
                <button data-bb-act="ignore" data-sub="${escapeHtml(entry.sub)}">Add Ignored</button>
              </div>
            </div>
          `;
        });
      } else {
        html += '<div>None yet</div>';
      }

      state.ui.content.innerHTML = html;

      state.ui.content.querySelectorAll('button[data-bb-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sub = btn.dataset.sub;
          if (btn.dataset.bbAct === 'safe') addSafe(sub);
          else addIgnored(sub);
        });
      });

      state.ui.content.querySelectorAll('button[data-unk-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          handleUnknownAction(btn.dataset.unkAct, btn.dataset.link, btn.dataset.sub);
        });
      });
    }

    function renderListView(title, items) {
      state.ui.summary.innerHTML = `<div><b>Mode:</b> ${title}</div><div><b>Total:</b> ${items.length}</div>`;
      state.ui.content.innerHTML = items.length
        ? items.map(s => `<div class="list-item">${escapeHtml(s)}</div>`).join('')
        : '<div>No items.</div>';
    }

    function handleUnknownAction(action, link, sub) {
      const task = state.pendingUnknown.find(t => t.link === link);
      if (!task) return;

      if (action === 'claim') {
        clickClaim(task);
      } else if (action === 'claim-safe') {
        addSafe(sub);
        clickClaim(task);
      } else if (action === 'ignore') {
        addIgnored(sub);
        state.pendingUnknown = state.pendingUnknown.filter(t => t.link !== link);
        renderBoard();
      }
    }

    function showClaimNotification(link) {
      const notif = document.createElement('div');
      notif.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;background:#0b0f14;color:#d7ffd7;border:2px solid #2f4f2f;border-radius:14px;padding:20px;text-align:center;font:14px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.5);';
      notif.innerHTML = `
        <div style="font-size:18px;font-weight:700;margin-bottom:8px;">🎉 Task Claimed!</div>
        <div>Congratulations, task successfully claimed.</div>
        <div style="margin:10px 0;"><a href="https://taskflux.net/tasks" target="_blank" style="color:#55ff88;">Visit your tasks</a></div>
        <button id="bb-close-notif" style="background:#2f4f2f;border:none;color:white;padding:8px 16px;border-radius:6px;cursor:pointer;">Close</button>
      `;
      document.body.appendChild(notif);
      document.getElementById('bb-close-notif').addEventListener('click', () => notif.remove());
      setTimeout(() => notif.remove(), 15000);
    }

    function extractTasksFromPage() {
      const potentialClaimButtons = [...document.querySelectorAll('button')].filter(btn =>
        /claim|accept|take task/i.test(btn.innerText || '')
      );
      const tasks = [];
      const seenLinks = new Set();

      for (const btn of potentialClaimButtons) {
        let card = btn.closest('div, li, article, section, form, [role="listitem"]');
        while (card && card !== document.body) {
          if (/reddit\.com\/r\//i.test(card.innerText || '')) break;
          card = card.parentElement?.closest('div, li, article, section, form, [role="listitem"]') || null;
        }
        if (!card || card === document.body) continue;

        const cardText = card.innerText || '';
        const linkMatch = cardText.match(/https?:\/\/(?:www\.)?reddit\.com\/r\/[^\s)]+/i);
        if (!linkMatch) continue;
        const link = linkMatch[0].trim();
        const subMatch = link.match(/reddit\.com\/r\/([a-z0-9_]+)/i);
        if (!subMatch) continue;
        const subreddit = subMatch[1].toLowerCase();

        if (!seenLinks.has(link)) {
          seenLinks.add(link);
          tasks.push({ subreddit, link, buttonElement: btn });
        }
      }
      return tasks;
    }

    function clickClaim(task) {
      try {
        task.buttonElement.scrollIntoView({ block: 'center', behavior: 'instant' });
      } catch(e) {}
      task.buttonElement.click();
    }

    function setBotStopped(val) {
      saveFlag(STORAGE.stopped, val);
      if (val) {
        state.running = false;
        state.filteringMode = false;
        saveFlag(STORAGE.filteringMode, false);
        if (state.currentTimer) clearTimeout(state.currentTimer);
      }
      setRunningVisual(!val);
    }

    function startBot() {
      saveFlag(STORAGE.stopped, false);
      state.running = true;
      state.filteringMode = false;
      saveFlag(STORAGE.filteringMode, false);
      setRunningVisual(true);
      setStatus('Running');
      renderBoard();
      if (state.currentTimer) clearTimeout(state.currentTimer);
      state.currentTimer = setTimeout(runCycle, CONFIG.initialStartDelayMs);
    }

    function stopBot() {
      setBotStopped(true);
      setStatus('Stopped');
      renderBoard();
    }

    function runCycle() {
      if (isStopped() && !state.filteringMode) {
        setStatus('Stopped');
        return;
      }
      setStatus('Scanning tasks...');
      waitForTasks(tasks => {
        state.lastKnownCount = tasks.length;
        const safeTasks = tasks.filter(t => safeSubs.has(t.subreddit));
        const unknownTasks = tasks.filter(t => !safeSubs.has(t.subreddit) && !ignoredSubs.has(t.subreddit));
        state.pendingUnknown = unknownTasks;
        renderBoard();

        if (safeTasks.length > 0) {
          const task = safeTasks[0];
          clickClaim(task);
          setBotStopped(true);
          showClaimNotification(task.link);
          return;
        }

        if ((state.filteringMode || state.running) && unknownTasks.length > 0) {
          if (state.bbQueue.length === 0 && !state.bbInProgress) {
            state.bbQueue = [...new Set(unknownTasks.map(t => t.subreddit))];
            saveJSON(STORAGE.bbQueue, state.bbQueue);
          }
          if (state.bbQueue.length > 0 && !state.bbInProgress) {
            processBBQueue();
            return;
          }
        }

        if (state.running || state.filteringMode) {
          scheduleNextReload();
        }
      });
    }

    function waitForTasks(callback, retries = 0) {
      const tasks = extractTasksFromPage();
      if (tasks.length > 0) return callback(tasks);
      if (retries >= CONFIG.maxPageWaitRetries) {
        location.reload();
        return;
      }
      setTimeout(() => waitForTasks(callback, retries + 1), CONFIG.pageWaitIntervalMs);
    }

    function processBBQueue() {
      if (state.bbQueue.length === 0) return;
      const sub = state.bbQueue[0];
      state.bbInProgress = true;
      saveFlag(STORAGE.bbInProgress, true);

      GM_setValue(QUEUE_KEY, JSON.stringify(state.bbQueue));
      GM_setValue(AUTO_KEY, '1');

      setStatus(`Checking r/${sub}… (leaving dashboard)`);
      location.href = `https://www.reddit.com/r/${sub}/about`;
    }

    function scheduleNextReload() {
      if (state.currentTimer) clearTimeout(state.currentTimer);
      state.currentTimer = setTimeout(() => location.reload(), CONFIG.reloadDelayMs);
    }

    function handleAction(act) {
      switch (act) {
        case 'start':
          startBot();
          break;
        case 'stop':
          stopBot();
          break;
        case 'toggle-filter':
          state.filteringMode = !state.filteringMode;
          saveFlag(STORAGE.filteringMode, state.filteringMode);
          if (state.filteringMode) {
            setBotStopped(false);
            state.running = true;
            setRunningVisual(true);
            setStatus('Filtering mode ON');
          } else {
            state.running = false;
            setRunningVisual(false);
            setStatus('Filtering mode OFF');
          }
          state.mode = 'overview';
          renderBoard();
          if (state.filteringMode) {
            if (state.currentTimer) clearTimeout(state.currentTimer);
            state.currentTimer = setTimeout(runCycle, 500);
          }
          break;
        case 'add-subs':
        case 'remove-subs':
          showSubActionPanel(act === 'add-subs' ? 'add' : 'remove');
          break;
        case 'bulk-import':
          showBulkImportPanel();
          break;
        case 'view-safe':
          state.mode = 'safe';
          renderBoard();
          break;
        case 'view-ignore':
          state.mode = 'ignored';
          renderBoard();
          break;
        case 'clear-view':
          state.mode = 'overview';
          renderBoard();
          break;
        case 'hide':
          state.ui.root.style.display = 'none';
          break;
      }
    }

    function showSubActionPanel(type) {
      const panel = state.ui.subActionPanel;
      panel.style.display = 'block';
      state.ui.subActionInner.innerHTML = '';

      const actions = type === 'add'
        ? ['Add to Safe', 'Add to Ignored']
        : ['Remove from Safe', 'Remove from Ignored'];
      actions.forEach(label => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.marginRight = '4px';
        btn.addEventListener('click', () => showSubInput(type, label.includes('Safe') ? 'safe' : 'ignored'));
        state.ui.subActionInner.appendChild(btn);
      });
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => { panel.style.display = 'none'; });
      state.ui.subActionInner.appendChild(cancel);
    }

    function showSubInput(type, list) {
      state.ui.subActionInner.innerHTML = `
        <input id="sub-input-field" type="text" placeholder="Sub name">
        <button id="sub-confirm">Confirm</button>
        <button id="sub-cancel">Cancel</button>
      `;
      document.getElementById('sub-confirm').addEventListener('click', () => {
        const sub = document.getElementById('sub-input-field').value.trim();
        if (!sub) return;
        if (type === 'add') {
          if (list === 'safe') addSafe(sub);
          else addIgnored(sub);
        } else {
          if (list === 'safe') {
            if (safeSubs.has(sub)) {
              safeSubs.delete(sub);
              persistLists();
              renderBoard();
            } else alert('Sub not in safe list.');
          } else {
            if (ignoredSubs.has(sub)) {
              ignoredSubs.delete(sub);
              persistLists();
              renderBoard();
            } else alert('Sub not in ignored list.');
          }
        }
        state.ui.subActionPanel.style.display = 'none';
      });
      document.getElementById('sub-cancel').addEventListener('click', () => {
        state.ui.subActionPanel.style.display = 'none';
      });
    }

    function showBulkImportPanel() {
      const panel = state.ui.subActionPanel;
      panel.style.display = 'block';
      state.ui.subActionInner.innerHTML = `
        <div style="margin-bottom:6px;font-weight:700">Bulk Import</div>
        <textarea id="bulk-import-text" placeholder="Paste subreddits separated by commas or new lines" style="height:80px;"></textarea>
        <div style="margin-top:6px;display:flex;gap:6px">
          <button id="bulk-import-safe" style="flex:1">Add to Safe</button>
          <button id="bulk-import-ignore" style="flex:1">Add to Ignored</button>
          <button id="bulk-cancel" style="background:#444">Cancel</button>
        </div>
      `;

      document.getElementById('bulk-import-safe').addEventListener('click', () => {
        const raw = document.getElementById('bulk-import-text').value;
        const subs = raw.split(/[,\n]+/).map(s => normalizeSub(s)).filter(Boolean);
        subs.forEach(sub => addSafe(sub));
        panel.style.display = 'none';
      });

      document.getElementById('bulk-import-ignore').addEventListener('click', () => {
        const raw = document.getElementById('bulk-import-text').value;
        const subs = raw.split(/[,\n]+/).map(s => normalizeSub(s)).filter(Boolean);
        subs.forEach(sub => addIgnored(sub));
        panel.style.display = 'none';
      });

      document.getElementById('bulk-cancel').addEventListener('click', () => {
        panel.style.display = 'none';
      });
    }

    function initRedditAboutPage() {
      if (!/^https:\/\/www\.reddit\.com\/r\/[a-z0-9_]+\/about/i.test(location.href)) return;
      const sub = location.pathname.split('/')[2];
      const isAuto = (GM_getValue(AUTO_KEY, null) === '1');

      const checkInterval = setInterval(() => {
        const bodyText = document.body.innerText.toLowerCase();
        if (bodyText.includes('installed apps') || bodyText.includes('moderators')) {
          clearInterval(checkInterval);
          const hasBotBouncer = bodyText.includes('bot bouncer');

          if (isAuto) {
            if (hasBotBouncer) {
              addIgnored(sub);
            } else {
              addSafe(sub);
            }

            if (!state.bbCheckedSubs.find(t => t.sub === sub)) {
              state.bbCheckedSubs.push({
                sub,
                result: hasBotBouncer ? 'BotBouncer' : 'No BotBouncer'
              });
              saveJSON(STORAGE.bbCheckedSubs, state.bbCheckedSubs);
            }

            const queueRaw = GM_getValue(QUEUE_KEY, null);
            if (queueRaw) {
              try {
                const arr = JSON.parse(queueRaw);
                if (Array.isArray(arr) && arr.length > 0) arr.shift();
                GM_setValue(QUEUE_KEY, JSON.stringify(arr));
              } catch(e) {}
            }

            GM_setValue(AUTO_KEY, '');
            setTimeout(() => {
              location.href = 'https://taskflux.net/dashboard';
            }, 1000);
          } else {
            const resultText = hasBotBouncer
              ? '✅ Bot Bouncer DETECTED → add to IGNORED'
              : '⚠️ No Bot Bouncer → add to SAFE';
            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:20px;left:20px;z-index:99999;background:#0b0f14;color:#d7ffd7;border:2px solid #2f4f2f;border-radius:14px;padding:18px;max-width:90vw;font:14px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.5);';
            div.innerHTML = `
              <div style="font-weight:700;font-size:16px;margin-bottom:10px;">🔍 r/${sub}</div>
              <div style="white-space:pre-wrap;font-family:monospace;">${resultText}</div>
              <button id="bb-manual-back" style="margin-top:10px;background:#2f4f2f;border:none;color:white;padding:6px 14px;border-radius:6px;cursor:pointer;">Go Back</button>
            `;
            document.body.appendChild(div);
            document.getElementById('bb-manual-back').addEventListener('click', () => {
              history.back();
              setTimeout(() => { if (div.parentNode) div.remove(); }, 500);
            });
          }
        }
      }, 300);
      setTimeout(() => clearInterval(checkInterval), 15000);
    }

    function init() {
      if (location.hostname === 'www.reddit.com' && /^\/r\/[a-z0-9_]+\/about/i.test(location.pathname)) {
        initRedditAboutPage();
        return;
      }

      createOverlay();
      createManualBBButton();

      const savedQueue = GM_getValue(QUEUE_KEY, null);
      if (savedQueue) {
        try {
          const arr = JSON.parse(savedQueue);
          if (Array.isArray(arr) && arr.length > 0) {
            state.bbQueue = arr;
            saveJSON(STORAGE.bbQueue, state.bbQueue);
          }
        } catch(e) {}
        GM_setValue(QUEUE_KEY, '');
      }

      if (GM_getValue(AUTO_KEY, null) === '1') {
        GM_setValue(AUTO_KEY, '');
      }

      const stopped = isStopped();
      setRunningVisual(!stopped);
      state.running = !stopped && !state.filteringMode;
      if (state.filteringMode) {
        setRunningVisual(true);
        state.running = true;
        setStatus('Filtering mode ON');
      } else {
        setStatus(stopped ? 'Stopped' : 'Ready');
      }
      renderBoard();

      if (state.running || state.filteringMode) {
        if (state.currentTimer) clearTimeout(state.currentTimer);
        state.currentTimer = setTimeout(runCycle, 1000);
      }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      init();
    } else {
      window.addEventListener('DOMContentLoaded', init);
    }
  })();
})();
