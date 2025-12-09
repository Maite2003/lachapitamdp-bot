import { google } from 'googleapis';
import { GoogleSheetRow, Product } from '@/types/sheet';
import { createClient } from '@supabase/supabase-js';

// The scope for reading spreadsheets.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// Sheet ID
const SPREADSHEET_ID = '1Lg4h9ZZ7N7WCVUkIJM0JvteLO6dCkjVilSz2nKG9QRY'; 

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
    range: 'Hoja 1!A:AE',
  });

  const rows = response.data.values || [];

  return rows
}

function parseCurrency(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const cleanString = value.replace(/[$\s.]/g, '').replace(',', '.');
  const number = parseFloat(cleanString);
  return isNaN(number) || number === 0 ? undefined : number;
}

function sanitizeKey(header: string): string {
  return header
    .toLowerCase()
    .replace(/^p\.\s*/, '') // Remove "P."
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]/g, '_') // Replace other characters with _
    .replace(/_+/g, '_'); // Avoid doubles _ (__)
}

export async function formatRows(rows: GoogleSheetRow[]) {
  if (rows.length < 2) return [];
  
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const priceColumnIndex: number[] = [];

  headers.forEach((header, index) => {
    if (header.trim().startsWith('P.')) {
      priceColumnIndex.push(index);
    }
  });

  const products: Product[] = dataRows.map((row: GoogleSheetRow) => {
      
      const precios: Record<string, number> = {};

      priceColumnIndex.forEach((index) => {
        const rawValue = row[index];
        const price = parseCurrency(rawValue);
        
        if (price !== undefined) {
          const keyName = sanitizeKey(headers[index]);
          precios[keyName] = price;
        }
      });

      // Asumimos índices fijos para los metadatos básicos
      // 0: Category, 1: Subcategory, 2: Name, Last: Description
      return {
        category: row[0] || 'Sin Categoría',
        subcategory: row[1] || 'General',
        name: row[2] || 'Producto sin nombre',
        price: precios,
        description: row[row.length - 1] || '', 
        last_synced_at: new Date().toISOString()
      };
    });

    return products;
}

export async function updateSupabase(products: Product[]) {
  if (products.length === 0) {
    console.warn("No hay productos para sincronizar.");
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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