// auth.js - Simplified (No JSON credentials needed)

const PROJECT_ID = 'summarizer-app-499613';

function getProjectId() {
    return PROJECT_ID;
}

// Export a dummy function for compatibility
async function getAuthClient() {
    console.log('ℹ️ Using API key authentication (auth.js not needed)');
    return null;
}

module.exports = { getProjectId, getAuthClient, PROJECT_ID };