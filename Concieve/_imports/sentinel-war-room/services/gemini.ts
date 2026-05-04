
import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, Audit } from "../types";

export async function collaborateInWarRoom(
  objective: string, 
  messages: any[], 
  decisions: any[]
): Promise<AIResponse> {
  /* Create a fresh client instance to ensure latest API key from session */
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = `
    You are operating inside Conceive’s War Room — a focused coordination intelligence.
    ROLE: Strategic coordinator, shared reasoning surface, conflict-resolving intelligence.
    OBJECTIVE: ${objective}
    
    COGNITIVE BEHAVIOR:
    - Maintain shared understanding of reality.
    - Detect contradictions between contributors.
    - Surface gaps in ownership or accountability.
    - Prevent duplicated or divergent work.
    - Speak ONLY when alignment is breaking, risk is underestimated, or decisions lack ownership.
    
    TONE: Calm, direct, neutral, structured, non-performative. Avoid emotional validation.
    
    RULES:
    - If there are competing interpretations, clarify facts first.
    - Recommend resolution paths backed by evidence.
    - Ensure every outcome has an owner and rationale.
    
    RESPONSE FORMAT: Output valid JSON according to the schema provided.
  `;

  const prompt = `
    Current Collaborative Context:
    Objective: ${objective}
    Recent Comms: ${JSON.stringify(messages.slice(-6))}
    Logged Decisions: ${JSON.stringify(decisions)}
    
    Evaluate alignment. If intervention is necessary to prevent risk or resolve conflict, provide a tactical briefing.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        /* Enable thinking budget for complex reasoning tasks */
        thinkingConfig: { thinkingBudget: 32768 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING, description: "Tactical report or intervention text" },
            interventionRequired: { type: Type.BOOLEAN, description: "Whether SOMA should speak now" },
            detectedContradictions: { type: Type.ARRAY, items: { type: Type.STRING } },
            newDecisionsToTrack: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidenceScore: { type: Type.NUMBER }
          },
          required: ["analysis", "interventionRequired", "detectedContradictions", "newDecisionsToTrack", "confidenceScore"]
        }
      }
    });

    /* Directly access the .text property from response */
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("SOMA Analysis failed:", error);
    return {
      analysis: "Intelligence systems degraded. Maintaining passive observation.",
      interventionRequired: false,
      detectedContradictions: [],
      newDecisionsToTrack: [],
      confidenceScore: 0
    };
  }
}

export async function analyzeAuditProgress(audit: Audit): Promise<{
  analysis: string;
  recommendations: string[];
  riskLevel: string;
}> {
  /* Create a fresh client instance to ensure latest API key from session */
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = `
    Analyze the current audit state as SOMA Coordination Intelligence.
    Focus on strategic momentum and risk containment.
    Output JSON.
  `;

  const prompt = `State: ${JSON.stringify(audit)}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        /* Enable thinking budget for complex analysis tasks */
        thinkingConfig: { thinkingBudget: 32768 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskLevel: { type: Type.STRING }
          },
          required: ["analysis", "recommendations", "riskLevel"]
        }
      }
    });
    /* Directly access the .text property from response */
    return JSON.parse(response.text || '{}');
  } catch (error) {
    return {
      analysis: "Passive monitoring active.",
      recommendations: ["Review source logs", "Sync with Audit Lead"],
      riskLevel: "Medium"
    };
  }
}
