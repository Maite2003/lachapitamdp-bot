import { readRows, formatRows, updateSupabase } from '@/app/api/sync/utils';
import { NextResponse } from 'next/server';

import { GoogleSheetRow, Product } from '@/types/sheet';

export async function GET() {
  try {
    const rows: GoogleSheetRow[]|null  = await readRows()

    if (!rows || rows.length <= 1) {
      return NextResponse.json({ message: "La planilla está vacía" });
    }
    
    const products: Product[] = await formatRows(rows)

    await updateSupabase(products)

    return NextResponse.json({ 
      status: 'success', 
      message: `Se sincronizaron ${products.length} productos correctamente.` 
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}