import { GoogleGenAI } from "@google/genai";
import { AgentLesson } from '../types';

// ============================================================================
// MOCK MODE: When API key is not set, we use hardcoded insights/news.
// This is safe because Gemini is ONLY used for:
// 1. Market news aggregation (non-critical, cosmetic)
// 2. AI-generated insights (educational, not trading logic)
// Trading decisions are NOT affected by mock mode.
// ============================================================================

// Mock Data Constants for Fallback
const MOCK_NEWS: { headline: string, sentiment: 'Bullish' | 'Bearish' | 'Neutral', source: string }[] = [
  { headline: "Solana Transaction Volume Spikes 20%", sentiment: "Bullish", source: "CoinDesk" },
  { headline: "Fed Signals Potential Rate Hike Pause", sentiment: "Bullish", source: "Bloomberg" },
  { headline: "Jupiter Exchange Volume Overtakes Uniswap", sentiment: "Bullish", source: "DeFi Llama" },
  { headline: "SEC Delays ETF Decision Again", sentiment: "Bearish", source: "Reuters" }
];

const MOCK_INSIGHTS = [
  "[MOCK] I am refining my order block identification based on the recent volatility.",
  "[MOCK] Detected a liquidity sweep; adjusting entry buffer by 0.2%.",
  "[MOCK] Market structure shift confirmed; switching focus to 5m timeframe.",
  "[MOCK] Volume divergence noted on the hourly; caution advised for long entries.",
  "[MOCK] Optimizing strategy parameters based on live data flow.",
  "[MOCK] Volatility spike detected; widening stop-loss parameters slightly."
];

const MOCK_ANALYSIS = "[MOCK] Analysis: Stop loss was likely too tight given the volatility. Price swept the liquidity pool just below your stop before reversing. Consider widening SL to below the swing low.";

// Track mock mode state
let isMockMode = false;

// Initialize Gemini Client
const getClient = () => {
  // Vite uses import.meta.env, not process.env
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    if (!isMockMode) {
      console.warn("Gemini API Key not found (VITE_GEMINI_API_KEY). AI insights will use mock data. This is safe - trading logic is unaffected.");
      isMockMode = true;
    }
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// Export mock mode status for UI
export const isGeminiMockMode = (): boolean => {
  getClient(); // Trigger check
  return isMockMode;
};

export const fetchMarketNewsAnalysis = async (query: string): Promise<{ headline: string, sentiment: 'Bullish' | 'Bearish' | 'Neutral', source: string }[]> => {
  const client = getClient();
  if (!client) {
    return MOCK_NEWS.map(n => ({ ...n, headline: `[MOCK] ${n.headline}` }));
  }

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Search for the latest crypto news regarding ${query} and analyze sentiment. Return a JSON array with 3 items. Format: [{"headline": string, "sentiment": "Bullish"|"Bearish"|"Neutral", "source": string}].`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    return MOCK_NEWS;
  } catch (error) {
    console.warn("Gemini API Error (using fallback data):", error);
    return MOCK_NEWS;
  }
};

export const analyzeTradeFailure = async (tradeDetails: string): Promise<string> => {
  const client = getClient();
  if (!client) {
    return MOCK_ANALYSIS;
  }

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this failed trade and provide constructive feedback in 2 sentences: ${tradeDetails}`,
    });
    return response.text || MOCK_ANALYSIS;
  } catch (error) {
    console.warn("Gemini API Error (using fallback analysis):", error);
    return MOCK_ANALYSIS;
  }
};

// Updated function signature to accept memory
export const generateAgentInsight = async (
  trend: 'UP' | 'DOWN' | 'CHOPPY',
  pastLessons: AgentLesson[]
): Promise<string> => {
  const client = getClient();

  // Format past lessons for the prompt
  const recentLessons = pastLessons.slice(-5).map(l => `- ${l.insight}`).join('\n');

  // Fallback for no API key
  if (!client) {
    return MOCK_INSIGHTS[Math.floor(Math.random() * MOCK_INSIGHTS.length)];
  }

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
      You are an autonomous AI Trading Bot named Yota. 
      
      Your Goal: Grow smarter over time.
      
      Current Market Context: ${trend}
      
      Here is your Short-Term Memory (What you learned recently):
      ${recentLessons}
      
      Task: Generate a NEW, short (1 sentence) "Self-Learning" log entry.
      1. It must be a specific technical observation or strategy adjustment.
      2. It must EVOLVE your strategy based on your memory (don't just repeat old lessons).
      3. Use technical terms like "FVG", "Liquidity", "MSB", "Bias".
      
      Format: First person ("I have observed...", "I am adjusting...").
      `,
    });
    return response.text?.trim() || MOCK_INSIGHTS[Math.floor(Math.random() * MOCK_INSIGHTS.length)];
  } catch (error) {
    console.warn("Gemini API Error (using fallback insight):", error);
    return MOCK_INSIGHTS[Math.floor(Math.random() * MOCK_INSIGHTS.length)];
  }
};