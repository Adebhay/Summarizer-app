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
chrome.runtime.sendMessage({ type: 'getUserId' }, (response) => {
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
    chrome.storage.local.get(['activityData'], (result) => {
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
console.log('Popup loaded');