(() => {
  'use strict';

  const config = window.SAFEPLATE_CONFIG || {};
  const hasKey = Boolean(config.supabaseUrl && config.supabasePublishableKey && !config.supabasePublishableKey.includes('YOUR_'));
  const hasSdk = Boolean(window.supabase && typeof window.supabase.createClient === 'function');
  const sb = hasKey && hasSdk
    ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
    : null;

  const DEFAULT_ALLERGENS = [
    { name: 'Peanuts', note: 'Avoid all traces', severity: 'High', tone: 'red' },
    { name: 'Dairy', note: 'Includes derivatives', severity: 'High', tone: 'violet' }
  ];

  const SYNC_STORAGE_KEY = 'safeplate_allergy_sync';
  const CACHE_KEY_PREFIX = 'safeplate_prefs_';

  const normalizeAllergens = (list, fallbackToDefault = true) => {
    if (!Array.isArray(list)) {
      return fallbackToDefault ? DEFAULT_ALLERGENS.map((item) => ({ ...item })) : [];
    }
    return list
      .filter((item) => item && typeof item.name === 'string' && item.name.trim())
      .map((item, idx) => ({
        name: item.name.trim(),
        note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : 'Avoid all traces',
        severity: item.severity === 'Moderate' ? 'Moderate' : 'High',
        tone: item.tone === 'violet' ? 'violet' : item.tone === 'red' ? 'red' : (idx % 2 === 0 ? 'red' : 'violet')
      }));
  };

  const readCachedPrefs = (userId) => {
    if (!userId) return null;
    try {
      const raw = window.localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
        strictMode: typeof parsed.strictMode === 'boolean' ? parsed.strictMode : true,
        traceAlerts: typeof parsed.traceAlerts === 'boolean' ? parsed.traceAlerts : true,
        allergens: normalizeAllergens(parsed.allergens, true),
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
      };
    } catch (_) {
      return null;
    }
  };

  const writeCachedPrefs = (userId, prefs) => {
    if (!userId || !prefs) return;
    try {
      window.localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify({
        fullName: prefs.fullName || '',
        strictMode: Boolean(prefs.strictMode),
        traceAlerts: Boolean(prefs.traceAlerts),
        allergens: normalizeAllergens(prefs.allergens, false),
        updatedAt: prefs.updatedAt || new Date().toISOString()
      }));
      window.localStorage.setItem('safeplate_active_user_id', userId);
    } catch (_) {}
  };

  const getCachedActiveUserId = () => {
    try {
      return window.localStorage.getItem('safeplate_active_user_id') || null;
    } catch (_) {
      return null;
    }
  };

  const clearCachedPrefs = (userId) => {
    if (!userId) return;
    try {
      window.localStorage.removeItem(`${CACHE_KEY_PREFIX}${userId}`);
      window.localStorage.removeItem('safeplate_active_user_id');
    } catch (_) {}
  };

  const notifyAllergySync = () => {
    try {
      window.localStorage.setItem(SYNC_STORAGE_KEY, String(Date.now()));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('safeplate:allergy-sync', { detail: { timestamp: Date.now() } }));
    } catch (_) {}
  };

  const getUserPreferences = (user, profileRow = null) => {
    if (!user?.id) {
      return {
        fullName: '',
        strictMode: true,
        traceAlerts: true,
        allergens: normalizeAllergens(null, true),
        updatedAt: ''
      };
    }

    const meta = user?.user_metadata || {};
    const cached = readCachedPrefs(user.id);
    const hasRow = Boolean(profileRow && typeof profileRow === 'object');
    const rowTime = hasRow && profileRow.updated_at ? Date.parse(profileRow.updated_at) || 0 : 0;
    const metaTime = meta.allergy_updated_at ? Date.parse(meta.allergy_updated_at) || 0 : 0;
    const cachedTime = cached?.updatedAt ? Date.parse(cached.updatedAt) || 0 : 0;

    let preferSource = 'meta';
    if (hasRow && (rowTime >= metaTime || !Array.isArray(meta.allergens))) {
      preferSource = 'row';
    } else if (cached && (cachedTime >= metaTime || !Array.isArray(meta.allergens))) {
      preferSource = 'cached';
    }

    const source = preferSource === 'row' ? profileRow : preferSource === 'cached' ? cached : meta;

    const rawAllergens = preferSource === 'cached'
      ? cached.allergens
      : Array.isArray(source.allergens)
        ? source.allergens
        : Array.isArray(meta.allergens)
          ? meta.allergens
          : cached?.allergens;

    const fullName = (
      (typeof source.full_name === 'string' && source.full_name.trim()) ||
      (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
      cached?.fullName ||
      ''
    );

    const strictMode = preferSource === 'cached'
      ? cached.strictMode
      : typeof source.strict_mode === 'boolean'
        ? source.strict_mode
        : typeof meta.strict_mode === 'boolean'
          ? meta.strict_mode
          : cached?.strictMode ?? true;

    const traceAlerts = preferSource === 'cached'
      ? cached.traceAlerts
      : typeof source.trace_alerts === 'boolean'
        ? source.trace_alerts
        : typeof meta.trace_alerts === 'boolean'
          ? meta.trace_alerts
          : cached?.traceAlerts ?? true;

    return {
      fullName,
      strictMode,
      traceAlerts,
      allergens: normalizeAllergens(rawAllergens, true),
      updatedAt: (preferSource === 'row' ? profileRow.updated_at : preferSource === 'cached' ? cached.updatedAt : meta.allergy_updated_at) || ''
    };
  };

  const formatProtectionSummary = (prefs) => {
    const count = prefs?.allergens?.length || 0;
    const modeLabel = prefs?.strictMode ? 'strict mode' : 'standard mode';
    const parts = [`${count} ${count === 1 ? 'allergen' : 'allergens'}`, modeLabel];
    if (prefs?.traceAlerts) parts.push('trace alerts');
    return parts.join(' · ');
  };

  const isMissingProfilesTableError = (err) => {
    if (!err) return false;
    const code = String(err.code || '');
    const msg = String(err.message || '');
    return code === 'PGRST205' || code === '42P01' || /schema cache|relation .*profiles.* does not exist/i.test(msg);
  };

  const syncProfileTable = async (user, prefs) => {
    if (!sb || !user?.id) return { skipped: true };
    const updatedAt = prefs.updatedAt || new Date().toISOString();
    const { data, error } = await sb
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: prefs.fullName || '',
        strict_mode: Boolean(prefs.strictMode),
        trace_alerts: Boolean(prefs.traceAlerts),
        allergens: normalizeAllergens(prefs.allergens, false),
        updated_at: updatedAt
      }, { onConflict: 'id' })
      .select('full_name, strict_mode, trace_alerts, allergens, updated_at')
      .maybeSingle();

    if (error) {
      if (isMissingProfilesTableError(error)) {
        return { skipped: true };
      }
      return { error };
    }
    return { data };
  };

  const loadUserAllergyProfile = async (user) => {
    if (!user?.id) {
      return { prefs: getUserPreferences(null), profileRow: null };
    }

    let profileRow = null;
    if (sb) {
      try {
        const { data, error } = await sb
          .from('profiles')
          .select('full_name, strict_mode, trace_alerts, allergens, updated_at')
          .eq('id', user.id)
          .maybeSingle();

        if (!error && data) {
          profileRow = data;
        } else if (!error && !data) {
          // Table exists but row hasn't been created yet — backfill from auth user_metadata.
          const initialPrefs = getUserPreferences(user);
          const syncRes = await syncProfileTable(user, initialPrefs);
          if (syncRes.data) profileRow = syncRes.data;
        }
      } catch (_) {}
    }

    const prefs = getUserPreferences(user, profileRow);
    writeCachedPrefs(user.id, prefs);
    return { prefs, profileRow };
  };

  const saveUserAllergyProfile = async (user, nextPrefs) => {
    if (!sb || !user?.id) {
      throw new Error('Sign in required to save your profile.');
    }

    const updatedAt = new Date().toISOString();
    const existingPrefs = getUserPreferences(user);
    const cleaned = {
      fullName: typeof nextPrefs.fullName === 'string' ? nextPrefs.fullName.trim() : existingPrefs.fullName,
      strictMode: typeof nextPrefs.strictMode === 'boolean' ? nextPrefs.strictMode : existingPrefs.strictMode,
      traceAlerts: typeof nextPrefs.traceAlerts === 'boolean' ? nextPrefs.traceAlerts : existingPrefs.traceAlerts,
      allergens: normalizeAllergens(
        Array.isArray(nextPrefs.allergens) ? nextPrefs.allergens : existingPrefs.allergens,
        false
      ),
      updatedAt
    };

    const { data, error } = await sb.auth.updateUser({
      data: {
        ...(user.user_metadata || {}),
        full_name: cleaned.fullName,
        strict_mode: cleaned.strictMode,
        trace_alerts: cleaned.traceAlerts,
        allergens: cleaned.allergens,
        allergy_updated_at: updatedAt
      }
    });

    if (error) throw error;

    const updatedUser = data?.user || user;
    const tableResult = await syncProfileTable(updatedUser, cleaned);
    if (tableResult.error) {
      throw tableResult.error;
    }

    const finalPrefs = getUserPreferences(updatedUser, tableResult.data || null);
    writeCachedPrefs(updatedUser.id, finalPrefs);
    notifyAllergySync();

    return { user: updatedUser, prefs: finalPrefs };
  };

  const subscribeAllergySync = (onSync) => {
    if (typeof onSync !== 'function') return;
    window.addEventListener('storage', (e) => {
      if (e.key === SYNC_STORAGE_KEY || (e.key && e.key.startsWith(CACHE_KEY_PREFIX))) {
        onSync();
      }
    });
    window.addEventListener('pageshow', () => onSync());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onSync();
    });
  };

  // --- Shared Accessible :user-invalid ARIA sync & fallback ---
  const linkError = (el, shown) => {
    const errorId = el.dataset.error;
    if (!errorId) return;
    const ids = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  };

  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'polite');
  announcer.classList.add('visually-hidden');
  document.body.append(announcer);
  let announceTimer;
  let announcedField;

  const spokenText = (node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => {
      n.replaceWith(`${n.getAttribute('aria-label')}: `);
    });
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };

  const announceError = (el) => {
    const error = document.getElementById(el.dataset.error);
    if (!error) return;
    const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
    clearTimeout(announceTimer);
    announcer.textContent = '';
    announcedField = el;
    announceTimer = setTimeout(() => {
      announcer.textContent = label + spokenText(error);
    }, 500);
  };

  const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
  const dirtyState = new WeakMap();
  const flagged = new WeakSet();
  const announced = new WeakSet();

  const syncAria = (el, announce = false) => {
    if (!el?.matches?.('input, select, textarea')) return;
    const invalid = supportsUserInvalid
      ? el.matches(':user-invalid')
      : el.classList.contains('user-invalid-fallback');
    if (invalid) {
      if (announce && !announced.has(el)) {
        announceError(el);
        announced.add(el);
      }
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = '';
      }
    }
  };

  const updateFallbackState = (input, announce = false) => {
    const isValid = input.validity.valid;
    input.classList.toggle('user-invalid-fallback', !isValid);
    input.classList.toggle('user-valid-fallback', isValid);
    syncAria(input, announce);
  };

  const initValidation = (root) => {
    if (!root) return;
    root.querySelectorAll('input, select, textarea').forEach((el) => syncAria(el));

    root.addEventListener('blur', (e) => {
      const el = e.target;
      if (!el.matches?.('input, select, textarea')) return;
      if (!supportsUserInvalid) {
        const state = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
        state.hasBlurred = true;
        dirtyState.set(el, state);
        if (state.hasInteracted) updateFallbackState(el, true);
      } else {
        syncAria(el, true);
      }
    }, true);

    root.addEventListener('input', (e) => {
      const el = e.target;
      if (!el.matches?.('input, select, textarea')) return;
      if (!supportsUserInvalid) {
        const state = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
        state.hasInteracted = true;
        dirtyState.set(el, state);
        if (state.hasBlurred) updateFallbackState(el, false);
      } else if (el.hasAttribute('aria-invalid')) {
        syncAria(el, false);
      }
    });

    root.addEventListener('invalid', (e) => {
      const el = e.target;
      announced.add(el);
      if (!supportsUserInvalid) {
        dirtyState.set(el, { hasInteracted: true, hasBlurred: true });
        updateFallbackState(el, false);
      } else {
        syncAria(el, false);
      }
    }, true);

    root.addEventListener('reset', (e) => {
      setTimeout(() => {
        [...(e.target.elements || [])].forEach((el) => {
          dirtyState.delete(el);
          el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
          syncAria(el);
        });
      });
    }, true);
  };

  const initPasswordToggles = (root) => {
    if (!root) return;
    root.querySelectorAll('[data-toggle-pw]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.togglePw);
        if (!input) return;
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(reveal));
        btn.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
        btn.textContent = reveal ? 'Hide' : 'Show';
      });
    });
  };

  const getRedirectUrl = () => {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      return window.location.origin + window.location.pathname;
    }
    return undefined;
  };

  const setBusy = (button, busy, busyLabel, idleHtml) => {
    if (!button) return;
    button.disabled = busy;
    if (busy) {
      button.dataset.idleHtml = idleHtml || button.innerHTML;
      button.textContent = busyLabel;
    } else if (button.dataset.idleHtml) {
      button.innerHTML = button.dataset.idleHtml;
    }
  };

  const getConfigErrorMessage = () => {
    if (!hasSdk) {
      return 'Supabase client library failed to load. Check your internet connection and reload.';
    }
    if (!sb) {
      return 'Missing Supabase Publishable key. Add supabasePublishableKey in supabase-config.js (from Supabase Dashboard -> Project Settings -> API Keys).';
    }
    return '';
  };

  const createShieldSvg = () => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z');
    svg.append(path);
    return svg;
  };

  // --- Core State & Listeners ---
  let currentUser = null;
  let currentOverviewPrefs = getUserPreferences(null);
  let activeProfileLoadSeq = 0;
  const prefListeners = new Set();

  const onPreferencesChanged = (callback) => {
    if (typeof callback !== 'function') return () => {};
    prefListeners.add(callback);
    try {
      callback(currentOverviewPrefs, currentUser);
    } catch (_) {}
    return () => prefListeners.delete(callback);
  };

  const emitPreferencesChanged = (prefs, user) => {
    prefListeners.forEach((fn) => {
      try {
        fn(prefs, user);
      } catch (_) {}
    });
    try {
      window.dispatchEvent(new CustomEvent('safeplate:preferences-updated', {
        detail: { prefs, user }
      }));
    } catch (_) {}
  };

  const getActivePreferences = async () => {
    if (currentUser) {
      if (currentOverviewPrefs && currentOverviewPrefs.updatedAt) {
        return currentOverviewPrefs;
      }
      const { prefs } = await loadUserAllergyProfile(currentUser);
      renderUserState(currentUser, prefs);
      return prefs;
    }

    if (sb) {
      try {
        const { data } = await sb.auth.getSession();
        const sessionUser = data?.session?.user || null;
        if (sessionUser) {
          const { prefs } = await loadUserAllergyProfile(sessionUser);
          renderUserState(sessionUser, prefs);
          return prefs;
        }
      } catch (_) {}
    }

    return currentOverviewPrefs || getUserPreferences(null);
  };

  // --- Shared header & overview sync ---
  const signedOutActions = document.getElementById('signedOutActions');
  const signedInActions = document.getElementById('signedInActions');
  const accountBtn = document.getElementById('accountBtn');
  const accountLabel = document.getElementById('accountLabel');
  const authStatusText = document.getElementById('authStatusText');
  const authStatusDot = document.getElementById('authStatusDot');
  const protectSummary = document.getElementById('protectSummary');
  const allergyList = document.getElementById('allergyList');

  const renderOverviewAllergens = (user, prefsOverride = null) => {
    if (!protectSummary && !allergyList) return;
    const prefs = prefsOverride || getUserPreferences(user);
    currentOverviewPrefs = prefs;
    const count = prefs.allergens.length;

    if (protectSummary) {
      protectSummary.textContent = formatProtectionSummary(prefs);
    }

    if (allergyList) {
      allergyList.replaceChildren();
      if (count === 0) {
        const emptyLi = document.createElement('li');
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = 'No allergens listed';
        const sub = document.createElement('span');
        sub.textContent = 'Add allergens in Profile settings';
        info.append(title, sub);
        emptyLi.append(info);
        allergyList.append(emptyLi);
        return;
      }

      prefs.allergens.forEach((item, index) => {
        const li = document.createElement('li');
        const icon = document.createElement('span');
        const tone = item.tone || (index % 2 === 0 ? 'red' : 'violet');
        icon.className = `a-icon ${tone === 'violet' ? 'violet' : 'red'}`;
        icon.append(createShieldSvg());

        const info = document.createElement('div');
        const nameEl = document.createElement('strong');
        nameEl.textContent = item.name;
        const noteEl = document.createElement('span');
        noteEl.textContent = item.note || 'Avoid all traces';
        info.append(nameEl, noteEl);

        const badge = document.createElement('em');
        badge.className = `badge${item.severity === 'Moderate' ? ' moderate' : ''}`;
        badge.textContent = item.severity === 'Moderate' ? 'Moderate' : 'High';

        li.append(icon, info, badge);
        allergyList.append(li);
      });
    }
  };

  let updateModalAccountView = () => {};

  const renderUserState = (user, prefsOverride = null) => {
    currentUser = user || null;
    if (currentUser) {
      const prefs = prefsOverride || getUserPreferences(currentUser);
      const displayName = prefs.fullName || currentUser.user_metadata?.full_name?.trim() || currentUser.email || 'Account';
      if (signedOutActions) signedOutActions.hidden = true;
      if (signedInActions) signedInActions.hidden = false;
      if (accountLabel) accountLabel.textContent = displayName;
      if (accountBtn) accountBtn.setAttribute('aria-label', `Signed in as ${displayName}. Open account options`);
      if (authStatusText) authStatusText.textContent = `Signed in as ${displayName} · Profile active and protected`;
      if (authStatusDot) authStatusDot.classList.remove('idle');
      renderOverviewAllergens(currentUser, prefs);
      updateModalAccountView(currentUser, prefs);
    } else {
      if (signedOutActions) signedOutActions.hidden = false;
      if (signedInActions) signedInActions.hidden = true;
      if (accountLabel) accountLabel.textContent = '';
      if (authStatusText) authStatusText.textContent = 'Sign in or create a profile to save your protection';
      if (authStatusDot) authStatusDot.classList.add('idle');
      renderOverviewAllergens(null, getUserPreferences(null));
      updateModalAccountView(null, null);
    }

    emitPreferencesChanged(currentOverviewPrefs, currentUser);
  };

  const syncUserFromDatabase = async (hintUser = null) => {
    const seq = ++activeProfileLoadSeq;
    let user = hintUser;
    if (sb) {
      try {
        const { data: sessionData } = await sb.auth.getSession();
        const sessionUser = sessionData?.session?.user || null;
        if (!sessionUser) {
          user = null;
        } else {
          user = sessionUser;
          const { data, error } = await sb.auth.getUser();
          if (data?.user) {
            user = data.user;
          } else if (error && (error.status === 401 || error.status === 403 || error.name === 'AuthSessionMissingError')) {
            user = null;
          }
        }
      } catch (_) {}
    }
    if (seq !== activeProfileLoadSeq) return;
    if (!user) {
      renderUserState(null);
      return;
    }
    const { prefs } = await loadUserAllergyProfile(user);
    if (seq !== activeProfileLoadSeq) return;
    renderUserState(user, prefs);
  };

  window.SafePlateAuth = {
    client: sb,
    hasKey,
    hasSdk,
    DEFAULT_ALLERGENS,
    normalizeAllergens,
    readCachedPrefs,
    writeCachedPrefs,
    clearCachedPrefs,
    getUserPreferences,
    getCurrentUser: () => currentUser,
    getCurrentPreferences: () => currentOverviewPrefs,
    getActivePreferences,
    onPreferencesChanged,
    formatProtectionSummary,
    loadUserAllergyProfile,
    saveUserAllergyProfile,
    syncProfileTable,
    syncUserFromDatabase,
    notifyAllergySync,
    subscribeAllergySync,
    initValidation,
    initPasswordToggles,
    getRedirectUrl,
    setBusy,
    getConfigErrorMessage,
    createShieldSvg
  };

  // --- Auth dialog logic (optional: on pages with #signupModal) ---
  const authDialog = document.getElementById('signupModal');
  let activeView = 'signup';
  let openAuthModal = () => {};

  if (authDialog) {
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const authFeedback = document.getElementById('authFeedback');
    const accountName = document.getElementById('accountName');
    const accountEmail = document.getElementById('accountEmail');
    const accountProtectSummary = document.getElementById('accountProtectSummary');
    const signOutBtn = document.getElementById('signOutBtn');

    const forms = {
      signup: document.getElementById('signupForm'),
      signin: document.getElementById('signinForm'),
      forgot: document.getElementById('forgotForm'),
      recovery: document.getElementById('recoveryForm'),
      account: document.getElementById('accountView')
    };

    const viewCopy = {
      signup: {
        subtitle: 'Create your private profile',
        title: 'Food confidence starts here.'
      },
      signin: {
        subtitle: 'Welcome back',
        title: 'Sign in to SafePlate.'
      },
      forgot: {
        subtitle: 'Account recovery',
        title: 'Reset your password.'
      },
      recovery: {
        subtitle: 'Password recovery',
        title: 'Choose a new password.'
      },
      account: {
        subtitle: 'Signed in',
        title: 'Your SafePlate account.'
      }
    };

    initValidation(authDialog);
    initPasswordToggles(authDialog);

    const setFeedback = (message = '', type = 'info') => {
      if (!authFeedback) return;
      if (!message) {
        authFeedback.textContent = '';
        authFeedback.hidden = true;
        authFeedback.className = 'auth-feedback';
        return;
      }
      authFeedback.textContent = message;
      authFeedback.className = `auth-feedback ${type}`;
      authFeedback.setAttribute('role', type === 'error' ? 'alert' : 'status');
      authFeedback.hidden = false;
    };

    const setView = (view, { preserveFeedback = false } = {}) => {
      activeView = view;
      if (!preserveFeedback) setFeedback('');

      const copy = viewCopy[view] || viewCopy.signup;
      if (authSubtitle) authSubtitle.textContent = copy.subtitle;
      if (authTitle) authTitle.textContent = copy.title;

      Object.entries(forms).forEach(([key, el]) => {
        if (!el) return;
        el.hidden = key !== view;
      });

      if (view === 'account' && currentUser) {
        const fullName = currentOverviewPrefs.fullName || currentUser.user_metadata?.full_name?.trim();
        if (accountName) accountName.textContent = fullName || 'SafePlate member';
        if (accountEmail) accountEmail.textContent = currentUser.email || '';
        if (accountProtectSummary) {
          accountProtectSummary.textContent = formatProtectionSummary(currentOverviewPrefs);
        }
      }
    };

    updateModalAccountView = (user, prefs) => {
      if (activeView === 'account') {
        if (user && prefs) {
          if (accountName) accountName.textContent = prefs.fullName || 'SafePlate member';
          if (accountEmail) accountEmail.textContent = user.email || '';
          if (accountProtectSummary) {
            accountProtectSummary.textContent = formatProtectionSummary(prefs);
          }
        } else {
          if (accountProtectSummary) accountProtectSummary.textContent = '';
        }
      }
    };

    openAuthModal = (preferredView) => {
      const targetView = preferredView || (currentUser ? 'account' : 'signup');
      setView(targetView);
      if (!authDialog.open) {
        authDialog.showModal();
      }
      const visibleForm = forms[targetView];
      const firstInput = visibleForm?.querySelector('input:not([hidden])');
      if (firstInput) firstInput.focus();
    };

    document.querySelectorAll('[data-open-auth]').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal(trigger.dataset.openAuth);
      });
    });

    authDialog.querySelectorAll('[data-switch-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setView(btn.dataset.switchView);
        const firstInput = forms[btn.dataset.switchView]?.querySelector('input');
        if (firstInput) firstInput.focus();
      });
    });

    authDialog.querySelectorAll('[data-close-dialog]').forEach((btn) => {
      btn.addEventListener('click', () => authDialog.close());
    });

    authDialog.addEventListener('close', () => {
      authDialog.returnValue = '';
      setFeedback('');
    });

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      authDialog.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, authDialog);
      });
      authDialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, authDialog)) authDialog.close();
      });
    }

    const ensureClient = () => {
      const configErr = getConfigErrorMessage();
      if (configErr) {
        setFeedback(configErr, 'error');
        return null;
      }
      return sb;
    };

    if (forms.signup) {
      forms.signup.addEventListener('submit', async (e) => {
        e.preventDefault();
        const client = ensureClient();
        if (!client) return;

        const fullName = document.getElementById('signupName')?.value.trim() || '';
        const email = document.getElementById('signupEmail')?.value.trim() || '';
        const password = document.getElementById('signupPassword')?.value || '';
        const submitBtn = document.getElementById('signupSubmit');

        setFeedback('');
        setBusy(submitBtn, true, 'Creating account…');
        try {
          const redirectUrl = getRedirectUrl();
          const nowIso = new Date().toISOString();
          const initialAllergens = DEFAULT_ALLERGENS.map((item) => ({ ...item }));
          const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                strict_mode: true,
                trace_alerts: true,
                allergens: initialAllergens,
                allergy_updated_at: nowIso
              },
              ...(redirectUrl ? { emailRedirectTo: redirectUrl } : {})
            }
          });

          if (error) {
            setFeedback(error.message, 'error');
            return;
          }

          if (data.session) {
            await syncProfileTable(data.session.user, {
              fullName,
              strictMode: true,
              traceAlerts: true,
              allergens: initialAllergens,
              updatedAt: nowIso
            });
            forms.signup.reset();
            await syncUserFromDatabase(data.session.user);
            setView('account', { preserveFeedback: true });
            setFeedback('Account created and signed in.', 'success');
          } else {
            forms.signup.reset();
            setView('signin', { preserveFeedback: true });
            setFeedback('Account created! Check your inbox for the confirmation link, then sign in.', 'success');
          }
        } catch (err) {
          setFeedback(err?.message || 'Unable to create account right now.', 'error');
        } finally {
          setBusy(submitBtn, false);
        }
      });
    }

    if (forms.signin) {
      forms.signin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const client = ensureClient();
        if (!client) return;

        const email = document.getElementById('signinEmail')?.value.trim() || '';
        const password = document.getElementById('signinPassword')?.value || '';
        const submitBtn = document.getElementById('signinSubmit');

        setFeedback('');
        setBusy(submitBtn, true, 'Signing in…');
        try {
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) {
            setFeedback(error.message, 'error');
            return;
          }
          forms.signin.reset();
          await syncUserFromDatabase(data.user);
          authDialog.close();
        } catch (err) {
          setFeedback(err?.message || 'Unable to sign in right now.', 'error');
        } finally {
          setBusy(submitBtn, false);
        }
      });
    }

    if (forms.forgot) {
      forms.forgot.addEventListener('submit', async (e) => {
        e.preventDefault();
        const client = ensureClient();
        if (!client) return;

        const email = document.getElementById('forgotEmail')?.value.trim() || '';
        const submitBtn = document.getElementById('forgotSubmit');

        setFeedback('');
        setBusy(submitBtn, true, 'Sending reset link…');
        try {
          const redirectUrl = getRedirectUrl();
          const { error } = await client.auth.resetPasswordForEmail(
            email,
            redirectUrl ? { redirectTo: redirectUrl } : undefined
          );
          if (error) {
            setFeedback(error.message, 'error');
            return;
          }
          forms.forgot.reset();
          setFeedback('If an account exists for that email, a reset link has been sent.', 'success');
        } catch (err) {
          setFeedback(err?.message || 'Unable to send reset email right now.', 'error');
        } finally {
          setBusy(submitBtn, false);
        }
      });
    }

    if (forms.recovery) {
      forms.recovery.addEventListener('submit', async (e) => {
        e.preventDefault();
        const client = ensureClient();
        if (!client) return;

        const password = document.getElementById('recoveryPassword')?.value || '';
        const submitBtn = document.getElementById('recoverySubmit');

        setFeedback('');
        setBusy(submitBtn, true, 'Updating password…');
        try {
          const { data, error } = await client.auth.updateUser({ password });
          if (error) {
            setFeedback(error.message, 'error');
            return;
          }
          forms.recovery.reset();
          renderUserState(data.user);
          setView('account', { preserveFeedback: true });
          setFeedback('Password updated successfully.', 'success');
        } catch (err) {
          setFeedback(err?.message || 'Unable to update password right now.', 'error');
        } finally {
          setBusy(submitBtn, false);
        }
      });
    }

    if (signOutBtn) {
      signOutBtn.addEventListener('click', async () => {
        const client = ensureClient();
        if (!client) return;

        const prevUserId = currentUser?.id;
        setFeedback('');
        setBusy(signOutBtn, true, 'Signing out…');
        try {
          const { error } = await client.auth.signOut();
          if (error) {
            setFeedback(error.message, 'error');
            return;
          }
          clearCachedPrefs(prevUserId);
          renderUserState(null);
          setView('signin', { preserveFeedback: true });
          setFeedback('Signed out.', 'info');
        } catch (err) {
          setFeedback(err?.message || 'Unable to sign out right now.', 'error');
        } finally {
          setBusy(signOutBtn, false);
        }
      });
    }
  }

  // --- Session Bootstrapper & Reactive Database Sync ---
  const initialActiveId = getCachedActiveUserId();
  if (initialActiveId) {
    const cached = readCachedPrefs(initialActiveId);
    if (cached) {
      currentOverviewPrefs = cached;
      renderOverviewAllergens({ id: initialActiveId }, cached);
    }
  } else {
    renderUserState(null);
  }

  if (sb) {
    sb.auth.getSession().then(({ data }) => {
      const sessionUser = data?.session?.user || null;
      if (sessionUser) {
        renderUserState(sessionUser);
        syncUserFromDatabase(sessionUser);
      } else {
        renderUserState(null);
      }
    });

    sb.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user || null;
      if (sessionUser) {
        renderUserState(sessionUser);
        syncUserFromDatabase(sessionUser);
      } else {
        renderUserState(null);
      }
      if (event === 'PASSWORD_RECOVERY' && typeof openAuthModal === 'function') {
        openAuthModal('recovery');
      } else if (event === 'SIGNED_IN' && authDialog && authDialog.open && activeView === 'signin') {
        authDialog.close();
      }
    });

    subscribeAllergySync(() => {
      syncUserFromDatabase(currentUser);
    });
  }
})();
