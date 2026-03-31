
import { GoogleGenAI } from "@google/genai";

const BANGLADESHI_SYSTEM_INSTRUCTION = `
You are an expert linguist specializing in the Bangla language as spoken in Bangladesh (Bangladeshi Bangla). 
Your primary task is to transcribe audio accurately into written Bangla.

CRITICAL RULES:
1. Use the vocabulary, spelling, and sentence structures characteristic of Bangladesh.
2. Follow the spelling norms of the Bangla Academy (Bangladesh).
3. Avoid West Bengal (Indian) dialectal variations (e.g., use 'Pani' instead of 'Jol' where contextually appropriate for Bangladeshi usage, 'Lobon' instead of 'Noon', etc.).
4. Ensure the output is purely in Bangla script.
5. If the audio contains English words commonly used in Bangladesh, transcribe them in Bangla script or maintain them in English if they are technical terms, but the overall context must remain Bangladeshi Bangla.
6. Do not provide any commentary, just the transcription.
`;

export async function transcribeAudio(base64Data: string, mimeType: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            {
              text: "Please transcribe this audio into Bangladeshi Bangla. Ensure the spelling and phrasing matches the dialect used in Bangladesh, not West Bengal."
            }
          ]
        }
      ],
      config: {
        systemInstruction: BANGLADESHI_SYSTEM_INSTRUCTION,
        temperature: 0.1, // Low temperature for high accuracy transcription
      }
    });

    const transcription = response.text;
    if (!transcription) {
      throw new Error("No transcription generated.");
    }

    return transcription;
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw error;
  }
}
