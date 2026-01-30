
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from "@google/genai";
// Added BubbleColor to the imports from "../types"
import { StrategicHint, AiResponse, DebugInfo, BubbleColor } from "../types";

// Complex Text/Multimodal Task model
const MODEL_NAME = "gemini-3-flash-preview";

export interface TargetCandidate {
  id: string;
  color: string;
  size: number;
  row: number;
  col: number;
  multiplier: number;
  description: string;
}

/**
 * Helper to safely extract and parse JSON from the model response.
 * Handles cases where the model might wrap JSON in markdown blocks or include pre/post text.
 */
const parseSafeJson = (text: string) => {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try to extract content between first { and last }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        // 3. If that still fails, it might be due to unescaped newlines in strings
        // This is a common cause of "Unterminated string" errors
        const sanitized = jsonMatch[0].replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        // This is a bit risky but can recover some common malformations
        // We only replace newlines that are not part of the JSON structure
        // A better approach is to fix the prompt, but we'll try one more simple fix
        try {
           return JSON.parse(jsonMatch[0].replace(/(?<=:.*")(\n|\r)/g, ' '));
        } catch (e3) {
          throw e2; // Throw original error if recovery fails
        }
      }
    }
    throw e;
  }
};

export const getStrategicHint = async (
  imageBase64: string,
  validTargets: TargetCandidate[],
  dangerRow: number,
  isBonus: boolean
): Promise<AiResponse> => {
  const startTime = performance.now();
  
  const debug: DebugInfo = {
    latency: 0,
    screenshotBase64: imageBase64,
    promptContext: "",
    rawResponse: "",
    timestamp: new Date().toLocaleTimeString()
  };

  // Follow best practice: initialize client within call scope
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const targetListStr = validTargets.length > 0 
    ? validTargets.slice(0, 40).map(t => 
        `- ${t.color.toUpperCase()} at [R:${t.row}, C:${t.col}] (Mult: ${t.multiplier}x)`
      ).join("\n")
    : "NO DIRECT PAYOUTS AVAILABLE.";

  const prompt = `
    ACT AS: "Nebula Sentinel" - Galactic Casino AI Analyst.
    TASK: Analyze the current Bubble Shooter board state and provide the highest RTP (Return to Player) shot.
    
    ENVIRONMENT:
    - Status: ${isBonus ? "BONUS FRENZY ACTIVE (2X ALL MULTIPLIERS)" : "Standard Operations"}
    - Danger: ${dangerRow >= 6 ? "CRITICAL (Bubbles near base)" : "Stable"}
    
    TARGET OPTIONS:
    ${targetListStr}

    OBJECTIVE:
    1. Identify the target that maximizes immediate payout or sets up a massive chain.
    2. Respond strictly in JSON format.
    3. Ensure string values contain NO literal newlines.
    
    SCHEMA:
    {
      "message": "A short, commanding operational order.",
      "rationale": "A one-sentence explanation of why this target is optimal.",
      "recommendedColor": "red|blue|green|yellow|purple|orange",
      "targetRow": number,
      "targetCol": number,
      "payoutPotential": "A short string describing the expected win (e.g., '150x Est. Payout')"
    }
  `;

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: prompt }, 
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }
        ]
      },
      config: {
        maxOutputTokens: 512, // Reduced to focus on the concise JSON
        temperature: 0.1, // Lower temperature for more consistent structure
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            rationale: { type: Type.STRING },
            recommendedColor: { type: Type.STRING },
            targetRow: { type: Type.NUMBER },
            targetCol: { type: Type.NUMBER },
            payoutPotential: { type: Type.STRING }
          },
          required: ["message", "rationale", "recommendedColor", "targetRow", "targetCol", "payoutPotential"]
        }
      }
    });

    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    debug.rawResponse = response.text || "{}";

    const json = parseSafeJson(debug.rawResponse);
    
    return {
      hint: {
        message: json.message || "Target Identified",
        rationale: json.rationale || "Optimal trajectory calculated.",
        targetRow: Number(json.targetRow),
        targetCol: Number(json.targetCol),
        recommendedColor: json.recommendedColor?.toLowerCase() as BubbleColor,
        payoutPotential: json.payoutPotential || "Variable ROI"
      },
      debug
    };
  } catch (e: any) {
    console.error("AI Analysis Error:", e, "Raw Response:", debug.rawResponse);
    return {
        hint: { 
          message: "Scanning for ROI...", 
          rationale: "Data synchronization in progress. Maintain defensive posture." 
        },
        debug: { ...debug, error: e.message }
    };
  }
};