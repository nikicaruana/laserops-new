import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local","utf8").split(/\r?\n/)) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
(async () => {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url!, key!);
  const hb: Record<string,string> = {
    "simon@drinklinkevents.com":"01","michelezahra@gmail.com":"02","glenngatt10289@gmail.com":"41",
    "jensbud@gmail.com":"06","andrewct214@gmail.com":"39","tomas.calmfors@gmail.com":"42",
    "sina.salminen@gmail.com":"04","axel.lundberg1@gmail.com":"45","wiggman@gmail.com":"40","bsodgaming1@gmail.com":"37" };
  const emails = Object.keys(hb);
  const { data, error } = await sb.from("accounts").select("email, ops_tag, full_name").in("email", emails);
  if(error){ console.log("ERR", error.message); return; }
  const byEmail: Record<string,any> = {}; for(const a of data||[]) byEmail[(a.email||"").toLowerCase()] = a;
  console.log("HB | email | ops_tag | full_name");
  for(const e of emails){ const a=byEmail[e.toLowerCase()]; console.log(`${hb[e]} | ${e} | ${a?.ops_tag ?? "(no account)"} | ${a?.full_name ?? ""}`); }
})();
