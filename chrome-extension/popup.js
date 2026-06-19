// chrome-extension/popup.js - Complete Updated Version

const SERVER_URL = 'https://summarizer-app-ybx8.onrender.com';

// ============================================================
// FORMAT TIME
// ============================================================
function formatTime(seconds) {
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return seconds + 's';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return hours + 'h ' + mins + 'm';
    if (hours > 0) return hours + 'h';
    return mins + 'm';
}

// ============================================================
// USER ID & INITIALIZATION
// ============================================================
let userId = 'Loading...';

// Store voice settings globally
let voiceSettings = {
    language: 'en-US',
    voiceName: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    useGoogleTTS: false,
    googleApiKey: '',
    googleVoice: 'en-US-Wavenet-D'
};

// Get userId from background
chrome.runtime.sendMessage({ type: 'getUserId' }, (response) => {
    console.log('Popup received userId response:', response);
    if (response && response.userId) {
        userId = response.userId;
        document.getElementById('userId').textContent = userId;
        loadStats();
        checkServer();
    } else {
        userId = 'temp_' + Math.random().toString(36).substring(7);
        document.getElementById('userId').textContent = userId + ' (local)';
        loadStats();
        checkServer();
    }
});

// Load saved voice settings
chrome.storage.local.get(['voiceSettings'], (result) => {
    if (result.voiceSettings) {
        voiceSettings = result.voiceSettings;
        // Update UI with saved settings
        document.getElementById('voice-language').value = voiceSettings.language || 'en-US';
        document.getElementById('rate-slider').value = voiceSettings.rate || 1.0;
        document.getElementById('pitch-slider').value = voiceSettings.pitch || 1.0;
        document.getElementById('volume-slider').value = voiceSettings.volume || 1.0;
        document.getElementById('rate-display').textContent = voiceSettings.rate || 1.0;
        document.getElementById('pitch-display').textContent = voiceSettings.pitch || 1.0;
        document.getElementById('volume-display').textContent = voiceSettings.volume || 1.0;
        
        if (voiceSettings.useGoogleTTS) {
            document.getElementById('use-google-tts').checked = true;
            document.getElementById('google-tts-settings').style.display = 'block';
            document.getElementById('google-api-key').value = voiceSettings.googleApiKey || '';
            document.getElementById('google-voice-select').value = voiceSettings.googleVoice || 'en-US-Wavenet-D';
        }
    }
});

// Load saved break settings
chrome.storage.local.get(['breakSettings'], (result) => {
    if (result.breakSettings) {
        const settings = result.breakSettings;
        document.getElementById('break-interval').value = settings.intervalMinutes || 30;
        document.getElementById('snooze-duration').value = settings.snoozeMinutes || 5;
        document.getElementById('strict-mode').checked = settings.strictMode || false;
    }
});

// ============================================================
// SERVER CHECK
// ============================================================
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

// ============================================================
// STATS LOADING & DISPLAY
// ============================================================
async function loadStats() {
    const today = new Date().toISOString().split('T')[0];
    const statsDiv = document.getElementById('stats');
    try {
        chrome.storage.local.get(['activityData'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Storage error:', chrome.runtime.lastError);
                statsDiv.innerHTML = '<div class="empty">Error loading data</div>';
                return;
            }
            const data = (result && result.activityData) || {};
            const todayData = data[today] || {};
            if (Object.keys(todayData).length > 0) {
                displayStats(todayData);
            } else {
                statsDiv.innerHTML = '<div class="empty">No activity tracked yet today.<br>Start browsing to see insights!</div>';
            }
        });
    } catch (e) {
        console.error('Load stats error:', e);
        statsDiv.innerHTML = '<div class="empty">Error loading data</div>';
    }
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

// ============================================================
// VOICE POPULATION & MANAGEMENT
// ============================================================

// Populate voice dropdown with available system voices
function populateVoices() {
    const select = document.getElementById('voice-select');
    const voices = speechSynthesis.getVoices();
    
    if (voices.length === 0) {
        setTimeout(populateVoices, 500);
        return;
    }
    
    const languageSelect = document.getElementById('voice-language');
    const selectedLang = languageSelect.value;
    
    // Filter voices by selected language
    let filteredVoices = voices.filter(v => v.lang === selectedLang);
    
    // If no voices for selected language, show all
    if (filteredVoices.length === 0) {
        filteredVoices = voices;
    }
    
    select.innerHTML = '';
    let added = 0;
    
    filteredVoices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        if (added === 0) option.selected = true;
        const voiceType = voice.localService ? '[System]' : '[Network]';
        option.textContent = `${voice.name} (${voice.lang}) ${voiceType}`;
        select.appendChild(option);
        added++;
    });
    
    // Load saved voice selection
    chrome.storage.local.get(['voiceSettings'], (result) => {
        if (result.voiceSettings && result.voiceSettings.voiceName) {
            const savedName = result.voiceSettings.voiceName;
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === savedName) {
                    select.selectedIndex = i;
                    break;
                }
            }
        }
    });
}

// Populate voices when available
if ('speechSynthesis' in window) {
    if (speechSynthesis.getVoices().length > 0) {
        populateVoices();
    }
    speechSynthesis.onvoiceschanged = populateVoices;
}

// ============================================================
// UI EVENT LISTENERS
// ============================================================

// Toggle voice settings panel
document.getElementById('toggle-voice-settings').addEventListener('click', () => {
    const panel = document.getElementById('voice-settings');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    // Refresh voices when opening
    if (panel.style.display === 'block') {
        populateVoices();
    }
});

// Update voice list when language changes
document.getElementById('voice-language').addEventListener('change', function() {
    populateVoices();
});

// Toggle Google TTS settings
document.getElementById('use-google-tts').addEventListener('change', function() {
    document.getElementById('google-tts-settings').style.display = this.checked ? 'block' : 'none';
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
    voiceSettings.language = document.getElementById('voice-language').value;
    voiceSettings.voiceName = document.getElementById('voice-select').value;
    voiceSettings.rate = parseFloat(document.getElementById('rate-slider').value);
    voiceSettings.pitch = parseFloat(document.getElementById('pitch-slider').value);
    voiceSettings.volume = parseFloat(document.getElementById('volume-slider').value);
    voiceSettings.useGoogleTTS = document.getElementById('use-google-tts').checked;
    voiceSettings.googleApiKey = document.getElementById('google-api-key').value.trim();
    voiceSettings.googleVoice = document.getElementById('google-voice-select').value;
    
    chrome.storage.local.set({ voiceSettings: voiceSettings }, () => {
        alert('✅ Voice settings saved!');
        document.getElementById('voice-settings').style.display = 'none';
    });
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
    
    chrome.storage.local.set({ breakSettings: settings }, () => {
        chrome.runtime.sendMessage({ 
            type: 'updateBreakSettings', 
            settings: settings 
        });
        alert('✅ Break settings saved!');
        document.getElementById('break-settings').style.display = 'none';
    });
});

// ============================================================
// SPEAK SUMMARY (ENHANCED VOICE)
// ============================================================

function speakSummary(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        return;
    }
    
    // Get latest voice settings
    chrome.storage.local.get(['voiceSettings'], (result) => {
        const settings = result.voiceSettings || voiceSettings;
        const useGoogleTTS = settings.useGoogleTTS || false;
        
        if (useGoogleTTS && settings.googleApiKey) {
            speakWithGoogleTTS(text, settings);
        } else {
            speakWithBrowserTTS(text, settings);
        }
    });
}

// Browser TTS (free, multiple voices)
function speakWithBrowserTTS(text, settings) {
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.rate = parseFloat(settings.rate) || 1.0;
    utterance.pitch = parseFloat(settings.pitch) || 1.0;
    utterance.volume = parseFloat(settings.volume) || 1.0;
    utterance.lang = settings.language || 'en-US';
    
    const voices = speechSynthesis.getVoices();
    const voiceName = settings.voiceName || '';
    const selectedVoice = voices.find(v => v.name === voiceName);
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    } else {
        const fallbackVoice = voices.find(v => v.lang === utterance.lang);
        if (fallbackVoice) utterance.voice = fallbackVoice;
    }
    
    const speakBtn = document.querySelector('.speak-btn');
    if (speakBtn) speakBtn.textContent = '🔊 Speaking...';
    
    utterance.onend = function() {
        if (speakBtn) speakBtn.textContent = '🔊 Listen to Summary';
    };
    utterance.onerror = function() {
        if (speakBtn) speakBtn.textContent = '🔊 Listen to Summary';
    };
    
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}

// Google Cloud TTS (ultra-realistic, premium)
async function speakWithGoogleTTS(text, settings) {
    const apiKey = settings.googleApiKey;
    const voiceName = settings.googleVoice || 'en-US-Wavenet-D';
    
    if (!apiKey) {
        console.warn('Google TTS API key missing, using browser TTS');
        speakWithBrowserTTS(text, settings);
        return;
    }
    
    try {
        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text: text },
                    voice: {
                        languageCode: settings.language || 'en-US',
                        name: voiceName
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: parseFloat(settings.rate) || 1.0,
                        pitch: parseFloat(settings.pitch) || 1.0,
                        volumeGainDb: 0
                    }
                })
            }
        );
        
        const data = await response.json();
        
        if (data.audioContent) {
            const audio = new Audio('data:audio/mp3;base64,' + data.audioContent);
            const speakBtn = document.querySelector('.speak-btn');
            if (speakBtn) speakBtn.textContent = '🔊 Speaking...';
            
            audio.onended = function() {
                if (speakBtn) speakBtn.textContent = '🔊 Listen to Summary';
            };
            audio.onerror = function() {
                if (speakBtn) speakBtn.textContent = '🔊 Listen to Summary';
                speakWithBrowserTTS(text, settings);
            };
            audio.play();
        } else {
            speakWithBrowserTTS(text, settings);
        }
    } catch (error) {
        console.warn('Google TTS API error:', error);
        speakWithBrowserTTS(text, settings);
    }
}

// ============================================================
// SUMMARY BUTTON
// ============================================================
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
            speakBtn.textContent = '🔊 Listen to Summary';
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

// ============================================================
// AUTO REFRESH
// ============================================================
setInterval(loadStats, 30000);
console.log('Mentis.co popup loaded');