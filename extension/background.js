// Check if it's a new day
function checkNewDay() {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(['lastDate'], (result) => {
        if (result.lastDate !== today) {
            // New day - clear old data
            chrome.storage.local.set({ 
                activityData: {},
                lastDate: today 
            });
        }
    });
}

// Run on startup
checkNewDay();
// Log when extension loads
console.log('=== Productivity Tracker Extension Loaded ===');

// Log all tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log('Tab activated:', activeInfo.tabId);
    // ... rest of your code
});

// Log when URLs change
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('Tab updated:', tabId, changeInfo);
    // ... rest of your code
});
// background.js - Tracks your browsing activity

let currentTab = null;
let currentStartTime = null;

// Your backend server URL
const API_URL = 'http://localhost:3001/api/activity';

// Generate a random user ID (in a real app, this would come from login)
// Generate a consistent user ID using chrome.storage
let userId;

chrome.storage.local.get(['userId'], (result) => {
    if (result.userId) {
        userId = result.userId;
    } else {
        userId = 'user_' + Math.random().toString(36).substring(7);
        chrome.storage.local.set({ userId: userId });
    }
    console.log('User ID:', userId);
});

// Also make userId available to popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getUserId') {
        chrome.storage.local.get(['userId'], (result) => {
            sendResponse({ userId: result.userId });
        });
        return true;
    }
});

// Function to save usage data
async function saveActivity(domain, duration) {
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`💾 Saving: ${domain} for ${duration}ms`);
    
    // Get existing data from Chrome storage
    chrome.storage.local.get(['activityData'], async (result) => {
        let activityData = result.activityData || {};
        
        if (!activityData[today]) {
            activityData[today] = {};
        }
        
        if (!activityData[today][domain]) {
            activityData[today][domain] = 0;
        }
        
        activityData[today][domain] += duration;
        
        // Save to Chrome storage
        chrome.storage.local.set({ activityData }, () => {
            console.log('💾 Saved to Chrome storage');
        });
        
        // Send to your backend
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    date: today,
                    activityData: activityData[today]
                })
            });
            
            if (response.ok) {
                console.log('✅ Data sent to backend');
            } else {
                console.log('⚠️ Backend responded with error:', response.status);
            }
        } catch (error) {
            console.log('⚠️ Backend not reachable, data saved locally');
        }
    });
}

// Track when user switches tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // Save time for previous tab
    if (currentTab && currentStartTime) {
        const duration = Date.now() - currentStartTime;
        if (duration > 1000) { // Only save if more than 1 second
            await saveActivity(currentTab, duration);
        }
    }
    
    // Get the new tab's URL
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url.startsWith('http')) {
            const url = new URL(tab.url);
            currentTab = url.hostname.replace('www.', '');
            currentStartTime = Date.now();
            console.log(`🔄 Switched to: ${currentTab}`);
        } else {
            currentTab = null;
            currentStartTime = null;
        }
    } catch (error) {
        console.log('Error getting tab:', error);
    }
});

// Track when tab URL changes (navigation within same tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active && tab.url && tab.url.startsWith('http')) {
        // Save time for previous tab
        if (currentTab && currentStartTime) {
            const duration = Date.now() - currentStartTime;
            if (duration > 1000) {
                await saveActivity(currentTab, duration);
            }
        }
        
        // Start tracking new URL
        const url = new URL(tab.url);
        currentTab = url.hostname.replace('www.', '');
        currentStartTime = Date.now();
        console.log(`🔄 Navigated to: ${currentTab}`);
    }
});

// Save activity when Chrome closes
chrome.tabs.onRemoved.addListener(async () => {
    if (currentTab && currentStartTime) {
        const duration = Date.now() - currentStartTime;
        if (duration > 1000) {
            await saveActivity(currentTab, duration);
        }
    }
});

console.log('🚀 Productivity Tracker extension loaded!');