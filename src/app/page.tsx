'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

// 核心逻辑组件
function ExpenseTracker() {
  const [text, setText] = useState('');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 确保只在客户端运行
  useEffect(() => { 
    setMounted(true);
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase Error:', error);
        // 如果表不存在，给用户明确提示
        if (error.code === '42P01') {
          alert('数据库中缺少 "expenses" 表，请在 Supabase 控制台创建。');
        }
        return;
      }
      
      if (data) setExpenses(data);
    } catch (err) {
      console.error('Fetch Error:', err);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      
      if (!res.ok) {
        throw new Error('API request failed');
      }

      const aiData = await res.json();

      if (!aiData || aiData.amount === 0) {
        alert('AI 没听清金额，请重试（如：买咖啡 20 元）');
        return;
      }

      const { error } = await supabase.from('expenses').insert([{
        amount: aiData.amount,
        category: aiData.category || '未分类',
        description: aiData.description || text.trim(),
      }]);

      if (error) throw error;
      
      setText('');
      await fetchExpenses();
    } catch (err) {
      console.error('HandleSubmit Error:', err);
      alert('操作失败，请检查网络或 API Key 是否正确配置');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 animate-pulse text-lg font-medium">
          助手正在整理账本...
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-8 font-sans min-h-screen bg-gray-50">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-800">AI 记账助手 💰</h1>
        <button 
          onClick={fetchExpenses}
          disabled={loading}
          className="text-sm px-4 py-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors font-medium"
        >
          {loading ? '刷新中...' : '刷新列表'}
        </button>
      </div>
      
      <div className="flex gap-2 mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <input 
          className="flex-1 p-3 border-none rounded-xl text-black outline-none focus:ring-2 focus:ring-blue-100 bg-gray-50 placeholder:text-gray-400" 
          placeholder="例如：中午吃拉面花了 25 元"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          disabled={loading}
        />
        <button 
          className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all font-bold shadow-md shadow-blue-200"
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
        >
          {loading ? '分析中...' : '记一笔'}
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-700 border-b border-gray-200 pb-3 mb-4">记录详情</h2>
        {expenses.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-400">暂无开销记录，试试说一句话记账吧！</p>
          </div>
        ) : (
          expenses.map((item) => (
            <div key={item.id} className="p-5 border-none rounded-2xl flex justify-between items-center bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex flex-col gap-1">
                <p className="font-bold text-gray-800 text-lg">{item.description}</p>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-md font-medium">
                    {item.category}
                  </span>
                  <p className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleString('zh-CN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              <p className="text-2xl font-bold font-mono text-red-500">
                -{(Number(item.amount) || 0).toFixed(2)}
              </p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

// 使用 dynamic 禁用 SSR，彻底解决渲染挂起和水合问题
export default dynamic(() => Promise.resolve(ExpenseTracker), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400">正在进入财务世界...</div>
    </div>
  )
});
