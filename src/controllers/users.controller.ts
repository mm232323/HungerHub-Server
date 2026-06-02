import type { Request, Response } from "express";
import { supabase } from "#supabase";
import { getAuth, createClerkClient } from "@clerk/express";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY || "" });

export async function initUser(req: Request, res: Response): Promise<void> {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(auth.userId);
    const sessionid = auth.sessionId || "unknown-session";
    const username = user.username || user.firstName || "anonymous";
    const email = user.primaryEmailAddress?.emailAddress || null;
    const firstName = user.firstName || null;
    const lastName = user.lastName || null;
    const imageUrl = user.imageUrl || null;
    const role = user.unsafeMetadata?.role as string || "customer";

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", auth.userId)
      .single();

    if (existingUser) {
      // User already exists, just return
      res.status(200).json({ success: true, id: existingUser.id });
      return;
    }

    // Insert into users table with all metadata
    const { data, error } = await supabase
      .from("users")
      .insert({
        session_id: sessionid,
        username,
        clerk_id: auth.userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ success: true, id: data.id });
  } catch (err: any) {
    console.error("User initialization failed:", err);
    res.status(500).json({ error: err.message });
  }
}
