// firefox-extension/background.js

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
    console.log('Firefox User ID:', userId);
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
    if (!activityData[today]) activityData[today] = {};
    if (!activityData[today][domain]) activityData[today][domain] = 0;
    activityData[today][domain] += duration;
    await browser.storage.local.set({ activityData });
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, date: today, activityData: activityData[today] })
        });
    } catch (error) {
        console.log('Backend not reachable, data saved locally');
    }
}

// Break reminder
function checkBreakReminder() {
    const today = new Date().toISOString().split('T')[0];
    browser.storage.local.get(['lastBreakReminder', 'activityData']).then((result) => {
        const lastReminder = result.lastBreakReminder || '';
        const activityData = result.activityData || {};
        const todayData = activityData[today] || {};
        const totalSeconds = Object.values(todayData).reduce((a, b) => a + b, 0);
        const totalMinutes = Math.round(totalSeconds / 60);
        
        console.log(`Break check: ${totalMinutes} minutes today, last reminder: ${lastReminder}`);
        
        if (totalMinutes > 60 && lastReminder !== today) {
            console.log('🔔 Sending break notification...');
            browser.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon-128.png',
                title: '🧠 Mentis.co - Break Reminder',
                message: 'You\'ve been browsing for over an hour! Take a 5-minute break to rest your eyes and hydrate. 💧'
            }).then((notificationId) => {
                console.log('✅ Notification sent:', notificationId);
            }).catch((error) => {
                console.error('Notification error:', error);
            });
            browser.storage.local.set({ lastBreakReminder: today });
        }
    });
}

browser.alarms.create('breakReminder', { periodInMinutes: 15 });
browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'breakReminder') {
        console.log('⏰ Break reminder alarm triggered');
        checkBreakReminder();
    }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
    if (currentTab && currentStartTime) {
        const duration = Date.now() - currentStartTime;
        if (duration > 1000) await saveActivity(currentTab, duration);
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
    } catch (error) { console.log('Error getting tab:', error); }
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active && tab.url && tab.url.startsWith('http')) {
        if (currentTab && currentStart