import { setUpModel } from '@/app/utils/ia';
import { SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    const model = setUpModel({
      type: SchemaType.OBJECT,
      properties: {
        intent: { 
          type: SchemaType.STRING, 
          enum: ["INFO_HORARIOS", "INFO_UBICACION", "CONSULTA_PRECIO", "INTENCION_COMPRA", "FINALIZAR_CARRITO", "CANCELAR", "SALUDO", "OTRO"] 
        }
      }
    });

    const prompt = `
      Eres el cerebro de un bot de WhatsApp para "La Chapita MDP" (insumos de cerveza).
      Clasifica el mensaje del usuario en una de estas categorías exactas:
      
      1. INFO_HORARIOS: Preguntas sobre horarios, días de apertura, feriados.
      2. INFO_UBICACION: Dirección, dónde están, mapa, envíos a otras zonas.
      
      3. CONSULTA_PRECIO: 
         - Preguntas de precio ("cuánto sale", "precio de").
         - Preguntas de DISPONIBILIDAD ("venden malta?", "tienen lúpulo?", "¿hay stock de X?", "¿trabajan la marca X?").
         - Nombres de productos sueltos sin cantidad ("Malta Pilsen", "Leva").
      
      4. INTENCION_COMPRA: 
         - Intención clara de comprar ("quiero 2 bolsas", "dame 1 kilo", "encargar", "sumar al pedido").
         - Producto + Cantidad ("2 pilsen").
         - Si el mensaje hace referencia a hacer un pedido
      
      5. FINALIZAR_COMPRA: Confirmar, cerrar pedido, "listo", "eso es todo".
      6. CANCELAR: Salir, cancelar, reiniciar.
      7. SALUDO: Hola, buenas (sin pedir nada más).
      8. OTRO: No se entiende.

      Mensaje del usuario: "${text}"
    `;

    const data = await model.generateContent(prompt);
    const responseText = data.response.text();

    const result = JSON.parse(responseText);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Router Error:', error);
    return NextResponse.json({ intent: "OTRO" });
  }
}