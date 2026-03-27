import type { Context } from "@netlify/functions";

const VALIDATE_PROMPT = `You are a consistency checker for a product planning pipeline. You will receive the current stage's output along with outputs from prior stages.

Check for:
1. **Missing coverage** — Topics, features, or requirements mentioned in earlier stages that are absent from the current output
2. **Contradictions** — Statements that conflict between stages (e.g., PRD says "offline support" but Tech Spec has no offline architecture)
3. **Scope drift** — The current stage significantly expanded or narrowed scope vs. prior stages without explanation

Return ONLY valid JSON (no markdown, no code fences):
{
  "consistent": <true if no significant issues, false otherwise>,
  "issues": ["<issue description 1>", "<issue description 2>"]
}

Keep issues to 5 max, each under 30 words. If consistent, return an empty issues array.`;

const STAGE_ORDER = ["intake", "refine", "prd", "techspec", "estimate", "proto_prompt"];

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { current_stage: string; current_output: string; previous_outputs: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { current_stage, current_output, previous_outputs } = body;

  if (!current_output?.trim()) {
    return new Response(JSON.stringify({ consistent: true, issues: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build context from prior stages
  const stageIdx = STAGE_ORDER.indexOf(current_stage);
  const priorStages = STAGE_ORDER.slice(0, stageIdx)
    .filter(s => previous_outputs?.[s]?.trim())
    .map(s => `### ${s.toUpperCase()} Output:\n${previous_outputs[s].slice(0, 3000)}`)
    .join("\n\n");

  if (!priorStages) {
    return new Response(JSON.stringify({ consistent: true, issues: [] }), {
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

    const userContent = `## Prior Stages:\n${priorStages}\n\n## Current Stage (${current_stage.toUpperCase()}) Output:\n${current_output.slice(0, 4000)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: VALIDATE_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.1 },
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

    const cleaned = rawText.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleaned);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Validation failed";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/validate",
};
