// chrome-extension/popup.js - Fixed for Chrome & Edge

const SERVER_URL = 'https://summarizer-app-ybx8.onrender.com';

function formatTime(seconds) {
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return seconds + 's';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return hours + 'h ' + mins + 'm';
    if (hours > 0) return hours + 'h';
    return mins + 'm';
}

let userId = 'Loading...';

// Get userId from background
browser.runtime.sendMessage({ type: 'getUserId' }, (response) => {
    console.log('Popup received userId response:', response);
    if (response && response.userId) {
        userId = response.userId;
        document.getElementById('userId').textContent = userId;
        loadStats();
        checkServer();
    } else {
        // Fallback: generate temporary ID
        userId = 'temp_' + Math.random().toString(36).substring(7);
        document.getElementById('userId').textContent = userId + ' (local)';
        loadStats();
        checkServer();
    }
});

async function checkServer() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    try {
        const response = await fetch(SERVER_URL + '/health');
        if (response.ok) {
            dot.className = 'status-dot online';
            text.textContent = 'Server online';
        } else {
            dot.className = 'status-dot offline';
            text.textContent = 'Server offline';
        }
    } catch (error) {
        dot.className = 'status-dot offline';
        text.textContent = 'Server offline';
    }
}

async function loadStats() {
    const today = new Date().toISOString().split('T')[0];
    const statsDiv = document.getElementById('stats');
    browser.storage.local.get(['activityData'], (result) => {
        const data = (result && result.activityData) || {};
        const todayData = data[today] || {};
        if (Object.keys(todayData).length > 0) {
            displayStats(todayData);
        } else {
            statsDiv.innerHTML = '<div class="empty">No activity tracked yet today.<br>Start browsing to see insights!</div>';
        }
    });
}

function displayStats(activity) {
    const statsDiv = document.getElementById('stats');
    let html = '<h4>Today\'s Activity</h4>';
    const sorted = Object.entries(activity).sort((a, b) => b[1] - a[1]);
    for (const [site, seconds] of sorted) {
        html += '<div class="site">' +
            '<span class="site-name">' + site + '</span>' +
            '<span class="site-time">' + formatTime(seconds) + '</span>' +
        '</div>';
    }
    statsDiv.innerHTML = html;
}

function speakSummary(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        const voices = speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang === 'en-US');
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    }
}

document.getElementById('summarizeBtn').addEventListener('click', async () => {
    const button = document.getElementById('summarizeBtn');
    const summaryDiv = document.getElementById('summary');
    const today = new Date().toISOString().split('T')[0];
    
    button.disabled = true;
    button.textContent = 'Generating...';
    summaryDiv.className = 'summary show loading';
    summaryDiv.textContent = 'Analyzing your day...';
    
    try {
        const response = await fetch(SERVER_URL + '/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, date: today })
        });
        const data = await response.json();
        if (data.success) {
            summaryDiv.className = 'summary show success';
            summaryDiv.textContent = data.summary;
            const speakBtn = document.createElement('button');
            speakBtn.className = 'speak-btn';
            speakBtn.textContent = 'Listen to Summary';
            speakBtn.onclick = function() { speakSummary(data.summary); };
            summaryDiv.appendChild(speakBtn);
        } else {
            summaryDiv.className = 'summary show error';
            summaryDiv.textContent = data.message || 'Not enough data yet. Browse more!';
        }
    } catch (error) {
        summaryDiv.className = 'summary show error';
        summaryDiv.textContent = 'Error: Make sure backend is running';
    } finally {
        button.disabled = false;
        button.textContent = 'Get AI Summary';
    }
});

setInterval(loadStats, 30000);

// ============================================================
// VOICE SETTINGS UI LOGIC
// ============================================================

// Store voice settings globally
let voiceSettings = {
    rate: 0.9,
    pitch: 1.0,
    volume: 1.0
};

// Load saved voice settings
browser.storage.local.get(['voiceSettings'], (result) => {
    if (result.voiceSettings) {
        const settings = result.voiceSettings;
        voiceSettings = settings;
        document.getElementById('rate-slider').value = settings.rate || 0.9;
        document.getElementById('pitch-slider').value = settings.pitch || 1.0;
        document.getElementById('volume-slider').value = settings.volume || 1.0;
        document.getElementById('rate-display').textContent = settings.rate || 0.9;
        document.getElementById('pitch-display').textContent = settings.pitch || 1.0;
        document.getElementById('volume-display').textContent = settings.volume || 1.0;
    }
});

// Toggle voice settings panel
document.getElementById('toggle-voice-settings').addEventListener('click', () => {
    const panel = document.getElementById('voice-settings');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

// Update displays on slider change
document.getElementById('rate-slider').addEventListener('input', function() {
    document.getElementById('rate-display').textContent = this.value;
    voiceSettings.rate = parseFloat(this.value);
});
document.getElementById('pitch-slider').addEventListener('input', function() {
    document.getElementById('pitch-display').textContent = this.value;
    voiceSettings.pitch = parseFloat(this.value);
});
document.getElementById('volume-slider').addEventListener('input', function() {
    document.getElementById('volume-display').textContent = this.value;
    voiceSettings.volume = parseFloat(this.value);
});

// Test voice button
document.getElementById('test-voice-btn').addEventListener('click', function() {
    speakSummary('Hello! This is your personalized Mentis.co voice. Adjust the settings to your liking.');
});

// Save voice settings
document.getElementById('save-voice-btn').addEventListener('click', function() {
    browser.storage.local.set({ voiceSettings: voiceSettings }, () => {
        alert('✅ Voice settings saved!');
        document.getElementById('voice-settings').style.display = 'none';
    });
});

// ============================================================
// BREAK SETTINGS UI LOGIC
// ============================================================

// Load saved break settings
browser.storage.local.get(['breakSettings'], (result) => {
    if (result.breakSettings) {
        const settings = result.breakSettings;
        document.getElementById('break-interval').value = settings.intervalMinutes || 30;
        document.getElementById('snooze-duration').value = settings.snoozeMinutes || 5;
        document.getElementById('strict-mode').checked = settings.strictMode || false;
    }
});

// Toggle break settings panel
document.getElementById('toggle-break-settings').addEventListener('click', () => {
    const panel = document.getElementById('break-settings');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

// Save break settings
document.getElementById('save-break-settings').addEventListener('click', () => {
    const settings = {
        intervalMinutes: parseInt(document.getElementById('break-interval').value),
        snoozeMinutes: parseInt(document.getElementById('snooze-duration').value),
        strictMode: document.getElementById('strict-mode').checked,
    };
    
    browser.storage.local.set({ breakSettings: settings }, () => {
        // Send message to background to update alarm
        browser.runtime.sendMessage({ 
            type: 'updateBreakSettings', 
            settings: settings 
        });
        alert('✅ Break settings saved!');
        document.getElementById('break-settings').style.display = 'none';
    });
});

// ============================================================
// UPDATED speakSummary FUNCTION (uses voiceSettings)
// ============================================================

// Replace the existing speakSummary function with this enhanced version
function speakSummary(text) {
    if ('speechSynthesis' in window) {
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            // Apply user settings
            utterance.rate = voiceSettings.rate || 0.9;
            utterance.pitch = voiceSettings.pitch || 1.0;
            utterance.volume = voiceSettings.volume || 1.0;
            
            // Try to find a good voice
            const voices = speechSynthesis.getVoices();
            // Prefer a US English female voice
            let preferredVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Female'));
            if (!preferredVoice) {
                preferredVoice = voices.find(v => v.lang === 'en-US');
            }
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            
            speechSynthesis.cancel();
            speechSynthesis.speak(utterance);
        } catch (e) {
            console.error('Speech error:', e);
        }
    }
}
console.log('Popup loaded');