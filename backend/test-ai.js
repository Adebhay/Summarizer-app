// test-ai.js - Test AI with explicit project ID
const { generateSummary } = require('./vertex-ai');

async function testAI() {
    console.log('🧪 Testing AI with explicit project ID...');
    
    const testData = {
        'google.com': 600,      // 10 minutes
        'github.com': 1200,     // 20 minutes
        'youtube.com': 300,     // 5 minutes
        'stackoverflow.com': 900 // 15 minutes
    };
    
    try {
        const summary = await generateSummary(testData);
        console.log('\n✅ AI Generated Summary:');
        console.log('='.repeat(50));
        console.log(summary);
        console.log('='.repeat(50));
        console.log('🎉 AI is working correctly!');
    } catch (error) {
        console.error('❌ AI Test Failed:', error.message);
    }
}

testAI();