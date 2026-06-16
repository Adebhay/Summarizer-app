// vertex-ai.js - Uses Vertex AI with gemini-pro (works!)
const { VertexAI } = require('@google-cloud/vertexai');
const { getAuthClient, PROJECT_ID } = require('./auth');

async function generateSummary(activityData) {
    try {
        console.log('📋 Using Project ID:', PROJECT_ID);
        
        // Get auth client
        const authClient = await getAuthClient();
        console.log('✅ Auth client obtained');
        
        // Initialize Vertex AI with explicit project ID
        const vertexAI = new VertexAI({
            project: PROJECT_ID,
            location: 'us-central1',
            googleAuth: {
                authClient: authClient
            }
        });
        
        // Use gemini-pro (works in most regions)
        const model = vertexAI.getGenerativeModel({
            model: 'gemini-pro',
        });
        
        // Calculate total time
        const totalTime = Object.values(activityData).reduce((a, b) => a + b, 0);
        const totalMinutes = Math.round(totalTime / 60);
        const totalSites = Object.keys(activityData).length;
        
        // Format the prompt
        const prompt = `You are a friendly productivity coach. The user spent ${totalMinutes} minutes browsing ${totalSites} websites today.

Their activity breakdown:
${Object.entries(activityData)
    .sort((a, b) => b[1] - a[1]) // Sort by time spent
    .map(([site, seconds]) => `- ${site}: ${Math.round(seconds / 60)} minutes`)
    .join('\n')}

Write a 2-sentence summary encouraging them to be productive tomorrow. Be specific, actionable, and encouraging.`;
        
        console.log('📝 Sending prompt to Gemini...');
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        // Get the summary text
        const summary = response.candidates[0].content.parts[0].text;
        
        console.log('✅ AI Response received');
        return summary;
    } catch (error) {
        console.error('❌ Vertex AI Error:', error.message);
        
        // Fallback summary if AI fails
        return generateFallbackSummary(activityData);
    }
}

// Fallback summary (works without AI)
function generateFallbackSummary(activityData) {
    const totalMinutes = Math.round(Object.values(activityData).reduce((a, b) => a + b, 0) / 60);
    const topSites = Object.entries(activityData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([site, seconds]) => `${site} (${Math.round(seconds / 60)} min)`)
        .join(', ');
    
    const totalSites = Object.keys(activityData).length;
    
    // Different messages based on time
    let message = '';
    if (totalMinutes < 30) {
        message = 'Great job limiting screen time today!';
    } else if (totalMinutes < 120) {
        message = 'You had a productive browsing session today!';
    } else if (totalMinutes < 240) {
        message = 'Good focus today! Remember to take regular breaks.';
    } else {
        message = 'That\'s a lot of screen time. Consider setting daily limits for better balance.';
    }
    
    return `📊 Daily Summary: You spent ${totalMinutes} minutes on ${totalSites} websites. Top sites: ${topSites}. ${message}`;
}

module.exports = { generateSummary };