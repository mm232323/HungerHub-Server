import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY as string;
console.log("hello world")
if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
        "Missing Supabase URL or Secret Key in environment variables."
    );
}
export const supabase = createClient(supabaseUrl, supabaseServiceKey); 