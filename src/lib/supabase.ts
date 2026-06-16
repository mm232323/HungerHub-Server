import { createClient } from "@supabase/supabase-js";
import fetch from "cross-fetch";

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY as string;
if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
        "Missing Supabase URL or Secret Key in environment variables."
    );
}
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: fetch
  }
}); 