const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from "react";

/**
 * Hook that reads public/media-data.json and syncs new items
 * into the Media entity database. Returns the full merged list.
 */
export default function useMediaSync() {
  const [media, setMedia] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    syncFromJSON();
  }, []);

  const syncFromJSON = async () => {
    setSyncing(true);
    try {
      // 1. Fetch the JSON file
      const res = await fetch("/media-data.json", { cache: "no-cache" });
      if (!res.ok) {
        console.log("[MediaSync] No media-data.json found, falling back to DB");
        const dbMedia = await db.entities.Media.list("-avg_rating", 200);
        setMedia(dbMedia);
        setSyncing(false);
        return;
      }

      const data = await res.json();
      const jsonMedia = data.media || [];
      setLastSync(data.updated_at);

      if (jsonMedia.length === 0) {
        const dbMedia = await db.entities.Media.list("-avg_rating", 200);
        setMedia(dbMedia);
        setSyncing(false);
        return;
      }

      // 2. Get existing media from DB to check for duplicates
      const dbMedia = await db.entities.Media.list("-avg_rating", 500);
      const dbKeys = new Set(dbMedia.map((m) => `${m.title?.toLowerCase().trim()}|${m.type}`));

      // 3. Find new items not in DB
      const newItems = jsonMedia.filter((item) => {
        const key = `${(item.title || "").toLowerCase().trim()}|${item.type}`;
        return item.title && !dbKeys.has(key);
      });

      // 4. Bulk create new items (in batches of 50 to avoid payload limits)
      if (newItems.length > 0) {
        console.log(`[MediaSync] Importing ${newItems.length} new media items...`);
        for (let i = 0; i < newItems.length; i += 50) {
          const batch = newItems.slice(i, i + 50);
          await db.entities.Media.bulkCreate(batch);
        }
        console.log(`[MediaSync] Done importing ${newItems.length} items`);
      }

      // 5. Return merged list
      const updatedDb = await db.entities.Media.list("-avg_rating", 500);
      setMedia(updatedDb);
    } catch (e) {
      console.error("[MediaSync] Sync error:", e);
      // Fallback to DB
      try {
        const dbMedia = await db.entities.Media.list("-avg_rating", 200);
        setMedia(dbMedia);
      } catch {}
    }
    setSyncing(false);
  };

  return { media, syncing, lastSync, resync: syncFromJSON };
}