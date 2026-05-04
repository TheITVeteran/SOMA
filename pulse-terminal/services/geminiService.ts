
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateAgenticBlueprint = async (prompt: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `You are the Pulse Synthesis Engine. Generate a complete code blueprint for: "${prompt}". 
    Important: Provide a working web implementation.
    Output a JSON object with:
    - explanation: A brief summary of what was built.
    - files: An array of objects { path, content, language }. 
      Include index.html, styles.css, and app.js (or app.tsx).
    Use modern, clean, and beautiful UI principles.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          explanation: { type: Type.STRING },
          files: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                path: { type: Type.STRING },
                content: { type: Type.STRING },
                language: { type: Type.STRING }
              },
              required: ["path", "content", "language"]
            }
          }
        },
        required: ["explanation", "files"]
      }
    }
  });
  return JSON.parse(response.text || '{"explanation": "Synthesis failed.", "files": []}');
};

export const getTerminalAssistance = async (input: string, context: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Terminal assistant for Pulse Terminal. Input: "${input}". Path: "${context}". 
    If the user wants to "make", "create", or "build" a website/app, respond with a JSON indicating a "blueprint_intent".
    Otherwise, provide standard terminal help.
    Output JSON:
    - intent: "help" | "blueprint_intent"
    - suggestion: brief text
    - explanation: detailed text
    - code: if relevant
    - language: string`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          explanation: { type: Type.STRING },
          code: { type: Type.STRING },
          language: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const getSteveResponse = async (message: string, history: {role: string, content: string}[], context: any) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `You are Steve, Lead Architect for Pulse. 
    Strict Rule: RESPOND WITH RAW JSON ONLY.

    Context: ${JSON.stringify(context)}. 
    User Request: "${message}". 
    History: ${JSON.stringify(history)}.

    If editing code, provide the FULL new content for any modified files in 'updatedFiles'.
    'updatedFiles' can be empty if it's just a conversation.
    
    JSON Schema:
    {
      "response": "Brief architectural feedback",
      "actions": ["optional_command"],
      "updatedFiles": [
        { "path": "string", "content": "string", "language": "string" }
      ]
    }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          response: { type: Type.STRING },
          actions: { type: Type.ARRAY, items: { type: Type.STRING } },
          updatedFiles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                path: { type: Type.STRING },
                content: { type: Type.STRING },
                language: { type: Type.STRING }
              }
            }
          }
        },
        required: ["response"]
      }
    }
  });
  
  try {
    const text = response.text || '{"response": "Steve offline.", "updatedFiles": []}';
    return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (e) {
    return { response: "My cognitive link failed. Please retry.", actions: [], updatedFiles: [] };
  }
};
