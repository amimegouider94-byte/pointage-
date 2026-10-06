/**
 * Supabase Configuration & Data Layer
 * Handles all database operations for Pointage Serre with lazy client initialization
 */

const SUPABASE_URL = 'https://zyahmqbdqjdklthdwiiw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YWhtcWJkcWpka2x0aGR3aWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjY1NTMsImV4cCI6MjEwNjgwMjU1M30.Xi9V9mrzavbiCmqIm9CS2KQSJrBOopNUsar_BX3Eiag';

let _supabaseInstance = null;

function getSupabase() {
    if (_supabaseInstance) return _supabaseInstance;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        try {
            _supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[Supabase] Client initialisé avec succès');
            return _supabaseInstance;
        } catch (e) {
            console.error('[Supabase] Erreur d\'initialisation du client:', e);
        }
    }
    return null;
}

// ─── Connection Status ────────────────────────────────────────
async function checkConnection() {
    const client = getSupabase();
    if (!client) return false;
    try {
        const { error } = await client.from('settings').select('id').limit(1);
        return !error;
    } catch (e) {
        return false;
    }
}

// ─── SETTINGS ─────────────────────────────────────────────────

async function dbLoadSettings() {
    const client = getSupabase();
    if (!client) {
        console.warn('[Supabase] Client non disponible pour dbLoadSettings');
        return null;
    }
    try {
        const { data, error } = await client
            .from('settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
            gaucheStart: data.gauche_start,
            gaucheEnd: data.gauche_end,
            droitStart: data.droit_start,
            droitEnd: data.droit_end,
            sup1Name: data.sup1_name,
            sup2Name: data.sup2_name,
            sup1Pwd: data.sup1_pwd,
            sup2Pwd: data.sup2_pwd,
            adminPwd: data.admin_pwd
        };
    } catch (e) {
        console.warn('[Supabase] dbLoadSettings erreur:', e.message || e);
        return null;
    }
}

async function dbSaveSettings(settings) {
    const client = getSupabase();
    if (!client) {
        console.warn('[Supabase] Client non disponible pour dbSaveSettings');
        return false;
    }
    try {
        const { error } = await client
            .from('settings')
            .upsert({
                id: 1,
                gauche_start: settings.gaucheStart,
                gauche_end: settings.gaucheEnd,
                droit_start: settings.droitStart,
                droit_end: settings.droitEnd,
                sup1_name: settings.sup1Name,
                sup2_name: settings.sup2Name,
                sup1_pwd: settings.sup1Pwd || '',
                sup2_pwd: settings.sup2Pwd || '',
                admin_pwd: settings.adminPwd || '1234',
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        console.log('[Supabase] Paramètres sauvegardés en BDD');
        return true;
    } catch (e) {
        console.warn('[Supabase] dbSaveSettings erreur:', e.message || e);
        return false;
    }
}

// ─── WIP (Work In Progress) ───────────────────────────────────

async function dbLoadWip(key) {
    const client = getSupabase();
    if (!client) return null;
    try {
        const { data, error } = await client
            .from('wip')
            .select('*')
            .eq('id', key)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
            gaucheState: data.gauche_state || {},
            droitState: data.droit_state || {},
            remarks: data.remarks || ''
        };
    } catch (e) {
        console.warn('[Supabase] dbLoadWip erreur:', e.message || e);
        return null;
    }
}

async function dbSaveWip(key, wipData) {
    const client = getSupabase();
    if (!client) return false;
    try {
        const { error } = await client
            .from('wip')
            .upsert({
                id: key,
                gauche_state: wipData.gaucheState,
                droit_state: wipData.droitState,
                remarks: wipData.remarks,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return true;
    } catch (e) {
        console.warn('[Supabase] dbSaveWip erreur:', e.message || e);
        return false;
    }
}

async function dbClearWip(key) {
    const client = getSupabase();
    if (!client) return false;
    try {
        const { error } = await client
            .from('wip')
            .delete()
            .eq('id', key);

        if (error) throw error;
        return true;
    } catch (e) {
        console.warn('[Supabase] dbClearWip erreur:', e.message || e);
        return false;
    }
}

// ─── SUBMISSIONS ──────────────────────────────────────────────

async function dbLoadSubmissions() {
    const client = getSupabase();
    if (!client) {
        console.warn('[Supabase] Client non disponible pour dbLoadSubmissions');
        return null;
    }
    try {
        const { data, error } = await client
            .from('submissions')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;
        console.log(`[Supabase] ${data ? data.length : 0} soumission(s) chargée(s) depuis la BDD`);
        return (data || []).map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            supervisor: row.supervisor,
            week: row.week,
            task: row.task,
            gaucheCount: row.gauche_count,
            droitCount: row.droit_count,
            totalMax: row.total_max,
            remarks: row.remarks,
            gaucheState: row.gauche_state || {},
            droitState: row.droit_state || {},
            gaucheRange: row.gauche_range || { start: 1, end: 140 },
            droitRange: row.droit_range || { start: 1, end: 140 }
        }));
    } catch (e) {
        console.warn('[Supabase] dbLoadSubmissions erreur:', e.message || e);
        return null;
    }
}

function isStateActive(val) {
    return val === true || val === 'true' || val === 1 || val === '1';
}

async function dbUpsertSubmission(submission) {
    const client = getSupabase();
    if (!client) {
        console.warn('[Supabase] Client non disponible pour dbUpsertSubmission');
        return false;
    }
    try {
        // Check if existing record exists for same supervisor + week + task
        const { data: existing, error: findError } = await client
            .from('submissions')
            .select('id, gauche_state, droit_state, remarks')
            .eq('supervisor', submission.supervisor)
            .eq('week', submission.week)
            .eq('task', submission.task)
            .maybeSingle();

        if (findError) throw findError;

        const calcGCount = Object.values(submission.gaucheState || {}).filter(v => isStateActive(v)).length;
        const calcDCount = Object.values(submission.droitState || {}).filter(v => isStateActive(v)).length;

        if (existing) {
            // MERGE (cumulative OR)
            const mergedG = { ...(existing.gauche_state || {}) };
            Object.entries(submission.gaucheState).forEach(([k, v]) => {
                if (v !== false) mergedG[k] = v;
            });

            const mergedD = { ...(existing.droit_state || {}) };
            Object.entries(submission.droitState).forEach(([k, v]) => {
                if (v !== false) mergedD[k] = v;
            });

            const mergedGCount = Object.values(mergedG).filter(v => isStateActive(v)).length;
            const mergedDCount = Object.values(mergedD).filter(v => isStateActive(v)).length;

            const { error: updateError } = await client
                .from('submissions')
                .update({
                    timestamp: new Date().toISOString(),
                    gauche_count: mergedGCount,
                    droit_count: mergedDCount,
                    total_max: submission.totalMax,
                    remarks: submission.remarks || existing.remarks,
                    gauche_state: mergedG,
                    droit_state: mergedD,
                    gauche_range: submission.gaucheRange,
                    droit_range: submission.droitRange
                })
                .eq('id', existing.id);

            if (updateError) throw updateError;
        } else {
            // CREATE NEW
            const { error: insertError } = await client
                .from('submissions')
                .insert({
                    timestamp: new Date().toISOString(),
                    supervisor: submission.supervisor,
                    week: submission.week,
                    task: submission.task,
                    gauche_count: calcGCount,
                    droit_count: calcDCount,
                    total_max: submission.totalMax,
                    remarks: submission.remarks,
                    gauche_state: submission.gaucheState,
                    droit_state: submission.droitState,
                    gauche_range: submission.gaucheRange,
                    droit_range: submission.droitRange
                });

            if (insertError) throw insertError;
        }

        console.log('[Supabase] Pointage enregistré avec succès dans la BDD');
        return true;
    } catch (e) {
        console.warn('[Supabase] dbUpsertSubmission erreur:', e.message || e);
        return false;
    }
}

async function dbDeleteSubmission(id) {
    const client = getSupabase();
    if (!client) return false;
    try {
        const { error } = await client
            .from('submissions')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (e) {
        console.warn('[Supabase] dbDeleteSubmission erreur:', e.message || e);
        return false;
    }
}

async function dbDeleteSubmissionsForSupervisor(supervisorName) {
    const client = getSupabase();
    if (!client) return false;
    try {
        const { error } = await client
            .from('submissions')
            .delete()
            .eq('supervisor', supervisorName);

        if (error) throw error;
        return true;
    } catch (e) {
        console.warn('[Supabase] dbDeleteSubmissionsForSupervisor erreur:', e.message || e);
        return false;
    }
}

// ─── TROLLEYS / CHARIOTS (KAS 8) ──────────────────────────────

async function dbLoadTrolleys() {
    const client = getSupabase();
    if (!client) return null;
    try {
        const { data, error } = await client
            .from('trolleys')
            .select('*')
            .order('id', { ascending: true });

        if (!error && data && data.length > 0) {
            return data.map(t => ({
                id: t.id,
                worker: t.worker || '',
                pinsAssigned: t.pins_assigned !== undefined ? t.pins_assigned : 10,
                pinsFound: t.pins_found !== undefined ? t.pins_found : 10,
                chargeStatus: t.charge_status || 'Normale',
                chargePct: t.charge_pct !== undefined ? t.charge_pct : 100,
                chargeDay: t.charge_day || 'Non défini',
                chargerNum: t.charger_num || `Chargeur ${((t.id - 1) % 10) + 1}`,
                notes: t.notes || ''
            }));
        }

        // Fallback WIP store
        const remoteWip = await dbLoadWip('kas8_trolleys');
        if (remoteWip && remoteWip.gaucheState && Array.isArray(remoteWip.gaucheState.trolleyData)) {
            return remoteWip.gaucheState.trolleyData;
        }
        return null;
    } catch(e) {
        console.warn('[Supabase] dbLoadTrolleys fallback WIP mode');
        const remoteWip = await dbLoadWip('kas8_trolleys');
        if (remoteWip && remoteWip.gaucheState && Array.isArray(remoteWip.gaucheState.trolleyData)) {
            return remoteWip.gaucheState.trolleyData;
        }
        return null;
    }
}

async function dbSaveTrolleys(trolleyList) {
    const client = getSupabase();
    if (!client) {
        return false;
    }

    // Always save JSON copy in Supabase WIP store for instant multi-device persistence
    await dbSaveWip('kas8_trolleys', { gaucheState: { trolleyData: trolleyList } });

    try {
        const payload = trolleyList.map(t => ({
            id: t.id,
            worker: t.worker || '',
            pins_assigned: (t.pinsAssigned === '' || t.pinsAssigned === null || t.pinsAssigned === undefined) ? 0 : (parseInt(t.pinsAssigned, 10) || 0),
            pins_found: (t.pinsFound === '' || t.pinsFound === null || t.pinsFound === undefined) ? 0 : (parseInt(t.pinsFound, 10) || 0),
            charge_status: t.chargeStatus || 'Normale',
            charge_pct: t.chargePct !== undefined ? t.chargePct : 100,
            charge_day: t.chargeDay || 'Non défini',
            charger_num: t.chargerNum || `Chargeur ${((t.id - 1) % 10) + 1}`,
            notes: t.notes || '',
            updated_at: new Date().toISOString()
        }));

        await client
            .from('trolleys')
            .upsert(payload);

        return true;
    } catch(e) {
        console.warn('[Supabase] dbSaveTrolleys table sync fallback:', e.message || e);
        return true;
    }
}

async function dbLoadAllWips() {
    const client = getSupabase();
    if (!client) return [];
    try {
        const { data, error } = await client
            .from('wip')
            .select('*');
        if (error || !data) return [];
        return data;
    } catch(e) {
        return [];
    }
}


