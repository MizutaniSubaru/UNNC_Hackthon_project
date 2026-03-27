'use client';

import { useEffect, useState } from 'react';
import type { Database } from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

type Expense = Database['public']['Tables']['expenses']['Row'];

export default function Home() {
  const [text, setText] = useState('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSupabaseConfigured] = useState(() => Boolean(getSupabaseClient()));

  const fetchExpenses = async () => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setExpenses([]);
      return;
    }

    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setExpenses(data as Expense[]);
    }
  };

  useEffect(() => {
    void fetchExpenses();
  }, []);

  const handleSubmit = async () => {
    if (!text) {
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('Please configure Supabase first.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const aiData = await res.json();

      if (!res.ok) {
        alert(aiData.error || 'Failed to analyze the expense.');
        return;
      }

      const { error } = await supabase.from('expenses').insert([
        {
          amount: aiData.amount,
          category: aiData.category,
          description: aiData.description || text,
        },
      ]);

      if (error) {
        alert(`Error saving to Supabase: ${error.message}`);
        return;
      }

      setText('');
      await fetchExpenses();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans">
      <h1 className="mb-8 text-3xl font-bold">AI Expense Assistant</h1>

      <div className="mb-8 flex gap-2">
        <input
          className="flex-1 rounded border p-2 text-black"
          placeholder="Describe an expense, for example: Milk tea 15 RMB"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={() => void handleSubmit()}
          disabled={loading || !isSupabaseConfigured}
        >
          {loading ? 'Analyzing...' : 'Save Expense'}
        </button>
      </div>

      {!isSupabaseConfigured && (
        <p className="mb-8 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
          before using the database features.
        </p>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">History</h2>
        {expenses.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded border bg-gray-50 p-4 text-black"
          >
            <div>
              <p className="font-bold">{item.description}</p>
              <p className="text-sm text-gray-500">{item.category}</p>
            </div>
            <p className="font-mono text-xl text-red-600">-{item.amount} RMB</p>
          </div>
        ))}
      </div>
    </main>
  );
}
