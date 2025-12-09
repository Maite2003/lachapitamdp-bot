import { google } from 'googleapis';
import { GoogleSheetRow, Product } from '@/types/sheet';
import { createClient } from '@supabase/supabase-js';

// The scope for reading spreadsheets.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// Sheet ID
const SPREADSHEET_ID = '1moant4XmxOrkU7YCyRiscaM8_Qdo3tZlrz8FykD7Iqc'; // TODO: Modificar esto mas adelante

export async function listPrices() {
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
    range: 'Hoja 1!A:B', // TODO: Modificar esto mas adelante
  });

  const rows = (response.data.values || []) as GoogleSheetRow[];

  return rows
}

export async function formatRows(rows: GoogleSheetRow[]) {
    const productosParaInsertar: Product[] = rows.slice(1).map((row: GoogleSheetRow) => ({
      name: row[0],
      price: parseFloat(row[1]?.replace('$', '').replace(',', '') || '0'),
      stock: row[2] || 'Consultar',
      last_synced_at: new Date().toISOString()
    }));

    return productosParaInsertar
}

export async function updateSupabase(products: Product[]) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .neq('id', 0); // To delete all rows, where id not zero

  if (deleteError) throw new Error("Error borrando DB: " + deleteError.message);

  const { error: insertError } = await supabase
    .from('products')
    .insert(products);

  if (insertError) throw new Error("Error insertando en DB: " + insertError.message);
}