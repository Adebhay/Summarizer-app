// vertex-ai.js - Enhanced AI summary with time-based, mood-based, and random encouragement

const { VertexAI } = require('@google-cloud/vertexai');
const { getAuthClient, PROJECT_ID } = require('./auth');

// In-memory storage for user history (for streaks and comparisons)
const userHistory = {};

// ============================================================
// DYNAMIC ELEMENTS
// ============================================================

// 1. TIME-BASED MESSAGES
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

// 2. MOOD-BASED TONE
function getMoodBasedTone(productivityRatio, totalMinutes, streak) {
    // Calculate a "mood score" based on multiple factors
    let moodScore = 0;
    
    // Productivity ratio contributes 40%
    if (productivityRatio >= 80) moodScore += 40;
    else if (productivityRatio >= 60) moodScore += 30;
    else if (productivityRatio >= 40) moodScore += 20;
    else if (productivityRatio >= 20) moodScore += 10;
    else moodScore += 0;
    
    // Time spent contributes 30% (moderate time is best)
    if (totalMinutes >= 60 && totalMinutes <= 180) moodScore += 30;
    else if (totalMinutes >= 180 && totalMinutes <= 300) moodScore += 20;
    else if (totalMinutes < 30) moodScore += 10; // Too little time
    else if (totalMinutes > 300) moodScore += 5; // Too much time
    else moodScore += 15;
    
    // Streak contributes 30%
    if (streak >= 7) moodScore += 30;
    else if (streak >= 3) moodScore += 20;
    else if (streak >= 1) moodScore += 10;
    else moodScore += 0;
    
    // Determine mood based on score
    if (moodScore >= 80) {
        return {
            tone: '🎉 Celebratory and Excited',
            style: 'You are absolutely crushing it! Your focus and consistency are outstanding.',
            energy: 'high',
            emoji: '🌟'
        };
    } else if (moodScore >= 60) {
        return {
            tone: '😊 Encouraging and Supportive',
            style: 'You\'re on the right track! Your efforts are paying off.',
            energy: 'medium-high',
            emoji: '💪'
        };
    } else if (moodScore >= 40) {
        return {
            tone: '🌱 Gentle and Understanding',
            style: 'Every day is a chance to grow. You\'re building better habits.',
            energy: 'medium',
            emoji: '🌱'
        };
    } else if (moodScore >= 20) {
        return {
            tone: '🧠 Thoughtful and Reflective',
            style: 'Today might not have been perfect, but tomorrow is a fresh start.',
            energy: 'low-medium',
            emoji: '🤔'
        };
    } else {
        return {
            tone: '💙 Compassionate and Supportive',
            style: 'We all have off days. The important thing is to learn and move forward.',
            energy: 'low',
            emoji: '💙'
        };
    }
}

// 3. RANDOM ENCOURAGEMENT PHRASES
function getRandomEncouragement() {
    const phrases = [
        // Growth mindset
        '🌱 Every day is a new opportunity to grow.',
        '🌟 Small steps lead to big changes.',
        '💪 Your efforts are building momentum.',
        '🔥 Keep pushing forward - progress is progress.',
        '🌈 Every productive moment adds up.',
        
        // Persistence
        '🏆 Consistency is the key to success.',
        '⭐ You\'re building habits that will last.',
        '💎 Your focus today is an investment in tomorrow.',
        '🚀 Small improvements compound over time.',
        '🎯 You\'re getting closer to your goals.',
        
        // Encouragement
        '👏 Be proud of what you accomplished today.',
        '🌟 You\'re doing better than you think.',
        '💪 Your dedication is inspiring.',
        '🎉 Celebrate the wins - no matter how small.',
        '✨ You have the power to shape your day.',
        
        // Reflection
        '🤔 What made today feel productive?',
        '💡 What\'s one thing you learned today?',
        '🎯 What\'s your focus for tomorrow?',
        '🌟 How can you make tomorrow even better?',
        '💪 What\'s one habit you want to build?'
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
}

// 4. PRODUCTIVITY INSIGHT BASED ON RATIO
function getProductivityInsight(productiveMinutes, distractingMinutes, totalMinutes) {
    const ratio = totalMinutes > 0 ? Math.round((productiveMinutes / totalMinutes) * 100) : 0;
    
    if (ratio >= 80) {
        return {
            title: '🌟 You\'re in the zone!',
            insight: `You spent ${productiveMinutes} minutes on productive work today. That's an incredible ${ratio}% focus rate!`,
            advice: 'Try to replicate this tomorrow. What helped you focus today?'
        };
    } else if (ratio >= 60) {
        return {
            title: '👍 Good balance today!',
            insight: `You spent ${productiveMinutes} minutes on productive work and ${distractingMinutes} minutes on other things. That's a solid ${ratio}% productivity ratio.`,
            advice: 'Can you identify what distracted you today? Try to minimize it tomorrow.'
        };
    } else if (ratio >= 40) {
        return {
            title: '🌱 Room to grow',
            insight: `You spent ${productiveMinutes} minutes on productive work and ${distractingMinutes} minutes on distractions. Your productivity ratio was ${ratio}%.`,
            advice: 'Try blocking distractions for the first hour of work tomorrow.'
        };
    } else if (ratio >= 20) {
        return {
            title: '🧠 A learning day',
            insight: `You spent ${productiveMinutes} minutes on productive work and ${distractingMinutes} minutes on other things. Your focus was scattered today.`,
            advice: 'Tomorrow, try starting with a 25-minute "focus sprint" on your most important task.'
        };
    } else {
        return {
            title: '💙 A fresh start tomorrow',
            insight: `You spent most of your time on distractions today. That's okay - it happens to everyone.`,
            advice: 'Tomorrow, try the "Pomodoro Technique": 25 minutes of work, 5 minutes break.'
        };
    }
}

// ============================================================
// MAIN SUMMARY FUNCTION
// ============================================================

async function generateSummary(activityData, userId) {
    try {
        console.log('📋 Using Project ID:', PROJECT_ID);
        
        const authClient = await getAuthClient();
        
        const vertexAI = new VertexAI({
            project: PROJECT_ID,
            location: 'us-central1',
            googleAuth: {
                authClient: authClient
            }
        });
        
        const model = vertexAI.getGenerativeModel({
            model: 'gemini-pro',
        });
        
        // Calculate metrics
        const totalTime = Object.values(activityData).reduce((a, b) => a + b, 0);
        const totalMinutes = Math.round(totalTime / 60);
        const totalSites = Object.keys(activityData).length;
        
        // Get yesterday's data for comparison
        let yesterdayData = null;
        let yesterdayMinutes = 0;
        
        if (userHistory[userId]) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = yesterday.toISOString().split('T')[0];
            yesterdayData = userHistory[userId][yesterdayKey];
            if (yesterdayData) {
                yesterdayMinutes = Math.round(Object.values(yesterdayData).reduce((a, b) => a + b, 0) / 60);
            }
        }
        
        // Calculate productivity ratio
        const productiveSites = ['github.com', 'stackoverflow.com', 'docs.', 'medium.com', 'notion', 'slack', 'chat.deepseek.com', 'ciscopartnerinnovationchallenge.com', 'google.com', 'mail.google.com', 'drive.google.com', 'calendar.google.com'];
        let productiveTime = 0;
        let distractingTime = 0;
        
        for (const [site, seconds] of Object.entries(activityData)) {
            const isProductive = productiveSites.some(p => site.includes(p));
            if (isProductive) {
                productiveTime += seconds;
            } else {
                distractingTime += seconds;
            }
        }
        
        const productiveMinutes = Math.round(productiveTime / 60);
        const distractingMinutes = Math.round(distractingTime / 60);
        const productivityRatio = totalMinutes > 0 ? Math.round((productiveMinutes / totalMinutes) * 100) : 0;
        
        // Calculate streak
        let streak = 0;
        if (userHistory[userId]) {
            const today = new Date().toISOString().split('T')[0];
            let checkDate = new Date();
            checkDate.setDate(checkDate.getDate() - 1);
            
            while (true) {
                const key = checkDate.toISOString().split('T')[0];
                const dayData = userHistory[userId][key];
                if (dayData) {
                    const dayMinutes = Math.round(Object.values(dayData).reduce((a, b) => a + b, 0) / 60);
                    if (dayMinutes > 30) {
                        streak++;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
                checkDate.setDate(checkDate.getDate() - 1);
            }
        }
        
        // Store today's data for future comparisons
        if (!userHistory[userId]) {
            userHistory[userId] = {};
        }
        const todayKey = new Date().toISOString().split('T')[0];
        userHistory[userId][todayKey] = activityData;
        
        // ============================================================
        // DYNAMIC ELEMENTS
        // ============================================================
        
        const timeGreeting = getTimeBasedGreeting();
        const mood = getMoodBasedTone(productivityRatio, totalMinutes, streak);
        const encouragement = getRandomEncouragement();
        const productivityInsight = getProductivityInsight(productiveMinutes, distractingMinutes, totalMinutes);
        
        // Build the enhanced prompt
        const prompt = `You are a friendly, supportive AI productivity coach for "Mentis.co".

${timeGreeting}

📊 USER DATA FOR TODAY:
- Total time: ${totalMinutes} minutes
- Total sites: ${totalSites}
- Top sites:
${Object.entries(activityData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([site, seconds]) => `  - ${site}: ${Math.round(seconds / 60)} minutes`)
    .join('\n')}

📈 PRODUCTIVITY METRICS:
- Productive time: ${productiveMinutes} minutes (${productivityRatio}%)
- Distracting time: ${distractingMinutes} minutes (${100 - productivityRatio}%)
- Productivity insight: ${productivityInsight.title}

${yesterdayData ? `📊 COMPARED TO YESTERDAY: ${yesterdayMinutes} minutes (${totalMinutes > yesterdayMinutes ? '🔥 ' + (totalMinutes - yesterdayMinutes) + ' minutes MORE' : '📉 ' + (yesterdayMinutes - totalMinutes) + ' minutes LESS'})` : ''}

🏆 STREAK: ${streak} day${streak !== 1 ? 's' : ''} of productive days!

🎯 MOOD TONE: ${mood.tone}

💬 RANDOM ENCOURAGEMENT: ${encouragement}

===========================================
CREATE A DAILY COACHING SUMMARY with these EXACT sections:

1. 📊 MORNING GREETING
   Start with: "${timeGreeting}"

2. 🧠 CONTEXTUAL INTELLIGENCE (2 sentences)
   - ${productivityInsight.title}
   - ${productivityInsight.insight}

3. 💡 EMOTIONAL INTELLIGENCE (2 sentences)
   - Use this tone: ${mood.style}
   - Provide ONE specific, actionable recommendation

4. 🎯 ACTIONABLE RECOMMENDATION (1 sentence)
   - ${productivityInsight.advice}

5. 🏆 GAMIFICATION (1 sentence)
   ${streak > 0 ? `- Celebrate their ${streak}-day streak! 🎉` : '- Encourage them to start a new streak tomorrow!'}

6. 💬 RANDOM ENCOURAGEMENT
   - "${encouragement}"

7. 💭 REFLECTIVE PROMPT (1 question)
   - Ask a thoughtful question about their productivity or focus

8. 🎯 SPOTLIGHT: YOUR BEST TODAY
   - Identify their most productive website or moment today
   - Example: "Your best focus today was on GitHub for 45 minutes!"

9. 💪 TOMORROW'S CHALLENGE
   - Suggest ONE specific challenge for tomorrow
   - Example: "Tomorrow, try to beat your productivity ratio by 5%!"

Format the response with clear headings and a warm, supportive, and specific tone. Make it feel personal and actionable.

IMPORTANT: Include ALL 9 sections. Make it feel like a personal coaching session.`;

        console.log('📝 Sending enhanced prompt to Gemini...');
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.candidates[0].content.parts[0].text;
        
        console.log('✅ Enhanced AI Response received');
        return summary;
    } catch (error) {
        console.error('❌ Vertex AI Error:', error.message);
        return generateFallbackSummary(activityData, totalMinutes, totalSites, streak, productivityRatio);
    }
}

// ============================================================
// ENHANCED FALLBACK SUMMARY
// ============================================================

function generateFallbackSummary(activityData, totalMinutes, totalSites, streak, productivityRatio) {
    const topSites = Object.entries(activityData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([site, seconds]) => `${site} (${Math.round(seconds / 60)} min)`)
        .join(', ');
    
    const timeGreeting = getTimeBasedGreeting();
    const mood = getMoodBasedTone(productivityRatio, totalMinutes, streak);
    const encouragement = getRandomEncouragement();
    
    // Different messages based on time
    let message = '';
    let advice = '';
    let reflection = '';
    
    if (totalMinutes < 30) {
        message = 'Light browsing day! 🌱 Consider setting aside dedicated time for focused work tomorrow.';
        advice = 'Try a 25-minute "Focus Sprint" on your most important task.';
        reflection = 'What\'s one thing you wish you had accomplished today?';
    } else if (totalMinutes < 90) {
        message = 'Good balance today! You kept your browsing in check. ✅';
        advice = 'Build on this momentum tomorrow by starting with a 2-hour deep work session.';
        reflection = 'What was your most productive moment today?';
    } else if (totalMinutes < 180) {
        message = 'You\'re building great focus habits! Keep it going. 💪';
        advice = 'Try blocking 90 minutes of "No Distraction" time tomorrow morning.';
        reflection = 'What\'s one thing you could have done more efficiently today?';
    } else if (totalMinutes < 300) {
        message = 'You\'re putting in serious time. Remember to take breaks! 🌟';
        advice = 'Schedule 5-minute breaks every 25 minutes of focused work.';
        reflection = 'How did you feel about your productivity today?';
    } else {
        message = 'That\'s a lot of screen time. Consider setting daily limits for better balance. 🧠';
        advice = 'Try the "Pomodoro Technique" tomorrow: 25 mins work, 5 mins break.';
        reflection = 'What could you delegate or eliminate from your screen time?';
    }
    
    return `
📊 DAILY COACHING SUMMARY

${timeGreeting}

🧠 Context: You spent ${totalMinutes} minutes across ${totalSites} websites today. Your top sites were: ${topSites}.

💡 Insight: ${message}

🎯 Recommendation: ${advice}

🏆 ${streak > 0 ? `You've got a ${streak}-day streak going! 🎉` : 'Start a new streak tomorrow by staying focused!'}

💬 ${encouragement}

💭 Reflect: ${reflection}

© 2026 Mentis.co`;
}

// ============================================================
// EXPORT
// ============================================================

module.exports = { generateSummary };