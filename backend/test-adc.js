// test-adc.js - Test ADC authentication with Gemini
const { getAccessToken } = require('./auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testAI() {
    console.log('🔍 Testing ADC + Gemini connection...');
    
    try {
        // Get token using ADC
        const token = await getAccessToken();
        console.log('✅ Token obtained');
        
        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(token);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        const prompt = 'Say "Hello! The AI is working perfectly!"';
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        console.log('✅ AI Response:', response.text());
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('💡 Troubleshooting:');
        console.log('1. Run: gcloud auth application-default login');
        console.log('2. Make sure Gemini API is enabled in Google Cloud Console');
        console.log('3. Check your project ID is correct');
    }
}

testAI();