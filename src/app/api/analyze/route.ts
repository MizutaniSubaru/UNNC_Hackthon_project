import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: 'https://api.together.xyz/v1',
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    const response = await openai.chat.completions.create({
      model: 'meta-llama/Llama-3-70b-chat-hf', 
      messages: [
        {
          role: 'system',
          content: `你是一个专业的财务记账助手。请从用户输入中提取以下字段并以 JSON 格式返回：
          - "amount": 数字类型，金额（必须提取，如果没找到则设为 0）
          - "category": 字符串，分类（如：餐饮、交通、购物等）
          - "description": 字符串，具体的消费描述
          
          示例输出：{"amount": 15.5, "category": "餐饮", "description": "购买奶茶"}
          请只返回 JSON 对象，不要包含任何解释文字。`
        },
        { role: 'user', content: text }
      ],
      // 某些开源模型可能对这个参数支持不稳，我们通过 Prompt 强制约束
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    const result = JSON.parse(content);

    // 【关键步骤】数据校验：确保 amount 存在且是数字
    const finalData = {
      amount: Number(result.amount) || 0, // 如果解析失败，默认为 0
      category: result.category || '未分类',
      description: result.description || text,
    };

    return NextResponse.json(finalData);
  } catch (error) {
    console.error('Analyze Error:', error);
    return NextResponse.json({ error: 'AI 解析失败' }, { status: 500 });
  }
}
