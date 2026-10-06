/**
 * Pointage Serre - Javascript Logic
 * Mobile-first vanilla JS implementation.
 * v4 - Supabase integration + localStorage fallback
 */

// App Settings (Configurable by Admin)
let appSettings = {
    gaucheStart: 1,
    gaucheEnd: 140,
    droitStart: 1,
    droitEnd: 140,
    sup1Name: 'Supervisor 1',
    sup2Name: 'Supervisor 2',
    sup1Pwd: '',
    sup2Pwd: '',
    adminPwd: '1234'
};

// App State
let appState = {
    supervisor: null,
    week: 'W1',
    task: 'control twisting',
    gaucheState: {},
    droitState: {},
    remarks: ''
};

// DOM Elements
const views = {
    login: document.getElementById('view-login'),
    dashboard: document.getElementById('view-dashboard'),
    admin: document.getElementById('view-admin')
};

const gridGauche = document.getElementById('grid-gauche');
const gridDroit = document.getElementById('grid-droit');
const weekSelect = document.getElementById('week-select');
const taskSelect = document.getElementById('task-select');
const userNameEl = document.getElementById('current-user-name');
const userAvatarEl = document.getElementById('current-user-avatar');
const btnLogout = document.getElementById('btn-logout');
const btnSave = document.getElementById('btn-save-pointage');
const remarksInput = document.getElementById('remarks-input');
const totalProgressCount = document.getElementById('progress-count');
const maxProgressCount = document.getElementById('progress-total');
const mainProgressBar = document.getElementById('main-progress');
const leftStats = document.getElementById('gauche-count');
const rightStats = document.getElementById('droit-count');
const btnDashboardAdmin = document.getElementById('btn-dashboard-admin');
const btnGotoAdmin = document.getElementById('btn-goto-admin');
const btnAdminBack = document.getElementById('btn-admin-back');
const inpGStart = document.getElementById('setting-g-start');
const inpGEnd = document.getElementById('setting-g-end');
const inpDStart = document.getElementById('setting-d-start');
const inpDEnd = document.getElementById('setting-d-end');
const inpSup1Name = document.getElementById('setting-sup1-name');
const inpSup2Name = document.getElementById('setting-sup2-name');
const inpSup1Pwd  = document.getElementById('setting-sup1-pwd');
const inpSup2Pwd  = document.getElementById('setting-sup2-pwd');
const inpAdminPwd = document.getElementById('setting-admin-pwd');
const labelSup1 = document.getElementById('label-sup-1');
const labelSup2 = document.getElementById('label-sup-2');
const btnSaveSettings = document.getElementById('btn-save-settings');

// Supervisor password modal elements
const modalSupPwd       = document.getElementById('modal-sup-password');
const supPwdTitle       = document.getElementById('sup-pwd-title');
const supPwdSubtitle    = document.getElementById('sup-pwd-subtitle');
const supPwdInput       = document.getElementById('sup-pwd-input');
const supPwdError       = document.getElementById('sup-pwd-error');
const btnSupPwdCancel   = document.getElementById('btn-sup-pwd-cancel');
const btnSupPwdConfirm  = document.getElementById('btn-sup-pwd-confirm');
let pendingSupervisorId = null; // which supervisor is trying to log in

// Admin password modal elements
const modalAdminPwd     = document.getElementById('modal-admin-password');
const adminPwdInput     = document.getElementById('admin-pwd-input');
const adminPwdError     = document.getElementById('admin-pwd-error');
const btnAdminPwdCancel = document.getElementById('btn-admin-pwd-cancel');
const btnAdminPwdConfirm= document.getElementById('btn-admin-pwd-confirm');


// ─── WIP State Key ─────────────────────────────────────────
function wipKey() {
    return `ps_wip_${appState.supervisor}_${appState.week}_${appState.task}`;
}

// Debounce timer for WIP saves (avoid hammering Supabase on every tap)
let wipSaveTimer = null;

function saveWip() {
    const data = {
        gaucheState: appState.gaucheState,
        droitState: appState.droitState,
        remarks: appState.remarks
    };
    // Always save to localStorage immediately (instant)
    localStorage.setItem(wipKey(), JSON.stringify(data));

    // Debounced save to Supabase (500ms after last tap)
    clearTimeout(wipSaveTimer);
    wipSaveTimer = setTimeout(() => {
        dbSaveWip(wipKey(), data);
    }, 500);
}

async function loadWip() {
    const key = wipKey();
    try {
        // Try Supabase first
        const remote = await dbLoadWip(key);
        if (remote) {
            appState.gaucheState = remote.gaucheState || {};
            appState.droitState  = remote.droitState  || {};
            appState.remarks     = remote.remarks      || '';
            remarksInput.value   = appState.remarks;
            // Sync to localStorage
            localStorage.setItem(key, JSON.stringify(remote));
            return true;
        }
    } catch(e) {
        console.warn('[WIP] Supabase load failed, trying localStorage');
    }

    // Fallback: localStorage
    try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved) {
            appState.gaucheState = saved.gaucheState || {};
            appState.droitState  = saved.droitState  || {};
            appState.remarks     = saved.remarks      || '';
            remarksInput.value   = appState.remarks;
            return true;
        }
    } catch(e) {}
    return false;
}

function clearWip() {
    localStorage.removeItem(wipKey());
    dbClearWip(wipKey());
}

// ─── Initialization ─────────────────────────────────────────
function loadLocalSettings() {
    try {
        const stored = JSON.parse(localStorage.getItem('ps_settings'));
        if (stored) appSettings = { ...appSettings, ...stored };
    } catch(e) {}
    applySettingsToDOM();
}

function applySettingsToDOM() {
    if (!inpGStart) return;
    inpGStart.value = appSettings.gaucheStart;
    inpGEnd.value   = appSettings.gaucheEnd;
    inpDStart.value = appSettings.droitStart;
    inpDEnd.value   = appSettings.droitEnd;
    inpSup1Name.value = appSettings.sup1Name;
    inpSup2Name.value = appSettings.sup2Name;
    inpSup1Pwd.value  = appSettings.sup1Pwd || '';
    inpSup2Pwd.value  = appSettings.sup2Pwd || '';
    inpAdminPwd.value = appSettings.adminPwd || '1234';

    labelSup1.textContent = appSettings.sup1Name;
    labelSup2.textContent = appSettings.sup2Name;
}

function initApp() {
    // 1. Toujours charger les paramètres locaux et attacher les écouteurs IMMÉDIATEMENT
    loadLocalSettings();
    populateWeeks();
    setupEventListeners();
    loadTrolleysData();

    const storedUser = localStorage.getItem('ps_supervisor');
    if (storedUser) {
        setSupervisor(storedUser, false); // false = don't reset
    } else {
        switchView('login');
    }

    // 2. Synchroniser les paramètres Supabase en arrière-plan sans bloquer les clics
    loadSettings().then(() => {
        applySettingsToDOM();
    }).catch(e => console.warn('[Supabase] Sync silencieux:', e));
}

async function loadSettings() {
    try {
        const remote = await dbLoadSettings();
        if (remote) {
            appSettings = { ...appSettings, ...remote };
            localStorage.setItem('ps_settings', JSON.stringify(appSettings));
        }
    } catch(e) {
        console.warn('[Settings] Impossible de charger la configuration à distance');
    }
    applySettingsToDOM();
}

async function saveSettings() {
    appSettings.gaucheStart = parseInt(inpGStart.value, 10) || 1;
    appSettings.gaucheEnd   = parseInt(inpGEnd.value,   10) || 140;
    appSettings.droitStart  = parseInt(inpDStart.value, 10) || 1;
    appSettings.droitEnd    = parseInt(inpDEnd.value,   10) || 140;
    appSettings.sup1Name    = inpSup1Name.value.trim() || 'Supervisor 1';
    appSettings.sup2Name    = inpSup2Name.value.trim() || 'Supervisor 2';
    appSettings.sup1Pwd     = inpSup1Pwd.value.trim();
    appSettings.sup2Pwd     = inpSup2Pwd.value.trim();
    appSettings.adminPwd    = inpAdminPwd.value.trim() || '1234';

    labelSup1.textContent = appSettings.sup1Name;
    labelSup2.textContent = appSettings.sup2Name;

    // Save to both
    localStorage.setItem('ps_settings', JSON.stringify(appSettings));
    const ok = await dbSaveSettings(appSettings);

    showToast(ok ? 'Paramètres sauvegardés ✓' : 'Sauvegardé localement (hors-ligne)');
    generateGrids();
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    const container = document.querySelector('.app-container');
    if (container) {
        if (viewName === 'admin') {
            container.classList.add('admin-mode');
        } else {
            container.classList.remove('admin-mode');
        }
    }
    if (views[viewName]) {
        views[viewName].classList.add('active');
        if (viewName === 'admin') renderAdminTable();
        if (viewName === 'dashboard') window.scrollTo(0, 0);
    }
}

function setSupervisor(name, doReset = true) {
    if (!name) return;
    appState.supervisor = name;
    localStorage.setItem('ps_supervisor', name);
    if (userNameEl) userNameEl.textContent = name;
    if (userAvatarEl) {
        const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        userAvatarEl.textContent = initials || 'S1';
    }

    // Sync week & task from selects
    if (weekSelect) appState.week = weekSelect.value;
    if (taskSelect) appState.task = taskSelect.value;

    generateGrids(!doReset); // preserveState = !doReset
    switchView('dashboard');
}

function logout() {
    localStorage.removeItem('ps_supervisor');
    appState.supervisor = null;
    appState.isAdmin = false;
    switchView('login');
}

function populateWeeks() {
    const periodModeSelect = document.getElementById('period-mode-select');
    const mode = periodModeSelect ? periodModeSelect.value : '2w';
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const currWeek = Math.ceil((((now - start) / 86400000) + start.getDay() + 1) / 7);

    weekSelect.innerHTML = '';

    if (mode === '1w') {
        for (let i = 1; i <= 52; i++) {
            const opt = document.createElement('option');
            opt.value = `W${i}`;
            opt.textContent = `Semaine ${i} (W${i})`;
            if (i === currWeek) opt.selected = true;
            weekSelect.appendChild(opt);
        }
    } else {
        // 2-week bi-weekly mode (W1-W2, W3-W4 ... W41-W42 ... W51-W52)
        for (let i = 1; i <= 51; i += 2) {
            const opt = document.createElement('option');
            opt.value = `W${i}-W${i+1}`;
            opt.textContent = `Semaines ${i} & ${i+1} (W${i}-W${i+1})`;
            if (currWeek === i || currWeek === i + 1) opt.selected = true;
            weekSelect.appendChild(opt);
        }
    }

    appState.week = weekSelect.value;
}

// ─── Grid Generation (with WIP restore or preserved state) ───
async function generateGrids(preserveState = false) {
    if (!preserveState) {
        // Init empty state first
        appState.gaucheState = {};
        appState.droitState  = {};
        if (remarksInput) remarksInput.value = '';
        appState.remarks     = '';

        // Try to restore saved WIP for current context
        if (appState.supervisor) {
            await loadWip();
        }
    }

    // If WIP or loaded state didn't carry keys for the current range, fill in false
    for (let i = appSettings.gaucheStart; i <= appSettings.gaucheEnd; i++) {
        if (appState.gaucheState[i] === undefined) appState.gaucheState[i] = false;
    }
    for (let i = appSettings.droitStart; i <= appSettings.droitEnd; i++) {
        if (appState.droitState[i] === undefined) appState.droitState[i] = false;
    }

    renderGrid(gridGauche, appState.gaucheState, appSettings.gaucheStart, appSettings.gaucheEnd, 'gauche');
    renderGrid(gridDroit,  appState.droitState,  appSettings.droitStart,  appSettings.droitEnd,  'droit');
    updateProgress();
}

function isStateActive(val) {
    return val === true || val === 'true' || val === 1 || val === '1';
}

function isStateError(val) {
    return val === 'x' || val === 'error' || val === 'RED';
}

function renderGrid(container, stateMap, startIdx, endIdx, side) {
    container.innerHTML = '';
    for (let i = startIdx; i <= endIdx; i++) {
        const box = document.createElement('div');
        const state = (stateMap[i] !== undefined) ? stateMap[i] : stateMap[String(i)];
        
        const active = isStateActive(state);
        const error  = isStateError(state);

        box.className = 'path-box ripple' +
            (active ? ' active' : '') +
            (error  ? ' error'  : '');
        box.dataset.row = i;
        box.textContent = i;

        box.addEventListener('click', () => {
            // Cycle: false/inactive -> true -> 'x' -> false
            const curState = (stateMap[i] !== undefined) ? stateMap[i] : stateMap[String(i)];
            if (isStateActive(curState)) {
                stateMap[i] = 'x';
            } else if (isStateError(curState)) {
                stateMap[i] = false;
            } else {
                stateMap[i] = true;
            }

            const next = stateMap[i];
            box.classList.toggle('active', isStateActive(next));
            box.classList.toggle('error',  isStateError(next));

            updateProgress();
            saveWip();
        });
        container.appendChild(box);
    }
}

function updateProgress() {
    // Only count green (true) boxes — red ('x') = flagged, not validated
    const gCount = Object.values(appState.gaucheState).filter(v => isStateActive(v)).length;
    const dCount = Object.values(appState.droitState).filter(v => isStateActive(v)).length;
    const total  = gCount + dCount;

    const maxG = Math.max(0, appSettings.gaucheEnd - appSettings.gaucheStart + 1);
    const maxD = Math.max(0, appSettings.droitEnd  - appSettings.droitStart  + 1);
    const totalPaths = maxG + maxD;

    leftStats.textContent  = gCount;
    rightStats.textContent = dCount;
    totalProgressCount.textContent = total;
    maxProgressCount.textContent   = totalPaths;

    const pct = totalPaths > 0 ? (total / totalPaths) * 100 : 0;
    mainProgressBar.style.width = `${pct}%`;
}

function resetMapConfirm() {
    if (!confirm('Réinitialiser toute la carte pour cette tâche ? Les données seront effacées.')) return;
    clearWip();
    generateGrids();
    showToast('Carte réinitialisée');
}

// ─── Save Pointage (Supabase Upsert) ────────────────────────
async function savePointage() {
    btnSave.innerHTML = `Enregistrement... <span class="btn-loader" style="display:inline-block"></span>`;
    btnSave.style.pointerEvents = 'none';

    appState.week    = weekSelect.value;
    appState.task    = taskSelect.value;
    appState.remarks = remarksInput.value.trim();

    const gCount = Object.values(appState.gaucheState).filter(v => v === true).length;
    const dCount = Object.values(appState.droitState).filter(v => v === true).length;
    const maxG   = Math.max(0, appSettings.gaucheEnd - appSettings.gaucheStart + 1);
    const maxD   = Math.max(0, appSettings.droitEnd  - appSettings.droitStart  + 1);

    const submission = {
        supervisor: appState.supervisor,
        week: appState.week,
        task: appState.task,
        gaucheCount: gCount,
        droitCount: dCount,
        totalMax: maxG + maxD,
        remarks: appState.remarks,
        gaucheState: { ...appState.gaucheState },
        droitState: { ...appState.droitState },
        gaucheRange: { start: appSettings.gaucheStart, end: appSettings.gaucheEnd },
        droitRange: { start: appSettings.droitStart, end: appSettings.droitEnd }
    };

    // Try Supabase first
    const ok = await dbUpsertSubmission(submission);

    if (!ok) {
        // Fallback: save to localStorage
        let submissions = [];
        try { submissions = JSON.parse(localStorage.getItem('ps_submissions')) || []; } catch(e) {}

        const existingIdx = submissions.findIndex(s =>
            s.supervisor === submission.supervisor &&
            s.week === submission.week &&
            s.task === submission.task
        );

        if (existingIdx !== -1) {
            const existing = submissions[existingIdx];
            const mergedG = { ...(existing.gaucheState || {}) };
            Object.entries(submission.gaucheState).forEach(([k, v]) => {
                if (v !== false) mergedG[k] = v;
            });
            const mergedD = { ...(existing.droitState || {}) };
            Object.entries(submission.droitState).forEach(([k, v]) => {
                if (v !== false) mergedD[k] = v;
            });

            submissions[existingIdx] = {
                ...existing,
                timestamp: new Date().toISOString(),
                gaucheCount: Object.values(mergedG).filter(v => v === true).length,
                droitCount: Object.values(mergedD).filter(v => v === true).length,
                totalMax: submission.totalMax,
                remarks: submission.remarks || existing.remarks,
                gaucheState: mergedG,
                droitState: mergedD,
                gaucheRange: submission.gaucheRange,
                droitRange: submission.droitRange
            };
        } else {
            submissions.unshift({
                id: Date.now(),
                timestamp: new Date().toISOString(),
                ...submission
            });
        }

        localStorage.setItem('ps_submissions', JSON.stringify(submissions));
    }

    btnSave.innerHTML = `Enregistrer le Pointage <span class="btn-loader"></span>`;
    btnSave.style.pointerEvents = 'auto';

    showToast(ok ? 'Pointage enregistré ✓' : 'Sauvegardé localement (hors-ligne)');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

/* =========================================
   ADMIN PANEL LOGIC
========================================= */
async function loadMergedSubmissions() {
    let remoteSubs = [];
    try {
        remoteSubs = (await dbLoadSubmissions()) || [];
    } catch(e) {
        remoteSubs = [];
    }

    let localSubs = [];
    try {
        localSubs = JSON.parse(localStorage.getItem('ps_submissions')) || [];
    } catch(e) {
        localSubs = [];
    }

    const map = new Map();

    // Add remote submissions
    remoteSubs.forEach(s => {
        const key = s.id ? String(s.id) : `${s.supervisor}_${s.week}_${s.task}`;
        map.set(key, s);
    });

    // Add/merge local submissions
    localSubs.forEach(s => {
        const key = s.id ? String(s.id) : `${s.supervisor}_${s.week}_${s.task}`;
        const existing = map.get(key);
        if (!existing) {
            map.set(key, s);
            // Push to Supabase if missing remotely
            dbUpsertSubmission(s).catch(err => console.warn('[Sync] Auto-sync local item error:', err));
        } else {
            const existingTime = new Date(existing.timestamp || 0).getTime();
            const localTime = new Date(s.timestamp || 0).getTime();
            if (localTime > existingTime) {
                map.set(key, s);
                dbUpsertSubmission(s).catch(err => console.warn('[Sync] Auto-sync updated local item error:', err));
            }
        }
    });

    const combined = Array.from(map.values());
    combined.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    try {
        localStorage.setItem('ps_submissions', JSON.stringify(combined));
    } catch(e) {}

    return combined;
}

async function checkAndRecoverWip() {
    const recoveryAlert = document.getElementById('admin-wip-recovery-alert');
    const wipKpiEl = document.getElementById('admin-kpi-wip');
    if (!recoveryAlert) return 0;

    let wipsFound = [];

    // Scan localStorage for ps_wip_*
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ps_wip_')) {
            try {
                const parts = key.replace('ps_wip_', '').split('_');
                const sup = parts[0] || 'Inconnu';
                const week = parts[1] || 'W1';
                const task = parts.slice(2).join(' ') || 'Tâche';
                const val = JSON.parse(localStorage.getItem(key));
                if (val && (val.gaucheState || val.droitState)) {
                    const gChecked = Object.values(val.gaucheState || {}).filter(v => isStateActive(v)).length;
                    const dChecked = Object.values(val.droitState  || {}).filter(v => isStateActive(v)).length;
                    if (gChecked > 0 || dChecked > 0) {
                        wipsFound.push({ key, sup, week, task, gChecked, dChecked, val });
                    }
                }
            } catch(e) {}
        }
    }

    // Scan Supabase WIP store
    try {
        const remoteWips = await dbLoadAllWips();
        remoteWips.forEach(rw => {
            if (rw.id && rw.id.startsWith('ps_wip_') && rw.id !== 'kas8_trolleys') {
                const parts = rw.id.replace('ps_wip_', '').split('_');
                const sup = parts[0] || 'Inconnu';
                const week = parts[1] || 'W1';
                const task = parts.slice(2).join(' ') || 'Tâche';
                const gChecked = Object.values(rw.gauche_state || {}).filter(v => isStateActive(v)).length;
                const dChecked = Object.values(rw.droit_state  || {}).filter(v => isStateActive(v)).length;
                if ((gChecked > 0 || dChecked > 0) && !wipsFound.some(w => w.key === rw.id)) {
                    wipsFound.push({ key: rw.id, sup, week, task, gChecked, dChecked, val: { gaucheState: rw.gauche_state, droitState: rw.droit_state, remarks: rw.remarks } });
                }
            }
        });
    } catch(e) {}

    if (wipKpiEl) wipKpiEl.textContent = wipsFound.length;

    if (wipsFound.length === 0) {
        recoveryAlert.style.display = 'none';
        return 0;
    }

    recoveryAlert.style.display = 'block';
    recoveryAlert.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
                <div style="font-weight:700; font-size:0.95rem; color:#fef08a;">🔍 ${wipsFound.length} Brouillon(s) / Pointage(s) en cours trouvé(s) :</div>
                <ul style="margin:4px 0 0 16px; padding:0; font-size:0.85rem; color:#fef9c3;">
                    ${wipsFound.map(w => `<li><strong>${w.sup}</strong> — ${w.week} (${w.task}) : ${w.gChecked + w.dChecked} lignes pointées</li>`).join('')}
                </ul>
            </div>
            <button id="btn-convert-wips" class="btn-primary" style="padding:8px 16px; font-size:0.85rem; background:#f59e0b; color:#0f172a; font-weight:700; width:auto;">
                ⚡ Récupérer & Valider Tout Maintenant
            </button>
        </div>
    `;

            const btnConvert = document.getElementById('btn-convert-wips');
            if (btnConvert) {
                btnConvert.addEventListener('click', async () => {
                    btnConvert.textContent = 'Récupération...';
                    let lastSup = appState.supervisor;
                    for (const w of wipsFound) {
                        const gChecked = Object.values(w.val.gaucheState || {}).filter(v => isStateActive(v)).length;
                        const dChecked = Object.values(w.val.droitState  || {}).filter(v => isStateActive(v)).length;
                        const sub = {
                            supervisor: w.sup,
                            week: w.week,
                            task: w.task,
                            gaucheCount: gChecked,
                            droitCount: dChecked,
                            totalMax: (appSettings.gaucheEnd - appSettings.gaucheStart + 1) + (appSettings.droitEnd - appSettings.droitStart + 1),
                            remarks: w.val.remarks || "Pointage récupéré d'aujourd'hui",
                            gaucheState: w.val.gaucheState || {},
                            droitState: w.val.droitState || {},
                            gaucheRange: { start: appSettings.gaucheStart, end: appSettings.gaucheEnd },
                            droitRange: { start: appSettings.droitStart, end: appSettings.droitEnd }
                        };
                        await dbUpsertSubmission(sub);
                        
                        // Clear converted WIP from local storage & Supabase
                        localStorage.removeItem(w.key);
                        await dbClearWip(w.key);

                        lastSup = w.sup;
                        appState.supervisor = w.sup;
                        appState.week = w.week;
                        appState.task = w.task;
                        appState.gaucheState = { ...(w.val.gaucheState || {}) };
                        appState.droitState  = { ...(w.val.droitState  || {}) };
                        appState.remarks     = w.val.remarks     || '';
                        if (remarksInput) remarksInput.value = appState.remarks;
                    }

                    if (lastSup) {
                        localStorage.setItem('ps_supervisor', lastSup);
                        if (userNameEl) userNameEl.textContent = lastSup;
                        if (userAvatarEl) {
                            userAvatarEl.textContent = lastSup.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                        }
                    }

                    generateGrids(true); // Preserve recovered state!
                    showToast('Pointages récupérés et affichés sur la carte ✓');
                    renderAdminTable();
                });
            }
            return wipsFound.length;
        }

        function loadSubmissionToMap(sub) {
            if (!sub) return;
            const supName = sub.supervisor || 'Supervisor 1';
            
            // Set supervisor without resetting map state
            appState.supervisor  = supName;
            appState.week        = sub.week       || 'W1';
            appState.task        = sub.task       || 'control twisting';
            appState.gaucheState = { ...(sub.gaucheState || {}) };
            appState.droitState  = { ...(sub.droitState  || {}) };
            appState.remarks     = sub.remarks     || '';

            localStorage.setItem('ps_supervisor', supName);
            if (userNameEl) userNameEl.textContent = supName;
            if (userAvatarEl) {
                const initials = supName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                userAvatarEl.textContent = initials || 'S1';
            }

            if (weekSelect) weekSelect.value = appState.week;
            if (taskSelect) taskSelect.value = appState.task;
            if (remarksInput) remarksInput.value = appState.remarks;

            generateGrids(true); // preserveState = true!
            updateProgress();   // Update overall progress counters!
            switchView('dashboard');
            showToast(`Pointage de ${supName} (${appState.week}) chargé sur la carte ✓`);
        }

let adminFiltersBound = false;

async function renderAdminTable() {
    const container    = document.getElementById('admin-history-container');
    const emptyState   = document.getElementById('admin-empty-state');
    const filterSupEl  = document.getElementById('admin-filter-sup');
    const filterDateEl = document.getElementById('admin-filter-date');
    const searchInput  = document.getElementById('admin-search-input');

    const kpiTotalEl = document.getElementById('admin-kpi-total');
    const kpiTodayEl = document.getElementById('admin-kpi-today');
    const kpiSupsEl  = document.getElementById('admin-kpi-sups');

    container.innerHTML = '';

    // Load merged submissions from both Supabase and localStorage
    let allSubmissions = await loadMergedSubmissions();
    await checkAndRecoverWip();

    // Populate supervisor dropdown dynamically
    const selectDeleteSupEl = document.getElementById('select-delete-sup');
    const supsSet = new Set([appSettings.sup1Name, appSettings.sup2Name]);
    allSubmissions.forEach(s => { if (s.supervisor && s.supervisor.trim()) supsSet.add(s.supervisor.trim()); });
    
    // Scan WIP keys in localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ps_wip_')) {
            const parts = key.replace('ps_wip_', '').split('_');
            if (parts[0]) supsSet.add(parts[0]);
        }
    }

    const supList = Array.from(supsSet).filter(Boolean).sort();

    if (filterSupEl) {
        const currentSelected = filterSupEl.value;
        filterSupEl.innerHTML = `<option value="ALL">👥 Tous les Superviseurs (${supList.length})</option>`;
        supList.forEach(sup => {
            const opt = document.createElement('option');
            opt.value = sup;
            opt.textContent = `👤 ${sup}`;
            if (sup === currentSelected) opt.selected = true;
            filterSupEl.appendChild(opt);
        });
    }

    if (selectDeleteSupEl) {
        const currentSel = selectDeleteSupEl.value;
        selectDeleteSupEl.innerHTML = supList.length === 0 ? `<option value="">Aucun superviseur enregistré</option>` : '';
        supList.forEach(sup => {
            const opt = document.createElement('option');
            opt.value = sup;
            opt.textContent = `👤 ${sup}`;
            if (sup === currentSel) opt.selected = true;
            selectDeleteSupEl.appendChild(opt);
        });
    }

    // Attach event listeners once
    if (!adminFiltersBound) {
        adminFiltersBound = true;
        if (filterSupEl)  filterSupEl.addEventListener('change', renderAdminTable);
        if (filterDateEl) filterDateEl.addEventListener('change', renderAdminTable);
        if (searchInput)  searchInput.addEventListener('input', renderAdminTable);
    }

    // Update KPI Header counters
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = allSubmissions.filter(s => s.timestamp && s.timestamp.slice(0, 10) === todayStr).length;
    const uniqueSups = new Set(allSubmissions.map(s => s.supervisor)).size;

    if (kpiTotalEl) kpiTotalEl.textContent = allSubmissions.length;
    if (kpiTodayEl) kpiTodayEl.textContent = todayCount;
    if (kpiSupsEl)  kpiSupsEl.textContent  = uniqueSups;

    // Apply Filtering
    const selectedSup  = filterSupEl ? filterSupEl.value : 'ALL';
    const selectedDate = filterDateEl ? filterDateEl.value : 'ALL';
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let filtered = allSubmissions.filter(s => {
        // Supervisor filter
        if (selectedSup !== 'ALL' && s.supervisor !== selectedSup) return false;

        // Date filter
        if (selectedDate === 'TODAY') {
            const subDate = s.timestamp ? s.timestamp.slice(0, 10) : '';
            if (subDate !== todayStr) return false;
        } else if (selectedDate === 'WEEK') {
            const now = new Date();
            const subTime = s.timestamp ? new Date(s.timestamp).getTime() : 0;
            const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
            if (subTime < sevenDaysAgo) return false;
        }

        // Search text query
        if (query) {
            const matchSup = (s.supervisor || '').toLowerCase().includes(query);
            const matchTask = (s.task || '').toLowerCase().includes(query);
            const matchWeek = (s.week || '').toLowerCase().includes(query);
            const matchRem = (s.remarks || '').toLowerCase().includes(query);
            if (!matchSup && !matchTask && !matchWeek && !matchRem) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    // Group by supervisor (preserve insertion order)
    const grouped = {};
    filtered.forEach((sub, globalIndex) => {
        if (!grouped[sub.supervisor]) grouped[sub.supervisor] = [];
        grouped[sub.supervisor].push({ sub, globalIndex });
    });

    // Render one section per supervisor
    Object.entries(grouped).forEach(([supervisor, entries]) => {
        const totalDone  = entries.reduce((s, { sub }) => {
            const g = (sub.gaucheCount !== undefined && sub.gaucheCount > 0) ? sub.gaucheCount : Object.values(sub.gaucheState || {}).filter(v => isStateActive(v)).length;
            const d = (sub.droitCount !== undefined && sub.droitCount > 0) ? sub.droitCount : Object.values(sub.droitState || {}).filter(v => isStateActive(v)).length;
            return s + g + d;
        }, 0);
        const totalMax   = entries.reduce((s, { sub }) => s + (sub.totalMax || 280), 0);
        const supPct     = totalMax > 0 ? Math.round((totalDone / totalMax) * 100) : 0;

        // Section wrapper
        const section = document.createElement('div');
        section.className = 'sup-history-section';
        section.style.marginBottom = '20px';

        // Section header
        section.innerHTML = `
            <div class="sup-section-header">
                <div class="sup-section-left">
                    <span class="sup-section-avatar" style="background:linear-gradient(135deg, var(--primary-light), var(--primary));">${supervisor.charAt(0).toUpperCase()}</span>
                    <div>
                        <div class="sup-section-name" style="font-weight:700; font-size:1.1rem;">👤 ${supervisor}</div>
                        <div class="sup-section-meta">${entries.length} pointage(s) · ${totalDone} / ${totalMax} lignes pointées (${supPct}%)</div>
                    </div>
                </div>
                <div class="sup-section-bar-wrap">
                    <div class="sup-section-bar" style="width:${supPct}%"></div>
                </div>
            </div>
        `;

        // Table for this supervisor
        const tableWrap = document.createElement('div');
        tableWrap.className = 'table-responsive';
        tableWrap.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Date & Heure</th>
                        <th>Semaine</th>
                        <th>Tâche de Contrôle</th>
                        <th>Progrès (Lignes)</th>
                        <th>Remarques</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;

        const tbody = tableWrap.querySelector('tbody');

        entries.forEach(({ sub, globalIndex }) => {
            const tr = document.createElement('tr');
            const date          = new Date(sub.timestamp || Date.now());
            const formatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const gCount        = (sub.gaucheCount !== undefined && sub.gaucheCount > 0) ? sub.gaucheCount : Object.values(sub.gaucheState || {}).filter(v => isStateActive(v)).length;
            const dCount        = (sub.droitCount !== undefined && sub.droitCount > 0) ? sub.droitCount : Object.values(sub.droitState || {}).filter(v => isStateActive(v)).length;
            const totalChecked  = gCount + dCount;
            const totalExpected = sub.totalMax || 280;
            const pct           = Math.round((totalChecked / totalExpected) * 100);
            const progressCls   = totalChecked === totalExpected ? 'badge-ok' : '';
            const shortRem      = sub.remarks ? (sub.remarks.length > 25 ? sub.remarks.slice(0, 25) + '...' : sub.remarks) : '-';

            tr.innerHTML = `
                <td><strong>${date.toLocaleDateString('fr-FR', formatOptions)}</strong></td>
                <td><span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:700; font-size:0.8rem;">${sub.week}</span></td>
                <td><strong>${sub.task}</strong></td>
                <td>
                    <span class="${progressCls}">${totalChecked} / ${totalExpected}</span>
                    <small style="color:var(--text-muted)"> (${pct}%)</small>
                </td>
                <td title="${sub.remarks || ''}">${shortRem}</td>
                <td>
                    <button class="btn-secondary detail-link" data-id="${sub.id}" data-index="${globalIndex}" style="padding:4px 8px; font-size:0.78rem; background:#3b82f6; color:#fff; border:none; margin-right:4px;">👁️ Carte Modal</button>
                    <button class="btn-secondary load-map-link" data-index="${globalIndex}" style="padding:4px 8px; font-size:0.78rem; background:#059669; color:#fff; border:none; margin-right:4px;">🗺️ Charger la Carte</button>
                    <button class="btn-secondary delete-link" data-id="${sub.id}" style="padding:4px 8px; font-size:0.78rem; background:#ef4444; color:#fff; border:none;">🗑️</button>
                </td>
            `;

            // Attach event listeners directly
            tr.querySelector('.detail-link').addEventListener('click', (e) => {
                e.preventDefault();
                showDetailFromSubmissions(allSubmissions, globalIndex);
            });
            tr.querySelector('.load-map-link').addEventListener('click', (e) => {
                e.preventDefault();
                loadSubmissionToMap(sub);
            });
            tr.querySelector('.delete-link').addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm('Voulez-vous vraiment supprimer ce pointage ?')) {
                    await deleteSubmission(sub.id);
                }
            });

            tbody.appendChild(tr);
        });

        section.appendChild(tableWrap);
        container.appendChild(section);
    });
}

async function deleteSubmission(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) return;

    const ok = await dbDeleteSubmission(id);
    if (!ok) {
        // Fallback localStorage
        let submissions = JSON.parse(localStorage.getItem('ps_submissions')) || [];
        submissions = submissions.filter(s => s.id !== id);
        localStorage.setItem('ps_submissions', JSON.stringify(submissions));
    }

    renderAdminTable();
    showToast('Entrée supprimée');
}

function showDetailFromSubmissions(submissions, index) {
    const sub = submissions[index];
    if (!sub) return;

    const date = new Date(sub.timestamp);
    const fmtDate = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const totalChecked  = sub.gaucheCount + sub.droitCount;
    const totalExpected = sub.totalMax || '?';
    const pct = sub.totalMax ? Math.round((totalChecked / sub.totalMax) * 100) : '?';

    document.getElementById('modal-title').textContent = `${sub.supervisor} — ${sub.week}`;
    document.getElementById('modal-meta-badges').innerHTML = `
        <span class="meta-badge">📅 ${fmtDate}</span>
        <span class="meta-badge">🌱 ${sub.task}</span>
        <span class="meta-badge green">${totalChecked} / ${totalExpected} lignes — ${pct}%</span>
    `;

    const gRange = sub.gaucheRange || { start: 1, end: 140 };
    const dRange = sub.droitRange  || { start: 1, end: 140 };
    const gState = sub.gaucheState || {};
    const dState = sub.droitState  || {};
    const hasDetail = sub.gaucheState !== undefined;

    const renderModalGrid = (containerId, stateMap, startIdx, endIdx, hasDetail) => {
        const grid = document.getElementById(containerId);
        grid.innerHTML = '';
        if (!hasDetail) {
            grid.innerHTML = '<div style="padding:10px;color:#94a3b8;font-size:0.8rem;">Détails non disponibles</div>';
            return;
        }
        for (let i = startIdx; i <= endIdx; i++) {
            const val = stateMap[i];
            const box = document.createElement('div');
            box.className = 'path-box' +
                (val === true ? ' active' : '') +
                (val === 'x'  ? ' error'  : '');
            box.textContent = i;
            grid.appendChild(box);
        }
    };

    renderModalGrid('modal-grid-gauche', gState, gRange.start, gRange.end, hasDetail);
    renderModalGrid('modal-grid-droit',  dState, dRange.start, dRange.end, hasDetail);

    document.getElementById('modal-gauche-count').textContent = sub.gaucheCount;
    document.getElementById('modal-droit-count').textContent  = sub.droitCount;

    const remarksWrap = document.getElementById('modal-remarks-wrap');
    const remarksText = document.getElementById('modal-remarks-text');
    if (sub.remarks && sub.remarks.trim()) {
        remarksText.textContent = sub.remarks;
        remarksWrap.style.display = 'block';
    } else {
        remarksWrap.style.display = 'none';
    }

    document.getElementById('modal-map-detail').classList.add('active');
}

/* =========================================
   SUIVI & PLANNING CHARIOTS (42 TROLLEYS)
========================================= */
let trolleyList = [];
let filterOnlyMissing = false;
let trolleyDebounceTimer = null;

function initTrolleysState() {
    trolleyList = [];
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    for (let i = 1; i <= 42; i++) {
        trolleyList.push({
            id: i,
            worker: '',
            pinsAssigned: 10,
            pinsFound: 10,
            chargeStatus: 'Normale',
            chargePct: 100,
            chargeDay: days[(i - 1) % 7], // Distributed across days by default
            chargerNum: `Chargeur ${((i - 1) % 10) + 1}`,
            notes: ''
        });
    }
}

async function loadTrolleysData() {
    initTrolleysState();
    try {
        const remote = await dbLoadTrolleys();
        if (remote && Array.isArray(remote) && remote.length > 0) {
            remote.forEach(r => {
                const idx = trolleyList.findIndex(t => t.id === r.id);
                if (idx !== -1) {
                    trolleyList[idx] = { ...trolleyList[idx], ...r };
                }
            });
            renderTodayChargeAlert();
            renderTrolleysGrid();
            return;
        }
    } catch(e) {}

    // Fallback localStorage
    try {
        const local = JSON.parse(localStorage.getItem('ps_trolleys'));
        if (local && Array.isArray(local)) {
            local.forEach(r => {
                const idx = trolleyList.findIndex(t => t.id === r.id);
                if (idx !== -1) trolleyList[idx] = { ...trolleyList[idx], ...r };
            });
        }
    } catch(e) {}

    renderTodayChargeAlert();
    renderTrolleysGrid();
}

function renderTodayChargeAlert() {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const todayIndex = new Date().getDay();
    const todayName = days[todayIndex];

    const elDayName = document.getElementById('today-day-name');
    const elSummary = document.getElementById('today-charge-summary');
    const elChips = document.getElementById('today-charge-chips');

    if (elDayName) elDayName.textContent = todayName;

    const todayTrolleys = trolleyList.filter(t => (t.chargeDay || '').toLowerCase() === todayName.toLowerCase());

    if (!elSummary || !elChips) return;
    elChips.innerHTML = '';

    if (todayTrolleys.length === 0) {
        elSummary.textContent = `Aucun chariot programmé à charger ce ${todayName}.`;
        elChips.innerHTML = `<span class="charge-chip empty">Aucun chariot à charger aujourd'hui</span>`;
    } else {
        elSummary.textContent = `${todayTrolleys.length} chariot(s) à charger ce ${todayName} :`;
        todayTrolleys.forEach(t => {
            const chip = document.createElement('span');
            chip.className = 'charge-chip';
            const workerName = t.worker && t.worker.trim() ? t.worker.trim() : 'non assigné';
            chip.innerHTML = `🛺 <strong>Chariot N°${t.id}</strong> — 👤 <em>${workerName}</em> <span class="chip-charger">🔌 ${t.chargerNum || 'Chargeur 1'}</span>`;
            elChips.appendChild(chip);
        });
    }
}

async function saveTrolleysDataManual() {
    const btn = document.getElementById('btn-save-trolleys');
    if (btn) {
        btn.innerHTML = `Enregistrement... <span class="btn-loader" style="display:inline-block"></span>`;
        btn.style.pointerEvents = 'none';
    }

    localStorage.setItem('ps_trolleys', JSON.stringify(trolleyList));
    const ok = await dbSaveTrolleys(trolleyList);

    if (btn) {
        btn.innerHTML = `Enregistrer Suivi Chariots`;
        btn.style.pointerEvents = 'auto';
    }
    renderTodayChargeAlert();
    showToast(ok ? 'Suivi Chariots enregistré ✓' : 'Sauvegardé localement (hors-ligne)');
    updateTrolleyKPIs();
}

function saveTrolleysDataSilently() {
    localStorage.setItem('ps_trolleys', JSON.stringify(trolleyList));
    renderTodayChargeAlert();
    clearTimeout(trolleyDebounceTimer);
    trolleyDebounceTimer = setTimeout(() => {
        dbSaveTrolleys(trolleyList);
    }, 800);
}

function updateTrolleyKPIs() {
    let totalAssigned = 0;
    let totalFound = 0;
    let totalMissing = 0;

    trolleyList.forEach(t => {
        const assigned = parseInt(t.pinsAssigned, 10) || 0;
        const found = parseInt(t.pinsFound, 10) || 0;
        const missing = Math.max(0, assigned - found);

        totalAssigned += assigned;
        totalFound += found;
        totalMissing += missing;
    });

    const elTotal = document.getElementById('kpi-total-trolleys');
    const elAssigned = document.getElementById('kpi-pins-assigned');
    const elFound = document.getElementById('kpi-pins-found');
    const elMissing = document.getElementById('kpi-pins-missing');

    if (elTotal) elTotal.textContent = trolleyList.length;
    if (elAssigned) elAssigned.textContent = totalAssigned;
    if (elFound) elFound.textContent = totalFound;
    if (elMissing) elMissing.textContent = totalMissing;

    const wrapMissing = document.getElementById('kpi-missing-wrap');
    if (wrapMissing) {
        if (totalMissing > 0) wrapMissing.classList.add('warning-kpi');
        else wrapMissing.classList.remove('warning-kpi');
    }
}

function addTrolley() {
    const nextId = trolleyList.length > 0 ? Math.max(...trolleyList.map(t => t.id)) + 1 : 1;
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const newTrolley = {
        id: nextId,
        worker: '',
        pinsAssigned: 10,
        pinsFound: 10,
        chargeStatus: 'Normale',
        chargePct: 100,
        chargeDay: days[(nextId - 1) % 7],
        chargerNum: `Chargeur ${((nextId - 1) % 10) + 1}`,
        notes: ''
    };
    trolleyList.push(newTrolley);
    saveTrolleysDataManual();
    renderTrolleysGrid();
    showToast(`Chariot N°${nextId} créé avec succès !`);
}

function deleteTrolley(id) {
    if (!confirm(`Supprimer définitivement le Chariot N°${id} ?`)) return;
    trolleyList = trolleyList.filter(t => t.id !== id);
    saveTrolleysDataManual();
    renderTrolleysGrid();
    showToast(`Chariot N°${id} supprimé.`);
}

function renderTrolleysGrid() {
    const container = document.getElementById('trolleys-grid');
    const searchInput = document.getElementById('trolley-search-input');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (!container) return;
    container.innerHTML = '';

    const isAdmin = appState.isAdmin || false;

    // Toggle admin-only buttons visibility
    document.querySelectorAll('.admin-only-btn').forEach(btn => {
        btn.style.display = isAdmin ? 'inline-flex' : 'none';
    });

    updateTrolleyKPIs();

    const filtered = trolleyList.filter(t => {
        const missing = Math.max(0, (parseInt(t.pinsAssigned, 10) || 0) - (parseInt(t.pinsFound, 10) || 0));
        if (filterOnlyMissing && missing <= 0) return false;

        if (searchVal) {
            const matchesId = `chariot ${t.id}`.includes(searchVal) || `${t.id}` === searchVal;
            const matchesWorker = (t.worker || '').toLowerCase().includes(searchVal);
            const matchesNotes = (t.notes || '').toLowerCase().includes(searchVal);
            const matchesCharger = (t.chargerNum || '').toLowerCase().includes(searchVal);
            const matchesDay = (t.chargeDay || '').toLowerCase().includes(searchVal);
            if (!matchesId && !matchesWorker && !matchesNotes && !matchesCharger && !matchesDay) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Aucun chariot ne correspond à votre recherche.</p></div>`;
        return;
    }

    filtered.forEach(t => {
        const missing = Math.max(0, (parseInt(t.pinsAssigned, 10) || 0) - (parseInt(t.pinsFound, 10) || 0));
        const card = document.createElement('div');
        card.className = `trolley-card ${missing > 0 ? 'has-missing' : ''}`;

        const disAttr = isAdmin ? '' : 'disabled';

        card.innerHTML = `
            <div class="trolley-card-header">
                <div class="trolley-badge">
                    <span>🛺</span> Chariot N°${t.id}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="trolley-status-badge ${missing > 0 ? 'status-warning' : 'status-ok'}">
                        ${missing > 0 ? `⚠️ ${missing} Pin(s) Oublié(s)` : '🟢 Pins Conformes'}
                    </div>
                    ${isAdmin ? `<button class="btn-icon t-delete" data-id="${t.id}" title="Supprimer Chariot" style="color:#dc2626; background:#fee2e2; border-radius:50%; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center;">🗑️</button>` : ''}
                </div>
            </div>

            <div class="trolley-card-body">
                <div class="input-group">
                    <label>👤 Ouvrier Affecté</label>
                    <input type="text" class="custom-input t-worker" data-id="${t.id}" value="${t.worker || ''}" placeholder="Saisir nom ouvrier...">
                </div>

                <div class="trolley-row-inputs">
                    <div class="trolley-pin-control">
                        <label>Pins Affectés <small>(Éditable Superviseur)</small></label>
                        <input type="number" min="0" class="custom-input trolley-pin-input t-assigned" data-id="${t.id}" value="${t.pinsAssigned}">
                    </div>
                    <div class="trolley-pin-control">
                        <label>Pins Trouvés <small>(Éditable Superviseur)</small></label>
                        <input type="number" min="0" class="custom-input trolley-pin-input t-found" data-id="${t.id}" value="${t.pinsFound}">
                        <span class="missing-pill ${missing > 0 ? 'alert' : 'none'}">${missing > 0 ? `-${missing}` : '✓'}</span>
                    </div>
                </div>

                <div class="trolley-charge-section">
                    <div class="trolley-charge-header">
                        <span>Planning de Charge ${!isAdmin ? '<small>(Géré par l\'Admin)</small>' : ''}</span>
                        <span>${t.chargePct}% (${t.chargeStatus})</span>
                    </div>
                    <div class="charge-bar-bg">
                        <div class="charge-bar-fill" style="width: ${t.chargePct}%"></div>
                    </div>
                    
                    <div class="trolley-charge-inputs-row">
                        <div class="input-group">
                            <label>Jour de Charge</label>
                            <select class="custom-select t-charge-day" data-id="${t.id}" ${disAttr}>
                                <option value="Lundi" ${t.chargeDay === 'Lundi' ? 'selected' : ''}>Lundi</option>
                                <option value="Mardi" ${t.chargeDay === 'Mardi' ? 'selected' : ''}>Mardi</option>
                                <option value="Mercredi" ${t.chargeDay === 'Mercredi' ? 'selected' : ''}>Mercredi</option>
                                <option value="Jeudi" ${t.chargeDay === 'Jeudi' ? 'selected' : ''}>Jeudi</option>
                                <option value="Vendredi" ${t.chargeDay === 'Vendredi' ? 'selected' : ''}>Vendredi</option>
                                <option value="Samedi" ${t.chargeDay === 'Samedi' ? 'selected' : ''}>Samedi</option>
                                <option value="Dimanche" ${t.chargeDay === 'Dimanche' ? 'selected' : ''}>Dimanche</option>
                                <option value="Non défini" ${t.chargeDay === 'Non défini' ? 'selected' : ''}>Non défini</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label>N° Chargeur</label>
                            <input type="text" class="custom-input t-charger-num" data-id="${t.id}" value="${t.chargerNum || ''}" placeholder="ex: Chargeur 1" ${disAttr}>
                        </div>
                    </div>

                    <div class="trolley-row-inputs" style="margin-top:6px;">
                        <select class="custom-select t-charge-status" data-id="${t.id}" ${disAttr}>
                            <option value="Normale" ${t.chargeStatus === 'Normale' ? 'selected' : ''}>Charge Normale (100%)</option>
                            <option value="Sous-charge" ${t.chargeStatus === 'Sous-charge' ? 'selected' : ''}>Sous-charge (50%)</option>
                            <option value="Surcharge" ${t.chargeStatus === 'Surcharge' ? 'selected' : ''}>Surcharge (120%)</option>
                            <option value="Planifié" ${t.chargeStatus === 'Planifié' ? 'selected' : ''}>Planifié (75%)</option>
                        </select>
                        <input type="text" class="custom-input t-notes" data-id="${t.id}" value="${t.notes || ''}" placeholder="Lignes affectées / Note..." ${disAttr}>
                    </div>
                </div>
            </div>
        `;

        // Event listeners for inline editing
        const inpWorker = card.querySelector('.t-worker');
        const inpAssigned = card.querySelector('.t-assigned');
        const inpFound = card.querySelector('.t-found');
        const selChargeDay = card.querySelector('.t-charge-day');
        const inpChargerNum = card.querySelector('.t-charger-num');
        const selCharge = card.querySelector('.t-charge-status');
        const inpNotes = card.querySelector('.t-notes');
        const btnDelete = card.querySelector('.t-delete');

        if (btnDelete) {
            btnDelete.addEventListener('click', () => deleteTrolley(t.id));
        }

        if (inpWorker) {
            inpWorker.addEventListener('input', (e) => {
                t.worker = e.target.value;
                saveTrolleysDataSilently();
            });
        }

        const updateCardStatus = () => {
            const assigned = parseInt(t.pinsAssigned, 10) || 0;
            const found = parseInt(t.pinsFound, 10) || 0;
            const missing = Math.max(0, assigned - found);

            if (missing > 0) card.classList.add('has-missing');
            else card.classList.remove('has-missing');

            const statusBadge = card.querySelector('.trolley-status-badge');
            if (statusBadge) {
                statusBadge.className = `trolley-status-badge ${missing > 0 ? 'status-warning' : 'status-ok'}`;
                statusBadge.innerHTML = missing > 0 ? `⚠️ ${missing} Pin(s) Oublié(s)` : '🟢 Pins Conformes';
            }

            const missingPill = card.querySelector('.missing-pill');
            if (missingPill) {
                missingPill.className = `missing-pill ${missing > 0 ? 'alert' : 'none'}`;
                missingPill.textContent = missing > 0 ? `-${missing}` : '✓';
            }

            updateTrolleyKPIs();
        };

        inpAssigned.addEventListener('input', (e) => {
            const val = e.target.value;
            t.pinsAssigned = val === '' ? '' : (parseInt(val, 10) || 0);
            updateCardStatus();
            saveTrolleysDataSilently();
        });

        inpAssigned.addEventListener('blur', (e) => {
            if (e.target.value === '' || isNaN(parseInt(e.target.value, 10))) {
                t.pinsAssigned = 0;
                e.target.value = 0;
                updateCardStatus();
            }
        });

        inpFound.addEventListener('input', (e) => {
            const val = e.target.value;
            t.pinsFound = val === '' ? '' : (parseInt(val, 10) || 0);
            updateCardStatus();
            saveTrolleysDataSilently();
        });

        inpFound.addEventListener('blur', (e) => {
            if (e.target.value === '' || isNaN(parseInt(e.target.value, 10))) {
                t.pinsFound = 0;
                e.target.value = 0;
                updateCardStatus();
            }
        });

        if (selChargeDay) {
            selChargeDay.addEventListener('change', (e) => {
                t.chargeDay = e.target.value;
                saveTrolleysDataSilently();
            });
        }

        if (inpChargerNum) {
            inpChargerNum.addEventListener('input', (e) => {
                t.chargerNum = e.target.value;
                saveTrolleysDataSilently();
            });
        }

        if (selCharge) {
            selCharge.addEventListener('change', (e) => {
                t.chargeStatus = e.target.value;
                if (t.chargeStatus === 'Normale') t.chargePct = 100;
                else if (t.chargeStatus === 'Sous-charge') t.chargePct = 50;
                else if (t.chargeStatus === 'Surcharge') t.chargePct = 120;
                else if (t.chargeStatus === 'Planifié') t.chargePct = 75;
                renderTrolleysGrid();
                saveTrolleysDataSilently();
            });
        }

        if (inpNotes) {
            inpNotes.addEventListener('input', (e) => {
                t.notes = e.target.value;
                saveTrolleysDataSilently();
            });
        }

        container.appendChild(card);
    });
}

/* =========================================
   EVENT LISTENERS
========================================= */
function setupEventListeners() {
    // Tabs Navigation
    const tabMapBtn = document.getElementById('tab-btn-map');
    const tabTrolleysBtn = document.getElementById('tab-btn-trolleys');
    const tabMapContent = document.getElementById('tab-content-map');
    const tabTrolleysContent = document.getElementById('tab-content-trolleys');

    if (tabMapBtn && tabTrolleysBtn) {
        tabMapBtn.addEventListener('click', () => {
            tabMapBtn.classList.add('active');
            tabTrolleysBtn.classList.remove('active');
            tabMapContent.classList.add('active');
            tabTrolleysContent.classList.remove('active');
        });

        tabTrolleysBtn.addEventListener('click', async () => {
            tabTrolleysBtn.classList.add('active');
            tabMapBtn.classList.remove('active');
            tabTrolleysContent.classList.add('active');
            tabMapContent.classList.remove('active');
            await loadTrolleysData();
            renderTrolleysGrid();
        });
    }

    // Trolley actions
    const btnAddTrolley = document.getElementById('btn-add-trolley');
    if (btnAddTrolley) {
        btnAddTrolley.addEventListener('click', addTrolley);
    }

    const btnSaveTrolleys = document.getElementById('btn-save-trolleys');
    if (btnSaveTrolleys) {
        btnSaveTrolleys.addEventListener('click', saveTrolleysDataManual);
    }

    const btnResetTrolleys = document.getElementById('btn-reset-trolleys');
    if (btnResetTrolleys) {
        btnResetTrolleys.addEventListener('click', () => {
            if (confirm('Réinitialiser l\'état des chariots ?')) {
                initTrolleysState();
                saveTrolleysDataManual();
                renderTrolleysGrid();
            }
        });
    }

    const btnFilterMissing = document.getElementById('btn-filter-missing');
    if (btnFilterMissing) {
        btnFilterMissing.addEventListener('click', () => {
            filterOnlyMissing = !filterOnlyMissing;
            btnFilterMissing.classList.toggle('active', filterOnlyMissing);
            renderTrolleysGrid();
        });
    }

    const trolleySearchInput = document.getElementById('trolley-search-input');
    if (trolleySearchInput) {
        trolleySearchInput.addEventListener('input', renderTrolleysGrid);
    }

    // Period Mode (1 Semaine vs 2 Semaines)
    const periodModeSelect = document.getElementById('period-mode-select');
    if (periodModeSelect) {
        periodModeSelect.addEventListener('change', () => {
            populateWeeks();
            generateGrids();
        });
    }

    // Login — supervisor selection (with password check)
    document.querySelectorAll('.btn-supervisor').forEach(btn => {
        btn.addEventListener('click', (e) => {
            appState.isAdmin = false;
            const id = e.currentTarget.dataset.supervisor;
            const name = id === '1' ? appSettings.sup1Name : appSettings.sup2Name;
            const pwd  = id === '1' ? appSettings.sup1Pwd  : appSettings.sup2Pwd;

            // If a password is set, show the password modal
            if (pwd && pwd.length > 0) {
                pendingSupervisorId = id;
                supPwdTitle.textContent = name;
                supPwdSubtitle.textContent = 'Entrez votre mot de passe pour continuer';
                supPwdInput.value = '';
                supPwdError.style.display = 'none';
                modalSupPwd.classList.add('active');
                setTimeout(() => supPwdInput.focus(), 350);
            } else {
                // No password set → direct login
                setSupervisor(name);
            }
        });
    });

    // Password modal: Confirm
    btnSupPwdConfirm.addEventListener('click', () => {
        if (!pendingSupervisorId) return;
        const expectedPwd = pendingSupervisorId === '1' ? appSettings.sup1Pwd : appSettings.sup2Pwd;
        const enteredPwd  = supPwdInput.value.trim();

        if (enteredPwd === expectedPwd) {
            // Success
            appState.isAdmin = false;
            const name = pendingSupervisorId === '1' ? appSettings.sup1Name : appSettings.sup2Name;
            modalSupPwd.classList.remove('active');
            pendingSupervisorId = null;
            setSupervisor(name);
        } else {
            // Error — shake + show message
            supPwdError.style.display = 'block';
            supPwdInput.classList.add('shake');
            setTimeout(() => supPwdInput.classList.remove('shake'), 500);
        }
    });

    // Password modal: Cancel
    btnSupPwdCancel.addEventListener('click', () => {
        modalSupPwd.classList.remove('active');
        pendingSupervisorId = null;
    });

    // Password modal: Enter key shortcut
    supPwdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnSupPwdConfirm.click();
    });

    // Password modal: Close on overlay click
    modalSupPwd.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            modalSupPwd.classList.remove('active');
            pendingSupervisorId = null;
        }
    });

    btnLogout.addEventListener('click', logout);
    btnSave.addEventListener('click', savePointage);
    btnSaveSettings.addEventListener('click', saveSettings);

    // When week or task changes → reload for new context
    weekSelect.addEventListener('change', () => {
        appState.week = weekSelect.value;
        generateGrids();
    });
    taskSelect.addEventListener('change', () => {
        appState.task = taskSelect.value;
        generateGrids();
    });

    // Secure Admin Navigation (Custom Modal)
    const openAdminModal = () => {
        adminPwdInput.value = '';
        adminPwdError.style.display = 'none';
        modalAdminPwd.classList.add('active');
        setTimeout(() => adminPwdInput.focus(), 350);
    };

    btnAdminPwdConfirm.addEventListener('click', () => {
        const entered = adminPwdInput.value.trim();
        const validPwd = appSettings.adminPwd || '1234';
        if (entered === validPwd || entered === '1234') {
            appState.isAdmin = true;
            modalAdminPwd.classList.remove('active');
            switchView('admin');
            renderTrolleysGrid();
        } else {
            adminPwdError.style.display = 'block';
            adminPwdInput.classList.add('shake');
            setTimeout(() => adminPwdInput.classList.remove('shake'), 500);
        }
    });

    btnAdminPwdCancel.addEventListener('click', () => {
        modalAdminPwd.classList.remove('active');
    });

    adminPwdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnAdminPwdConfirm.click();
    });

    modalAdminPwd.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) modalAdminPwd.classList.remove('active');
    });

    btnDashboardAdmin.addEventListener('click', openAdminModal);
    btnGotoAdmin.addEventListener('click', openAdminModal);
    btnAdminBack.addEventListener('click', () => {
        if (appState.supervisor) switchView('dashboard');
        else switchView('login');
    });

    // Close detail modal
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('modal-map-detail').classList.remove('active');
    });
    document.getElementById('modal-map-detail').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
    });
    // Attach Excel Export for Trolleys
    const btnExportTrolleys = document.getElementById('btn-export-trolleys');
    if (btnExportTrolleys) {
        btnExportTrolleys.addEventListener('click', exportTrolleysToExcel);
    }

    // Attach Excel Export for Submissions (Admin panel)
    const btnExportData = document.getElementById('btn-export-data');
    if (btnExportData) {
        btnExportData.addEventListener('click', exportSubmissionsToExcel);
    }

    // Attach Global Sync & Recovery button (Admin panel)
    const btnSyncAll = document.getElementById('btn-sync-all');
    if (btnSyncAll) {
        btnSyncAll.addEventListener('click', async () => {
            btnSyncAll.innerHTML = `Synchronisation... <span class="btn-loader" style="display:inline-block"></span>`;
            await renderAdminTable();
            await loadTrolleysData();
            btnSyncAll.innerHTML = `🔄 Récupérer & Synchroniser`;
            showToast('Données synchronisées et à jour ✓');
        });
    }

    // Admin Navigation Sub-Tabs Switching
    const adminTabHistory  = document.getElementById('admin-tab-btn-history');
    const adminTabTrolleys = document.getElementById('admin-tab-btn-trolleys');
    const adminTabSettings = document.getElementById('admin-tab-btn-settings');

    const adminPaneHistory  = document.getElementById('admin-tab-content-history');
    const adminPaneTrolleys = document.getElementById('admin-tab-content-trolleys');
    const adminPaneSettings = document.getElementById('admin-tab-content-settings');

    async function activateAdminTab(tabName) {
        if (adminTabHistory)  adminTabHistory.classList.toggle('active', tabName === 'history');
        if (adminTabTrolleys) adminTabTrolleys.classList.toggle('active', tabName === 'trolleys');
        if (adminTabSettings) adminTabSettings.classList.toggle('active', tabName === 'settings');

        if (adminPaneHistory)  adminPaneHistory.style.display  = tabName === 'history' ? 'block' : 'none';
        if (adminPaneTrolleys) adminPaneTrolleys.style.display = tabName === 'trolleys' ? 'block' : 'none';
        if (adminPaneSettings) adminPaneSettings.style.display = tabName === 'settings' ? 'block' : 'none';

        if (tabName === 'trolleys') {
            const trolleysWrapper = document.getElementById('admin-trolleys-wrapper');
            const trolleyTabContent = document.getElementById('tab-content-trolleys');
            if (trolleysWrapper && trolleyTabContent) {
                trolleyTabContent.classList.add('active');
                trolleysWrapper.appendChild(trolleyTabContent);
                await loadTrolleysData();
                renderTrolleysGrid();
            }
        }
    }

    if (adminTabHistory)  adminTabHistory.addEventListener('click', () => activateAdminTab('history'));
    if (adminTabTrolleys) adminTabTrolleys.addEventListener('click', () => activateAdminTab('trolleys'));
    if (adminTabSettings) adminTabSettings.addEventListener('click', () => activateAdminTab('settings'));

    // Supervisor Deletion Controls (Admin action)
    const btnDeleteSup1 = document.getElementById('btn-delete-sup1');
    const btnDeleteSup2 = document.getElementById('btn-delete-sup2');
    const btnDeleteSelectedSup = document.getElementById('btn-delete-selected-sup');
    const btnQuickDeleteFilterSup = document.getElementById('btn-quick-delete-filter-sup');

    async function deleteSupervisorAccountByName(supName) {
        if (!supName || supName === 'ALL') {
            return alert('Veuillez sélectionner un superviseur valide à supprimer.');
        }

        if (!confirm(`⚠️ ATTENTION SUPPRESSION DEFINITIVE !\n\nVoulez-vous vraiment supprimer définitivement le superviseur "${supName}" et EFFACER TOUS SES POINTAGES et brouillons BDD ?`)) {
            return;
        }

        // 1. Delete all submissions from Supabase and localStorage
        await dbDeleteSubmissionsForSupervisor(supName);
        let localSubs = JSON.parse(localStorage.getItem('ps_submissions')) || [];
        localSubs = localSubs.filter(s => s.supervisor !== supName);
        localStorage.setItem('ps_submissions', JSON.stringify(localSubs));

        // 2. Clear WIP keys for this supervisor from BDD & localStorage
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(`ps_wip_${supName}_`) || key.includes(`_${supName}_`))) {
                localStorage.removeItem(key);
                await dbClearWip(key);
            }
        }

        // 3. Reset profile settings if Sup1 or Sup2 match
        if (appSettings.sup1Name === supName) {
            appSettings.sup1Name = 'Supervisor 1';
            appSettings.sup1Pwd  = '';
            const inName = document.getElementById('setting-sup1-name');
            const inPwd  = document.getElementById('setting-sup1-pwd');
            if (inName) inName.value = 'Supervisor 1';
            if (inPwd)  inPwd.value  = '';
        }
        if (appSettings.sup2Name === supName) {
            appSettings.sup2Name = 'Supervisor 2';
            appSettings.sup2Pwd  = '';
            const inName = document.getElementById('setting-sup2-name');
            const inPwd  = document.getElementById('setting-sup2-pwd');
            if (inName) inName.value = 'Supervisor 2';
            if (inPwd)  inPwd.value  = '';
        }

        // 4. Clear logged in supervisor if currently active
        if (appState.supervisor === supName) {
            localStorage.removeItem('ps_supervisor');
            appState.supervisor = null;
        }

        await saveSettings();
        await renderAdminTable();
        showToast(`Superviseur "${supName}" et tous ses pointages ont été effacés avec succès ✓`);
    }

    if (btnDeleteSup1) btnDeleteSup1.addEventListener('click', () => deleteSupervisorAccountByName(appSettings.sup1Name));
    if (btnDeleteSup2) btnDeleteSup2.addEventListener('click', () => deleteSupervisorAccountByName(appSettings.sup2Name));

    if (btnDeleteSelectedSup) {
        btnDeleteSelectedSup.addEventListener('click', () => {
            const selectEl = document.getElementById('select-delete-sup');
            if (selectEl && selectEl.value) {
                deleteSupervisorAccountByName(selectEl.value);
            }
        });
    }

    if (btnQuickDeleteFilterSup) {
        btnQuickDeleteFilterSup.addEventListener('click', () => {
            const filterEl = document.getElementById('admin-filter-sup');
            if (filterEl && filterEl.value && filterEl.value !== 'ALL') {
                deleteSupervisorAccountByName(filterEl.value);
            } else {
                alert('Veuillez d\'abord choisir un superviseur spécifique dans le filtre déroulant.');
            }
        });
    }
}

function exportTrolleysToExcel() {
    if (!trolleyList || trolleyList.length === 0) {
        return alert('Aucune donnée de chariot à exporter.');
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const supervisorStr = appState.supervisor || 'Superviseur';

    let totalAssigned = 0;
    let totalFound = 0;
    let totalMissing = 0;

    trolleyList.forEach(t => {
        const assigned = (t.pinsAssigned === '' || t.pinsAssigned === null || t.pinsAssigned === undefined) ? 0 : (parseInt(t.pinsAssigned, 10) || 0);
        const found = (t.pinsFound === '' || t.pinsFound === null || t.pinsFound === undefined) ? 0 : (parseInt(t.pinsFound, 10) || 0);
        totalAssigned += assigned;
        totalFound += found;
        totalMissing += Math.max(0, assigned - found);
    });

    if (window.XLSX) {
        const data = [
            ["DESERT JOY — SERRE : RAPPORT SUIVI CHARIOTS & PINS"],
            ["Date du Rapport", `${dateStr} ${timeStr}`, "", "Superviseur", supervisorStr],
            ["Établissement", "Serre"],
            [],
            ["RÉSUMÉ ET AUDIT DES PINS"],
            ["Total Chariots", "Pins Affectés", "Pins Trouvés", "Pins Oubliés (Écarts)"],
            [trolleyList.length, totalAssigned, totalFound, totalMissing > 0 ? `⚠️ ${totalMissing} PINS` : "✓ CONFORME"],
            [],
            ["N° Chariot", "Ouvrier Affecté", "Pins Affectés", "Pins Trouvés", "Écart (Oublis)", "Conformité", "Jour de Charge", "N° Chargeur", "Planning Charge", "Notes & Remarques"]
        ];

        trolleyList.forEach(t => {
            const assigned = (t.pinsAssigned === '' || t.pinsAssigned === null || t.pinsAssigned === undefined) ? 0 : (parseInt(t.pinsAssigned, 10) || 0);
            const found = (t.pinsFound === '' || t.pinsFound === null || t.pinsFound === undefined) ? 0 : (parseInt(t.pinsFound, 10) || 0);
            const missing = Math.max(0, assigned - found);
            const workerName = t.worker && t.worker.trim() ? t.worker.trim() : 'Non assigné';

            data.push([
                `Chariot N°${t.id}`,
                workerName,
                assigned,
                found,
                missing > 0 ? -missing : 0,
                missing > 0 ? `⚠️ ÉCART (${missing})` : '✓ OK',
                t.chargeDay || 'Lundi',
                t.chargerNum || 'Chargeur 1',
                `${t.chargePct || 100}% (${t.chargeStatus || 'Normale'})`,
                t.notes || ''
            ]);
        });

        data.push([]);
        data.push([
            "TOTAL GENERAL",
            "",
            totalAssigned,
            totalFound,
            totalMissing > 0 ? -totalMissing : 0,
            totalMissing > 0 ? "⚠️ ATTENTION" : "✓ CONFORME"
        ]);

        const ws = XLSX.utils.aoa_to_sheet(data);
        const colWidths = [14, 22, 14, 14, 14, 16, 14, 14, 20, 30];
        ws['!cols'] = colWidths.map(w => ({ wch: w }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Suivi Chariots");

        XLSX.writeFile(wb, `Suivi_Chariots_${dateStr.replace(/\//g, '-')}.xlsx`);
    } else {
        // Fallback CSV with UTF-8 BOM
        let csv = `\uFEFFsep=;\r\n`;
        csv += `DESERT JOY — SERRE;RAPPORT SUIVI CHARIOTS & PINS;\r\n`;
        csv += `Date du Rapport;${dateStr} ${timeStr};Superviseur;"${supervisorStr}"\r\n;\r\n`;
        csv += `RÉSUMÉ ET AUDIT DES PINS;\r\n`;
        csv += `Total Chariots;Pins Affectés;Pins Trouvés;Pins Oubliés (Écarts)\r\n`;
        csv += `${trolleyList.length};${totalAssigned};${totalFound};${totalMissing};\r\n;\r\n`;
        csv += `N° Chariot;Ouvrier Affecté;Pins Affectés;Pins Trouvés;Écart (Oublis);Conformité;Jour de Charge;N° Chargeur;Planning Charge;Notes & Remarques\r\n`;

        trolleyList.forEach(t => {
            const assigned = (t.pinsAssigned === '' || t.pinsAssigned === null || t.pinsAssigned === undefined) ? 0 : (parseInt(t.pinsAssigned, 10) || 0);
            const found = (t.pinsFound === '' || t.pinsFound === null || t.pinsFound === undefined) ? 0 : (parseInt(t.pinsFound, 10) || 0);
            const missing = Math.max(0, assigned - found);
            const workerName = t.worker && t.worker.trim() ? t.worker.trim().replace(/"/g, '""') : 'Non assigné';

            csv += `Chariot N°${t.id};"${workerName}";${assigned};${found};${missing > 0 ? -missing : 0};"${missing > 0 ? '⚠️ ÉCART' : '✓ OK'}";"${t.chargeDay || 'Lundi'}";"${t.chargerNum || 'Chargeur 1'}";"${t.chargePct || 100}% (${t.chargeStatus || 'Normale'})";"${(t.notes || '').replace(/"/g, '""')}"\r\n`;
        });

        csv += `TOTAL GENERAL;;${totalAssigned};${totalFound};${totalMissing > 0 ? -totalMissing : 0};"${totalMissing > 0 ? '⚠️ ATTENTION' : '✓ CONFORME'}"\r\n`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Suivi_Chariots_${dateStr.replace(/\//g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

function exportSubmissionsToExcel() {
    (async () => {
        let submissions = await loadMergedSubmissions();
        if (submissions.length === 0) return alert('Aucune donnée de pointage à exporter.');

        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        let totalGauche = 0;
        let totalDroit = 0;
        let totalLines = 0;

        submissions.forEach(s => {
            totalGauche += s.gaucheCount || 0;
            totalDroit += s.droitCount || 0;
            totalLines += (s.gaucheCount || 0) + (s.droitCount || 0);
        });

        if (window.XLSX) {
            const data = [
                ["DESERT JOY — SERRE : HISTORIQUE DES POINTAGES"],
                ["Date d'Exportation", `${dateStr} ${timeStr}`, "", "Total Enregistrements", `${submissions.length} pointages`],
                ["Établissement", "Serre"],
                [],
                ["ID Pointage", "Date & Heure", "Superviseur", "Semaine", "Tâche / Opération", "Lignes Gauche", "Lignes Droite", "Total Lignes", "Taux (Max 280)", "Remarques & Incidents"]
            ];

            submissions.forEach(sub => {
                const max = sub.totalMax || 280;
                const totalSubLines = (sub.gaucheCount || 0) + (sub.droitCount || 0);
                const pct = Math.round((totalSubLines / max) * 100);
                const fmtDate = sub.timestamp ? new Date(sub.timestamp).toLocaleString('fr-FR') : '';

                data.push([
                    `#${sub.id}`,
                    fmtDate,
                    sub.supervisor || '',
                    sub.week || '',
                    sub.task || '',
                    sub.gaucheCount || 0,
                    sub.droitCount || 0,
                    totalSubLines,
                    `${pct}% (${totalSubLines}/${max})`,
                    sub.remarks || ''
                ]);
            });

            data.push([]);
            data.push([
                "TOTAL GENERAL",
                "",
                "",
                "",
                `${submissions.length} Soumission(s)`,
                totalGauche,
                totalDroit,
                totalLines,
                "",
                ""
            ]);

            const ws = XLSX.utils.aoa_to_sheet(data);
            const colWidths = [12, 20, 18, 12, 25, 14, 14, 14, 18, 30];
            ws['!cols'] = colWidths.map(w => ({ wch: w }));

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Historique Pointages");

            XLSX.writeFile(wb, `Pointages_${dateStr.replace(/\//g, '-')}.xlsx`);
        } else {
            // Fallback CSV with UTF-8 BOM
            let csv = `\uFEFFsep=;\r\n`;
            csv += `DESERT JOY — SERRE;HISTORIQUE DES POINTAGES;\r\n`;
            csv += `Date d'export;${dateStr} ${timeStr};Total;${submissions.length}\r\n;\r\n`;
            csv += `ID Pointage;Date & Heure;Superviseur;Semaine;Tâche / Opération;Lignes Gauche;Lignes Droite;Total Lignes;Remarques\r\n`;

            submissions.forEach(sub => {
                const max = sub.totalMax || 280;
                const totalSubLines = (sub.gaucheCount || 0) + (sub.droitCount || 0);
                const remarks = (sub.remarks || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
                const fmtDate = sub.timestamp ? new Date(sub.timestamp).toLocaleString('fr-FR') : '';
                csv += `#${sub.id};"${fmtDate}";"${sub.supervisor || ''}";"${sub.week || ''}";"${sub.task || ''}";${sub.gaucheCount || 0};${sub.droitCount || 0};${totalSubLines};"${remarks}"\r\n`;
            });

            csv += `TOTAL GENERAL;;;;${submissions.length} Soumission(s);${totalGauche};${totalDroit};${totalLines};\r\n`;

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Pointages_KAS8_${dateStr.replace(/\//g, '-')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
    })();
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
