(() => {
  'use strict';

  const STORAGE_KEY = 'safeplate_recent_scans';
  const auth = window.SafePlateAuth;

  const historyHeaderPill = document.getElementById('historyHeaderPill');
  const historyHeaderLabel = document.getElementById('historyHeaderLabel');
  const historySignInBtn = document.getElementById('historySignInBtn');
  const historyStatusDot = document.getElementById('historyStatusDot');
  const historyStatusText = document.getElementById('historyStatusText');
  const historyProtectSummary = document.getElementById('historyProtectSummary');

  const historySearchInput = document.getElementById('historySearchInput');
  const filterButtons = document.querySelectorAll('[data-filter]');
  const countAll = document.getElementById('countAll');
  const countDanger = document.getElementById('countDanger');
  const countWarning = document.getElementById('countWarning');
  const countSafe = document.getElementById('countSafe');

  const historyItemsList = document.getElementById('historyItemsList');
  const historyEmptyState = document.getElementById('historyEmptyState');
  const emptyHeading = document.getElementById('emptyHeading');
  const emptySubheading = document.getElementById('emptySubheading');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const loadSampleScansBtn = document.getElementById('loadSampleScansBtn');

  let activeFilter = 'all';
  let searchQuery = '';
  let currentUser = null;

  const DEFAULT_SAMPLES = [
    {
      id: 'scan_sample_1',
      labelName: 'Peanut Butter Bakery Cookie',
      status: 'danger',
      timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      allergens: ['Peanuts', 'Dairy', 'Eggs', 'Wheat / Gluten', 'Soy'],
      summary: '5 allergens detected · Peanuts (High Risk)',
      extractedText: 'INGREDIENTS: Enriched wheat flour, roasted peanuts, peanut butter (peanuts, salt), palm oil, butter (pasteurized cream, salt), eggs, sea salt, soy lecithin, natural vanilla flavor. CONTAINS: PEANUTS, WHEAT, MILK, EGGS, SOY. Manufactured in a facility that also processes tree nuts.'
    },
    {
      id: 'scan_sample_2',
      labelName: 'Whey Protein Recovery Shake',
      status: 'warning',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      allergens: ['Dairy', 'Soy', 'Eggs (Trace)', 'Wheat / Gluten (Trace)'],
      summary: 'Facility trace alert · Produced on shared equipment with eggs & wheat',
      extractedText: 'INGREDIENTS: Filtered water, whey protein concentrate (milk), calcium caseinate, cocoa powder, sunflower oil, soy lecithin, sea salt. Produced on shared equipment with eggs and wheat.'
    },
    {
      id: 'scan_sample_3',
      labelName: 'Organic Crispy Apple Cinnamon Chips',
      status: 'safe',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      allergens: [],
      summary: 'No allergens detected · Certified peanut-free & gluten-free facility',
      extractedText: 'INGREDIENTS: Organic dried apples, organic ground cinnamon, organic lemon juice concentrate. Free from common allergens. Produced in a certified peanut-free and gluten-free facility.'
    }
  ];

  const escapeHtml = (str) => {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const getScansFromStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  };

  const saveScansToStorage = (scans) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
      window.dispatchEvent(new Event('storage'));
    } catch (_) {}
  };

  const formatTimestamp = (iso) => {
    if (!iso) return 'Just now';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Recently';

    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const updateHeaderUser = (user, prefsOverride = null) => {
    currentUser = user || null;
    const prefs = prefsOverride || (
      auth && typeof auth.getCurrentPreferences === 'function'
        ? auth.getCurrentPreferences()
        : auth && typeof auth.getUserPreferences === 'function'
          ? auth.getUserPreferences(currentUser)
          : { strictMode: true, traceAlerts: true, allergens: [{ name: 'Peanuts' }, { name: 'Dairy' }] }
    );

    if (currentUser) {
      const name = prefs.fullName || currentUser.email || 'Account';
      if (historyHeaderPill) historyHeaderPill.hidden = false;
      if (historyHeaderLabel) historyHeaderLabel.textContent = name;
      if (historySignInBtn) historySignInBtn.hidden = true;
      if (historyStatusText) historyStatusText.textContent = `Signed in as ${name} · History synced with your account`;
      if (historyStatusDot) historyStatusDot.classList.remove('idle');
    } else {
      if (historyHeaderPill) historyHeaderPill.hidden = true;
      if (historySignInBtn) historySignInBtn.hidden = false;
      if (historyStatusText) historyStatusText.textContent = 'On-device label scan history';
      if (historyStatusDot) historyStatusDot.classList.add('idle');
    }

    if (historyProtectSummary && auth && typeof auth.formatProtectionSummary === 'function') {
      historyProtectSummary.textContent = auth.formatProtectionSummary(prefs);
    }
  };

  const renderHistory = () => {
    const allScans = getScansFromStorage();

    // Counts
    const counts = {
      all: allScans.length,
      danger: allScans.filter((s) => s.status === 'danger').length,
      warning: allScans.filter((s) => s.status === 'warning').length,
      safe: allScans.filter((s) => s.status === 'safe').length
    };

    if (countAll) countAll.textContent = String(counts.all);
    if (countDanger) countDanger.textContent = String(counts.danger);
    if (countWarning) countWarning.textContent = String(counts.warning);
    if (countSafe) countSafe.textContent = String(counts.safe);

    // Filter by tab
    let filtered = allScans;
    if (activeFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === activeFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        const titleMatch = (s.labelName || '').toLowerCase().includes(q);
        const summaryMatch = (s.summary || '').toLowerCase().includes(q);
        const allergenMatch = (s.allergens || []).some((a) => String(a).toLowerCase().includes(q));
        const textMatch = (s.extractedText || '').toLowerCase().includes(q);
        return titleMatch || summaryMatch || allergenMatch || textMatch;
      });
    }

    if (!historyItemsList) return;

    if (filtered.length === 0) {
      historyItemsList.replaceChildren();
      historyItemsList.hidden = true;
      if (historyEmptyState) historyEmptyState.hidden = false;

      if (allScans.length === 0) {
        if (emptyHeading) emptyHeading.textContent = 'No scan records found';
        if (emptySubheading) emptySubheading.textContent = 'Scans you perform with the ingredient label scanner will appear here with full allergen analysis.';
        if (loadSampleScansBtn) loadSampleScansBtn.hidden = false;
      } else {
        if (emptyHeading) emptyHeading.textContent = 'No matching scans found';
        if (emptySubheading) emptySubheading.textContent = 'Try adjusting your search query or switching the status filter above.';
        if (loadSampleScansBtn) loadSampleScansBtn.hidden = true;
      }
      return;
    }

    if (historyEmptyState) historyEmptyState.hidden = true;
    historyItemsList.hidden = false;
    historyItemsList.replaceChildren();

    filtered.forEach((scan) => {
      const li = document.createElement('li');
      li.className = `history-card status-${scan.status}`;

      // Card Header
      const header = document.createElement('div');
      header.className = 'history-card-header';

      const left = document.createElement('div');
      left.className = 'history-card-title-group';

      const statusBadge = document.createElement('span');
      statusBadge.className = `badge status-pill ${scan.status}`;
      statusBadge.textContent = scan.status === 'danger' ? 'Avoid' : scan.status === 'warning' ? 'Caution' : 'Safe';

      const title = document.createElement('h3');
      title.className = 'history-product-title';
      title.textContent = scan.labelName || 'Scanned Ingredient Label';

      const time = document.createElement('time');
      time.className = 'history-time';
      time.textContent = formatTimestamp(scan.timestamp);

      left.append(statusBadge, title, time);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'history-delete-btn';
      deleteBtn.setAttribute('aria-label', `Delete scan for ${scan.labelName}`);
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = getScansFromStorage();
        const next = current.filter((item) => item.id !== scan.id);
        saveScansToStorage(next);
        renderHistory();
      });

      header.append(left, deleteBtn);

      // Summary & Allergens List
      const body = document.createElement('div');
      body.className = 'history-card-body';

      const summaryText = document.createElement('p');
      summaryText.className = 'history-summary-text';
      summaryText.textContent = scan.summary || (scan.allergens?.length ? scan.allergens.join(', ') : 'No allergens detected');
      body.append(summaryText);

      if (Array.isArray(scan.allergens) && scan.allergens.length > 0) {
        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'history-allergen-chips';
        scan.allergens.forEach((alg) => {
          const chip = document.createElement('span');
          chip.className = `history-chip ${scan.status}`;
          chip.textContent = alg;
          chipsWrap.append(chip);
        });
        body.append(chipsWrap);
      }

      // Extracted Text Accordion
      if (scan.extractedText) {
        const details = document.createElement('details');
        details.className = 'history-extracted-details';

        const summary = document.createElement('summary');
        summary.textContent = 'View extracted ingredient text';

        const pre = document.createElement('pre');
        pre.className = 'history-raw-text';
        pre.textContent = scan.extractedText;

        details.append(summary, pre);
        body.append(details);
      }

      li.append(header, body);
      historyItemsList.append(li);
    });
  };

  // --- Filter Buttons ---
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      activeFilter = btn.dataset.filter || 'all';
      renderHistory();
    });
  });

  // --- Search Input ---
  if (historySearchInput) {
    historySearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderHistory();
    });
  }

  // --- Clear History ---
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      const scans = getScansFromStorage();
      if (scans.length === 0) {
        alert('Your scan history is already empty.');
        return;
      }
      if (confirm('Are you sure you want to clear your entire scan history?')) {
        saveScansToStorage([]);
        renderHistory();
      }
    });
  }

  // --- Load Sample Scans ---
  if (loadSampleScansBtn) {
    loadSampleScansBtn.addEventListener('click', () => {
      saveScansToStorage(DEFAULT_SAMPLES.map((s) => ({ ...s, id: 'sample_' + Date.now() + Math.random() })));
      renderHistory();
    });
  }

  // --- Cross-tab Sync ---
  window.addEventListener('storage', () => {
    renderHistory();
  });
  window.addEventListener('pageshow', () => {
    renderHistory();
  });

  // --- Auth Session Sync ---
  if (auth) {
    if (typeof auth.onPreferencesChanged === 'function') {
      auth.onPreferencesChanged((prefs, user) => {
        updateHeaderUser(user, prefs);
      });
    }

    if (auth.client) {
      auth.client.auth.getSession().then(({ data }) => {
        const sessionUser = data?.session?.user || null;
        if (sessionUser && typeof auth.loadUserAllergyProfile === 'function') {
          auth.loadUserAllergyProfile(sessionUser).then(({ prefs }) => {
            updateHeaderUser(sessionUser, prefs);
          }).catch(() => {
            updateHeaderUser(sessionUser);
          });
        } else {
          updateHeaderUser(sessionUser);
        }
      });
      auth.client.auth.onAuthStateChange((_event, session) => {
        const sessionUser = session?.user || null;
        if (sessionUser && typeof auth.loadUserAllergyProfile === 'function') {
          auth.loadUserAllergyProfile(sessionUser).then(({ prefs }) => {
            updateHeaderUser(sessionUser, prefs);
          }).catch(() => {
            updateHeaderUser(sessionUser);
          });
        } else {
          updateHeaderUser(sessionUser);
        }
      });
    }

    if (typeof auth.subscribeAllergySync === 'function') {
      auth.subscribeAllergySync(async () => {
        const user = typeof auth.getCurrentUser === 'function' ? auth.getCurrentUser() : currentUser;
        const prefs = typeof auth.getActivePreferences === 'function'
          ? await auth.getActivePreferences()
          : auth.getUserPreferences(user);
        updateHeaderUser(user, prefs);
      });
    }
  } else {
    updateHeaderUser(null);
  }

  // Initial render
  renderHistory();
})();
