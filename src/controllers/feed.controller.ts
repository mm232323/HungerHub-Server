import type { Request, Response } from "express";
import { supabase } from "#supabase";
import {
  GetFeedResponse,
  LikeFeedPostResponse,
  SaveFeedPostResponse,
  GetFeedStoriesResponse,
  LikeFeedPostParams,
  SaveFeedPostParams,
  GetFeedQueryParams,
} from "#api-zod";
import { serializeDates, camelCaseKeys } from "../utils/serialize";
import { getSessionId } from "./session";

export async function list(req: Request, res: Response): Promise<void> {
  const query = GetFeedQueryParams.safeParse(req.query);
  const limit =
    query.success && query.data.limit ? Number(query.data.limit) : 10;
  const offset =
    query.success && query.data.offset ? Number(query.data.offset) : 0;

  const { data: posts, error } = await supabase
    .from("feed_posts")
    .select("*")
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const { data: merchants } = await supabase.from("merchants").select("*");
  const merchantMap = new Map(
    (merchants ?? []).map((m: { id: number }) => [m.id, m]),
  );

  const sessionId = getSessionId(req);
  const { data: likes } = await supabase
    .from("feed_likes")
    .select("*")
    .eq("session_id", sessionId);
  const { data: saves } = await supabase
    .from("feed_saves")
    .select("*")
    .eq("session_id", sessionId);

  const likedIds = new Set(
    (likes ?? []).map((l: { feed_post_id: number }) => l.feed_post_id),
  );
  const savedIds = new Set(
    (saves ?? []).map((s: { feed_post_id: number }) => s.feed_post_id),
  );

  const result = (posts ?? []).map((p: Record<string, unknown>) => {
    const camelPost = camelCaseKeys(p) as { merchantId: number; id: number };
    const rawMerchant = merchantMap.get(camelPost.merchantId);
    const camelMerchant = rawMerchant ? camelCaseKeys(rawMerchant) : null;
    return {
      ...camelPost,
      merchant: camelMerchant ? { ...camelMerchant, isFollowing: false } : null,
      product: null,
      isLiked: likedIds.has(camelPost.id),
      isSaved: savedIds.has(camelPost.id),
    };
  });

  res.json(GetFeedResponse.parse(serializeDates(result)));
}

export async function toggleLike(req: Request, res: Response): Promise<void> {
  const params = LikeFeedPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { data: posts, error } = await supabase
    .from("feed_posts")
    .select("*")
    .eq("id", params.data.id)
    .limit(1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const post = posts?.[0];
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const sessionId = getSessionId(req);
  const { data: existingLikes } = await supabase
    .from("feed_likes")
    .select("*")
    .eq("feed_post_id", params.data.id)
    .eq("session_id", sessionId)
    .limit(1);

  const existing = existingLikes?.[0];

  let isLiked: boolean;
  let likes: number;

  if (existing) {
    await supabase.from("feed_likes").delete().eq("id", existing.id);
    const newLikes = Math.max(0, (post.likes ?? 0) - 1);
    await supabase
      .from("feed_posts")
      .update({ likes: newLikes })
      .eq("id", params.data.id);
    isLiked = false;
    likes = newLikes;
  } else {
    await supabase
      .from("feed_likes")
      .insert({ feed_post_id: params.data.id, session_id: sessionId });
    const newLikes = (post.likes ?? 0) + 1;
    await supabase
      .from("feed_posts")
      .update({ likes: newLikes })
      .eq("id", params.data.id);
    isLiked = true;
    likes = newLikes;
  }

  res.json(LikeFeedPostResponse.parse({ isLiked, likes }));
}

export async function toggleSave(req: Request, res: Response): Promise<void> {
  const params = SaveFeedPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { data: posts } = await supabase
    .from("feed_posts")
    .select("*")
    .eq("id", params.data.id)
    .limit(1);

  const post = posts?.[0];
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const sessionId = getSessionId(req);
  const { data: existingSaves } = await supabase
    .from("feed_saves")
    .select("*")
    .eq("feed_post_id", params.data.id)
    .eq("session_id", sessionId)
    .limit(1);

  const existing = existingSaves?.[0];

  let isSaved: boolean;
  if (existing) {
    await supabase.from("feed_saves").delete().eq("id", existing.id);
    isSaved = false;
  } else {
    await supabase
      .from("feed_saves")
      .insert({ feed_post_id: params.data.id, session_id: sessionId });
    isSaved = true;
  }

  res.json(SaveFeedPostResponse.parse({ isSaved }));
}

export async function stories(_req: Request, res: Response): Promise<void> {
  const { data: merchants, error } = await supabase
    .from("merchants")
    .select("*")
    .limit(8);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = (merchants ?? []).map((m: Record<string, unknown>, i: number) => {
    const camelMerchant = camelCaseKeys(m) as {
      id: number;
      coverImage: string;
    };
    return {
      id: i + 1,
      merchantId: camelMerchant.id,
      merchant: { ...camelMerchant, isFollowing: false },
      image: camelMerchant.coverImage,
      hasUnviewed: Math.random() > 0.3,
    };
  });

  res.json(GetFeedStoriesResponse.parse(serializeDates(result)));
}
