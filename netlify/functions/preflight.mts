import type { Context } from "@netlify/functions";

const PREFLIGHT_PROMPT = `You are an input quality evaluator for a product planning tool. Score the user's product idea on three dimensions (1-5 each):

1. **Specificity** — Does it name a domain, target users, and a concrete problem?
2. **Completeness** — Does it mention scope, constraints, audience, or business context?
3. **Clarity** — Is it parseable as a coherent product idea?

Return ONLY valid JSON (no markdown, no code fences):
{
  "score": <average of the 3 scores, rounded to 1 decimal>,
  "specificity": <1-5>,
  "completeness": <1-5>,
  "clarity": <1-5>,
  "suggestions": ["<improvement suggestion 1>", "<improvement suggestion 2>"]
}

Keep suggestions to 2-3 items max, each under 15 words. If the input scores 4+ on all dimensions, return an empty suggestions array.`;

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { text: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { text } = body;
  if (!text?.trim() || text.trim().length < 10) {
    return new Response(JSON.stringify({ score: 0, suggestions: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const model = "gemini-2.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: PREFLIGHT_PROMPT }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${err}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from the response, stripping any markdown fences
    const cleaned = rawText.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleaned);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Preflight check failed";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/preflight",
};
