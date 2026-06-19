// chrome-extension/popup.js - Complete with Calendar & Timeline

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

function formatTimeShort(minutes) {
    if (minutes < 1) return '< 1m';
    if (minutes < 60) return minutes + 'm';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return hours + 'h';
    return hours + 'h ' + mins + 'm';
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
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
browser.runtime.sendMessage({ type: 'getUserId' }, (response) => {
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
browser.storage.local.get(['voiceSettings'], (result) => {
    if (result.voiceSettings) {
        voiceSettings = result.voiceSettings;
        const langSelect = document.getElementById('voice-language');
        const rateSlider = document.getElementById('rate-slider');
        const pitchSlider = document.getElementById('pitch-slider');
        const volumeSlider = document.getElementById('volume-slider');
        
        if (langSelect) langSelect.value = voiceSettings.language || 'en-US';
        if (rateSlider) {
            rateSlider.value = voiceSettings.rate || 1.0;
            document.getElementById('rate-display').textContent = voiceSettings.rate || 1.0;
        }
        if (pitchSlider) {
            pitchSlider.value = voiceSettings.pitch || 1.0;
            document.getElementById('pitch-display').textContent = voiceSettings.pitch || 1.0;
        }
        if (volumeSlider) {
            volumeSlider.value = voiceSettings.volume || 1.0;
            document.getElementById('volume-display').textContent = voiceSettings.volume || 1.0;
        }
        
        if (voiceSettings.useGoogleTTS) {
            const useGoogle = document.getElementById('use-google-tts');
            if (useGoogle) {
                useGoogle.checked = true;
                const ttsSettings = document.getElementById('google-tts-settings');
                if (ttsSettings) ttsSettings.style.display = 'block';
            }
            const apiKeyInput = document.getElementById('google-api-key');
            if (apiKeyInput) apiKeyInput.value = voiceSettings.googleApiKey || '';
            const googleVoiceSelect = document.getElementById('google-voice-select');
            if (googleVoiceSelect) googleVoiceSelect.value = voiceSettings.googleVoice || 'en-US-Wavenet-D';
        }
    }
});

// Load saved break settings
browser.storage.local.get(['breakSettings'], (result) => {
    if (result.breakSettings) {
        const settings = result.breakSettings;
        const intervalSelect = document.getElementById('break-interval');
        const snoozeSelect = document.getElementById('snooze-duration');
        const strictCheckbox = document.getElementById('strict-mode');
        if (intervalSelect) intervalSelect.value = settings.intervalMinutes || 30;
        if (snoozeSelect) snoozeSelect.value = settings.snoozeMinutes || 5;
        if (strictCheckbox) strictCheckbox.checked = settings.strictMode || false;
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
        browser.storage.local.get(['activityData'], (result) => {
            if (browser.runtime.lastError) {
                console.error('Storage error:', browser.runtime.lastError);
                statsDiv.innerHTML = '<div class="empty">Error loading data</div>';
                return;
            }
            const data = (result && result.activityData) || {};
            const todayData = data[today] || {};
            const sites = todayData.sites || {};
            if (Object.keys(sites).length > 0) {
                displayStats(sites);
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
// CALENDAR & TIMELINE LOGIC
// ============================================================

let currentViewDate = new Date();
let currentView = 'day';

// Load calendar data for a specific date
async function loadCalendarData(date) {
    const dateStr = date.toISOString().split('T')[0];
    const userIdEl = document.getElementById('userId');
    const userIdText = userIdEl ? userIdEl.textContent : 'Loading...';
    
    // If userId is still loading, wait and retry
    if (userIdText === 'Loading...' || userIdText.includes('(local)')) {
        setTimeout(() => loadCalendarData(date), 500);
        return;
    }
    
    try {
        const response = await fetch(SERVER_URL + '/api/timeline/' + userIdText + '/' + dateStr);
        const data = await response.json();
        
        if (data.success) {
            displayTimeline(data, date);
            updateCalendarStats(data);
        } else {
            document.getElementById('timeline-list').innerHTML = '<div style="text-align:center; color:#5f6368; padding:20px;">No data for this date</div>';
        }
    } catch (error) {
        console.error('Calendar load error:', error);
        document.getElementById('timeline-list').innerHTML = '<div style="text-align:center; color:#5f6368; padding:20px;">Error loading data</div>';
    }
}

// Display timeline
function displayTimeline(data, date) {
    const container = document.getElementById('timeline-list');
    
    document.getElementById('current-date-display').textContent = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    
    if (!data.timeline || data.timeline.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#5f6368; padding:20px;">No activity recorded for this date</div>';
        return;
    }
    
    // Group by hour
    const grouped = {};
    data.timeline.forEach(entry => {
        const hour = new Date(entry.timestamp).getHours();
        if (!grouped[hour]) grouped[hour] = [];
        grouped[hour].push(entry);
    });
    
    let html = '';
    const sortedHours = Object.keys(grouped).sort((a, b) => a - b);
    
    sortedHours.forEach(hour => {
        const hourLabel = hour === 0 ? '12 AM' : 
                          hour < 12 ? hour + ' AM' : 
                          hour === 12 ? '12 PM' : 
                          (hour - 12) + ' PM';
        
        html += '<div style="margin-bottom:8px;">';
        html += '<div style="font-weight:600; font-size:12px; color:#1a73e8; margin-bottom:4px;">' + hourLabel + '</div>';
        
        grouped[hour].forEach(entry => {
            const startTime = formatTimestamp(entry.startTime);
            const endTime = formatTimestamp(entry.endTime);
            const duration = Math.round(entry.duration / 60000);
            
            html += '<div class="timeline-entry">';
            html += '<span class="site-name">' + entry.site + '</span>';
            html += '<span class="site-time">' + startTime + ' - ' + endTime + ' (' + duration + 'm)</span>';
            html += '</div>';
        });
        
        html += '</div>';
    });
    
    container.innerHTML = html;
}

// Update calendar stats
function updateCalendarStats(data) {
    const totalMinutes = Math.round((data.totalTime || 0) / 60);
    const siteCount = Object.keys(data.sites || {}).length;
    
    document.getElementById('cal-total-time').textContent = formatTimeShort(totalMinutes);
    document.getElementById('cal-site-count').textContent = siteCount;
    
    const productivity = siteCount > 0 ? Math.min(100, Math.round((totalMinutes / (siteCount * 15)) * 10)) : 0;
    document.getElementById('cal-productivity').textContent = Math.min(100, productivity) + '%';
}

// Load week data
async function loadWeekData() {
    const startDate = new Date(currentViewDate);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    
    const userIdEl = document.getElementById('userId');
    const userIdText = userIdEl ? userIdEl.textContent : 'Loading...';
    
    if (userIdText === 'Loading...' || userIdText.includes('(local)')) {
        setTimeout(loadWeekData, 500);
        return;
    }
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    try {
        const response = await fetch(SERVER_URL + '/api/timeline/' + userIdText + '/' + startStr + '/' + endStr);
        const data = await response.json();
        
        if (data.success) {
            displayWeekView(data.data, startDate, endDate);
        }
    } catch (error) {
        console.error('Week load error:', error);
    }
}

// Display week view
function displayWeekView(data, startDate, endDate) {
    const container = document.getElementById('timeline-list');
    
    document.getElementById('current-date-display').textContent = 
        startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + 
        ' - ' + 
        endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    let html = '<div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:10px;">';
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(name => {
        html += '<div style="text-align:center; font-size:10px; color:#5f6368; font-weight:600;">' + name + '</div>';
    });
    
    const dataMap = {};
    data.forEach(item => {
        dataMap[item.date] = item;
    });
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayData = dataMap[dateStr];
        const dayMinutes = dayData ? Math.round((dayData.totalTime || 0) / 60) : 0;
        
        let colorClass = 'low';
        if (dayMinutes > 120) colorClass = 'high';
        else if (dayMinutes > 60) colorClass = 'medium';
        
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        const todayClass = isToday ? 'today' : '';
        
        html += '<div class="heatmap-day ' + colorClass + ' ' + todayClass + '" onclick="loadCalendarData(new Date(\'' + dateStr + '\'))">';
        html += '<div class="day-number">' + currentDate.getDate() + '</div>';
        html += '<div class="day-label">' + (dayMinutes > 0 ? formatTimeShort(dayMinutes) : '-') + '</div>';
        html += '</div>';
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    html += '</div>';
    html += '<div style="text-align:center; font-size:10px; color:#5f6368;">Click a date to view details</div>';
    
    container.innerHTML = html;
}

// Load month data
async function loadMonthData() {
    const startDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth(), 1);
    const endDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 0);
    
    const userIdEl = document.getElementById('userId');
    const userIdText = userIdEl ? userIdEl.textContent : 'Loading...';
    
    if (userIdText === 'Loading...' || userIdText.includes('(local)')) {
        setTimeout(loadMonthData, 500);
        return;
    }
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    try {
        const response = await fetch(SERVER_URL + '/api/timeline/' + userIdText + '/' + startStr + '/' + endStr);
        const data = await response.json();
        
        if (data.success) {
            displayMonthView(data.data, startDate, endDate);
        }
    } catch (error) {
        console.error('Month load error:', error);
    }
}

// Display month view
function displayMonthView(data, startDate, endDate) {
    const container = document.getElementById('timeline-list');
    
    document.getElementById('current-date-display').textContent = 
        startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const dataMap = {};
    data.forEach(item => {
        dataMap[item.date] = item;
    });
    
    let html = '<div style="display:grid; grid-template-columns:repeat(7,1fr); gap:3px;">';
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(name => {
        html += '<div style="text-align:center; font-size:9px; color:#5f6368; font-weight:600; padding:2px;">' + name + '</div>';
    });
    
    const firstDay = startDate.getDay();
    for (let i = 0; i < firstDay; i++) {
        html += '<div></div>';
    }
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayData = dataMap[dateStr];
        const dayMinutes = dayData ? Math.round((dayData.totalTime || 0) / 60) : 0;
        
        let colorClass = 'low';
        if (dayMinutes > 120) colorClass = 'high';
        else if (dayMinutes > 60) colorClass = 'medium';
        
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        const todayClass = isToday ? 'today' : '';
        
        html += '<div class="heatmap-day ' + colorClass + ' ' + todayClass + '" onclick="loadCalendarData(new Date(\'' + dateStr + '\'))">';
        html += '<div class="day-number">' + currentDate.getDate() + '</div>';
        html += '</div>';
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    html += '</div>';
    html += '<div style="margin-top:8px; text-align:center; font-size:9px; color:#5f6368;">Click a date to view details</div>';
    html += '<div style="display:flex; justify-content:center; gap:8px; margin-top:6px; font-size:8px; color:#5f6368;">';
    html += '<span>● <span style="color:#8ab4f8;">High (>2h)</span></span>';
    html += '<span>● <span style="color:#d2e3fc;">Medium (>1h)</span></span>';
    html += '<span>● <span style="color:#e8eaed;">Low (<1h)</span></span>';
    html += '</div>';
    
    container.innerHTML = html;
}

// Calendar navigation
document.getElementById('prev-day').addEventListener('click', function() {
    if (currentView === 'day') {
        currentViewDate.setDate(currentViewDate.getDate() - 1);
        loadCalendarData(currentViewDate);
    } else if (currentView === 'week') {
        currentViewDate.setDate(currentViewDate.getDate() - 7);
        loadWeekData();
    } else {
        currentViewDate.setMonth(currentViewDate.getMonth() - 1);
        loadMonthData();
    }
});

document.getElementById('next-day').addEventListener('click', function() {
    if (currentView === 'day') {
        currentViewDate.setDate(currentViewDate.getDate() + 1);
        loadCalendarData(currentViewDate);
    } else if (currentView === 'week') {
        currentViewDate.setDate(currentViewDate.getDate() + 7);
        loadWeekData();
    } else {
        currentViewDate.setMonth(currentViewDate.getMonth() + 1);
        loadMonthData();
    }
});

// View toggle
document.getElementById('view-day').addEventListener('click', function() {
    currentView = 'day';
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    this.classList.add('active');
    loadCalendarData(currentViewDate);
});

document.getElementById('view-week').addEventListener('click', function() {
    currentView = 'week';
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    this.classList.add('active');
    loadWeekData();
});

document.getElementById('view-month').addEventListener('click', function() {
    currentView = 'month';
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    this.classList.add('active');
    loadMonthData();
});

// Toggle calendar panel
document.getElementById('toggle-calendar').addEventListener('click', function() {
    const panel = document.getElementById('calendar-panel');
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        // Reset to today and load
        currentViewDate = new Date();
        loadCalendarData(currentViewDate);
    } else {
        panel.style.display = 'none';
    }
});

// ============================================================
// VOICE POPULATION
// ============================================================
function populateVoices() {
    const select = document.getElementById('voice-select');
    if (!select) return;
    
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
        setTimeout(populateVoices, 500);
        return;
    }
    
    const languageSelect = document.getElementById('voice-language');
    const selectedLang = languageSelect ? languageSelect.value : 'en-US';
    
    let filteredVoices = voices.filter(v => v.lang === selectedLang);
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
    
    browser.storage.local.get(['voiceSettings'], (result) => {
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

if ('speechSynthesis' in window) {
    if (speechSynthesis.getVoices().length > 0) {
        populateVoices();
    }
    speechSynthesis.onvoiceschanged = populateVoices;
}

// ============================================================
// UI EVENT LISTENERS
// ============================================================

// Toggle voice settings
const toggleVoiceBtn = document.getElementById('toggle-voice-settings');
if (toggleVoiceBtn) {
    toggleVoiceBtn.addEventListener('click', () => {
        const panel = document.getElementById('voice-settings');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            if (panel.style.display === 'block') {
                populateVoices();
            }
        }
    });
}

// Voice language change
const voiceLanguage = document.getElementById('voice-language');
if (voiceLanguage) {
    voiceLanguage.addEventListener('change', populateVoices);
}

// Google TTS toggle
const useGoogleTTS = document.getElementById('use-google-tts');
if (useGoogleTTS) {
    useGoogleTTS.addEventListener('change', function() {
        const ttsSettings = document.getElementById('google-tts-settings');
        if (ttsSettings) {
            ttsSettings.style.display = this.checked ? 'block' : 'none';
        }
    });
}

// Slider updates
const rateSlider = document.getElementById('rate-slider');
if (rateSlider) {
    rateSlider.addEventListener('input', function() {
        document.getElementById('rate-display').textContent = this.value;
        voiceSettings.rate = parseFloat(this.value);
    });
}

const pitchSlider = document.getElementById('pitch-slider');
if (pitchSlider) {
    pitchSlider.addEventListener('input', function() {
        document.getElementById('pitch-display').textContent = this.value;
        voiceSettings.pitch = parseFloat(this.value);
    });
}

const volumeSlider = document.getElementById('volume-slider');
if (volumeSlider) {
    volumeSlider.addEventListener('input', function() {
        document.getElementById('volume-display').textContent = this.value;
        voiceSettings.volume = parseFloat(this.value);
    });
}

// Test voice button
const testVoiceBtn = document.getElementById('test-voice-btn');
if (testVoiceBtn) {
    testVoiceBtn.addEventListener('click', function() {
        const langSelect = document.getElementById('voice-language');
        const voiceSelect = document.getElementById('voice-select');
        const rateSlider = document.getElementById('rate-slider');
        const pitchSlider = document.getElementById('pitch-slider');
        const volumeSlider = document.getElementById('volume-slider');
        const useGoogle = document.getElementById('use-google-tts');
        const apiKeyInput = document.getElementById('google-api-key');
        const googleVoiceSelect = document.getElementById('google-voice-select');
        
        voiceSettings.language = langSelect ? langSelect.value : 'en-US';
        voiceSettings.voiceName = voiceSelect ? voiceSelect.value : '';
        voiceSettings.rate = rateSlider ? parseFloat(rateSlider.value) : 1.0;
        voiceSettings.pitch = pitchSlider ? parseFloat(pitchSlider.value) : 1.0;
        voiceSettings.volume = volumeSlider ? parseFloat(volumeSlider.value) : 1.0;
        voiceSettings.useGoogleTTS = useGoogle ? useGoogle.checked : false;
        voiceSettings.googleApiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        voiceSettings.googleVoice = googleVoiceSelect ? googleVoiceSelect.value : 'en-US-Wavenet-D';
        
        speakSummary('Hello! This is your personalized Mentis.co voice.');
    });
}

// Save voice settings
const saveVoiceBtn = document.getElementById('save-voice-btn');
if (saveVoiceBtn) {
    saveVoiceBtn.addEventListener('click', function() {
        const langSelect = document.getElementById('voice-language');
        const voiceSelect = document.getElementById('voice-select');
        const rateSlider = document.getElementById('rate-slider');
        const pitchSlider = document.getElementById('pitch-slider');
        const volumeSlider = document.getElementById('volume-slider');
        const useGoogle = document.getElementById('use-google-tts');
        const apiKeyInput = document.getElementById('google-api-key');
        const googleVoiceSelect = document.getElementById('google-voice-select');
        
        voiceSettings.language = langSelect ? langSelect.value : 'en-US';
        voiceSettings.voiceName = voiceSelect ? voiceSelect.value : '';
        voiceSettings.rate = rateSlider ? parseFloat(rateSlider.value) : 1.0;
        voiceSettings.pitch = pitchSlider ? parseFloat(pitchSlider.value) : 1.0;
        voiceSettings.volume = volumeSlider ? parseFloat(volumeSlider.value) : 1.0;
        voiceSettings.useGoogleTTS = useGoogle ? useGoogle.checked : false;
        voiceSettings.googleApiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        voiceSettings.googleVoice = googleVoiceSelect ? googleVoiceSelect.value : 'en-US-Wavenet-D';
        
        browser.storage.local.set({ voiceSettings: voiceSettings }, () => {
            alert('✅ Voice settings saved!');
            const panel = document.getElementById('voice-settings');
            if (panel) panel.style.display = 'none';
        });
    });
}

// Toggle break settings
const toggleBreakBtn = document.getElementById('toggle-break-settings');
if (toggleBreakBtn) {
    toggleBreakBtn.addEventListener('click', () => {
        const panel = document.getElementById('break-settings');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    });
}

// Save break settings
const saveBreakBtn = document.getElementById('save-break-settings');
if (saveBreakBtn) {
    saveBreakBtn.addEventListener('click', () => {
        const intervalSelect = document.getElementById('break-interval');
        const snoozeSelect = document.getElementById('snooze-duration');
        const strictCheckbox = document.getElementById('strict-mode');
        
        const settings = {
            intervalMinutes: intervalSelect ? parseInt(intervalSelect.value) : 30,
            snoozeMinutes: snoozeSelect ? parseInt(snoozeSelect.value) : 5,
            strictMode: strictCheckbox ? strictCheckbox.checked : false,
        };
        
        browser.storage.local.set({ breakSettings: settings }, () => {
            browser.runtime.sendMessage({ 
                type: 'updateBreakSettings', 
                settings: settings 
            });
            alert('✅ Break settings saved!');
            const panel = document.getElementById('break-settings');
            if (panel) panel.style.display = 'none';
        });
    });
}

// ============================================================
// SPEAK SUMMARY
// ============================================================
function speakSummary(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        return;
    }
    
    browser.storage.local.get(['voiceSettings'], (result) => {
        const settings = result.voiceSettings || voiceSettings;
        const useGoogleTTS = settings.useGoogleTTS || false;
        
        if (useGoogleTTS && settings.googleApiKey) {
            speakWithGoogleTTS(text, settings);
        } else {
            speakWithBrowserTTS(text, settings);
        }
    });
}

function speakWithBrowserTTS(text, settings) {
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.rate = parseFloat(settings.rate) || 1.0;
    utterance.pitch = parseFloat(settings.pitch) || 1.0;
    utterance.volume = parseFloat(settings.volume) || 1.0;
    utterance.lang = settings.language || 'en-US';
    
    const voices = speechSynthesis.getVoices();
    const voiceName = settings.voiceName || '';
    let selectedVoice = voices.find(v => v.name === voiceName);
    
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang === utterance.lang);
    }
    if (!selectedVoice && voices.length > 0) {
        selectedVoice = voices[0];
    }
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('Using voice:', selectedVoice.name);
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

async function speakWithGoogleTTS(text, settings) {
    const apiKey = settings.googleApiKey;
    const voiceName = settings.googleVoice || 'en-US-Wavenet-D';
    
    if (!apiKey) {
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
        console.warn('Google TTS error:', error);
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
        if (!userId || userId === 'Loading...') {
            const result = await new Promise((resolve) => {
                browser.storage.local.get(['userId'], resolve);
            });
            if (result && result.userId) {
                userId = result.userId;
            } else {
                userId = 'user_' + Math.random().toString(36).substring(7);
                browser.storage.local.set({ userId: userId });
            }
            document.getElementById('userId').textContent = userId;
        }
        
        console.log('Generating summary for userId:', userId);
        
        const response = await fetch(SERVER_URL + '/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, date: today })
        });
        
        const data = await response.json();
        console.log('Summary response:', data);
        
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
        console.error('Summary error:', error);
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
console.log('Mentis.co popup loaded with calendar support');