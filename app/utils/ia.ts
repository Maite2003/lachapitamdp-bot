import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';


// Inicializamos Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

export function setUpModel(responseSchema: any) {
  return genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });
}