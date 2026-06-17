// vertex-ai.js - Uses API Key (NO JSON credentials!)

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Get API key from environment variable
const API_KEY = process.env.GEMINI_API_KEY;

// ============================================================
// TIME-BASED GREETING
// ============================================================
function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 5) return "🌙 Late night browsing! Remember to get some rest.";
    if (hour < 8) return "🌅 Early riser! You're getting a head start on the day.";
    if (hour < 12) return "☀️ Good morning! How's your focus today?";
    if (hour < 14) return "🌤️ Good afternoon! How's your day going so far?";
    if (hour < 17) return "🌤️ Good afternoon! Hope you're having a productive day.";
    if (hour < 20) return "🌅 Good evening! How did your day go?";
    if (hour < 23) return "🌙 Good evening! Winding down for the night?";
    return "🌙 Late night! Don't forget to get some quality sleep.";
}

// ============================================================
// RANDOM ENCOURAGEMENT
// ============================================================
function getEncouragement() {
    const phrases = [
        '🌱 Every day is a new opportunity to grow.',
        '🌟 Small steps lead to big changes.',
        '💪 Your efforts are building momentum.',
        '🔥 Keep pushing forward - progress is progress.',
        '🌈 Every productive moment adds up.',
        '🏆 Consistency is the key to success.',
        '⭐ You\'re building habits that will last.',
        '💎 Your focus today is an investment in tomorrow.',
        '🚀 Small improvements compound over time.',
        '🎯 You\'re getting closer to your goals.',
        '👏 Be proud of what you accomplished today.',
        '🌟 You\'re doing better than you think.',
        '💪 Your dedication is inspiring.',
        '🎉 Celebrate the wins - no matter how small.',
        '✨ You have the power to shape your day.'
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
}

// ============================================================
// GENERATE SUMMARY
// ============================================================
async function generateSummary(activityData, userId) {
    try {
        if (!API_KEY) {
            console.error('❌ GEMINI_API_KEY not set in environment variables');
            return generateFallbackSummary(activityData);
        }

        console.log('🔑 Using API Key authentication...');
        
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        // Calculate metrics
        const totalTime = Object.values(activityData).reduce((a, b) => a + b, 0);
        const totalMinutes = Math.round(totalTime / 60);
        const totalSites = Object.keys(activityData).length;
        
        const topSites = Object.entries(activityData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([site, seconds]) => `${site} (${Math.round(seconds / 60)} min)`)
            .join(', ');
        
        const timeGreeting = getTimeBasedGreeting();
        const encouragement = getEncouragement();
        
        // Build prompt
        const prompt = `You are a friendly AI productivity coach for "Mentis.co". 

${timeGreeting}

TODAY'S DATA:
- Total time: ${totalMinutes} minutes
- Total sites: ${totalSites}
- Top sites: ${topSites}

Create a DAILY COACHING SUMMARY with these sections:

1. 🧠 CONTEXT: Analyze their browsing pattern in 1 sentence.

2. 💡 INSIGHT: Give one encouraging insight about their productivity in 1 sentence.

3. 🎯 RECOMMENDATION: Give one specific, actionable recommendation for tomorrow in 1 sentence.

4. 💬 ENCOURAGEMENT: "${encouragement}"

5. 💭 REFLECT: Ask one thoughtful question.

Keep it short, warm, and supportive. Use clear headings.`;

        console.log('📝 Sending to Gemini...');
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();
        
        console.log('✅ AI Response received');
        return summary;
    } catch (error) {
        console.error('❌ AI Error:', error.message);
        return generateFallbackSummary(activityData);
    }
}

// ============================================================
// FALLBACK SUMMARY
// ============================================================
function generateFallbackSummary(activityData) {
    const totalMinutes = Math.round(Object.values(activityData).reduce((a, b) => a + b, 0) / 60);
    const totalSites = Object.keys(activityData).length;
    const topSites = Object.entries(activityData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([site, seconds]) => `${site} (${Math.round(seconds / 60)} min)`)
        .join(', ');
    
    const timeGreeting = getTimeBasedGreeting();
    const encouragement = getEncouragement();
    
    let message = '';
    if (totalMinutes < 30) message = 'Light browsing day! 🌱';
    else if (totalMinutes < 90) message = 'Good balance today! ✅';
    else if (totalMinutes < 180) message = 'You stayed focused for a solid amount of time! 💪';
    else if (totalMinutes < 300) message = 'You put in serious work today. Remember to take breaks! 🌟';
    else message = 'That\'s a lot of screen time. Consider setting daily limits. 🧠';
    
    return `${timeGreeting}

🧠 Context: You spent ${totalMinutes} minutes on ${totalSites} websites today. Top sites: ${topSites}.

💡 Insight: ${message}

🎯 Recommendation: ${totalMinutes > 180 ? 'Try taking a 5-minute break every 25 minutes tomorrow.' : 'Keep building this habit - consistency is key!'}

💬 ${encouragement}

💭 Reflect: What's one thing you could improve about your focus tomorrow?

© 2026 Mentis.co`;
}

module.exports = { generateSummary };