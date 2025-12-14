import { google } from 'googleapis';
import { GoogleSheetRow, Product } from '@/types/sheet';
import { createSupabaseClient } from '@/app/utils/db';

// The scope for reading spreadsheets.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// Sheet ID
const SPREADSHEET_ID = '1Lg4h9ZZ7N7WCVUkIJM0JvteLO6dCkjVilSz2nKG9QRY'; 

let col_index = {
  NAME: 2,
  CATEGORY: 0,
  SUBCATEGORY: 1,
  DESCRIPTION: -1
};

export async function readRows() {
  // Authenticate with Google and get an authorized client.
  const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    scopes: SCOPES,
  });

  // Create a new Sheets API client.
  const sheets = google.sheets({version: 'v4', auth});

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Hoja 1',
  });

  const rows = response.data.values || [];

  return rows
}

export async function formatRows(rows: GoogleSheetRow[]) {
  if (rows.length < 2) return [];
  
  const headers = rows[0];
  col_index.DESCRIPTION = headers.length - 1;
  const dataRows = rows.slice(1);

  const priceColumnMap: { index: number; rule: any }[] = [];

    headers.forEach((header, index) => {
      if (header.startsWith('P.') && index > col_index.SUBCATEGORY ) { 
        const rule = parseHeaderRule(header);
        if (rule) {
          priceColumnMap.push({
            index: index,
            rule: rule
          });
        }
      }
    });

  const products: Product[] = dataRows.map((row: GoogleSheetRow) => {
    const rawName = row[col_index.NAME];
    const rawCategory = row[col_index.CATEGORY];
    const rawSubcategory = row[col_index.SUBCATEGORY];

    if (!rawName || !rawCategory) return null;
    
    const name = rawName.trim();
    const category = (rawCategory ? rawCategory : 'General').trim();
    const subcategory = (rawSubcategory ? rawSubcategory : '').trim();

    const product = {
      category: category,
      subcategory: subcategory,
      name: name,
      price: [] as any[],
      description: row[col_index.DESCRIPTION]?.trim() || 'Sin descripcion',
      last_synced_at: new Date().toISOString()
    };

    for (const map of priceColumnMap) {
      const cellValue = row[map.index];

      if (cellValue) {
        const priceNumber = parseInt(cellValue.replace(/[^0-9]/g, ''), 10);
        
        if (!isNaN(priceNumber) && priceNumber > 0) {
          product.price.push({
            ...map.rule,
            price: priceNumber
          });
        }
      }
    }

    return product;
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return products;
}

export function parseHeaderRule(header: string) {
  // All lower case, remove 'P.' and extra spaces
  const cleanHeader = header.replace(/^P\.\s*/i, '').trim().toLowerCase();
  
  // Range: "4-10 bolsas"
  // group 1 (min), group 2 (max), group 3 (unit name)
  const rangePattern = /^(\d+)\s*-\s*(\d+)\s+(.+)$/;
  
  // Fixed: "1 kilo", "500 gr", "25 bolsas"
  // group 1 (number), group 2 (unit)
  const simplePattern = /^(\d+)\s+(.+)$/;

  // ¿range?
  const rangeMatch = cleanHeader.match(rangePattern);
  if (rangeMatch) {
    return {
      presentation: `${rangeMatch[3].charAt(0).toUpperCase() + rangeMatch[3].slice(1)}`,
      min: parseInt(rangeMatch[1]),
      max: parseInt(rangeMatch[2]),
      original_text: header
    };
  }

  // ¿Simple unit?
  const simpleMatch = cleanHeader.match(simplePattern);
  if (simpleMatch) {
    const number = simpleMatch[1];
    const unit = simpleMatch[2];
        
    return { 
      presentation: unit,
      min: parseInt(number), 
      max: null 
    };
  }
  return null;
}

export async function updateSupabase(products: Product[]) {
  if (products.length === 0) {
    console.warn("No hay productos para sincronizar.");
    return;
  }

  const supabase = await createSupabaseClient();

  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .neq('id', 0); // Delete all

  if (deleteError) {
    throw new Error("Error limpiando la base de datos: " + deleteError.message);
  }

  const { error: insertError } = await supabase
    .from('products')
    .insert(products);

  if (insertError) {
    throw new Error("Error insertando productos: " + insertError.message);
  }

  console.log(`Sincronización exitosa: ${products.length} productos actualizados.`);
}
