import { NextResponse } from 'next/server';
import { generateICalendar } from '@/lib/calendar-export';
import { getSupabaseClient } from '@/lib/supabase';
import type { Item } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // We fetch all items to export them.
    // If you add user auth, you should filter by userId here.
    const { data, error } = supabase
      ? await supabase.from('items').select('*')
      : { data: [] as Item[], error: null };

    const items = (data ?? []) as Item[];

    if (error) {
      console.error('Supabase query error:', error);
      return new NextResponse('Internal Server Error', { status: 500 });
    }

    const icsContent = generateICalendar(items, 'Planner Calendar');

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="calendar.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error('Calendar export error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
