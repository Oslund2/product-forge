import type { Context, Config } from "@netlify/functions";

const supabaseUrl = () => Netlify.env.get("SUPABASE_URL")!;
const supabaseKey = () => Netlify.env.get("SUPABASE_ANON_KEY")!;

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${supabaseUrl()}/rest/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey(),
      Authorization: `Bearer ${supabaseKey()}`,
      Prefer: options.method === "POST" ? "return=representation" : "return=representation",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error: ${text}`);
  }
  return res.json();
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const headers = { "Content-Type": "application/json" };

  try {
    // GET /api/pipeline?id=xxx — load a run
    if (req.method === "GET") {
      const id = url.searchParams.get("id");
      if (id) {
        const data = await supabaseFetch(`/pipeline_runs?id=eq.${id}&select=*`);
        return new Response(JSON.stringify(data[0] || null), { headers });
      }
      // List recent runs
      const data = await supabaseFetch(
        `/pipeline_runs?select=id,created_at,intake,current_stage,status&order=created_at.desc&limit=20`
      );
      return new Response(JSON.stringify(data), { headers });
    }

    // POST /api/pipeline — create a new run
    if (req.method === "POST") {
      const body = await req.json();
      const data = await supabaseFetch("/pipeline_runs", {
        method: "POST",
        body: JSON.stringify({ intake: body.intake }),
      });
      return new Response(JSON.stringify(data[0]), { status: 201, headers });
    }

    // PATCH /api/pipeline?id=xxx — update a run
    if (req.method === "PATCH") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers });
      }
      const body = await req.json();
      const allowed = ["intake", "refined", "prd", "tech_spec", "estimate", "proto_prompt", "build_status", "current_stage", "status"];
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      const data = await supabaseFetch(`/pipeline_runs?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      return new Response(JSON.stringify(data[0]), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
};

export const config: Config = {
  path: "/api/pipeline",
};
