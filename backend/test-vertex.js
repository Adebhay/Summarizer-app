// test-vertex.js - Test Vertex AI with ADC
const { generateSummary } = require('./vertex-ai');

async function testVertexAI() {
    console.log('🔍 Testing Vertex AI with ADC...');
    
    // Sample activity data
    const testData = {
        'google.com': 1200,      // 20 minutes
        'youtube.com': 600,      // 10 minutes
        'github.com': 1800,      // 30 minutes
        'reddit.com': 300        // 5 minutes
    };
    
    try {
        const summary = await generateSummary(testData);
        console.log('✅ AI Summary:');
        console.log('---');
        console.log(summary);
        console.log('---');
        console.log('🎉 Vertex AI is working correctly!');
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('💡 Troubleshooting:');
        console.log('1. Make sure you ran: gcloud auth application-default login');
        console.log('2. Verify your project ID in Google Cloud Console');
        console.log('3. Enable the Vertex AI API:');
        console.log('   gcloud services enable aiplatform.googleapis.com');
    }
}

testVertexAI();