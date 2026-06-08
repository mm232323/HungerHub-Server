import fs from 'fs';

const file = 'server/HungerHub-Server/src/controllers/feed.controller.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("import { clerkClient } from '@clerk/express';")) {
  code = `import { clerkClient } from '@clerk/express';\n` + code;
}

const enrichCommentsStr = `
async function enrichCommentsWithUserProfiles(comments: any[]) {
  if (!comments || comments.length === 0) return [];
  
  // Extract unique session_ids
  const userIds = [...new Set(comments.map(c => c.session_id || c.sessionId).filter(id => id && !id.includes("::") && !id.includes("anonymous")))];
  
  const userMap = new Map();
  if (userIds.length > 0) {
    try {
      const { data: users } = await clerkClient.users.getUserList({ userId: userIds, limit: 100 });
      users.forEach(u => {
        userMap.set(u.id, {
          firstName: u.firstName,
          lastName: u.lastName,
          imageUrl: u.imageUrl,
          username: u.username
        });
      });
    } catch (e) {
      console.error("Failed to fetch user profiles from Clerk", e);
    }
  }

  return comments.map(c => {
    const sId = c.session_id || c.sessionId;
    const profile = userMap.get(sId);
    
    let name = "User";
    if (profile) {
      if (profile.firstName) {
        name = profile.firstName + (profile.lastName ? \` \${profile.lastName}\` : "");
      } else if (profile.username) {
        name = profile.username;
      }
    } else {
      if (sId === "anonymous" || sId.includes("::")) name = "Anonymous User";
      else name = \`User \${sId.substring(0, 4)}\`;
    }

    return {
      ...c,
      user: {
        name,
        imageUrl: profile?.imageUrl || null,
      }
    };
  });
}
`;

if (!code.includes("enrichCommentsWithUserProfiles")) {
  code += enrichCommentsStr;
}

code = code.replace(
  `res.json((data ?? []).map((c: any) => camelCaseKeys(c)));`,
  `const enriched = await enrichCommentsWithUserProfiles(data ?? []);\n  res.json(enriched.map((c: any) => camelCaseKeys(c)));`
);

// We have two places where `res.json((data ?? []).map((c: any) => camelCaseKeys(c)));` appears (in getFeedPostComments and getFeedAdComments).
// String.prototype.replace only replaces the first occurrence. Let's do it globally using regex or split/join.
code = code.split(`res.json((data ?? []).map((c: any) => camelCaseKeys(c)));`).join(
  `const enriched = await enrichCommentsWithUserProfiles(data ?? []);\n  res.json(enriched.map((c: any) => camelCaseKeys(c)));`
);

fs.writeFileSync(file, code);