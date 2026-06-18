// chrome-extension/background.js - Fixed for Chrome & Edge

const API_URL = 'https://summarizer-app-ybx8.onrender.com/api/activity';

let currentTab = null;
let currentStartTime = null;
let userId = null;

// Get user ID with proper error handling
function initializeUserId() {
    chrome.storage.local.get(['userId'], (result) => {
        console.log('Storage result:', result);
        
        // Check if result exists and has userId
        if (result && result.userId) {
            userId = result.userId;
            console.log('Existing User ID:', userId);
        } else {
            userId = 'user_' + Math.random().toString(36).substring(7);
            chrome.storage.local.set({ userId: userId }, () => {
                console.log('New User ID created:', userId);
            });
        }
    });
}

// Call initialization
initializeUserId();

// Make userId available to popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getUserId') {
        chrome.storage.local.get(['userId'], (result) => {
            if (result && result.userId) {
                sendResponse({ userId: result.userId });
            } else {
                const newUserId = 'user_' + Math.random().toString(36).substring(7);
                chrome.storage.local.set({ userId: newUserId }, () => {
                    sendResponse({ userId: newUserId });
                });
            }
        });
        return true; // Keep message channel open for async response
    }
});

// Save activity
async function saveActivity(domain, duration) {
    // Ensure userId exists
    if (!userId) {
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['userId'], resolve);
        });
        if (result && result.userId) {
            userId = result.userId;
        } else {
            userId = 'user_' + Math.random().toString(36).substring(7);
            chrome.storage.local.set({ userId: userId });
        }
    }
    await doSaveActivity(domain, duration);
}

async function doSaveActivity(domain, duration) {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(['activityData'], async (result) => {
        let activityData = (result && result.activityData) || {};
        if (!activityData[today]) {
            activityData[today] = {};
        }
        if (!activityData[today][domain]) {
            activityData[today][domain] = 0;
        }
        activityData[today][domain] += duration;
        chrome.storage.local.set({ activityData });
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    date: today,
                    activityData: activityData[today]
                })
            });
            console.log('Data sent to backend');
        } catch (error) {
            console.log('Backend not reachable, data saved locally');
        }
    });
}

// Break reminder
function checkBreakReminder() {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get(['lastBreakReminder', 'activityData'], (result) => {
        const lastReminder = (result && result.lastBreakReminder) || '';
        const activityData = (result && result.activityData) || {};
        const todayData = activityData[today] || {};
        const totalSeconds = Object.values(todayData).reduce((a, b) => a + b, 0);
        const totalMinutes = Math.round(totalSeconds / 60);
        
        console.log('Break check: ' + totalMinutes + ' minutes today');
        
        if (totalMinutes > 60 && lastReminder !== today) {
            console.log('Sending break notification...');
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon-128.png',
                title: 'Mentis.co - Break Reminder',
                message: 'You\'ve been browsing for over an hour! Take a 5-minute break.',
                priority: 2
            }, (notificationId) => {
                if (chrome.runtime.lastError) {
                    console.error('Notification error:', chrome.runtime.lastError);
                } else {
                    console.log('Notification sent:', notificationId);
                }
            });
            chrome.storage.local.set({ lastBreakReminder: today });
        }
    });
}

// Set up alarm
chrome.alarms.create('breakReminder', { periodInMinutes: 15 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'breakReminder') {
        console.log('Break reminder alarm triggered');
        checkBreakReminder();
    }
});

// Track tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    if (currentTab && currentStartTime) {
        const duration = Date.now() - currentStartTime;
        if (duration > 1000) {
            await saveActivity(currentTab, duration);
        }
    }
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url.startsWith('http')) {
            const url = new URL(tab.url);
            currentTab = url.hostname.replace('www.', '');
            currentStartTime = Date.now();
        } else {
            currentTab = null;
            currentStartTime = null;
        }
    } catch (error) {
        console.log('Error getting tab:', error);
    }
});

// Track URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active && tab.url && tab.url.startsWith('http')) {
        if (currentTab && currentStartTime) {
            const duration = Date.now() - currentStartTime;
            if (duration > 1000) {
                await saveActivity(currentTab, duration);
            }
        }
        const url = new URL(tab.url);
        currentTab = url.hostname.replace('www.', '');
        currentStartTime = Date.now();
    }
});

console.log('Chrome/Edge background loaded successfully');