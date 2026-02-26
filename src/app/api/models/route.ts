import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}

let cachedModels: OpenRouterModel[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const now = Date.now();

  if (cachedModels && now - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json(cachedModels);
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        ...(process.env.OPENROUTER_API_KEY
          ? { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
          : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API error: ${res.status}`);
    }

    const json = await res.json();
    const models: OpenRouterModel[] = (json.data || [])
      .filter((m: { id: string }) => {
        // Filter out models that are clearly not chat/completion models
        const id = m.id.toLowerCase();
        return !id.includes("/auto") && !id.includes("tool-use");
      })
      .map((m: { id: string; name: string; context_length: number; pricing?: { prompt?: string; completion?: string } }) => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length,
        pricing: {
          prompt: m.pricing?.prompt ?? "0",
          completion: m.pricing?.completion ?? "0",
        },
      }))
      .sort((a: OpenRouterModel, b: OpenRouterModel) => a.name.localeCompare(b.name));

    cachedModels = models;
    cacheTimestamp = now;

    return NextResponse.json(models);
  } catch (err) {
    // If fetch fails and we have stale cache, return it
    if (cachedModels) {
      return NextResponse.json(cachedModels);
    }
    return NextResponse.json(
      { error: String(err) },
      { status: 502 }
    );
  }
}
