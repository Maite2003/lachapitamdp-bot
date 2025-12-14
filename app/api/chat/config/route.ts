import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/db';

const supabase = await createSupabaseClient();

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('settings') 
      .select('*')
      .single();

    if (error) {
      console.error("❌ Error Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const config = {
      name: data.name,      
      welcome_message: data.welcome_message, 
      website: data.website,        
      prices_sheet: data.prices_sheet, 
      address: data.address,             
      phone: data.phone,   
      features: {
        bot_activo: true,
      }
    };

    console.log("✅ Configuración obtenida:", config.name);
    
    return NextResponse.json(config, { status: 200 });

  } catch (error) {
    console.error("❌ Error General:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}