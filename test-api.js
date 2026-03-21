
const { OpenAI } = require('openai');
require('dotenv').config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
});

async function test() {
  try {
    const response = await openai.chat.completions.create({
      model: 'moonshot-v1-8k', // 修正模型名称
      messages: [{ role: 'user', content: '测试' }],
    });
    console.log('Success:', response.choices[0].message.content);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
