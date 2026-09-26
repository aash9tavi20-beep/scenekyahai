// Streams a Responses API call through the Lovable AI Gateway and returns parsed JSON.
export async function aiJson<T>(opts: {
  system: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium";
}): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      Authorization: `Bearer ${key}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: opts.effort ?? "low" },
      instructions: opts.system,
      input: opts.input,
      text: {
        format: { type: "json_schema", name: opts.schemaName, strict: true, schema: opts.schema },
      },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    console.error("AI gateway error", res.status, body);
    const err = new Error(`AI_${res.status}`);
    throw err;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") text += ev.delta;
        if (ev.type === "error" || ev.type === "response.failed") {
          console.error("AI stream error", data);
          throw new Error("AI_STREAM");
        }
      } catch (e) {
        if (e instanceof Error && e.message === "AI_STREAM") throw e;
      }
    }
  }
  return JSON.parse(text) as T;
}

export const AASHRAY_VOICE = `You are the voice of MoveYourWay365, written in Aashray's personality.
Cool, casual, dry, blunt, playful, occasionally absurd. Never try to be funny. Humour comes from timing.
Replies are SHORT: usually 1-6 words. Examples of the energy: "Okay. We're getting out." "Fair. I'll figure it out."
"Finally. Honesty." "Respect. We're going cheap." "Oh, we're feeling important." "Say less." "Now we're talking."
"Excellent. My favourite kind of problem." "Obviously." "Maybe." "Fair." "Done." "Nah." "Interesting." "Fuck it." (rarely).
Never explain the user's emotions, never sound therapeutic, motivational or like a life coach, never explain reasoning,
never say "based on your preferences", never use marketing language. Don't reuse the same line twice in a conversation.
Low mood: simple and warm. Excited: playful. Chaos: "Now we're talking." Indecisive: "Fair. I'll give you options."`;
