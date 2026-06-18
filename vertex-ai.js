// vertex-ai.js - Enhanced AI with breaks, hydration, and bullet format

const { GoogleGenerativeAI } = require('@google/generative-ai');
const API_KEY = process.env.GEMINI_API_KEY;

function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 5) return "Late night browsing! Remember to get some rest.";
    if (hour < 8) return "Early riser! You're getting a head start on the day.";
    if (hour < 12) return "Good morning! How's your focus today?";
    if (hour < 14) return "Good afternoon! How's your day going so far?";
    if (hour < 17) return "Good afternoon! Hope you're having a productive day.";
    if (hour < 20) return "Good evening! How did your day go?";
    if (hour < 23) return "Good evening! Winding down for the night?";
    return "Late night! Don't forget to get some quality sleep.";
}

function getEncouragement() {
    const phrases = [
        'Every day is a new opportunity to grow.',
        'Small steps lead to big changes.',
        'Your efforts are building momentum.',
        'Keep pushing forward - progress is progress.',
        'Every productive moment adds up.',
        'Consistency is the key to success.',
        'You\'re building habits that will last.',
        'Your focus today is an investment in tomorrow.',
        'Small improvements compound over time.',
        'You\'re getting closer to your goals.',
        'Be proud of what you accomplished today.',
        'You\'re doing better than you think.',
        'Your dedication is inspiring.',
        'Celebrate the wins - no matter how small.',
        'You have the power to shape your day.'
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
}

async function generateSummary(activityData, userId) {
    try {
        if (!API_KEY) {
            console.error('GEMINI_API_KEY not set');
            return generateFallbackSummary(activityData);
        }

        console.log('Using API Key authentication...');
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const totalTime = Object.values(activityData).reduce((a, b) => a + b, 0);
        const totalMinutes = Math.round(totalTime / 60);
        const totalSites = Object.keys(activityData).length;
        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;
        
        const topSites = Object.entries(activityData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([site, seconds]) => `${site} (${Math.round(seconds / 60)} min)`)
            .join(', ');
        
        const timeGreeting = getTimeBasedGreeting();
        const encouragement = getEncouragement();
        
        const prompt = `You are a friendly, supportive AI productivity coach for "Mentis.co".

${timeGreeting}

I hope you're having a productive day! Here's your personalized coaching summary:

USER DATA:
- Total time: ${totalHours}h ${remainingMinutes}m
- Total sites: ${totalSites}
- Top sites: ${topSites}
- Total minutes: ${totalMinutes}

Please create a DAILY COACHING SUMMARY with these EXACT sections in this format:

CONTEXT:
• [1 sentence analyzing their browsing pattern - be specific about what they focused on]

INSIGHT:
• [1 encouraging insight about their productivity - celebrate what they did well]

RECOMMENDATION:
• [1 specific, actionable recommendation for tomorrow - be practical and helpful]

HYDRATION & BREAKS:
• [If totalMinutes > 120: "You've been browsing for over 2 hours today. Your brain needs rest! Try the Pomodoro Technique: 25 minutes work, 5 minutes break."]
• [If totalMinutes <= 120: "Good job keeping your screen time moderate. Stay hydrated and keep it up!"]

${encouragement}

REFLECT:
• [1 thoughtful question to help them improve tomorrow]

Keep it warm, supportive, and specific. Use bullet points (•) for each section.

IMPORTANT: Do NOT include any copyright or footer text. The copyright belongs in the app footer, not in this summary.`;

        console.log('Sending to Gemini...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();
        console.log('AI Response received');
        return summary;
    } catch (error) {
        console.error('AI Error:', error.message);
        return generateFallbackSummary(activityData);
    }
}

function generateFallbackSummary(activityData) {
    const totalMinutes = Math.round(Object.values(activityData).reduce((a, b) => a + b, 0) / 60);
    const totalSites = Object.keys(activityData).length;
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const topSites = Object.entries(activityData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([site, seconds]) => `${site} (${Math.round(seconds / 60)} min)`)
        .join(', ');
    
    const timeGreeting = getTimeBasedGreeting();
    const encouragement = getEncouragement();
    
    let message = '';
    let breakAdvice = '';
    if (totalMinutes < 30) {
        message = 'Light browsing day! You kept your screen time minimal today.';
        breakAdvice = 'Great job! You had plenty of time for breaks.';
    } else if (totalMinutes < 90) {
        message = 'Good balance today! You spent about 1.5 hours online.';
        breakAdvice = 'You maintained a healthy screen time balance.';
    } else if (totalMinutes < 180) {
        message = `You spent ${totalHours}h ${remainingMinutes}m online today - solid focus time!`;
        breakAdvice = 'Remember to take a 5-minute break every 25 minutes tomorrow.';
    } else if (totalMinutes < 300) {
        message = `You were online for ${totalHours}h ${remainingMinutes}m today.`;
        breakAdvice = 'That\'s a lot of screen time! Schedule 5-minute breaks every 25 minutes.';
    } else {
        message = `You spent ${totalHours}h ${remainingMinutes}m online today - that's significant.`;
        breakAdvice = 'Your eyes and brain need rest. Try the Pomodoro Technique tomorrow!';
    }

    return `${timeGreeting}

I hope you're having a productive day! Here's your daily coaching summary:

CONTEXT:
• You visited ${totalSites} websites today. Your top sites were: ${topSites}.

INSIGHT:
• ${message}

RECOMMENDATION:
• ${totalMinutes > 120 ? 'Try taking a 5-minute break every 25 minutes tomorrow.' : 'Keep building this habit - consistency is key!'}

HYDRATION & BREAKS:
• ${breakAdvice}

${encouragement}

REFLECT:
• What's one thing you could improve about your focus tomorrow?`;
}

module.exports = { generateSummary };