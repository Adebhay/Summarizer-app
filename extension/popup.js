// popup.js - Shows your daily stats with proper time formatting

// ============================================================
// FORMAT TIME FUNCTION - Add this at the top
// ============================================================
function formatTime(seconds) {
    // Convert seconds to minutes
    const minutes = Math.round(seconds / 60);
    
    // If less than 1 minute, show seconds
    if (minutes < 1) {
        return `${Math.round(seconds)}s`;
    }
    
    // Calculate hours and minutes
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    // Format based on duration
    if (hours > 0 && mins > 0) {
        return `${hours}h ${mins}m`;
    } else if (hours > 0) {
        return `${hours}h`;
    } else {
        return `${mins}m`;
    }
}

// ============================================================
// Get user ID from chrome.storage
// ============================================================
let userId = 'Loading...';

chrome.runtime.sendMessage({ type: 'getUserId' }, (response) => {
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

// ============================================================
// Check server status
// ============================================================
async function checkServer() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    
    try {
        const response = await fetch('http://localhost:3001/health');
        if (response.ok) {
            dot.className = 'status-dot online';
            text.textContent = 'Server online ✅';
        } else {
            dot.className = 'status-dot offline';
            text.textContent = 'Server offline ❌';
        }
    } catch (error) {
        dot.className = 'status-dot offline';
        text.textContent = 'Server offline ❌ (Start with: node server.js)';
    }
}

// ============================================================
// Load and display today's stats
// ============================================================
async function loadStats() {
    const today = new Date().toISOString().split('T')[0];
    const statsDiv = document.getElementById('stats');
    
    // First check local storage
    chrome.storage.local.get(['activityData'], (result) => {
        const data = result.activityData || {};
        const todayData = data[today] || {};
        
        if (Object.keys(todayData).length > 0) {
            displayStats(todayData);
        } else {
            // Try backend
            fetchStatsFromBackend(today);
        }
    });
}

// ============================================================
// Display stats with formatted time
// ============================================================
function displayStats(activity) {
    const statsDiv = document.getElementById('stats');
    let html = '<h4>📋 Today\'s Activity</h4>';
    
    // Sort by time spent (descending)
    const sorted = Object.entries(activity).sort((a, b) => b[1] - a[1]);
    
    for (const [site, seconds] of sorted) {
        // 👇 USE THE formatTime FUNCTION HERE
        const timeDisplay = formatTime(seconds);
        
        html += `<div class="site">
            <span class="site-name">${site}</span>
            <span class="site-time">${timeDisplay}</span>
        </div>`;
    }
    statsDiv.innerHTML = html;
}

// ============================================================
// Fetch stats from backend
// ============================================================
async function fetchStatsFromBackend(date) {
    const statsDiv = document.getElementById('stats');
    try {
        const response = await fetch(`http://localhost:3001/api/activity/${userId}/${date}`);
        const data = await response.json();
        
        if (data.activity && Object.keys(data.activity).length > 0) {
            displayStats(data.activity);
        } else {
            statsDiv.innerHTML = '<div class="empty">No activity tracked yet today.<br>Start browsing!</div>';
        }
    } catch (error) {
        statsDiv.innerHTML = '<div class="empty">No activity tracked yet today.<br>Start browsing!</div>';
    }
}

// ============================================================
// Handle summarize button
// ============================================================
document.getElementById('summarizeBtn').addEventListener('click', async () => {
    const button = document.getElementById('summarizeBtn');
    const summaryDiv = document.getElementById('summary');
    const today = new Date().toISOString().split('T')[0];
    
    button.disabled = true;
    button.textContent = 'Loading...';
    summaryDiv.className = 'summary show loading';
    summaryDiv.textContent = 'Generating your daily summary...';
    
    try {
        const response = await fetch('http://localhost:3001/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, date: today })
        });
        
        const data = await response.json();
        
        if (data.success) {
            summaryDiv.className = 'summary show';
            summaryDiv.textContent = data.summary;
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
// Refresh stats every 30 seconds
// ============================================================
setInterval(loadStats, 30000);

console.log('📊 Popup loaded successfully!');