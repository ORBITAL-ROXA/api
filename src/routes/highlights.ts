/** Express API router for highlight clips.
 * @module routes/highlights
 * @requires express
 * @requires db
 */

import { Request, Response, Router } from "express";
import { db } from "../services/db.js";
import { RowDataPacket } from "mysql2";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import config from "config";

const router: Router = Router();

// API key for worker authentication
const HIGHLIGHTS_API_KEY = process.env.HIGHLIGHTS_API_KEY || "";

// Ensure highlights directory exists
if (!existsSync("public/highlights")) {
  mkdirSync("public/highlights", { recursive: true });
}

// Ensure table exists on startup
async function ensureTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS highlight_clips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        match_id INT NOT NULL,
        map_number INT NOT NULL DEFAULT 0,
        \`rank\` INT NOT NULL DEFAULT 1,
        player_name VARCHAR(64),
        steam_id VARCHAR(64),
        kills_count INT DEFAULT 0,
        score INT DEFAULT 0,
        description TEXT,
        round_number INT,
        tick_start INT,
        tick_end INT,
        video_file VARCHAR(512),
        thumbnail_file VARCHAR(512),
        duration_s FLOAT,
        status ENUM('pending','extracting','recording','processing','ready','error') DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_match (match_id, map_number),
        INDEX idx_status (status),
        INDEX idx_steam_id (steam_id)
      )
    `);
  } catch (err) {
    // Table may already exist, ignore
  }
}
ensureTable();

/** Middleware to check highlights API key */
function checkApiKey(req: Request, res: Response, next: Function) {
  const apiKey = req.get("X-Highlights-Key") || req.query.apiKey;
  if (apiKey !== HIGHLIGHTS_API_KEY) {
    return res.status(401).json({ message: "Invalid highlights API key" });
  }
  next();
}

/**
 * GET /highlights/pending
 * Returns maps that have demos but no ready highlights.
 * Used by the local worker to find work.
 */
router.get("/pending", checkApiKey, async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT DISTINCT ms.match_id, ms.map_number, ms.demoFile, ms.map_name
      FROM map_stats ms
      WHERE ms.demoFile IS NOT NULL
        AND ms.demoFile != ''
        AND NOT EXISTS (
          SELECT 1 FROM highlight_clips hc
          WHERE hc.match_id = ms.match_id
            AND hc.map_number = ms.map_number
            AND hc.status = 'ready'
            AND hc.\`rank\` = 1
        )
        AND EXISTS (
          SELECT 1 FROM highlight_clips hc2
          WHERE hc2.match_id = ms.match_id
            AND hc2.map_number = ms.map_number
            AND hc2.status = 'pending'
        )
      ORDER BY ms.match_id DESC
      LIMIT 10
    `;
    const result: RowDataPacket[] = await db.query(sql);
    res.json({ pending: result });
  } catch (error) {
    console.error("[HIGHLIGHTS] Error fetching pending:", error);
    res.status(500).json({ message: "Error fetching pending highlights" });
  }
});

/**
 * POST /highlights/status
 * Worker updates clip status.
 * Body: { matchId, mapNumber, rank, status, errorMessage?, playerName?, steamId?, killsCount?, score?, description?, roundNumber?, tickStart?, tickEnd?, durationS? }
 */
router.post("/status", checkApiKey, async (req: Request, res: Response) => {
  try {
    const body = req.body[0] || req.body;
    const { matchId, mapNumber, rank, status, errorMessage,
            playerName, steamId, killsCount, score, description,
            roundNumber, tickStart, tickEnd, durationS } = body;

    if (!matchId || rank === undefined || !status) {
      return res.status(400).json({ message: "matchId, rank, and status are required" });
    }

    let sql = `
      UPDATE highlight_clips SET
        status = ?,
        error_message = ?,
        player_name = COALESCE(?, player_name),
        steam_id = COALESCE(?, steam_id),
        kills_count = COALESCE(?, kills_count),
        score = COALESCE(?, score),
        description = COALESCE(?, description),
        round_number = COALESCE(?, round_number),
        tick_start = COALESCE(?, tick_start),
        tick_end = COALESCE(?, tick_end),
        duration_s = COALESCE(?, duration_s)
      WHERE match_id = ? AND map_number = ? AND \`rank\` = ?
    `;
    await db.query(sql, [
      status, errorMessage || null,
      playerName || null, steamId || null, killsCount || null,
      score || null, description || null, roundNumber || null,
      tickStart || null, tickEnd || null, durationS || null,
      matchId, mapNumber || 0, rank
    ]);

    res.json({ message: "Status updated" });
  } catch (error) {
    console.error("[HIGHLIGHTS] Error updating status:", error);
    res.status(500).json({ message: "Error updating status" });
  }
});

/**
 * POST /highlights/upload
 * Worker uploads a processed clip MP4.
 * Headers: X-Match-Id, X-Map-Number, X-Rank, X-Metadata (JSON)
 * Body: raw binary MP4
 */
router.post("/upload", checkApiKey, async (req: Request, res: Response) => {
  try {
    const matchId = req.get("X-Match-Id");
    const mapNumber = req.get("X-Map-Number") || "0";
    const rank = req.get("X-Rank") || "1";
    const metadataStr = req.get("X-Metadata");
    const fileType = req.get("X-File-Type") || "video"; // "video" or "thumbnail"

    if (!matchId || !req.body || req.body.length === 0) {
      return res.status(400).json({ message: "matchId and file body required" });
    }

    const metadata = metadataStr ? JSON.parse(metadataStr) : {};

    if (fileType === "thumbnail") {
      const thumbName = `match_${matchId}_map_${mapNumber}_clip_${rank}_thumb.jpg`;
      writeFileSync(`public/highlights/${thumbName}`, req.body, "binary");

      await db.query(
        "UPDATE highlight_clips SET thumbnail_file = ? WHERE match_id = ? AND map_number = ? AND `rank` = ?",
        [thumbName, matchId, mapNumber, rank]
      );

      return res.json({ message: "Thumbnail uploaded", file: thumbName });
    }

    // Video upload
    const fileName = `match_${matchId}_map_${mapNumber}_clip_${rank}.mp4`;
    writeFileSync(`public/highlights/${fileName}`, req.body, "binary");

    // Update DB with video file and metadata
    let sql = `
      UPDATE highlight_clips SET
        video_file = ?,
        status = 'ready',
        player_name = COALESCE(?, player_name),
        steam_id = COALESCE(?, steam_id),
        kills_count = COALESCE(?, kills_count),
        score = COALESCE(?, score),
        description = COALESCE(?, description),
        round_number = COALESCE(?, round_number),
        tick_start = COALESCE(?, tick_start),
        tick_end = COALESCE(?, tick_end),
        duration_s = COALESCE(?, duration_s)
      WHERE match_id = ? AND map_number = ? AND \`rank\` = ?
    `;
    await db.query(sql, [
      fileName,
      metadata.playerName || null, metadata.steamId || null,
      metadata.killsCount || null, metadata.score || null,
      metadata.description || null, metadata.roundNumber || null,
      metadata.tickStart || null, metadata.tickEnd || null,
      metadata.durationS || null,
      matchId, mapNumber, rank
    ]);

    res.json({ message: "Clip uploaded", file: fileName });
  } catch (error) {
    console.error("[HIGHLIGHTS] Error uploading:", error);
    res.status(500).json({ message: "Error uploading clip" });
  }
});

/**
 * GET /highlights/player/:steamId
 * Returns all ready highlight clips for a specific player.
 */
router.get("/player/:steamId", async (req: Request, res: Response) => {
  try {
    const steamId = req.params.steamId;
    const sql = `
      SELECT hc.*, m.team1_string, m.team2_string
      FROM highlight_clips hc
      LEFT JOIN \`match\` m ON m.id = hc.match_id
      WHERE hc.steam_id = ? AND hc.status = 'ready' AND hc.video_file IS NOT NULL
      ORDER BY hc.created_at DESC
      LIMIT 20
    `;
    const result: RowDataPacket[] = await db.query(sql, [steamId]);
    res.json({ clips: result });
  } catch (error) {
    console.error("[HIGHLIGHTS] Error fetching player clips:", error);
    res.status(500).json({ message: "Error fetching player clips" });
  }
});

/**
 * GET /highlights/:match_id
 * Returns all highlight clips for a match.
 */
router.get("/:match_id", async (req: Request, res: Response) => {
  try {
    const matchId = req.params.match_id;
    const sql = `
      SELECT * FROM highlight_clips
      WHERE match_id = ?
      ORDER BY map_number ASC, \`rank\` ASC
    `;
    const result: RowDataPacket[] = await db.query(sql, [matchId]);
    res.json({ clips: result });
  } catch (error) {
    console.error("[HIGHLIGHTS] Error fetching clips:", error);
    res.status(500).json({ message: "Error fetching clips" });
  }
});

/**
 * POST /highlights/trigger
 * Admin creates pending rows for a match/map (manual trigger).
 * Body: { matchId, mapNumber? }
 */
router.post("/trigger", async (req: Request, res: Response) => {
  try {
    const body = req.body[0] || req.body;
    const { matchId, mapNumber } = body;

    if (!matchId) {
      return res.status(400).json({ message: "matchId is required" });
    }

    // Get maps with demos for this match
    let sql: string;
    let params: any[];

    if (mapNumber !== undefined) {
      sql = "SELECT match_id, map_number, demoFile FROM map_stats WHERE match_id = ? AND map_number = ? AND demoFile IS NOT NULL";
      params = [matchId, mapNumber];
    } else {
      sql = "SELECT match_id, map_number, demoFile FROM map_stats WHERE match_id = ? AND demoFile IS NOT NULL";
      params = [matchId];
    }

    const maps: RowDataPacket[] = await db.query(sql, params);

    if (maps.length === 0) {
      return res.status(404).json({ message: "No maps with demos found for this match" });
    }

    let created = 0;
    for (const map of maps) {
      // Delete existing clips for this map (reset)
      await db.query(
        "DELETE FROM highlight_clips WHERE match_id = ? AND map_number = ?",
        [map.match_id, map.map_number]
      );

      // Create 3 pending rows
      await db.query(
        "INSERT INTO highlight_clips (match_id, map_number, `rank`, status) VALUES (?, ?, 1, 'pending'), (?, ?, 2, 'pending'), (?, ?, 3, 'pending')",
        [map.match_id, map.map_number, map.match_id, map.map_number, map.match_id, map.map_number]
      );
      created += 3;
    }

    res.json({ message: `Created ${created} pending highlights for ${maps.length} map(s)` });
  } catch (error) {
    console.error("[HIGHLIGHTS] Error triggering:", error);
    res.status(500).json({ message: "Error triggering highlights" });
  }
});

export default router;
