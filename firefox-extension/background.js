// browser-extension/background.js - Complete Clean Version

const API_URL = 'https://summarizer-app-ybx8.onrender.com/api/activity';

let currentTab = null;
let currentStartTime = null;
let userId = null;

// Safe storage access function
function getStorage() {
    try {
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
            return browser.storage.local;
        }
        console.warn('browser storage not available');
        return null;
    } catch (e) {
        console.warn('Storage access error:', e);
        return null;
    }
}

// Initialize user ID
function initializeUserId() {
    const storage = getStorage();
    if (!storage) {
        console.error('Storage not available, using temporary ID');
        userId = 'temp_' + Math.random().toString(36).substring(7);
        return;
    }
    
    storage.get(['userId'], (result) => {
        console.log('Storage result:', result);
        if (browser.runtime.lastError) {
            console.error('Storage error:', browser.runtime.lastError);
            userId = 'temp_' + Math.random().toString(36).substring(7);
            return;
        }
        
        if (result && result.userId) {
            userId = result.userId;
            console.log('Existing User ID:', userId);
        } else {
            userId = 'user_' + Math.random().toString(36).substring(7);
            storage.set({ userId: userId }, () => {
                if (browser.runtime.lastError) {
                    console.error('Storage set error:', browser.runtime.lastError);
                } else {
                    console.log('New User ID created:', userId);
                }
            });
        }
    });
}

// Call initialization
initializeUserId();

// Make userId available to popup
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getUserId') {
        const storage = getStorage();
        if (!storage) {
            const tempId = 'temp_' + Math.random().toString(36).substring(7);
            sendResponse({ userId: tempId });
            return true;
        }
        
        storage.get(['userId'], (result) => {
            if (browser.runtime.lastError) {
                const tempId = 'temp_' + Math.random().toString(36).substring(7);
                sendResponse({ userId: tempId });
                return;
            }
            
            if (result && result.userId) {
                sendResponse({ userId: result.userId });
            } else {
                const newUserId = 'user_' + Math.random().toString(36).substring(7);
                storage.set({ userId: newUserId }, () => {
                    sendResponse({ userId: newUserId });
                });
            }
        });
        return true;
    }
});

// Save activity with timestamp tracking
async function saveActivity(domain, duration) {
    const storage = getStorage();
    if (!storage) {
        console.log('Storage not available, skipping save');
        return;
    }
    
    if (!userId) {
        const result = await new Promise((resolve) => {
            storage.get(['userId'], resolve);
        });
        if (result && result.userId) {
            userId = result.userId;
        } else {
            userId = 'user_' + Math.random().toString(36).substring(7);
            storage.set({ userId: userId });
        }
    }
    await doSaveActivity(domain, duration);
}

async function doSaveActivity(domain, duration) {
    const storage = getStorage();
    if (!storage) return;
    
    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    const timestamp = now.toISOString();
    const startTime = new Date(now.getTime() - duration).toISOString();
    
    console.log('📝 Saving activity for date:', today, 'domain:', domain, 'duration:', duration);
    
    storage.get(['activityData'], async (result) => {
        if (browser.runtime.lastError) {
            console.error('Storage read error:', browser.runtime.lastError);
            return;
        }
        
        let activityData = (result && result.activityData) || {};
        
        if (!activityData[today]) {
            activityData[today] = {
                sites: {},
                timeline: [],
                totalTime: 0
            };
        }
        
        if (!activityData[today].sites) {
            activityData[today].sites = {};
        }
        if (!activityData[today].timeline) {
            activityData[today].timeline = [];
        }
        if (typeof activityData[today].totalTime !== 'number') {
            activityData[today].totalTime = 0;
        }
        
        if (!activityData[today].sites[domain]) {
            activityData[today].sites[domain] = 0;
        }
        activityData[today].sites[domain] += duration;
        activityData[today].totalTime += duration;
        
        activityData[today].timeline.push({
            site: domain,
            duration: duration,
            startTime: startTime,
            endTime: timestamp,
            timestamp: timestamp
        });
        
        if (activityData[today].timeline.length > 500) {
            activityData[today].timeline = activityData[today].timeline.slice(-500);
        }
        
        console.log('💾 Saving data for', today, 'Total time:', activityData[today].totalTime);
        
        storage.set({ activityData }, () => {
            if (browser.runtime.lastError) {
                console.error('Storage write error:', browser.runtime.lastError);
            } else {
                console.log('✅ Data saved successfully for', today);
            }
        });
        
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    date: today,
                    activityData: activityData[today].sites,
                    timeline: activityData[today].timeline,
                    totalTime: activityData[today].totalTime
                })
            });
            console.log('📤 Data sent to backend for', today);
        } catch (error) {
            console.log('⚠️ Backend not reachable, data saved locally');
        }
    });
}

// Break reminder - COMPLETE FIXED VERSION
function checkBreakReminder() {
    const storage = getStorage();
    if (!storage) return;

    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');

    storage.get(['lastBreakReminder', 'activityData'], (result) => {
        if (browser.runtime.lastError) {
            console.error('Storage read error:', browser.runtime.lastError);
            return;
        }

        const lastReminder = (result && result.lastBreakReminder) || '';
        const activityData = (result && result.activityData) || {};
        const todayData = activityData[today] || {};
        const sites = todayData.sites || {};
        const totalSeconds = Object.values(sites).reduce((a, b) => a + b, 0);
        const totalMinutes = Math.round(totalSeconds / 60);

        console.log('Break check:', totalMinutes, 'minutes today');

        if (totalMinutes > 60 && lastReminder !== today) {
            console.log('Sending break notification...');

            if (browser.notifications) {
                try {
                    browser.notifications.create({
                        type: 'basic',
                        iconUrl: 'icons/icon-128.png',
                        title: '🧠 Mentiis.co - Break Reminder',
                        message: 'You\'ve been browsing for over an hour! Take a 5-minute break.',
                        priority: 2
                    }, (notificationId) => {
                        if (browser.runtime.lastError) {
                            console.warn('Notification warning:', browser.runtime.lastError.message);
                        } else {
                            console.log('✅ Notification sent:', notificationId);
                        }
                    });
                } catch (e) {
                    console.warn('Notification creation error:', e.message);
                }
            } else {
                console.log('Notifications API not available');
            }

            storage.set({ lastBreakReminder: today });
        }
    });
}

// Set up alarm
try {
    browser.alarms.create('breakReminder', { periodInMinutes: 15 });
    browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'breakReminder') {
            console.log('Break reminder alarm triggered');
            checkBreakReminder();
        }
    });
} catch (e) {
    console.warn('Alarm setup error:', e);
}

// Track tab changes
browser.tabs.onActivated.addListener(async (activeInfo) => {
    if (currentTab && currentStartTime) {
        const duration = Date.now() - currentStartTime;
        if (duration > 1000) {
            await saveActivity(currentTab, duration);
        }
    }
    try {
        const tab = await browser.tabs.get(activeInfo.tabId);
        if (tab && tab.url && tab.url.startsWith('http')) {
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
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active && tab.url && tab.url.startsWith('http')) {
        if (currentTab && currentStartTime) {
            const duration = Date.now() - currentStartTime;
            if (duration > 1000) {
                await saveActivity(currentTab, duration);
            }
        }
        try {
            const url = new URL(tab.url);
            currentTab = url.hostname.replace('www.', '');
            currentStartTime = Date.now();
        } catch (e) {
            console.log('Error parsing URL:', e);
        }
    }
});

console.log('🧠 Mentiis.co background loaded successfully');