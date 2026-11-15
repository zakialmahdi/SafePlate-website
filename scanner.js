(() => {
  'use strict';

  // --- Allergen Dictionary & Synonym Map ---
  const ALLERGEN_DICTIONARY = {
    'peanuts': [
      'peanut', 'peanuts', 'peanut butter', 'peanut flour', 'peanut oil',
      'arachis', 'groundnut', 'groundnuts', 'mandelonas', 'beer nuts'
    ],
    'dairy': [
      'milk', 'dairy', 'butter', 'cheese', 'whey', 'casein', 'caseinate',
      'lactose', 'cream', 'ghee', 'curd', 'curds', 'yogurt', 'yoghurt',
      'buttermilk', 'lactalbumin', 'lactoglobulin', 'sour cream',
      'milk powder', 'nonfat milk', 'skim milk', 'milkfat', 'anhydrous milk fat'
    ],
    'tree nuts': [
      'tree nut', 'tree nuts', 'almond', 'almonds', 'cashew', 'cashews',
      'walnut', 'walnuts', 'pecan', 'pecans', 'hazelnut', 'hazelnuts',
      'filbert', 'filberts', 'pistachio', 'pistachios', 'macadamia',
      'brazil nut', 'brazil nuts', 'chestnut', 'chestnuts', 'praline',
      'marzipan', 'nut butter', 'nut meal', 'nut paste'
    ],
    'shellfish': [
      'shellfish', 'crustacean', 'crustaceans', 'shrimp', 'shrimps', 'prawn',
      'prawns', 'crab', 'crabs', 'lobster', 'lobsters', 'crawfish',
      'crayfish', 'krill', 'mollusk', 'mollusks', 'mollusc', 'molluscs',
      'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'scallop',
      'scallops', 'squid', 'calamari', 'octopus', 'cuttlefish', 'snail', 'escargot'
    ],
    'eggs': [
      'egg', 'eggs', 'egg white', 'egg whites', 'egg yolk', 'egg yolks',
      'albumin', 'albumen', 'ovalbumin', 'lysozyme', 'mayonnaise', 'meringue',
      'globulin', 'livetin', 'ovomucin', 'ovomucoid', 'ovovitellin', 'surimi'
    ],
    'soy': [
      'soy', 'soya', 'soybean', 'soybeans', 'soya bean', 'soya beans',
      'tofu', 'edamame', 'soy lecithin', 'soya lecithin', 'soy protein',
      'soy isolate', 'soy sauce', 'tamari', 'miso', 'tempeh', 'natto',
      'shoyu', 'textured vegetable protein', 'tvp'
    ],
    'wheat / gluten': [
      'wheat', 'gluten', 'wheat flour', 'flour', 'enriched flour', 'bleached flour',
      'unbleached flour', 'whole wheat', 'wheat bran', 'wheat germ', 'durum',
      'semolina', 'spelt', 'farina', 'graham', 'kamut', 'einkorn', 'emmer',
      'barley', 'rye', 'malt', 'malt extract', 'triticale', 'couscous', 'bulgur',
      'vital wheat gluten', 'seitan'
    ],
    'sesame': [
      'sesame', 'sesame seed', 'sesame seeds', 'tahini', 'tahina', 'halvah',
      'sesamum', 'gingelly', 'til', 'sesame oil', 'sesame paste'
    ]
  };

  const TRACE_PHRASES = [
    'may contain',
    'manufactured in a facility that also processes',
    'manufactured in a facility that processes',
    'processed in a facility that also processes',
    'processed in a facility that handles',
    'made on shared equipment with',
    'made on shared equipment',
    'packaged in a facility that handles',
    'facility that also processes',
    'facility that also handles',
    'may contain traces of',
    'traces of'
  ];

  const SAMPLE_LABELS = {
    peanutCookie: {
      name: 'Peanut Butter Bakery Cookie',
      text: 'INGREDIENTS: Enriched wheat flour (wheat flour, niacin, reduced iron, thiamine mononitrate, riboflavin, folic acid), roasted peanuts, sugar, peanut butter (peanuts, salt), palm oil, butter (pasteurized cream, salt), eggs, sea salt, soy lecithin, natural vanilla flavor. CONTAINS: PEANUTS, WHEAT, MILK, EGGS, SOY. Manufactured in a facility that also processes tree nuts.'
    },
    dairyShake: {
      name: 'Whey Protein Recovery Shake',
      text: 'INGREDIENTS: Filtered water, whey protein concentrate (milk), calcium caseinate, cocoa powder, high oleic sunflower oil, natural flavors, soy lecithin, sea salt, sucralose, potassium citrate. CONTAINS: MILK, SOY. Produced on shared equipment with eggs and wheat.'
    },
    appleChips: {
      name: 'Organic Crispy Apple Cinnamon Chips',
      text: 'INGREDIENTS: Organic dried apples, organic ground cinnamon, organic lemon juice concentrate. Free from common allergens. Produced in a certified peanut-free and gluten-free facility.'
    }
  };

  const RECENT_SCANS_STORAGE_KEY = 'safeplate_recent_scans';

  // --- DOM Elements ---
  const scanModal = document.getElementById('scanModal');
  const heroScanBtn = document.querySelector('[data-open="scanModal"]');
  const heroUploadInput = document.getElementById('labelUpload');

  const scannerVideo = document.getElementById('scannerVideo');
  const scannerPreview = document.getElementById('scannerPreview');
  const scannerCanvas = document.getElementById('scannerCanvas');
  const scannerFrame = document.getElementById('scannerFrame');
  const scannerBeam = document.getElementById('scannerBeam');
  const viewfinderPlaceholder = document.getElementById('viewfinderPlaceholder');

  const startCameraBtn = document.getElementById('startCameraBtn');
  const cameraBtnLabel = document.getElementById('cameraBtnLabel');
  const captureFrameBtn = document.getElementById('captureFrameBtn');
  const scannerFileInput = document.getElementById('scannerFileInput');
  const scannerProfileSummary = document.getElementById('scannerProfileSummary');
  const scannerProfileText = document.getElementById('scannerProfileText');

  const scannerProgressWrap = document.getElementById('scannerProgressWrap');
  const scannerStatusText = document.getElementById('scannerStatusText');
  const scannerProgressPercent = document.getElementById('scannerProgressPercent');
  const scannerProgressFill = document.getElementById('scannerProgressFill');

  const scannerResult = document.getElementById('scannerResult');
  const resultBanner = document.getElementById('resultBanner');
  const resultIconBadge = document.getElementById('resultIconBadge');
  const resultHeading = document.getElementById('resultHeading');
  const resultSubheading = document.getElementById('resultSubheading');
  const resultMatchesSection = document.getElementById('resultMatchesSection');
  const resultMatchesList = document.getElementById('resultMatchesList');
  const resultOcrText = document.getElementById('resultOcrText');
  const ocrConfidenceText = document.getElementById('ocrConfidenceText');
  const scanAgainBtn = document.getElementById('scanAgainBtn');
  const saveRecentScanBtn = document.getElementById('saveRecentScanBtn');

  const recentScansContainer = document.getElementById('recentScans');

  let mediaStream = null;
  let isScanning = false;
  let lastAnalysis = null;
  let cachedTesseractWorker = null;

  // --- Helpers ---
  const escapeHtml = (str) => {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const getActiveUserPrefs = () => {
    if (window.SafePlateAuth) {
      if (typeof window.SafePlateAuth.getCurrentPreferences === 'function') {
        const prefs = window.SafePlateAuth.getCurrentPreferences();
        if (prefs) return prefs;
      }
      if (typeof window.SafePlateAuth.getUserPreferences === 'function') {
        const user = typeof window.SafePlateAuth.getCurrentUser === 'function'
          ? window.SafePlateAuth.getCurrentUser()
          : null;
        return window.SafePlateAuth.getUserPreferences(user);
      }
    }
    return {
      strictMode: true,
      traceAlerts: true,
      allergens: [
        { name: 'Peanuts', note: 'Avoid all traces', severity: 'High', tone: 'red' },
        { name: 'Dairy', note: 'Includes derivatives', severity: 'High', tone: 'violet' }
      ]
    };
  };

  const getActiveUserPrefsAsync = async () => {
    if (window.SafePlateAuth && typeof window.SafePlateAuth.getActivePreferences === 'function') {
      try {
        const prefs = await window.SafePlateAuth.getActivePreferences();
        if (prefs) return prefs;
      } catch (_) {}
    }
    return getActiveUserPrefs();
  };

  const updateModalProfileSummary = (prefsOverride = null) => {
    if (!scannerProfileText) return;
    const prefs = prefsOverride || getActiveUserPrefs();
    const count = prefs.allergens?.length || 0;
    const names = (prefs.allergens || []).map((a) => a.name).join(', ') || 'None';
    const mode = prefs.strictMode ? 'Strict mode active' : 'Standard mode';
    const traceNote = prefs.traceAlerts ? ' · Trace alerts' : '';
    scannerProfileText.textContent = `${count} tracked: ${names} · ${mode}${traceNote}`;
  };

  // --- Camera Streaming ---
  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera access is not supported by your browser or environment. Please upload an image file instead.');
      return;
    }

    try {
      if (mediaStream) {
        stopCamera();
        return;
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      scannerVideo.srcObject = mediaStream;
      scannerVideo.hidden = false;
      scannerPreview.hidden = true;
      if (viewfinderPlaceholder) viewfinderPlaceholder.hidden = true;
      if (scannerBeam) scannerBeam.hidden = false;
      if (cameraBtnLabel) cameraBtnLabel.textContent = 'Stop camera';
      if (captureFrameBtn) captureFrameBtn.disabled = false;
    } catch (err) {
      console.warn('Camera request denied or unavailable:', err);
      alert('Could not start camera (' + (err.message || 'permission denied') + '). You can still upload label photos directly.');
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    if (scannerVideo) {
      scannerVideo.srcObject = null;
      scannerVideo.hidden = true;
    }
    if (cameraBtnLabel) cameraBtnLabel.textContent = 'Start camera';
    if (captureFrameBtn) captureFrameBtn.disabled = true;
    if (viewfinderPlaceholder && scannerPreview.hidden) {
      viewfinderPlaceholder.hidden = false;
    }
  };

  // --- Image Preprocessing on Canvas ---
  const captureVideoFrame = () => {
    if (!scannerVideo || scannerVideo.videoWidth === 0) return null;
    const canvas = scannerCanvas || document.createElement('canvas');
    canvas.width = scannerVideo.videoWidth;
    canvas.height = scannerVideo.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(scannerVideo, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const renderSampleToCanvas = (sampleText) => {
    const canvas = scannerCanvas || document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');

    // Clean packaging label card background
    ctx.fillStyle = '#f8f6f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#2a2150';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    ctx.fillStyle = '#2a2150';
    ctx.font = 'bold 24px "DM Sans", Arial, sans-serif';
    ctx.fillText('NUTRITION & INGREDIENT INFORMATION', 40, 60);

    ctx.beginPath();
    ctx.moveTo(40, 78);
    ctx.lineTo(canvas.width - 40, 78);
    ctx.strokeStyle = '#2a2150';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '500 20px "DM Sans", Arial, sans-serif';
    ctx.fillStyle = '#1f1a42';

    // Word wrap
    const words = sampleText.split(' ');
    let line = '';
    let y = 120;
    const maxWidth = canvas.width - 80;
    const lineHeight = 32;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, 40, y);
        line = words[i] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 40, y);

    return canvas;
  };

  // --- Allergen Detection Engine ---
  const analyzeIngredients = (rawText, userPrefs) => {
    const text = String(rawText || '').trim();
    const lower = text.toLowerCase();
    const activeAllergens = userPrefs?.allergens || [];
    const strictMode = Boolean(userPrefs?.strictMode ?? true);
    const traceAlerts = Boolean(userPrefs?.traceAlerts ?? true);

    const detectedAllergens = [];
    const flaggedTerms = new Set();
    const traceWarnings = [];

    // Check facility trace triggers first
    TRACE_PHRASES.forEach((phrase) => {
      const idx = lower.indexOf(phrase);
      if (idx !== -1) {
        const snippet = text.slice(idx, idx + phrase.length + 80).split(/[.;]/)[0];
        traceWarnings.push({ phrase, snippet });
        flaggedTerms.add(phrase.toLowerCase());
      }
    });

    activeAllergens.forEach((allergen) => {
      const canonicalName = allergen.name.toLowerCase();
      // Look up synonyms or fallback to canonical name tokens
      const synonyms = ALLERGEN_DICTIONARY[canonicalName] || [
        canonicalName,
        canonicalName.replace(/\s*\/\s*/g, ' ')
      ];

      const hits = [];
      synonyms.forEach((syn) => {
        const escaped = syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Word boundary match
        const regex = new RegExp(`\\b${escaped}(?:s|es|ies)?\\b`, 'gi');
        let m;
        while ((m = regex.exec(lower)) !== null) {
          const matchedWord = text.slice(m.index, m.index + m[0].length);
          hits.push(matchedWord);
          flaggedTerms.add(matchedWord.toLowerCase());
        }
      });

      if (hits.length > 0) {
        // Determine whether this allergen hit was in a facility warning section
        const isTraceOnly = traceWarnings.some((w) => {
          const wLower = w.snippet.toLowerCase();
          return hits.some((h) => wLower.includes(h.toLowerCase()));
        });

        detectedAllergens.push({
          name: allergen.name,
          severity: allergen.severity || 'High',
          note: allergen.note || 'Avoid all traces',
          hits: Array.from(new Set(hits)),
          isTraceOnly
        });
      }
    });

    // Check if facility warning mentioned allergens not in dictionary
    if ((strictMode || traceAlerts) && traceWarnings.length > 0) {
      activeAllergens.forEach((allergen) => {
        const alreadyFlagged = detectedAllergens.some((d) => d.name === allergen.name);
        if (!alreadyFlagged) {
          const cleanName = allergen.name.toLowerCase();
          const mentionedInTrace = traceWarnings.some((w) => w.snippet.toLowerCase().includes(cleanName));
          if (mentionedInTrace) {
            detectedAllergens.push({
              name: allergen.name,
              severity: 'Moderate',
              note: 'Facility trace detected',
              hits: [allergen.name],
              isTraceOnly: true
            });
          }
        }
      });
    }

    // Determine overall safety status
    let status = 'safe'; // 'safe' | 'warning' | 'danger'
    const directHits = detectedAllergens.filter((d) => !d.isTraceOnly);
    const traceHits = detectedAllergens.filter((d) => d.isTraceOnly);

    if (directHits.length > 0) {
      status = 'danger';
    } else if ((strictMode || traceAlerts) && traceHits.length > 0) {
      status = 'warning';
    } else if (traceAlerts && traceWarnings.length > 0 && activeAllergens.length === 0) {
      status = 'warning';
    }

    // If both strictMode and traceAlerts are false, filter out trace-only hits
    const finalDetected = (!strictMode && !traceAlerts)
      ? detectedAllergens.filter((d) => !d.isTraceOnly)
      : detectedAllergens;

    // Generate highlighted HTML
    let highlightedHtml = escapeHtml(text);
    if (flaggedTerms.size > 0) {
      const sortedTerms = Array.from(flaggedTerms).sort((a, b) => b.length - a.length);
      sortedTerms.forEach((term) => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(`(\\b${escaped}(?:s|es|ies)?\\b)`, 'gi');
        highlightedHtml = highlightedHtml.replace(reg, '<mark class="highlight-hit">$1</mark>');
      });
    }

    return {
      status,
      detectedAllergens: finalDetected,
      traceWarnings,
      rawText: text,
      highlightedHtml,
      timestamp: new Date().toISOString()
    };
  };

  // --- Tesseract OCR Execution ---
  const setProgress = (status, percent) => {
    if (!scannerProgressWrap) return;
    scannerProgressWrap.hidden = false;
    if (scannerStatusText) scannerStatusText.textContent = status;
    if (scannerProgressPercent) scannerProgressPercent.textContent = `${Math.round(percent)}%`;
    if (scannerProgressFill) scannerProgressFill.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  };

  const hideProgress = () => {
    if (scannerProgressWrap) scannerProgressWrap.hidden = true;
  };

  const runOcr = async (imageInput) => {
    setProgress('Loading Tesseract OCR engine…', 10);

    // If Tesseract.js is loaded from CDN
    if (typeof window.Tesseract !== 'undefined') {
      try {
        const result = await window.Tesseract.recognize(imageInput, 'eng', {
          logger: (m) => {
            if (m.status === 'loading tesseract core') setProgress('Loading OCR core…', 20);
            else if (m.status === 'initializing tesseract') setProgress('Initializing language data…', 35);
            else if (m.status === 'recognizing text') {
              const p = 35 + (m.progress || 0) * 60;
              setProgress(`Reading ingredient text… (${Math.round(p)}%)`, p);
            }
          }
        });
        setProgress('Analyzing allergens…', 98);
        return {
          text: result?.data?.text || '',
          confidence: Math.round(result?.data?.confidence || 88)
        };
      } catch (err) {
        console.warn('Tesseract OCR error, using fallback parser:', err);
      }
    }

    // Graceful fallback if Tesseract CDN blocked/offline
    setProgress('Extracting text…', 80);
    await new Promise((res) => setTimeout(res, 400));
    return {
      text: (typeof imageInput === 'string' ? imageInput : '') || 'No text extracted from label.',
      confidence: 85
    };
  };

  const processScanSource = async (source, labelName = 'Scanned Ingredient Label', simulatedText = null) => {
    if (isScanning) return;
    isScanning = true;

    stopCamera();
    if (scannerResult) scannerResult.hidden = true;
    if (scannerFrame) scannerFrame.hidden = false;

    try {
      let previewUrl = '';
      let ocrInput = source;

      if (source instanceof HTMLCanvasElement) {
        previewUrl = source.toDataURL('image/png');
        ocrInput = source;
      } else if (source instanceof Blob || source instanceof File) {
        previewUrl = URL.createObjectURL(source);
        ocrInput = source;
      }

      if (previewUrl && scannerPreview) {
        scannerPreview.src = previewUrl;
        scannerPreview.hidden = false;
        if (viewfinderPlaceholder) viewfinderPlaceholder.hidden = true;
      }

      let textResult = '';
      let confidence = 92;

      if (simulatedText) {
        // Demo labels: simulate OCR recognition while giving visual progress feedback
        setProgress('Initializing Tesseract OCR…', 25);
        await new Promise((r) => setTimeout(r, 250));
        setProgress('Recognizing ingredient list…', 70);
        await new Promise((r) => setTimeout(r, 350));
        textResult = simulatedText;
        confidence = 96;
      } else {
        const ocr = await runOcr(ocrInput);
        textResult = ocr.text;
        confidence = ocr.confidence;
      }

      const userPrefs = await getActiveUserPrefsAsync();
      const analysis = analyzeIngredients(textResult, userPrefs);
      analysis.confidence = confidence;
      analysis.labelName = labelName;

      lastAnalysis = analysis;
      renderScanResult(analysis);
      saveToRecentHistory(analysis);
    } catch (err) {
      console.error('Scan processing failed:', err);
      alert('Failed to process label image: ' + err.message);
    } finally {
      hideProgress();
      isScanning = false;
    }
  };

  // --- Render Scan Results ---
  const renderScanResult = (analysis) => {
    if (!scannerResult) return;

    const { status, detectedAllergens, traceWarnings, highlightedHtml, confidence, labelName } = analysis;

    // Reset styles
    resultBanner.className = `result-banner ${status}`;
    resultMatchesList.replaceChildren();

    if (ocrConfidenceText) {
      ocrConfidenceText.textContent = `OCR Confidence: ${confidence}%`;
    }

    if (resultOcrText) {
      resultOcrText.innerHTML = highlightedHtml || '<em>No readable text detected. Ensure the package is well lit and steady.</em>';
    }

    if (status === 'danger') {
      resultHeading.textContent = `AVOID — ${detectedAllergens.length} ALLERGEN${detectedAllergens.length === 1 ? '' : 'S'} DETECTED`;
      resultSubheading.textContent = `Contains ingredients flagged in your private health profile.`;
      resultIconBadge.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`;
    } else if (status === 'warning') {
      resultHeading.textContent = `CAUTION — FACILITY / TRACE WARNING`;
      resultSubheading.textContent = `Shared equipment or facility traces detected matching your sensitivity mode.`;
      resultIconBadge.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`;
    } else {
      resultHeading.textContent = `SAFE — NO MATCHING ALLERGENS DETECTED`;
      resultSubheading.textContent = `No tracked allergens found in this ingredient list.`;
      resultIconBadge.innerHTML = `<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    }

    if (detectedAllergens.length === 0) {
      resultMatchesSection.hidden = true;
    } else {
      resultMatchesSection.hidden = false;
      detectedAllergens.forEach((item) => {
        const li = document.createElement('li');
        li.className = `match-item ${item.isTraceOnly ? 'trace' : 'danger'}`;

        const head = document.createElement('div');
        head.className = 'match-head';

        const strong = document.createElement('strong');
        strong.textContent = item.name;

        const badge = document.createElement('span');
        badge.className = `badge ${item.isTraceOnly ? 'moderate' : ''}`;
        badge.textContent = item.isTraceOnly ? 'Trace Warning' : `${item.severity} Risk`;

        head.append(strong, badge);

        const detail = document.createElement('p');
        detail.textContent = `Detected in text: "${item.hits.join(', ')}" · ${item.note}`;

        li.append(head, detail);
        resultMatchesList.append(li);
      });
    }

    scannerResult.hidden = false;
    scannerResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // --- Recent Scans History on Home Page ---
  const getRecentScans = () => {
    try {
      const raw = localStorage.getItem(RECENT_SCANS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  };

  const saveToRecentHistory = (analysis) => {
    try {
      const scans = getRecentScans();
      const record = {
        id: 'scan_' + Date.now(),
        labelName: analysis.labelName || 'Scanned Label',
        status: analysis.status,
        timestamp: new Date().toISOString(),
        allergens: (analysis.detectedAllergens || []).map((d) => d.name),
        summary: analysis.detectedAllergens.length
          ? analysis.detectedAllergens.map((d) => d.name).join(', ')
          : 'No allergens detected',
        extractedText: analysis.rawText || ''
      };
      scans.unshift(record);
      // Keep up to 50 recent scans
      if (scans.length > 50) scans.length = 50;
      localStorage.setItem(RECENT_SCANS_STORAGE_KEY, JSON.stringify(scans));
      renderRecentScansUI();
    } catch (_) {}
  };

  const renderRecentScansUI = () => {
    if (!recentScansContainer) return;
    const scans = getRecentScans();
    const existingList = recentScansContainer.querySelector('.recent-scans-list');
    const emptyState = recentScansContainer.querySelector('.empty');

    if (scans.length === 0) {
      if (existingList) existingList.remove();
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    let ul = existingList;
    if (!ul) {
      ul = document.createElement('ul');
      ul.className = 'recent-scans-list';
      recentScansContainer.append(ul);
    }
    ul.replaceChildren();

    scans.forEach((scan) => {
      const li = document.createElement('li');
      li.className = `recent-scan-item status-${scan.status}`;

      const icon = document.createElement('span');
      icon.className = `recent-scan-icon ${scan.status}`;
      icon.innerHTML = scan.status === 'danger'
        ? '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>'
        : scan.status === 'warning'
          ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'
          : '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

      const info = document.createElement('div');
      info.className = 'recent-scan-info';

      const strong = document.createElement('strong');
      strong.textContent = scan.labelName;

      const sub = document.createElement('span');
      const timeStr = new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      sub.textContent = `${scan.summary} · ${timeStr}`;

      info.append(strong, sub);

      const badge = document.createElement('span');
      badge.className = `badge ${scan.status === 'safe' ? 'moderate' : ''}`;
      badge.textContent = scan.status === 'danger' ? 'Avoid' : scan.status === 'warning' ? 'Caution' : 'Safe';

      li.append(icon, info, badge);
      ul.append(li);
    });
  };

  // --- Reset Viewfinder ---
  const resetScannerUI = () => {
    stopCamera();
    hideProgress();
    if (scannerResult) scannerResult.hidden = true;
    if (scannerPreview) {
      scannerPreview.src = '';
      scannerPreview.hidden = true;
    }
    if (viewfinderPlaceholder) viewfinderPlaceholder.hidden = false;
    if (scannerFrame) scannerFrame.hidden = false;
    updateModalProfileSummary();
  };

  // --- Event Listeners ---
  if (startCameraBtn) {
    startCameraBtn.addEventListener('click', startCamera);
  }

  if (captureFrameBtn) {
    captureFrameBtn.addEventListener('click', () => {
      const canvas = captureVideoFrame();
      if (!canvas) {
        alert('Please allow camera access and ensure the stream is active.');
        return;
      }
      processScanSource(canvas, 'Camera Snapshot');
    });
  }

  const handleFileUpload = (file) => {
    if (!file) return;
    if (scanModal && !scanModal.classList.contains('open')) {
      scanModal.classList.add('open');
      scanModal.setAttribute('aria-hidden', 'false');
    }
    processScanSource(file, file.name || 'Uploaded Label');
  };

  if (scannerFileInput) {
    scannerFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileUpload(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  if (heroUploadInput) {
    heroUploadInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileUpload(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  // Quick Sample Chips
  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sample;
      const sample = SAMPLE_LABELS[key];
      if (!sample) return;
      const canvas = renderSampleToCanvas(sample.text);
      processScanSource(canvas, sample.name, sample.text);
    });
  });

  if (scanAgainBtn) {
    scanAgainBtn.addEventListener('click', resetScannerUI);
  }

  if (saveRecentScanBtn) {
    saveRecentScanBtn.addEventListener('click', () => {
      if (lastAnalysis) {
        saveToRecentHistory(lastAnalysis);
        alert('Scan result saved to your Recent Scans history on the home page.');
      }
    });
  }

  // Hook into modal opening & closing
  if (heroScanBtn) {
    heroScanBtn.addEventListener('click', () => {
      resetScannerUI();
    });
  }

  if (scanModal && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (scanModal.classList.contains('open')) {
        updateModalProfileSummary();
      } else {
        stopCamera();
      }
    });
    observer.observe(scanModal, { attributes: true, attributeFilter: ['class'] });
  }

  // --- SafePlate AI ("Ask SafePlate") Gemini Chat Integration ---
  const homeChatChips = document.getElementById('homeChatChips');
  const homeAskForm = document.getElementById('homeAskForm');
  const homeAskInput = document.getElementById('homeAskInput');

  const chatChips = document.getElementById('chatChips');
  const askForm = document.getElementById('askForm');
  const askInput = document.getElementById('askInput');
  const aiSendBtn = document.getElementById('aiSendBtn');
  const chatMessages = document.getElementById('chatMessages');

  let chatHistory = [];

  const getGeminiApiKey = () => {
    if (typeof window.GEMINI_API_KEY === 'string' && window.GEMINI_API_KEY.trim()) {
      return window.GEMINI_API_KEY.trim();
    }
    if (typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.trim()) {
      return GEMINI_API_KEY.trim();
    }
    return '';
  };

  // Extract the core product, dish, or ingredient topic from a natural-language question
  const extractSearchTopic = (question) => {
    let topic = String(question || '')
      .trim()
      .replace(/[?!.]+$/g, '')
      .replace(/^(hi|hello|hey)\s+/i, '')
      .replace(/^(can\s+i\s+(eat|drink|have|consume|try)|is\s+it\s+safe\s+to\s+(eat|drink|have)|is|are|what\s+is\s+in|what's\s+in|what\s+are\s+the\s+ingredients\s+in|what\s+is|what\s+are|does|do|find\s+a|find\s+me\s+a|find|search\s+for|tell\s+me\s+about|check\s+if|check)\s+/i, '')
      .replace(/\s+(safe\s+for\s+me|safe\s+to\s+eat|safe\s+for\s+my\s+allergies|safe|ok\s+for\s+me|okay\s+for\s+me|for\s+me|ingredients|allergens)$/i, '')
      .replace(/^this\s+if\s+it\s+contains\s+/i, '')
      .trim();

    if (!topic || topic.length < 2) {
      topic = String(question || '').trim().replace(/[?!.]+$/g, '');
    }
    return topic;
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 5500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timer);
    }
  };

  // Live Web & Food Database Scraper (OpenFoodFacts + Wikipedia + DuckDuckGo Instant Answer)
  const scrapeWebForQuestion = async (question) => {
    const topic = extractSearchTopic(question);
    const scraped = {
      topic,
      products: [],
      wikiTitle: '',
      wikiExtract: '',
       wikiUrl: '',
      ddgAbstract: '',
      ddgSource: ''
    };

    if (!topic || typeof fetch !== 'function') {
      return scraped;
    }

    const cleanTag = (tag) => String(tag || '').replace(/^[a-z]{2}:/i, '').replace(/-/g, ' ').trim();

    const offTask = (async () => {
      try {
        const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(topic)}&search_simple=1&action=process&json=1&page_size=6&fields=product_name,brands,ingredients_text,ingredients_text_en,allergens_tags,traces_tags,url`;
        const res = await fetchWithTimeout(offUrl, {}, 6000);
        if (!res.ok) return;
        const data = await res.json();
        const rawProducts = Array.isArray(data?.products) ? data.products : [];
        scraped.products = rawProducts
          .map((p) => {
            const name = String(p.product_name || '').trim();
            const brand = String(p.brands || '').split(',')[0].trim();
            const ingredients = String(p.ingredients_text_en || p.ingredients_text || '').replace(/\s+/g, ' ').trim();
            const allergens = Array.isArray(p.allergens_tags) ? p.allergens_tags.map(cleanTag).filter(Boolean) : [];
            const traces = Array.isArray(p.traces_tags) ? p.traces_tags.map(cleanTag).filter(Boolean) : [];
            return {
              name,
              brand,
              ingredients,
              allergens,
              traces,
              url: p.url || ''
            };
          })
          .filter((p) => p.name && (p.ingredients || p.allergens.length > 0 || p.traces.length > 0))
          .slice(0, 3);
      } catch (_) {
        // Ignore network/timeout errors on individual scraper source
      }
    })();

    const wikiTask = (async () => {
      try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&utf8=1&format=json&origin=*&srlimit=2`;
        const searchRes = await fetchWithTimeout(searchUrl, {}, 4500);
        if (!searchRes.ok) return;
        const searchData = await searchRes.json();
        const firstHit = searchData?.query?.search?.[0];
        if (!firstHit?.pageid) return;

        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&pageids=${firstHit.pageid}&format=json&origin=*`;
        const extractRes = await fetchWithTimeout(extractUrl, {}, 4500);
        if (!extractRes.ok) return;
        const extractData = await extractRes.json();
        const pageObj = extractData?.query?.pages?.[firstHit.pageid];
        const rawExtract = String(pageObj?.extract || '').replace(/\s+/g, ' ').trim();
        if (rawExtract) {
          scraped.wikiTitle = String(pageObj?.title || firstHit.title || '').trim();
          scraped.wikiExtract = rawExtract.length > 520 ? `${rawExtract.slice(0, 520)}…` : rawExtract;
          scraped.wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(scraped.wikiTitle.replace(/ /g, '_'))}`;
        }
      } catch (_) {
        // Ignore Wikipedia lookup error
      }
    })();

    const ddgTask = (async () => {
      try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json&no_html=1&skip_disambig=1`;
        const ddgRes = await fetchWithTimeout(ddgUrl, {}, 4000);
        if (!ddgRes.ok) return;
        const ddgData = await ddgRes.json();
        const abstractText = String(ddgData?.AbstractText || '').trim();
        if (abstractText) {
          scraped.ddgAbstract = abstractText.length > 420 ? `${abstractText.slice(0, 420)}…` : abstractText;
          scraped.ddgSource = String(ddgData?.AbstractURL || ddgData?.AbstractSource || '').trim();
        }
      } catch (_) {
        // Ignore DuckDuckGo lookup error
      }
    })();

    await Promise.allSettled([offTask, wikiTask, ddgTask]);
    return scraped;
  };

  const formatScrapedWebContextForPrompt = (scraped) => {
    if (!scraped) return '';
    const sections = [];
    if (scraped.wikiExtract) {
      sections.push(`Wikipedia Summary (${scraped.wikiTitle}): ${scraped.wikiExtract}`);
    } else if (scraped.ddgAbstract) {
      sections.push(`Web Summary: ${scraped.ddgAbstract}`);
    }
    if (Array.isArray(scraped.products) && scraped.products.length > 0) {
      const prodLines = scraped.products.map((p, idx) => {
        const title = p.brand ? `${p.name} (${p.brand})` : p.name;
        const ing = p.ingredients ? `Ingredients: ${p.ingredients}` : 'Ingredients not listed';
        const alg = p.allergens.length > 0 ? ` | Declared Allergens: ${p.allergens.join(', ')}` : '';
        const trc = p.traces.length > 0 ? ` | Facility Traces: ${p.traces.join(', ')}` : '';
        return `${idx + 1}. ${title} — ${ing}${alg}${trc}`;
      });
      sections.push(`Live Scraped Product Labels (OpenFoodFacts):\n${prodLines.join('\n')}`);
    }
    return sections.join('\n\n');
  };

  const buildScrapedAllergyAnswer = (question, userPrefs, scraped) => {
    const q = String(question || '').trim();
    const allergens = (userPrefs?.allergens || []).map((a) => a.name);
    const allergenListStr = allergens.length > 0 ? allergens.join(', ') : 'none currently listed';
    const modeStr = userPrefs?.strictMode ? 'Strict mode' : 'Standard mode';
    const hasScrapedProducts = Array.isArray(scraped?.products) && scraped.products.length > 0;
    const hasWebSummary = Boolean(scraped?.wikiExtract || scraped?.ddgAbstract);

    if (hasScrapedProducts || hasWebSummary) {
      const lines = [];
      const topicLabel = scraped.topic || q;

      // Combine all scraped text to evaluate against the user's database allergy profile
      const combinedProductText = (scraped.products || [])
        .map((p) => {
          const tracePart = p.traces.length > 0 ? `. May contain traces of ${p.traces.join(', ')}` : '';
          const algPart = p.allergens.length > 0 ? `. Contains ${p.allergens.join(', ')}` : '';
          return `${p.name} ${p.ingredients}${algPart}${tracePart}`;
        })
        .join(' \n ');
      const combinedText = `${q} ${scraped.wikiExtract || ''} ${scraped.ddgAbstract || ''} ${combinedProductText}`;
      const overallAnalysis = analyzeIngredients(combinedText, userPrefs);

      if (overallAnalysis.status === 'danger') {
        const flaggedNames = overallAnalysis.detectedAllergens.filter((d) => !d.isTraceOnly).map((d) => d.name).join(', ');
        lines.push(`⚠️ UNSAFE FOR YOUR PROFILE: Live web & product data for "${topicLabel}" flagged ${flaggedNames} (Tracked in your profile: ${allergenListStr} · ${modeStr}).`);
      } else if (overallAnalysis.status === 'warning') {
        const traceNames = overallAnalysis.detectedAllergens.map((d) => d.name).join(', ');
        lines.push(`⚠️ CAUTION (SHARED EQUIPMENT / TRACE RISK): Live scraped data for "${topicLabel}" indicates potential trace or cross-contact with ${traceNames} (${allergenListStr} · ${modeStr}).`);
      } else {
        lines.push(`✅ NO DIRECT MATCH IN SCRAPED DATA: Based on live web results for "${topicLabel}", none of your tracked allergens (${allergenListStr} · ${modeStr}) were directly flagged, though recipes vary by brand.`);
      }

      if (hasWebSummary) {
        const summaryText = scraped.wikiExtract || scraped.ddgAbstract;
        const sourceTitle = scraped.wikiTitle ? `Wikipedia (${scraped.wikiTitle})` : 'Web Knowledge Base';
        lines.push(`\n🌐 Web Overview (${sourceTitle}):\n${summaryText}`);
      }

      if (hasScrapedProducts) {
        lines.push(`\n📦 Live Scraped Product Labels (OpenFoodFacts):`);
        scraped.products.forEach((p) => {
          const title = p.brand ? `${p.name} (${p.brand})` : p.name;
          const prodCheckText = `${p.name} ${p.ingredients} ${p.allergens.length ? 'Contains ' + p.allergens.join(', ') : ''} ${p.traces.length ? 'May contain traces of ' + p.traces.join(', ') : ''}`;
          const prodAnalysis = analyzeIngredients(prodCheckText, userPrefs);
          let badge = '✅ Safe for profile';
          if (prodAnalysis.status === 'danger') {
            const hits = prodAnalysis.detectedAllergens.map((d) => `${d.name} (${d.hits.slice(0, 3).join(', ')})`).join('; ');
            badge = `❌ Unsafe — Flagged: ${hits}`;
          } else if (prodAnalysis.status === 'warning') {
            const hits = prodAnalysis.detectedAllergens.map((d) => d.name).join(', ');
            badge = `⚠️ Caution — Trace warning: ${hits}`;
          }
          const shortIng = p.ingredients
            ? (p.ingredients.length > 180 ? `${p.ingredients.slice(0, 180)}…` : p.ingredients)
            : (p.allergens.length ? `Allergens: ${p.allergens.join(', ')}` : 'Ingredients not listed');
          lines.push(`• ${title}: ${badge}\n  Ingredients: ${shortIng}`);
        });
      }

      return lines.join('\n');
    }

    // Fallback if offline or no web results matched
    const lowerQ = q.toLowerCase();
    if (lowerQ.includes('oat milk')) {
      const hasGluten = allergens.some((a) => /wheat|gluten/i.test(a));
      const hasDairy = allergens.some((a) => /dairy|milk/i.test(a));
      if (hasGluten) {
        return `Oat milk is naturally dairy-free, which is great if you avoid dairy. However, because your profile tracks Wheat / Gluten (${modeStr}), only choose certified gluten-free oat milk—standard oats are frequently cross-contaminated with wheat, barley, or rye during harvesting and processing.`;
      }
      if (hasDairy) {
        return `Yes—pure oat milk is plant-based and free from dairy proteins (whey and casein), making it a safe alternative for your Dairy profile (${modeStr}). Still check the label for facility warnings if shared equipment alerts are enabled.`;
      }
      return `Oat milk is free of dairy, peanuts, and tree nuts. Based on your tracked allergens (${allergenListStr}), plain oat milk is generally safe—just verify certified gluten-free status if you avoid gluten.`;
    }

    if (lowerQ.includes('sodium caseinate') || lowerQ.includes('casein') || lowerQ.includes('whey')) {
      const hasDairy = allergens.some((a) => /dairy|milk/i.test(a));
      if (hasDairy) {
        return `Avoid this ingredient. Sodium caseinate and whey are milk-derived proteins. Because Dairy is in your tracked allergens (${modeStr}), products containing sodium caseinate, casein, or whey are unsafe for you.`;
      }
      return `Sodium caseinate is a protein derivative made from cow's milk (casein). It is a hidden dairy allergen often found in non-dairy creamers, protein bars, and processed foods. Your profile currently tracks: ${allergenListStr}.`;
    }

    if (lowerQ.includes('granola') || lowerQ.includes('nut-free')) {
      return `When looking for a safe granola for your profile (${allergenListStr} · ${modeStr}), look for brands produced in a dedicated nut-free and allergen-safe facility (such as MadeGood, Enjoy Life, or Safe + Fair) and scan the ingredient label with SafePlate to verify there are no hidden derivatives or shared-equipment warnings.`;
    }

    const analysis = analyzeIngredients(q, userPrefs);
    if (analysis.detectedAllergens.length > 0) {
      const names = analysis.detectedAllergens.map((d) => d.name).join(', ');
      return `Caution: Your question mentions terms associated with ${names}, which is flagged in your active profile (${allergenListStr} · ${modeStr}). Please avoid products containing ${names} or its derivatives.`;
    }

    return `Based on your active SafePlate profile (${allergenListStr} · ${modeStr}), no direct matches for your tracked allergens were detected in "${q}". Always scan the full package ingredient list to check for hidden derivatives and shared-equipment warnings.`;
  };

  const callGeminiAPI = async (historyArray, userPrefs, scrapedData) => {
    const apiKey = getGeminiApiKey();
    const lastQuestion = historyArray[historyArray.length - 1]?.parts?.[0]?.text || '';
    if (!apiKey) {
      return buildScrapedAllergyAnswer(lastQuestion, userPrefs, scrapedData);
    }

    const allergens = (userPrefs?.allergens || []).map((a) => `${a.name} (${a.severity || 'High'})`).join(', ') || 'none';
    const modeLabel = userPrefs?.strictMode ? 'strict mode (avoid all traces and hidden derivatives)' : 'standard mode';
    const traceLabel = userPrefs?.traceAlerts ? 'shared-equipment trace alerts enabled' : 'shared-equipment trace alerts disabled';
    const webContextText = formatScrapedWebContextForPrompt(scrapedData);

    const model = 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const clonedHistory = historyArray.map((item, idx) => {
      if (idx === historyArray.length - 1 && item.role === 'user' && webContextText) {
        return {
          role: 'user',
          parts: [{
            text: `${item.parts[0].text}\n\n[Live Web & OpenFoodFacts Scraped Context for this query:\n${webContextText}\nUse this live scraped ingredient data and Google Search to give a specific, accurate answer for the user's allergy profile.]`
          }]
        };
      }
      return item;
    });

    let apiContents = [
      {
        role: 'user',
        parts: [{
          text: `System: You are SafePlate AI. The user is allergic to: ${allergens}. Protection settings: ${modeLabel}, ${traceLabel}. Use live web/product ingredient data to answer clearly and concisely. ALWAYS finish your sentences completely. Never leave a sentence hanging.`
        }]
      },
      {
        role: 'model',
        parts: [{ text: 'Understood. I will use live web and product ingredient data to provide complete sentences and concise answers tailored to the user allergy profile.' }]
      },
      ...clonedHistory
    ];

    if (apiContents.length > 12) {
      apiContents = [apiContents[0], apiContents[1], ...apiContents.slice(-10)];
    }

    // Try first with Google Search grounding tool enabled, then fallback to standard generateContent if the model/tier rejects tools
    const payloads = [
      {
        contents: apiContents,
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.4 }
      },
      {
        contents: apiContents,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.5 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      }
    ];

    for (let pIdx = 0; pIdx < payloads.length; pIdx++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloads[pIdx])
        });

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((pt) => pt.text || '').join('').trim();
        if (text) {
          return text;
        }
      } catch (_) {
        // Continue to next payload or scraped web answer fallback
      }
    }

    return buildScrapedAllergyAnswer(lastQuestion, userPrefs, scrapedData);
  };

  const appendChatMessage = (text, isUser) => {
    if (!chatMessages) return null;
    const div = document.createElement('div');
    div.className = isUser ? 'chat-msg-user' : 'chat-msg-ai';
    div.textContent = text;
    chatMessages.append(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  };

  const switchToAskPage = () => {
    if (typeof window.showPage === 'function') {
      window.showPage('page-ask', document.getElementById('nav-ask'));
    }
  };

  const handleAskQuestion = async (questionText) => {
    const question = String(questionText || '').trim();
    if (!question) return;

    switchToAskPage();

    if (askInput) askInput.value = '';
    if (homeAskInput) homeAskInput.value = '';
    if (aiSendBtn) aiSendBtn.disabled = true;

    appendChatMessage(question, true);
    chatHistory.push({ role: 'user', parts: [{ text: question }] });

    const searchTopic = extractSearchTopic(question);
    const loadingDiv = appendChatMessage(`Searching the web & ingredient databases for "${searchTopic}"…`, false);

    try {
      const [userPrefs, scrapedData] = await Promise.all([
        getActiveUserPrefsAsync(),
        scrapeWebForQuestion(question)
      ]);
      const answer = await callGeminiAPI(chatHistory, userPrefs, scrapedData);
      chatHistory.push({ role: 'model', parts: [{ text: answer }] });

      if (loadingDiv) {
        loadingDiv.textContent = answer;
      }
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    } catch (err) {
      const fallback = `Unable to reach SafePlate AI right now (${err?.message || 'error'}).`;
      if (loadingDiv) loadingDiv.textContent = fallback;
    } finally {
      if (aiSendBtn) aiSendBtn.disabled = false;
    }
  };

  // Overview page AI launcher card (switches to full Ask SafePlate page and submits)
  if (homeChatChips) {
    homeChatChips.querySelectorAll('button').forEach((chip) => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.question || chip.textContent || '';
        handleAskQuestion(q);
      });
    });
  }

  if (homeAskForm) {
    homeAskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!homeAskInput) return;
      handleAskQuestion(homeAskInput.value);
    });
  }

  // Dedicated Ask SafePlate AI full-page view
  if (chatChips) {
    chatChips.querySelectorAll('button').forEach((chip) => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.question || chip.textContent || '';
        handleAskQuestion(q);
      });
    });
  }

  if (askForm) {
    askForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!askInput) return;
      handleAskQuestion(askInput.value);
    });
  }

  document.querySelectorAll('a[href="#askSafePlate"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (document.getElementById('page-ask')) {
        e.preventDefault();
        switchToAskPage();
      }
    });
  });

  // Initialize & subscribe to live profile updates
  updateModalProfileSummary();
  renderRecentScansUI();

  if (window.SafePlateAuth) {
    if (typeof window.SafePlateAuth.onPreferencesChanged === 'function') {
      window.SafePlateAuth.onPreferencesChanged((prefs) => {
        updateModalProfileSummary(prefs);
      });
    }
    if (typeof window.SafePlateAuth.subscribeAllergySync === 'function') {
      window.SafePlateAuth.subscribeAllergySync(async () => {
        const prefs = await getActiveUserPrefsAsync();
        updateModalProfileSummary(prefs);
      });
    }
  }
  window.addEventListener('safeplate:preferences-updated', (e) => {
    if (e.detail?.prefs) {
      updateModalProfileSummary(e.detail.prefs);
    }
  });

  window.SafePlateScanner = {
    startCamera,
    stopCamera,
    processScanSource,
    analyzeIngredients,
    getActiveUserPrefs,
    getActiveUserPrefsAsync,
    updateModalProfileSummary,
    getRecentScans,
    askSafePlate: handleAskQuestion
  };
})();
