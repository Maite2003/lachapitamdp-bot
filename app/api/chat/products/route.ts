// app/api/products/route.ts
import { createSupabaseClient } from '@/app/utils/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q'); 

  if (!query) return NextResponse.json([]);

  const supabase = await createSupabaseClient();
  
  const { data, error } = await supabase
    .from('productos')
    .select('name, price, description')
    .ilike('name', `%${query}%`)
    .not('price', 'is', null)
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}