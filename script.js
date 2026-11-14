// ==========================================
// 0. STATE & CONFIG
// ==========================================
let userAllergies = JSON.parse(localStorage.getItem('safePlateAllergies')) || ["peanut", "milk"];

// ==========================================
// 1. NOTIFICATION SYSTEM
// ==========================================
const notifBtn = document.getElementById('notifBtn');
const notifDropdown = document.getElementById('notifDropdown');
const notifList = document.getElementById('notifList');
const markAllReadBtn = document.getElementById('markAllReadBtn');
const notifRedDot = document.getElementById('notifRedDot');

let notifications = JSON.parse(localStorage.getItem('safePlateNotifications')) || [
    { id: 1, title: "Welcome to SafePlate!", desc: "Update your allergy profile to get personalized scans.", read: false },
    { id: 2, title: "New AI Engine Active", desc: "We've upgraded to Gemini 3.5 for faster results.", read: false },
    { id: 3, title: "Tip of the Day", desc: "Always check for 'may contain traces' warnings.", read: true }
];

function saveNotifications() {
    localStorage.setItem('safePlateNotifications', JSON.stringify(notifications));
    renderNotifications();
}

function renderNotifications() {
    if (!notifList) return;
    if (notifications.length === 0) {
        notifList.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--ink-soft); font-size: 14px;">No notifications.</div>`;
        if (notifRedDot) notifRedDot.style.display = 'none';
        return;
    }

    let html = '';
    notifications.forEach(n => {
        const bgColor = n.read ? '#fff' : '#f0f7ff';
        const dot = n.read ? '' : '<span style="display:inline-block; width:8px; height:8px; background:#c8473f; border-radius:50%; margin-right:8px;"></span>';
        html += `
            <div style="display: flex; justify-content: space-between; padding: 15px; border-bottom: 1px solid var(--line); background: ${bgColor}; transition: background 0.2s;">
                <div style="cursor: pointer; flex: 1;" onclick="markAsRead(${n.id})">
                    <strong style="display: block; margin-bottom: 5px; font-size: 14px; color: var(--ink);">${dot}${n.title}</strong>
                    <span style="color: var(--ink-soft); font-size: 13px; line-height: 1.4; display: block;">${n.desc}</span>
                </div>
                <button onclick="deleteNotification(${n.id})" style="background: none; border: none; color: #999; font-size: 18px; cursor: pointer; padding: 0 5px; display: flex; align-items: flex-start;" title="Delete">&times;</button>
            </div>
        `;
    });
    notifList.innerHTML = html;
    const hasUnread = notifications.some(n => !n.read);
    if (notifRedDot) notifRedDot.style.display = hasUnread ? 'block' : 'none';
}

window.markAsRead = function(id) {
    const notif = notifications.find(n => n.id === id);
    if (notif) { notif.read = true; saveNotifications(); }
};

window.deleteNotification = function(id) {
    notifications = notifications.filter(n => n.id !== id);
    saveNotifications();
};

if(markAllReadBtn) {
    markAllReadBtn.addEventListener('click', () => {
        notifications.forEach(n => n.read = true);
        saveNotifications();
    });
}

if(notifBtn) {
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        notifDropdown.style.display = notifDropdown.style.display === 'none' ? 'block' : 'none';
    });
}

document.addEventListener('click', (e) => {
    if (notifBtn && !notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
        notifDropdown.style.display = 'none';
    }
});

// ==========================================
// 2. SETTINGS & PROFILE LOGIC
// ==========================================
const settingsForm = document.getElementById('settingsForm');
const allergyChecks = document.querySelectorAll('.allergy-check');
const overviewProtectedText = document.getElementById('overviewProtectedText');
const allergyDisplayList = document.getElementById('allergyDisplayList');

function renderAllergies() {
    if(!overviewProtectedText) return;
    overviewProtectedText.innerText = `${userAllergies.length} allergens · strict mode`;
    let html = '';
    userAllergies.forEach(allergy => {
        let label = allergy.charAt(0).toUpperCase() + allergy.slice(1);
        let iconClass = allergy === 'peanut' ? 'red' : 'violet';
        html += `
        <li>
          <span class="a-icon ${iconClass}"><svg viewBox="0 0 24 24"><path d="M12 3c-3 0-5 2-5 4.5 0 1 .4 1.800 1 2.500-1.500.800-2.500 2.200-2.500 4 0 2.800 2.500 5 5.500 5s5.500-2.200 5.500-5c0-1.800-1-3.200-2.500-4 .6-.7 1-1.500 1-2.500C17 5 15 3 12 3z"/></svg></span>
          <div><strong>${label}</strong><span>Avoid all traces</span></div>
          <em class="badge">High</em>
        </li>`;
    });
    if (userAllergies.length === 0) html = `<li style="padding: 10px; color: var(--ink-soft);">No allergies selected.</li>`;
    allergyDisplayList.innerHTML = html;
    allergyChecks.forEach(check => { check.checked = userAllergies.includes(check.value); });
}

if(settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        userAllergies = Array.from(allergyChecks).filter(c => c.checked).map(c => c.value);
        localStorage.setItem('safePlateAllergies', JSON.stringify(userAllergies));
        renderAllergies();
        document.querySelectorAll('.overlay.open').forEach(m => {
            m.classList.remove('open'); m.setAttribute('aria-hidden', 'true');
        });
    });
}

// ==========================================
// 3. TRIGGER BUTTONS FROM HOMEPAGE
// ==========================================
function triggerBarcodeScan() {
    showPage('page-scanner', document.getElementById('nav-scanner'));
    setTimeout(() => { startBarcodeScanner(); }, 300);
}

function triggerCameraOpen() {
    showPage('page-scanner', document.getElementById('nav-scanner'));
    setTimeout(() => { startCamera(); }, 300);
}

// ==========================================
// 4. LIVE CAMERA & IMAGE PROCESSING
// ==========================================
let videoStream = null;
const video = document.getElementById('cameraFeed');
const cameraContainer = document.getElementById('cameraContainer');
const scannerChoices = document.getElementById('scannerChoices');
const resultContainer = document.getElementById('resultContainer');
const resultTitle = document.getElementById('resultTitle');
const resultExplanation = document.getElementById('resultExplanation');

async function startCamera() {
    scannerChoices.style.display = 'none';
    resultContainer.style.display = 'none';
    cameraContainer.style.display = 'block';

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = videoStream;
    } catch (err) {
        alert("Camera access denied or not available. Please ensure you are using Live Server (localhost).");
        stopCamera();
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    if(cameraContainer) cameraContainer.style.display = 'none';
    if(scannerChoices) scannerChoices.style.display = 'grid';
}

if(document.getElementById('captureBtn')) {
    document.getElementById('captureBtn').addEventListener('click', async () => {
        if (!videoStream) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        stopCamera();
        processImage(imageDataUrl);
    });
}

// FILE UPLOAD LOGIC
const fileUploadInput = document.getElementById('fileUploadInput');
if(fileUploadInput) {
    fileUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        scannerChoices.style.display = 'none';
        resultContainer.style.display = 'none';
        
        const reader = new FileReader();
        reader.onload = function(event) {
            processImage(event.target.result);
        };
        reader.readAsDataURL(file);
    });
}

async function processImage(imageSource) {
    updateUI('loading', "Reading Label...", "var(--ink)", "Tesseract is extracting text. Please wait.");
    try {
        const result = await Tesseract.recognize(imageSource, 'eng');
        const extractedText = result.data.text.replace(/(\r\n|\n|\r)/gm, " ").trim();
        if (extractedText.length < 5) {
            updateUI('error', "Unreadable Label", "var(--red)", "We couldn't read any text from this image. Please ensure the ingredient list is clear and well-lit.");
            return;
        }
        updateUI('loading', "Analyzing with AI...", "var(--ink)", "Gemini is checking for hidden allergens.");
        const aiResponse = await askGeminiForLabel(extractedText);
        if (aiResponse.includes("[ERROR]")) {
            updateUI('error', "AI Error", "var(--red)", aiResponse);
            return;
        }
        processResult(aiResponse);
    } catch (error) {
        updateUI('error', "System Error", "var(--red)", error.message);
    }
}

// ==========================================
// 5. BARCODE SCANNER (ANIMATION)
// ==========================================
function startBarcodeScanner() {
    document.getElementById('barcodeModal').classList.add('open');
    setTimeout(async () => {
        document.getElementById('barcodeModal').classList.remove('open');
        const simulatedBarcode = "Product Code: 0123456789 (Chocolate Chip Cookies)";
        updateUI('loading', "Analyzing Product...", "var(--ink)", "Fetching ingredients from database and checking with AI.");
        const aiResponse = await askGeminiForLabel(simulatedBarcode);
        processResult(aiResponse);
    }, 3000); 
}

// ==========================================
// 6. UI & API LOGIC FOR SCANNER
// ==========================================
function updateUI(status, title, color, explanation) {
    if(!resultContainer) return;
    resultContainer.style.display = 'block';
    resultTitle.innerText = title;
    resultTitle.style.color = color;
    resultExplanation.innerText = explanation;
    if (status === 'loading') resultContainer.style.backgroundColor = "#f1eee7";
    else if (status === 'safe') resultContainer.style.backgroundColor = "#e8f8f5";
    else if (status === 'caution') resultContainer.style.backgroundColor = "#fef9e7";
    else if (status === 'unsafe' || status === 'error') resultContainer.style.backgroundColor = "#f9ebea";
}

function processResult(aiResponse) {
    const lowerText = aiResponse.toLowerCase();
    let statusType = 'unsafe';
    let displayTitle = "❌ UNSAFE";
    let displayColor = "var(--red)";

    if (lowerText.includes("[safe]")) { statusType = 'safe'; displayTitle = "✅ SAFE TO EAT"; displayColor = "#6bb046"; }
    else if (lowerText.includes("[caution]")) { statusType = 'caution'; displayTitle = "⚠️ CAUTION"; displayColor = "#f39c12"; }

    const cleanExplanation = aiResponse.replace(/\[.*?\]/g, "").trim();
    updateUI(statusType, displayTitle, displayColor, cleanExplanation);
    saveToHistory(displayTitle, cleanExplanation);
}

async function askGeminiForLabel(inputData) {
    const prompt = `
    You are a strict food safety AI. 
    The user is allergic to: ${userAllergies.join(", ") || "none"}.
    Here is the ingredient list or product data: "${inputData}".
    Analyze carefully. Watch out for scientific names (e.g., arachis hypogaea = peanut, whey = milk).
    Reply with EXACTLY one of these three verdicts at the start: [SAFE], [CAUTION], or [UNSAFE].
    Then, give a short and COMPLETE 2-sentence explanation. Do not leave sentences unfinished. Do not use markdown.
    `;
    return await callGeminiAPI([{ role: "user", parts: [{ text: prompt }] }]);
}

// ==========================================
// 7. CHAT LOGIC
// ==========================================
const homeAskForm = document.getElementById('homeAskForm');
const homeAskInput = document.getElementById('homeAskInput');
const homeChatChips = document.querySelectorAll('#homeChatChips button');
const askForm = document.getElementById('askForm');
const askInput = document.getElementById('askInput');
const chatMessages = document.getElementById('chatMessages');

let chatHistory = []; 

if(homeChatChips.length > 0) {
    homeChatChips.forEach(chip => {
        chip.addEventListener('click', () => {
            homeAskInput.value = chip.innerText;
            homeAskForm.dispatchEvent(new Event('submit')); 
        });
    });
}

const chatChips = document.querySelectorAll('#chatChips button');
if(chatChips.length > 0) {
    chatChips.forEach(chip => {
        chip.addEventListener('click', () => {
            askInput.value = chip.innerText;
            askForm.dispatchEvent(new Event('submit')); 
        });
    });
}

if(homeAskForm) {
    homeAskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = homeAskInput.value.trim();
        if(!q) return;
        showPage('page-ask', document.getElementById('nav-ask'));
        askInput.value = q;
        askForm.dispatchEvent(new Event('submit'));
        homeAskInput.value = '';
    });
}

function appendMessage(text, isUser) {
    if(!chatMessages) return;
    const div = document.createElement('div');
    div.className = isUser ? 'chat-msg-user' : 'chat-msg-ai';
    div.innerText = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
}

if(askForm) {
    askForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const question = askInput.value.trim();
        if (!question) return;

        const sendBtn = askForm.querySelector('.send');
        sendBtn.disabled = true; 
        sendBtn.style.opacity = "0.5";

        appendMessage(question, true);
        askInput.value = "";
        
        chatHistory.push({ role: "user", parts: [{ text: question }] });

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-msg-ai';
        loadingDiv.innerText = "Thinking...";
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const answer = await callGeminiAPI(chatHistory);
            chatHistory.push({ role: "model", parts: [{ text: answer }] });

            chatMessages.removeChild(loadingDiv);
            appendMessage(answer, false);

        } catch (error) {
            chatMessages.removeChild(loadingDiv);
            appendMessage(`Error: ${error.message}`, false);
        } finally {
            sendBtn.disabled = false;
            sendBtn.style.opacity = "1";
        }
    });
}

// ==========================================
// 8. GEMINI API CORE
// ==========================================
async function callGeminiAPI(historyArray) {
    const model = "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    let apiContents = [
        { role: "user", parts: [{ text: `System: You are SafePlate AI. The user is allergic to ${userAllergies.join(", ") || "none"}. Answer clearly and concisely. ALWAYS finish your sentences completely. Never leave a sentence hanging.` }] },
        { role: "model", parts: [{ text: "Understood. I will always provide complete sentences and concise answers." }] }
    ];
    
    apiContents = apiContents.concat(historyArray);

    if (apiContents.length > 12) {
        apiContents = [apiContents[0], apiContents[1], ...apiContents.slice(-10)];
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: apiContents,
                    generationConfig: { 
                        maxOutputTokens: 2048, 
                        temperature: 0.5 
                    },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                })
            });

            const data = await response.json();

            if (data.candidates && data.candidates[0].content.parts[0].text) {
                return data.candidates[0].content.parts[0].text;
            }
            
            if (data.error) {
                if (data.error.code === 503) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    continue; 
                } else {
                    return `[ERROR] ${data.error.message}`;
                }
            }
        } catch (error) {
            return `[ERROR] Network issue. Please check your internet connection.`;
        }
    }
    return `[ERROR] The AI is currently very busy. Please try again in a few minutes.`;
}

// ==========================================
// 9. HISTORY LOGIC
// ==========================================
function saveToHistory(title, explanation) {
    let history = JSON.parse(localStorage.getItem('safePlateHistory')) || [];
    const newScan = { title: title, explanation: explanation, date: new Date().toLocaleString() };
    history.unshift(newScan); 
    if (history.length > 10) history.pop(); 
    localStorage.setItem('safePlateHistory', JSON.stringify(history));
    updateRecentScansUI(history[0]);
}

function updateRecentScansUI(latestScan) {
    const container = document.getElementById('recentScanContainer');
    if (!container) return;
    let shortDesc = latestScan.explanation;
    if (shortDesc.length > 50) shortDesc = shortDesc.substring(0, 50) + "...";
    container.innerHTML = `
        <span class="empty-icon" style="background: ${latestScan.title.includes('SAFE') ? '#d4edda' : latestScan.title.includes('CAUTION') ? '#fff3cd' : '#f8d7da'}">
            <svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8"/></svg>
        </span>
        <div>
            <strong style="color: ${latestScan.title.includes('SAFE') ? 'green' : latestScan.title.includes('CAUTION') ? 'orange' : 'red'};">${latestScan.title}</strong>
            <span style="display: block; font-size: 13px;">${shortDesc}</span>
        </div>
    `;
}

function loadHistoryUI() {
    const historyContainer = document.getElementById('historyContainer');
    if (!historyContainer) return;
    let history = JSON.parse(localStorage.getItem('safePlateHistory')) || [];
    if (history.length === 0) {
        historyContainer.innerHTML = `<p style="padding: 20px; text-align: center;">No scans yet.</p>`;
        return;
    }
    let html = '';
    history.forEach(scan => {
        let color = scan.title.includes('SAFE') ? 'green' : scan.title.includes('CAUTION') ? 'orange' : 'red';
        html += `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-title" style="color: ${color};">${scan.title}</span>
                    <span class="history-date">${scan.date}</span>
                </div>
                <p class="history-desc">${scan.explanation}</p>
            </div>
        `;
    });
    historyContainer.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    renderAllergies(); 
    renderNotifications(); 
    let history = JSON.parse(localStorage.getItem('safePlateHistory')) || [];
    if (history.length > 0) updateRecentScansUI(history[0]);
});