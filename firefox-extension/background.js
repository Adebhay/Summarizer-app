// background.js - Firefox Extension

const API_URL = 'https://summarizer-app-ybx8.onrender.com/api/activity';

let currentTab = null;
let currentStartTime = null;
let userId = null;

browser.storage.local.get(['userId']).then((result) => {
    if (result.userId) {
        userId = result.userId;
    } else {
        userId = 'user_' + Math.random().toString(36).substring(7);
        browser.storage.local.set({ userId: userId });
    }
    console.log('🔥 Firefox - User ID:', userId);
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getUserId') {
        browser.storage.local.get(['userId']).then((result) => {
            sendResponse({ userId: result.userId });
        });
        return true;
    }
});

async function saveActivity(domain, duration) {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await browser.storage.local.get(['activityData']);
    let activityData = result.activityData || {};
    
    if (!activityData[today]) {
        activityData[today] = {};
    }
    
    if (!activityData[today][domain]) {
        activityData[today][domain] = 0;
    }
    
    activityData[today][domain] += duration;
    
    await browser.storage.local.set({ activityData });
    
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
        console.log('✅ Data sent to backend');
    } catch (error) {
        console.log('⚠️ Backend not reachable, data saved locally');
    }
}

browser.tabs.onActivated.addListener(async (activeInfo) => {
    if (currentTab && currentStartTime) {
        const duration = Date.now() - currentStartTime;
        if (duration > 1000) {
            await saveActivity(currentTab, duration);
        }
    }
    
    try {
        const tab = await browser.tabs.get(activeInfo.tabId);
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

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
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

console.log('🔥 Firefox extension loaded!');