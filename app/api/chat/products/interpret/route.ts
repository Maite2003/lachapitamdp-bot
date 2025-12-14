import { NextResponse } from 'next/server';
import { SchemaType } from '@google/generative-ai';
import { createSupabaseClient } from '@/app/utils/db';
import { setUpModel } from '@/app/utils/ia';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    const supabase = await createSupabaseClient();
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, price, description')

    if (error || !products) {
      console.error("❌ Error BD:", error);
      return NextResponse.json({ error: "Error al obtener catálogo" }, { status: 500 });
    }

    const catalogSummary = products.map(p => `ID: ${p.id} | Name: ${p.name}`).join('\n');

    const model = setUpModel({
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          product_id: { type: SchemaType.NUMBER }, 
          name: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          user_query: { type: SchemaType.STRING }, 
          match_confidence: { type: SchemaType.STRING, enum: ["high", "medium", "low"] }
        },
        required: ["product_id", "name"]
      }
    });

    const prompt = `
      Eres un asistente de ventas inteligente.
      Tu tarea es identificar qué productos del catálogo está buscando el usuario.

      CATÁLOGO DISPONIBLE:
      ---
      ${catalogSummary}
      ---

      MENSAJE DEL USUARIO: "${text}"

      INSTRUCCIONES:
      1. Analiza el mensaje y busca coincidencias con el catálogo.
      2. Sé flexible: Si dice "Pilsen", asocialo con "Malta Pilsen". Si dice "Cascade", es "Lúpulo Cascade".
      3. Si el usuario pregunta por algo que NO está en la lista, IGNÓRALO. No inventes productos.
      4. Si pregunta por "precios de todo" o "lista", devuelve un array vacío.
      
      Devuelve un JSON Array con los productos encontrados.
    `;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    const foundProducts = JSON.parse(textResponse);

    const finalResponse = foundProducts.map((item: any) => {
      const originalProduct = products.find(p => p.id === item.product_id);
      const item_parsed = {
        ...item,
        price: originalProduct?.price
      };
      console.log(item_parsed);
      return item_parsed;
    });

    console.log(`✅ Productos detectados para "${text}":`, finalResponse.length);

    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error("❌ Error en Price Check:", error);
    return NextResponse.json([], { status: 500 });
  }
}