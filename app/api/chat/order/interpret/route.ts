import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/utils/db';
import { setUpModel } from '@/app/utils/ia';
import { SchemaType } from '@google/generative-ai';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    const supabase = await createSupabaseClient();
    const { data: products } = await supabase
      .from('products')
      .select('id, name, price')

    const productListString = JSON.stringify(products?.map(p => ({
        id: p.id,
        name: p.name,
        presentations: Array.isArray(p.price) ? p.price.map((pr: any) => pr.presentation) : "Estándar"
    })));

    const model = setUpModel({
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          product_id: { type: SchemaType.NUMBER },
          quantity: { type: SchemaType.NUMBER },
          detected_name: { type: SchemaType.STRING },
          confidence: { type: SchemaType.STRING, enum: ["high", "medium", "low"] }
        },
        required: ["product_id", "quantity", "detected_name"]
      }
    });

    const prompt = `
      Eres un asistente de ventas experto para una distribuidora.
      Tu trabajo es interpretar este pedido de texto libre y mapearlo a nuestro catálogo.

      CATÁLOGO DE PRODUCTOS DISPONIBLES:
      ${productListString}

      PEDIDO DEL USUARIO: "${text}"

      REGLAS:
      1. Analiza el texto e identifica productos y cantidades.
      2. Haz coincidir el producto del usuario con el "name" más parecido del catálogo (Fuzzy matching).
      3. Extrae la cantidad. Si dice "2 bolsas de malta", quantity es 2.
      4. Si el producto no existe en el catálogo, NO lo inventes, simplemente no lo agregues a la lista.
      5. Responde con el array JSON configurado.
    `;


    
    const data = await model.generateContent(prompt);
    const responseText = data.response.text();
    const result = JSON.parse(responseText);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interpretando pedido' }, { status: 500 });
  }
}