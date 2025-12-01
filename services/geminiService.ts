
// import { GoogleGenAI } from "@google/genai";
import { Language } from "../types";

// Initialize Gemini Client
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Rewrites a casual reason into a professional one in the specified language.
 */
export const polishLeaveReason = async (rawText: string, language: Language): Promise<string> => {
  if (!process.env.API_KEY) {
    console.warn("API Key is missing provided.");
    return rawText; // Fallback
  }

  try {
    const model = 'gemini-2.5-flash';
    // Mappa lingua -> nome lingua per il prompt
    const langNames = {
        IT: "Italian",
        EN: "English",
        ES: "Spanish",
        FR: "French",
        DE: "German"
    };

    const targetLang = langNames[language] || "Italian";

    const prompt = `
      Rewrite the following text to be a professional, polite, and concise reason for a work leave request.
      IMPORTANT: The output must be in ${targetLang}.
      Do not add any intro or outro, just the polished text.
      
      Input text: "${rawText}"
    `;

    // const response = await ai.models.generateContent({
    //   model: model,
    //   contents: prompt,
    // });

    // const text = response.text;
    const text = "Simulated polished text from Gemini API."; // Placeholder for actual API response
    return text ? text.trim() : rawText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return rawText; // Fallback to original text on error
  }
};
