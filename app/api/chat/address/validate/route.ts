import { setUpModel } from '@/app/utils/ia';
import { SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    const model = setUpModel({
      type: SchemaType.OBJECT,
      properties: {
        valid: { type: SchemaType.BOOLEAN },
        formatted_address: { type: SchemaType.STRING, nullable: true },
        reason: { type: SchemaType.STRING, nullable: true }
      },
      required: ["valid"]
    });

        
    const prompt = `
      Eres un experto en logística y geografía de Argentina. Tu tarea es validar y FORMATEAR la siguiente dirección ingresada por un usuario.

      DIRECCIÓN A ANALIZAR: "${address}"

      REGLAS DE FORMATEO (IMPORTANTE):
      1. Estandariza nombres de calles (ej: "colon" -> "Av. Colón").
      2. DEFAULTS: Si el usuario NO especifica ciudad, asume "Mar del Plata". Si NO especifica provincia, asume "Buenos Aires".
      3. Si el usuario especifica otra ciudad (ej: "Miramar"), respétala.
      4. Formato de salida deseado: "Calle Altura (o Intersección), Barrio (si se deduce), Ciudad, Provincia".

      REGLAS DE VALIDACIÓN:
      - Rechaza textos sin sentido, saludos sueltos o negativas ("no sé", "no quiero").
      - Acepta referencias claras aunque no tengan calle exacta (ej: "Frente al puerto", "Casino Central").

      Responde con un JSON respetando este esquema:
      {
        "valid": boolean,
        "formatted_address": "La dirección completa y corregida (o null si es inválida)",
        "reason": "Si es inválida, explica por qué (breve). Si es válida, null."
      }
    `;

    // Generamos la respuesta
    const data = await model.generateContent(prompt);
    const responseText = data.response.text();
    const result = JSON.parse(responseText);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error validando dirección:', error);
    return NextResponse.json({ valid: true }); 
  }
}