// chrome-extension/background.js - Fixed timeline durations

const API_URL = 'https://summarizer-app-ybx8.onrender.com/api/activity';

let currentTab = null;
let currentStartTime = null;
let currentDomain = null;
let userId = null;

// Safe storage access function
function getStorage() {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            return chrome.storage.local;
        }
        console.warn('Chrome storage not available');
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
        if (chrome.runtime.lastError) {
            console.error('Storage error:', chrome.runtime.lastError);
            userId = 'temp_' + Math.random().toString(36).substring(7);
            return;
        }
        
        if (result && result.userId) {
            userId = result.userId;
            console.log('Existing User ID:', userId);
        } else {
            userId = 'user_' + Math.random().toString(36).substring(7);
            storage.set({ userId: userId }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Storage set error:', chrome.runtime.lastError);
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getUserId') {
        const storage = getStorage();
        if (!storage) {
            const tempId = 'temp_' + Math.random().toString(36).substring(7);
            sendResponse({ userId: tempId });
            return true;
        }
        
        storage.get(['userId'], (result) => {
            if (chrome.runtime.lastError) {
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

// Save activity with proper start/end times
async function saveActivity(domain, duration, startTime, endTime) {
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
    await doSaveActivity(domain, duration, startTime, endTime);
}

async function doSaveActivity(domain, duration, startTime, endTime) {
    const storage = getStorage();
    if (!storage) return;
    
    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    
    // Use provided times or fallback to current
    const start = startTime || new Date(now.getTime() - duration).toISOString();
    const end = endTime || now.toISOString();
    
    console.log('📝 Saving activity for date:', today, 'domain:', domain, 'duration:', duration);
    
    storage.get(['activityData'], async (result) => {
        if (chrome.runtime.lastError) {
            console.error('Storage read error:', chrome.runtime.lastError);
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
        
        // Store site time (aggregated)
        if (!activityData[today].sites[domain]) {
            activityData[today].sites[domain] = 0;
        }
        activityData[today].sites[domain] += duration;
        activityData[today].totalTime += duration;
        
        // ✅ FIX: Store timeline entry with proper start and end times
        activityData[today].timeline.push({
            site: domain,
            duration: duration,
            startTime: start,
            endTime: end,
            timestamp: start
        });
        
        // Keep only last 500 timeline entries
        if (activityData[today].timeline.length > 500) {
            activityData[today].timeline = activityData[today].timeline.slice(-500);
        }
        
        console.log('💾 Saving data for', today, 'Total time:', activityData[today].totalTime);
        
        storage.set({ activityData }, () => {
            if (chrome.runtime.lastError) {
                console.error('Storage write error:', chrome.runtime.lastError);
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

// Track when user switches tabs - save the previous tab with proper end time
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // Save the previous tab if it was being tracked
    if (currentTab && currentStartTime && currentDomain) {
        const endTime = new Date().toISOString();
        const duration = Date.now() - currentStartTime;
        if (duration > 1000) {
            await saveActivity(currentDomain, duration, new Date(currentStartTime).toISOString(), endTime);
        }
        // Clear current tracking
        currentTab = null;
        currentStartTime = null;
        currentDomain = null;
    }
    
    // Start tracking the new tab
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab && tab.url && tab.url.startsWith('http')) {
            const url = new URL(tab.url);
            currentDomain = url.hostname.replace('www.', '');
            currentTab = tab.id;
            currentStartTime = Date.now();
            console.log('🔄 Started tracking:', currentDomain);
        } else {
            currentTab = null;
            currentStartTime = null;
            currentDomain = null;
        }
    } catch (error) {
        console.log('Error getting tab:', error);
    }
});

// Track URL changes within the same tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // If the URL changed and this is the active tab
    if (changeInfo.url && tab.active && tab.url && tab.url.startsWith('http')) {
        // Save the previous domain if it was being tracked
        if (currentDomain && currentStartTime && currentTab === tabId) {
            const endTime = new Date().toISOString();
            const duration = Date.now() - currentStartTime;
            if (duration > 1000) {
                await saveActivity(currentDomain, duration, new Date(currentStartTime).toISOString(), endTime);
            }
        }
        
        // Start tracking the new domain
        try {
            const url = new URL(tab.url);
            currentDomain = url.hostname.replace('www.', '');
            currentTab = tabId;
            currentStartTime = Date.now();
            console.log('🔄 Navigated to:', currentDomain);
        } catch (e) {
            console.log('Error parsing URL:', e);
        }
    }
});

// Save when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
    if (currentTab === tabId && currentDomain && currentStartTime) {
        const endTime = new Date().toISOString();
        const duration = Date.now() - currentStartTime;
        if (duration > 1000) {
            await saveActivity(currentDomain, duration, new Date(currentStartTime).toISOString(), endTime);
        }
        currentTab = null;
        currentStartTime = null;
        currentDomain = null;
    }
});

// Save when browser is about to close (if possible)
// Note: This is best effort, not guaranteed to run

// Break reminder
function checkBreakReminder() {
    const storage = getStorage();
    if (!storage) return;

    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');

    storage.get(['lastBreakReminder', 'activityData'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('Storage read error:', chrome.runtime.lastError);
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

            if (chrome.notifications) {
                try {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icons/icon-128.png',
                        title: '🧠 Mentiis.co - Break Reminder',
                        message: 'You\'ve been browsing for over an hour! Take a 5-minute break.',
                        priority: 2
                    }, (notificationId) => {
                        if (chrome.runtime.lastError) {
                            console.warn('Notification warning:', chrome.runtime.lastError.message);
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
    chrome.alarms.create('breakReminder', { periodInMinutes: 15 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'breakReminder') {
            console.log('Break reminder alarm triggered');
            checkBreakReminder();
        }
    });
} catch (e) {
    console.warn('Alarm setup error:', e);
}

console.log('🧠 Mentiis.co background loaded successfully');