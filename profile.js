(() => {
  'use strict';

  const auth = window.SafePlateAuth;
  if (!auth) return;

  const {
    client: sb,
    getUserPreferences,
    formatProtectionSummary,
    loadUserAllergyProfile,
    saveUserAllergyProfile,
    syncProfileTable,
    clearCachedPrefs,
    notifyAllergySync,
    subscribeAllergySync,
    initValidation,
    initPasswordToggles,
    getRedirectUrl,
    setBusy,
    getConfigErrorMessage,
    createShieldSvg
  } = auth;

  const profilePage = document.getElementById('profilePage');
  initValidation(profilePage);
  initPasswordToggles(profilePage);

  const profileHeaderPill = document.getElementById('profileHeaderPill');
  const profileHeaderLabel = document.getElementById('profileHeaderLabel');
  const profileStatusDot = document.getElementById('profileStatusDot');
  const profileStatusText = document.getElementById('profileStatusText');
  const profileProtectCard = document.getElementById('profileProtectCard');
  const profileProtectSummary = document.getElementById('profileProtectSummary');

  const profileAuthGate = document.getElementById('profileAuthGate');
  const profileSettingsContent = document.getElementById('profileSettingsContent');

  const gateFeedback = document.getElementById('gateFeedback');
  const gateSigninForm = document.getElementById('gateSigninForm');
  const gateSigninBtn = document.getElementById('gateSigninBtn');

  const accountSettingsFeedback = document.getElementById('accountSettingsFeedback');
  const accountSettingsForm = document.getElementById('accountSettingsForm');
  const settingsName = document.getElementById('settingsName');
  const settingsEmail = document.getElementById('settingsEmail');
  const saveAccountBtn = document.getElementById('saveAccountBtn');

  const allergySettingsFeedback = document.getElementById('allergySettingsFeedback');
  const allergySettingsForm = document.getElementById('allergySettingsForm');
  const strictModeInput = document.getElementById('strictModeInput');
  const traceAlertsInput = document.getElementById('traceAlertsInput');
  const allergenPresets = document.getElementById('allergenPresets');
  const settingsAllergenList = document.getElementById('settingsAllergenList');
  const customAllergenName = document.getElementById('customAllergenName');
  const customAllergenSeverity = document.getElementById('customAllergenSeverity');
  const addCustomAllergenBtn = document.getElementById('addCustomAllergenBtn');
  const saveAllergyBtn = document.getElementById('saveAllergyBtn');

  const passwordSettingsFeedback = document.getElementById('passwordSettingsFeedback');
  const passwordSettingsForm = document.getElementById('passwordSettingsForm');
  const settingsNewPassword = document.getElementById('settingsNewPassword');
  const savePasswordBtn = document.getElementById('savePasswordBtn');

  const sessionFeedback = document.getElementById('sessionFeedback');
  const sessionEmailValue = document.getElementById('sessionEmailValue');
  const sessionCreatedValue = document.getElementById('sessionCreatedValue');
  const sessionLastSignInValue = document.getElementById('sessionLastSignInValue');
  const settingsSignOutBtn = document.getElementById('settingsSignOutBtn');

  let currentUser = null;
  let draftAllergens = [];
  let hasUnsavedDraft = false;
  let hydrateSeq = 0;

  const setBanner = (el, message = '', type = 'info') => {
    if (!el) return;
    if (!message) {
      el.textContent = '';
      el.hidden = true;
      el.className = 'auth-feedback';
      return;
    }
    el.textContent = message;
    el.className = `auth-feedback ${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.hidden = false;
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const updateSummaryPill = () => {
    profileProtectSummary.textContent = formatProtectionSummary({
      allergens: draftAllergens,
      strictMode: strictModeInput.checked,
      traceAlerts: traceAlertsInput.checked
    });
  };

  const syncPresetButtons = () => {
    const activeNames = new Set(draftAllergens.map((item) => item.name.toLowerCase()));
    allergenPresets.querySelectorAll('[data-preset]').forEach((btn) => {
      const active = activeNames.has(btn.dataset.preset.toLowerCase());
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  };

  const renderAllergenEditor = () => {
    settingsAllergenList.replaceChildren();
    syncPresetButtons();
    updateSummaryPill();

    if (draftAllergens.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'active-allergen-empty';
      empty.textContent = 'No allergens selected. Add one from the presets above or enter a custom allergen below.';
      settingsAllergenList.append(empty);
      return;
    }

    draftAllergens.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'active-allergen-item';

      const top = document.createElement('div');
      top.className = 'active-allergen-top';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'active-allergen-title';

      const icon = document.createElement('span');
      const tone = item.tone || (index % 2 === 0 ? 'red' : 'violet');
      icon.className = `a-icon sm ${tone === 'violet' ? 'violet' : 'red'}`;
      icon.append(createShieldSvg());

      const title = document.createElement('strong');
      title.textContent = item.name;
      titleWrap.append(icon, title);

      const controls = document.createElement('div');
      controls.className = 'active-allergen-controls';

      const severitySelect = document.createElement('select');
      severitySelect.className = 'severity-select';
      severitySelect.setAttribute('aria-label', `${item.name} severity`);
      ['High', 'Moderate'].forEach((level) => {
        const opt = document.createElement('option');
        opt.value = level;
        opt.textContent = level;
        severitySelect.append(opt);
      });
      severitySelect.value = item.severity === 'Moderate' ? 'Moderate' : 'High';
      severitySelect.addEventListener('change', () => {
        draftAllergens[index].severity = severitySelect.value;
        hasUnsavedDraft = true;
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-allergen-btn';
      removeBtn.setAttribute('aria-label', `Remove ${item.name}`);
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        draftAllergens.splice(index, 1);
        hasUnsavedDraft = true;
        renderAllergenEditor();
      });

      controls.append(severitySelect, removeBtn);
      top.append(titleWrap, controls);

      const noteInput = document.createElement('input');
      noteInput.type = 'text';
      noteInput.className = 'allergen-note-input';
      noteInput.value = item.note || '';
      noteInput.placeholder = 'Note (e.g. Avoid all traces)';
      noteInput.setAttribute('aria-label', `${item.name} note`);
      noteInput.addEventListener('input', () => {
        draftAllergens[index].note = noteInput.value;
        hasUnsavedDraft = true;
      });

      li.append(top, noteInput);
      settingsAllergenList.append(li);
    });
  };

  const hydrateUser = (user, prefsOverride = null) => {
    const prevUserId = currentUser?.id || null;
    const nextUserId = user?.id || null;
    const userChanged = prevUserId !== nextUserId;
    currentUser = user || null;

    if (!currentUser) {
      hasUnsavedDraft = false;
      profileHeaderPill.hidden = true;
      profileProtectCard.hidden = true;
      profileSettingsContent.hidden = true;
      profileAuthGate.hidden = false;
      profileStatusDot.classList.add('idle');
      profileStatusText.textContent = 'Sign in required to edit profile settings';
      return;
    }

    const prefs = prefsOverride || getUserPreferences(currentUser);
    const displayName = prefs.fullName || currentUser.email || 'Account';

    profileHeaderPill.hidden = false;
    profileHeaderLabel.textContent = displayName;
    profileProtectCard.hidden = false;
    profileAuthGate.hidden = true;
    profileSettingsContent.hidden = false;
    profileStatusDot.classList.remove('idle');
    profileStatusText.textContent = `Signed in as ${displayName} · Settings synced with your account`;

    settingsName.value = prefs.fullName;
    settingsEmail.value = currentUser.email || '';

    if (userChanged || !hasUnsavedDraft) {
      strictModeInput.checked = prefs.strictMode;
      traceAlertsInput.checked = prefs.traceAlerts;
      draftAllergens = prefs.allergens.map((item) => ({ ...item }));
      renderAllergenEditor();
    }

    sessionEmailValue.textContent = currentUser.email || '—';
    sessionCreatedValue.textContent = formatDate(currentUser.created_at);
    sessionLastSignInValue.textContent = formatDate(currentUser.last_sign_in_at);
  };

  const syncProfileFromDatabase = async (hintUser = null) => {
    const seq = ++hydrateSeq;
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
    if (seq !== hydrateSeq) return;
    if (!user) {
      hydrateUser(null);
      return;
    }
    const { prefs } = await loadUserAllergyProfile(user);
    if (seq !== hydrateSeq) return;
    hydrateUser(user, prefs);
  };

  const ensureClient = (feedbackEl) => {
    const err = getConfigErrorMessage();
    if (err) {
      setBanner(feedbackEl, err, 'error');
      return null;
    }
    return sb;
  };

  // --- Preset & Custom Allergen Interactions ---
  strictModeInput.addEventListener('change', () => {
    hasUnsavedDraft = true;
    updateSummaryPill();
  });

  traceAlertsInput.addEventListener('change', () => {
    hasUnsavedDraft = true;
    updateSummaryPill();
  });

  allergenPresets.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const name = btn.dataset.preset;
    const existingIndex = draftAllergens.findIndex(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );
    if (existingIndex >= 0) {
      draftAllergens.splice(existingIndex, 1);
    } else {
      draftAllergens.push({
        name,
        note: btn.dataset.note || 'Avoid all traces',
        severity: 'High',
        tone: btn.dataset.tone || 'red'
      });
    }
    hasUnsavedDraft = true;
    renderAllergenEditor();
  });

  const addCustomAllergen = () => {
    const name = customAllergenName.value.trim();
    if (!name) {
      customAllergenName.focus();
      return;
    }
    const alreadyExists = draftAllergens.some(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );
    if (alreadyExists) {
      setBanner(allergySettingsFeedback, `${name} is already in your tracked allergens.`, 'info');
      return;
    }
    setBanner(allergySettingsFeedback, '');
    draftAllergens.push({
      name,
      note: strictModeInput.checked ? 'Avoid all traces' : 'Check ingredients',
      severity: customAllergenSeverity.value === 'Moderate' ? 'Moderate' : 'High',
      tone: draftAllergens.length % 2 === 0 ? 'red' : 'violet'
    });
    customAllergenName.value = '';
    hasUnsavedDraft = true;
    renderAllergenEditor();
  };

  addCustomAllergenBtn.addEventListener('click', addCustomAllergen);
  customAllergenName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      addCustomAllergen();
    }
  });

  // --- Form Submissions ---
  gateSigninForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const client = ensureClient(gateFeedback);
    if (!client) return;

    const email = document.getElementById('gateEmail').value.trim();
    const password = document.getElementById('gatePassword').value;
    setBanner(gateFeedback, '');
    setBusy(gateSigninBtn, true, 'Signing in…');

    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setBanner(gateFeedback, error.message, 'error');
        return;
      }
      gateSigninForm.reset();
      await syncProfileFromDatabase(data.user);
    } catch (err) {
      setBanner(gateFeedback, err?.message || 'Unable to sign in right now.', 'error');
    } finally {
      setBusy(gateSigninBtn, false);
    }
  });

  accountSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const client = ensureClient(accountSettingsFeedback);
    if (!client || !currentUser) return;

    const fullName = settingsName.value.trim();
    const nextEmail = settingsEmail.value.trim();
    const emailChanged = Boolean(nextEmail && nextEmail.toLowerCase() !== (currentUser.email || '').toLowerCase());

    setBanner(accountSettingsFeedback, '');
    setBusy(saveAccountBtn, true, 'Saving…');

    try {
      const payload = {
        data: {
          ...(currentUser.user_metadata || {}),
          full_name: fullName
        }
      };
      if (emailChanged) {
        payload.email = nextEmail;
      }
      const redirectUrl = getRedirectUrl();
      const options = emailChanged && redirectUrl ? { emailRedirectTo: redirectUrl } : undefined;
      const { data, error } = await client.auth.updateUser(payload, options);

      if (error) {
        setBanner(accountSettingsFeedback, error.message, 'error');
        return;
      }

      const updatedUser = data.user;
      await syncProfileTable(updatedUser, getUserPreferences(updatedUser));
      notifyAllergySync();
      await syncProfileFromDatabase(updatedUser);
      setBanner(
        accountSettingsFeedback,
        emailChanged
          ? `Account details saved. Check ${nextEmail} to confirm your new email address.`
          : 'Account details updated.',
        'success'
      );
    } catch (err) {
      setBanner(accountSettingsFeedback, err?.message || 'Unable to save account details.', 'error');
    } finally {
      setBusy(saveAccountBtn, false);
    }
  });

  allergySettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const client = ensureClient(allergySettingsFeedback);
    if (!client || !currentUser) return;

    const cleanedAllergens = draftAllergens
      .filter((item) => item && item.name && item.name.trim())
      .map((item, idx) => ({
        name: item.name.trim(),
        note: (item.note || '').trim() || 'Avoid all traces',
        severity: item.severity === 'Moderate' ? 'Moderate' : 'High',
        tone: item.tone || (idx % 2 === 0 ? 'red' : 'violet')
      }));

    setBanner(allergySettingsFeedback, '');
    setBusy(saveAllergyBtn, true, 'Saving…');

    try {
      const saved = await saveUserAllergyProfile(currentUser, {
        fullName: getUserPreferences(currentUser).fullName,
        strictMode: strictModeInput.checked,
        traceAlerts: traceAlertsInput.checked,
        allergens: cleanedAllergens
      });

      hasUnsavedDraft = false;
      hydrateUser(saved.user, saved.prefs);
      setBanner(allergySettingsFeedback, 'Allergy profile saved to your account.', 'success');
    } catch (err) {
      setBanner(allergySettingsFeedback, err?.message || 'Unable to save allergy profile.', 'error');
    } finally {
      setBusy(saveAllergyBtn, false);
    }
  });

  passwordSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const client = ensureClient(passwordSettingsFeedback);
    if (!client || !currentUser) return;

    const newPassword = settingsNewPassword.value;
    setBanner(passwordSettingsFeedback, '');
    setBusy(savePasswordBtn, true, 'Updating…');

    try {
      const { data, error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        setBanner(passwordSettingsFeedback, error.message, 'error');
        return;
      }
      passwordSettingsForm.reset();
      hydrateUser(data.user);
      setBanner(passwordSettingsFeedback, 'Password updated successfully.', 'success');
    } catch (err) {
      setBanner(passwordSettingsFeedback, err?.message || 'Unable to update password.', 'error');
    } finally {
      setBusy(savePasswordBtn, false);
    }
  });

  settingsSignOutBtn.addEventListener('click', async () => {
    const client = ensureClient(sessionFeedback);
    if (!client) return;

    const prevUserId = currentUser?.id;
    setBanner(sessionFeedback, '');
    setBusy(settingsSignOutBtn, true, 'Signing out…');

    try {
      const { error } = await client.auth.signOut();
      if (error) {
        setBanner(sessionFeedback, error.message, 'error');
        return;
      }
      clearCachedPrefs(prevUserId);
      hydrateUser(null);
    } catch (err) {
      setBanner(sessionFeedback, err?.message || 'Unable to sign out right now.', 'error');
    } finally {
      setBusy(settingsSignOutBtn, false);
    }
  });

  // --- Initial Session & Auth Listener ---
  if (!sb) {
    hydrateUser(null);
    const err = getConfigErrorMessage();
    if (err) setBanner(gateFeedback, err, 'error');
  } else {
    sb.auth.getSession().then(({ data }) => {
      const sessionUser = data?.session?.user || null;
      if (sessionUser) {
        hydrateUser(sessionUser);
        syncProfileFromDatabase(sessionUser);
      } else {
        hydrateUser(null);
      }
    });
    sb.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user || null;
      if (sessionUser) {
        hydrateUser(sessionUser);
        syncProfileFromDatabase(sessionUser);
      } else {
        hydrateUser(null);
      }
    });
    subscribeAllergySync(() => {
      syncProfileFromDatabase(currentUser);
    });
  }
})();
