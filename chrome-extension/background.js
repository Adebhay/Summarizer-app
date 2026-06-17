// background.js - Chrome Extension with Render URL

const API_URL = 'https://summarizer-app-ybx8.onrender.com/api/activity';

let currentTab = null;
let currentStartTime = null;
let userId = null;

chrome.storage.local.get(['userId'], (result) => {
    if (result.userId) {
        userId = result.userId;
    } else {
        userId = 'user_' + Math.random().toString(36).substring(7);
        chrome.storage.local.set({ userId: userId });
    }
    console.log('User ID:', userId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getUserId') {
        chrome.storage.local.get(['userId'], (result) => {
            sendResponse({ userId: result.userId });
        });
        return true;
    }
});

async function saveActivity(domain, duration) {
    if (!userId) {
        chrome.storage.local.get(['userId'], async (result) => {
            userId = result.userId;
            await doSaveActivity(domain, duration);
        });
    } else {
        await doSaveActivity(domain, duration);
    }
}

async function doSaveActivity(domain, duration) {
    const today = new Date().toISOString().split('T')[0];
    
    chrome.storage.local.get(['activityData'], async (result) => {
        let activityData = result.activityData || {};
        
        if (!activityData[today]) {
            activityData[today] = {};
        }
        
        if (!activityData[today][domain]) {
            activityData[today][domain] = 0;
        }
        
        activityData[today][domain] += duration;
        
        chrome.storage.local.set({ activityData });
        
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
            }
        } catch (error) {
            console.log('⚠️ Backend not reachable, data saved locally');
        }
    });
}

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

console.log('🚀 Chrome extension loaded!');