// auth.js - Handles authentication using ADC with explicit project ID
const { GoogleAuth } = require('google-auth-library');

// Your project ID from Google Cloud Console
const PROJECT_ID = 'summarizer-app-499613';

async function getProjectId() {
    return PROJECT_ID;
}

async function getAuthClient() {
    try {
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            projectId: PROJECT_ID
        });
        return await auth.getClient();
    } catch (error) {
        console.error('❌ Auth Client Error:', error);
        throw error;
    }
}

module.exports = { getProjectId, getAuthClient, PROJECT_ID };