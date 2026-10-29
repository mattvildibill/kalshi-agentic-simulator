import { readFile } from "node:fs/promises";
console.log(
  "Apply the following SQL ONLY in your dedicated simulator Supabase project SQL Editor:",
);
console.log(
  await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
);
console.log(
  "Then configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as server-only environment variables.",
);
