import OpenAI from "openai";

// put your API key here or use process.env.OPENAI_API_KEY
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

async function testKey() {
  try {
    const res = await client.models.list();
    console.log("✅ API Key is valid. Found models:");
    res.data.forEach(m => console.log("-", m.id));
  } catch (err) {
    console.error("❌ Invalid API Key or error:", err.message);
  }
}

testKey();
