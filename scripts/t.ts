import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split(/\r?\n/)) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
(async () => {
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try { const payload=JSON.parse(Buffer.from(key.split(".")[1],"base64").toString()); console.log("key role claim:", payload.role); } catch(e){ console.log("key decode fail"); }
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth:{persistSession:false} });
  const r1 = await sb.from("accounts").select("email, ops_tag").limit(1);
  console.log("accounts:", r1.error?("ERR "+r1.error.message):("ok, sample "+JSON.stringify(r1.data)));
})();
