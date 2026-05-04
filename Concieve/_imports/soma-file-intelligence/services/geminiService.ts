
import { GoogleGenAI, Type } from "@google/genai";
import { FileSystemNode, QueryResult, Chunk } from "../types";

// Exported to be used by App.tsx for autonomous tasks
export const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateFileSummary = async (fileName: string, content: string): Promise<{ summary: string; keywords: string[] }> => {
  try {
    const ai = getAiClient();
    const model = "gemini-3-flash-preview"; 
    const truncatedContent = content.slice(0, 10000);

    const prompt = `
      Analyze this file: "${fileName}".
      Content snippet:
      ${truncatedContent}
      
      Return a JSON object with:
      1. "summary": A concise 1-sentence description of what this file is.
      2. "keywords": An array of 5-10 specific technical keywords.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    // Use .text property as per guidelines
    const text = response.text;
    if (!text) return { summary: "Analysis failed", keywords: [] };
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return { summary: "Could not analyze", keywords: [] };
  }
};

/**
 * ACORN-inspired Hierarchical Search
 */
export const queryKnowledgeBase = async (
  query: string, 
  files: FileSystemNode[],
  callbacks?: {
      onRetrievalUpdate?: (fileIds: string[]) => void;
      onToken?: (text: string) => void;
  }
): Promise<QueryResult> => {
  try {
    const ai = getAiClient();
    
    // Step 1: Hierarchical Context Construction
    // Instead of a flat list, we provide the model with "Anchor Summaries" (Directories)
    const directoryIndex = files
      .filter(f => f.kind === 'directory')
      .map(d => `DIR: ${d.path} | Children: ${d.children?.length || 0} | Context: ${d.metadata?.summary || 'Project folder'}`)
      .join('\n');

    const fileIndex = files
      .filter(f => f.kind === 'file' && f.isIndexed)
      .map(f => `FILE: ${f.path} | ID: ${f.id} | Summary: ${f.metadata?.summary}`)
      .join('\n');

    // Step 2: Route the Query
    // Is it a "General Question" or a "Direct Navigation Request"?
    const routerPrompt = `
      You are SOMA Navigation Engine.
      Query: "${query}"
      
      Filesystem Index:
      ${directoryIndex}
      ---
      ${fileIndex}

      Task: 
      1. Identify the TOP 3 most relevant items (File IDs or Directory Paths).
      2. Determine if this is a DIRECT FILE REQUEST (e.g., "open the file where...") or a GENERAL QUESTION.
      
      Return JSON: { "relevantIds": string[], "isDirect": boolean, "navigationPath": string[] }
    `;

    const routerResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: routerPrompt,
      config: { responseMimeType: "application/json" }
    });

    // Extract text output using .text property
    const route = JSON.parse(routerResponse.text || "{}");
    const relevantFileIds = route.relevantIds || [];

    if (callbacks?.onRetrievalUpdate) {
        callbacks.onRetrievalUpdate(relevantFileIds);
    }

    // Step 3: Synthesis (RAG)
    const contextChunks: Chunk[] = [];
    const relevantFiles = files.filter(f => relevantFileIds.includes(f.id));
    
    let contextText = "";
    relevantFiles.forEach(f => {
      if (f.content) {
        contextText += `\nFILE CONTENT [${f.path}]:\n${f.content}\n`;
        contextChunks.push({
          id: `${f.id}_cite`,
          fileId: f.id,
          filePath: f.path,
          content: f.metadata?.summary || "Semantic Match",
          startOffset: 0,
          endOffset: f.content.length
        });
      }
    });

    const reasoningPrompt = `
      You are SOMA (Semantic Object-Relational Memory Agent).
      Query: "${query}"
      ${route.isDirect ? "USER WANTS TO OPEN THE CORRECT FILE. EXPLAIN WHY THIS FILE IS THE MATCH." : ""}
      
      Contextual Data:
      ${contextText}
      
      Answer format: Markdown.
      If it's a direct file request, start with "MATCH FOUND: [Path]".
    `;

    const streamResult = await ai.models.generateContentStream({
      model: "gemini-3-pro-preview",
      contents: reasoningPrompt,
    });

    let fullText = "";
    for await (const chunk of streamResult) {
      // Access text using .text property on the response chunk
      if (chunk.text) {
        fullText += chunk.text;
        if (callbacks?.onToken) callbacks.onToken(fullText);
      }
    }

    return {
      answer: fullText || "No response.",
      citations: contextChunks,
      relevantNodes: relevantFileIds
    };

  } catch (error) {
    console.error("Query failed:", error);
    return { answer: "Cognitive error in retrieval loop.", citations: [], relevantNodes: [] };
  }
};
