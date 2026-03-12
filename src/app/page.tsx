'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [text, setText] = useState('');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. 获取已有的账单列表
  const fetchExpenses = async () => {
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (data) setExpenses(data);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // 2. 提交 AI 解析并保存
  const handleSubmit = async () => {
    if (!text) return;
    setLoading(true);

    try {
      // 第一步：调用后端 API 进行 AI 分析
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const aiData = await res.json();

      // 【关键校验】如果金额是 0 且没有解析到，则拦截报错
      if (aiData.amount === 0) {
        alert('抱歉，AI 没听清你花了多少钱，请再说清楚一点（例如：买咖啡花了 20 元）');
        return;
      }

      // 第二步：使用 Supabase SDK 将结果直接存入数据库
      const { error } = await supabase.from('expenses').insert([{
        amount: aiData.amount,
        category: aiData.category,
        description: aiData.description,
      }]);

      if (error) alert('Error saving to Supabase: ' + error.message);
      
      // 第三步：清空输入框并刷新列表
      setText('');
      fetchExpenses();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-8 font-sans">
      <h1 className="text-3xl font-bold mb-8">AI 记账助手 💰</h1>
      
      <div className="flex gap-2 mb-8">
        <input 
          className="flex-1 p-2 border rounded text-black" 
          placeholder="说一句话记账，例如：刚才喝奶茶花了 15 元"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'AI 分析中...' : '一键记账'}
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">历史记录</h2>
        {expenses.map((item) => (
          <div key={item.id} className="p-4 border rounded flex justify-between items-center bg-gray-50 text-black">
            <div>
              <p className="font-bold">{item.description}</p>
              <p className="text-sm text-gray-500">{item.category}</p>
            </div>
            <p className="text-xl font-mono text-red-600">-{item.amount} 元</p>
          </div>
        ))}
      </div>
    </main>
  );
}
