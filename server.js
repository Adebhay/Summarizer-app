// server.js - Complete backend with simplified CORS

const express = require('express');
const cors = require('cors');
const { generateSummary } = require('./vertex-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// CORS CONFIGURATION - SIMPLIFIED
// ============================================================

const EXTENSION_ID = 'hhgeknianklfnefejpjdglfanfbjmap';

// Manual CORS middleware
app.use((req, res, next) => {
    // Allow your Chrome extension
    res.header('Access-Control-Allow-Origin', `chrome-extension://${EXTENSION_ID}`);
    // Allow all methods
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    // Allow headers
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

// Backup CORS for local development
app.use(cors({
    origin: [
        `chrome-extension://${EXTENSION_ID}`,
        'http://localhost:3000',
        'http://localhost:3001'
    ]
}));

app.use(express.json());

// ============================================================
// Store user data in memory
// ============================================================

const userData = {};

// ============================================================
// ROUTES
// ============================================================

// Welcome page
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Productivity Tracker API is running!',
        status: 'online',
        endpoints: [
            { path: '/', method: 'GET', description: 'Welcome page' },
            { path: '/health', method: 'GET', description: 'Health check' },
            { path: '/api/activity', method: 'POST', description: 'Save activity' },
            { path: '/api/activity/:userId/:date', method: 'GET', description: 'Get activity' },
            { path: '/api/summarize', method: 'POST', description: 'Generate AI summary' }
        ]
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Save activity
app.post('/api/activity', (req, res) => {
    const { userId, date, activityData } = req.body;
    
    console.log(`📊 Received activity for ${userId} on ${date}`);
    
    if (!userData[userId]) {
        userData[userId] = {};
    }
    userData[userId][date] = activityData;
    
    res.json({ 
        success: true, 
        message: 'Activity saved successfully!' 
    });
});

// Get activity
app.get('/api/activity/:userId/:date', (req, res) => {
    const { userId, date } = req.params;
    
    const activity = userData[userId]?.[date] || null;
    
    res.json({ 
        success: true, 
        activity 
    });
});

// Generate AI summary
app.post('/api/summarize', async (req, res) => {
    const { userId, date } = req.body;
    
    console.log(`🤖 Generating summary for ${userId} on ${date}`);
    
    const activity = userData[userId]?.[date];
    if (!activity) {
        return res.json({ 
            success: false, 
            message: 'No activity found for this date. Browse more websites first!' 
        });
    }
    
    try {
        const summary = await generateSummary(activity);
        res.json({ success: true, summary });
    } catch (error) {
        console.error('❌ AI Error:', error.message);
        res.json({ 
            success: false, 
            error: 'Failed to generate summary',
            details: error.message 
        });
    }
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 PRODUCTIVITY TRACKER SERVER');
    console.log('='.repeat(50));
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📊 Health check: /health`);
    console.log(`🔗 CORS allowed for extension ID: ${EXTENSION_ID}`);
    console.log('='.repeat(50));
    console.log('Press Ctrl+C to stop the server');
    console.log('='.repeat(50));
});