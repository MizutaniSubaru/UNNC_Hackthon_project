import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

// Kimi (Moonshot AI) 的初始化方式
const openai = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    const response = await openai.chat.completions.create({
      model: 'kimi-k2.5', 
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
    });

    let content = response.choices[0].message.content || '{}';
    
    // 更强大的 JSON 提取逻辑，防止 AI 返回包含 Markdown 代码块或其他杂质
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    const result = JSON.parse(content);

    const finalData = {
      amount: Number(result.amount) || 0,
      category: result.category || '未分类',
      description: result.description || text,
    };

    return NextResponse.json(finalData);
  } catch (error: any) {
    console.error('Kimi AI Error:', error);
    return NextResponse.json({ 
      amount: 0, 
      category: '错误', 
      description: error.message || '解析失败' 
    });
  }
}
