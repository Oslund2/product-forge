import type { Context } from "@netlify/functions";

const REVIEW_PROMPTS: Record<string, string> = {
  techspec: `You are a Principal Architect reviewing a Technical Specification. Evaluate it critically:

1. **Architecture Gaps** — Missing components, unclear boundaries, single points of failure
2. **Technology Choices** — Are the specific tools/versions appropriate? Any better alternatives?
3. **Data Model Issues** — Missing relationships, normalization problems, scalability concerns
4. **Security Weaknesses** — Authentication gaps, missing encryption, inadequate access control
5. **Integration Risks** — API design issues, missing error handling, coupling concerns

Format your review as:

## Strengths
- (2-3 things done well)

## Issues Found
For each issue:
- **[Severity: High/Medium/Low]** Description of the issue and specific recommendation to fix it

## Improvement Suggestions
- (2-3 specific enhancements that would elevate quality)`,

  estimate: `You are a Technical Project Manager reviewing a Cost & Timeline Estimate. Evaluate it critically:

1. **Math Accuracy** — Verify calculations, check that totals match line items
2. **Rate Realism** — Are salary rates, cloud costs, and vendor prices current and cited?
3. **Scope Coverage** — Does the estimate cover all requirements from the PRD/Tech Spec?
4. **Risk Assessment** — Are risks realistic? Are mitigations specific enough?
5. **AI Savings Claims** — Are productivity multipliers properly cited and reasonable?

Format your review as:

## Strengths
- (2-3 things done well)

## Issues Found
For each issue:
- **[Severity: High/Medium/Low]** Description of the issue and specific recommendation to fix it

## Improvement Suggestions
- (2-3 specific enhancements that would elevate quality)`,

  proto_prompt: `You are a Senior Prompt Engineer reviewing a Claude Code build prompt. Evaluate it critically:

1. **Completeness** — Does it cover all MVP user flows from the PRD?
2. **Executability** — Can Claude Code follow these instructions without ambiguity?
3. **Schema Quality** — Is the SQL schema complete with constraints, indexes, and RLS?
4. **File Structure** — Is the project organization clear and maintainable?
5. **Missing Details** — Are there gaps that would force Claude Code to guess?

Format your review as:

## Strengths
- (2-3 things done well)

## Issues Found
For each issue:
- **[Severity: High/Medium/Low]** Description of the issue and specific recommendation to fix it

## Improvement Suggestions
- (2-3 specific enhancements that would elevate quality)`,
};

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { stage: string; output: string; all_outputs?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { stage, output, all_outputs } = body;

  if (!REVIEW_PROMPTS[stage]) {
    return new Response(
      JSON.stringify({ error: `Deep review not available for stage: ${stage}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!output?.trim()) {
    return new Response(
      JSON.stringify({ error: "No output to review" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const model = "gemini-2.5-pro";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    // Build context from prior stages if available
    let contextBlock = "";
    if (all_outputs) {
      const priorKeys = ["intake", "refine", "prd", "techspec", "estimate", "proto_prompt"];
      const stageIdx = priorKeys.indexOf(stage);
      const priors = priorKeys.slice(0, stageIdx)
        .filter(k => all_outputs[k]?.trim())
        .map(k => `### ${k.toUpperCase()}:\n${all_outputs[k].slice(0, 2000)}`)
        .join("\n\n");
      if (priors) contextBlock = `\n\n## Context from Prior Stages:\n${priors}`;
    }

    const userContent = `Review the following ${stage.toUpperCase()} output:${contextBlock}\n\n## ${stage.toUpperCase()} Output to Review:\n${output}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: REVIEW_PROMPTS[stage] }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${err}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response back as SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const parts = parsed.candidates?.[0]?.content?.parts;
              if (parts) {
                for (const part of parts) {
                  if (part.text) {
                    fullText += part.text;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: part.text })}\n\n`));
                  }
                }
              }
            } catch {}
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ output: fullText, done: true })}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Review failed";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/review",
};
