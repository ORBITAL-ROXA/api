/** Express API router for leaderboards in get5.
 * @module routes/leaderboard
 * @requires express
 * @requires db
 */

/**
 * @swagger
 * resourcePath: /leaderboard
 * description: Leaderboard calls from the database.
 */
 import { Router } from "express";

 const router = Router();
 
 import {db} from "../services/db.js";
 
 import Utils from "../utility/utils.js";
import { TeamStanding } from "../types/leaderboard/TeamStanding.js";
import { Player } from "../types/leaderboard/Player.js";
 
 /**
  * @swagger
  *
  * components:
  *   schemas:
  *     Player:
  *       type: object
  *       properties:
  *          steamId:
  *            type: string
  *          name:
  *            type: string
  *          kills:
  *            type: integer
  *          deaths:
  *            type: integer
  *          assists:
  *            type: integer
  *          k1:
  *            type: integer
  *          k2:
  *            type: integer
  *          k3:
  *            type: integer
  *          k4:
  *            type: integer
  *          k5:
  *            type: integer
  *          v1:
  *            type: integer
  *          v2:
  *            type: integer
  *          v3:
  *            type: integer
  *          v4:
  *            type: integer
  *          v5:
  *            type: integer
  *          trp:
  *            type: integer
  *          fba:
  *            type: integer
  *          total_damage:
  *            type: integer
  *          hsk:
  *            type: integer
  *          hsp:
  *            type: number
  *          average_rating:
  *            type: number
  *          wins:
  *            type: integer
  *          total_maps:
  *            type: integer
  *          enemies_flashed:
  *            type: integer
  *          friendlies_flashed:
  *            type: integer
  *          util_damage:
  *            type: integer
  *     TeamStanding:
  *       type: object
  *       properties:
  *         name:
  *           type: string
  *         wins:
  *           type: integer
  *         losses:
  *           type: integer
  *         rounddiff:
  *           type: integer
  *     SimpleResponse:
  *       type: object
  *       properties:
  *         message:
  *           type: string
  *     SimpleResponseStatus:
  *      type: object
  *      properties:
  *        message:
  *         type: string
  *        status:
  *        type: integer
  *   responses:
  *     BadRequest:
  *       description: Bad request, information not provided.
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/SimpleResponse'
  *     NotFound:
  *       description: The specified resource was not found.
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/SimpleResponse'
  *     Unauthorized:
  *       description: Unauthorized.
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/SimpleResponse'
  *     Error:
  *       description: Error
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/SimpleResponse'
  *     Success:
  *       description: Success
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/SimpleResponse'
  */

 /**
  * @swagger
  *
  * /leaderboard/:
  *   get:
  *     description: Get lifetime leaderboard of teams
  *     produces:
  *       - application/json
  *     tags:
  *       - leaderboard
  *     responses:
  *       200:
  *         description: Leaderboard
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 leaderboard:
  *                   type: array
  *                   items:
  *                     $ref: '#/components/schemas/TeamStanding'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/", async (req, res) => {
   try {
     let leaderboard: TeamStanding[] = await getTeamLeaderboard();
     res.json({ leaderboard });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: err });
   }
 });
 
 /**
  * @swagger
  *
  * /leaderboard/players:
  *   get:
  *     description: Get lifetime leaderboard for players
  *     produces:
  *       - application/json
  *     tags:
  *       - leaderboard
  *     responses:
  *       200:
  *         description: Leaderboard
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 leaderboard:
  *                   type: array
  *                   items:
  *                     $ref: '#/components/schemas/Player'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/players", async (req, res) => {
   try {
     let leaderboard: Player[] = await getPlayerLeaderboard();
     res.json({ leaderboard });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: err });
   }
 });
 
 /**
  * @swagger
  *
  * /leaderboard/players/pug:
  *   get:
  *     description: Get lifetime leaderboard for players in pickup games.
  *     produces:
  *       - application/json
  *     tags:
  *       - leaderboard
  *     responses:
  *       200:
  *         description: Leaderboard
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 leaderboard:
  *                   type: array
  *                   items:
  *                     $ref: '#/components/schemas/Player'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/players/pug", async (req, res) => {
   try {
     let leaderboard: Player[] = await getPlayerLeaderboard(null, true);
     res.json({ leaderboard });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: err });
   }
 });
 
 /**
  * @swagger
  *
  * /leaderboard/players/:season_id:
  *   get:
  *     description: Seasonal leaderboard for players
  *     produces:
  *       - application/json
  *     parameters:
  *       - name: season_id
  *         required: true
  *         schema:
  *          type: string
  *     tags:
  *       - leaderboard
  *     responses:
  *       200:
  *         description: Leaderboard
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 leaderboard:
  *                   type: array
  *                   items:
  *                     $ref: '#/components/schemas/TeamStanding'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/players/:season_id", async (req, res) => {
   try {
     let seasonId: number = parseInt(req.params.season_id);
     let leaderboard: Player[] = await getPlayerLeaderboard(seasonId);
     res.json({ leaderboard });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: err });
   }
 });
 
 /**
  * @swagger
  *
  * /leaderboard/:season_id:
  *   get:
  *     description: Seasonal leaderboard for teams
  *     produces:
  *       - application/json
  *     tags:
  *       - leaderboard
  *     parameters:
  *       - name: season_id
  *         required: true
  *         schema:
  *          type: string
  *     responses:
  *       200:
  *         description: Leaderboard
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/SimpleResponse'
  *       500:
  *         $ref: '#/components/responses/Error'
  */
 router.get("/:season_id", async (req, res) => {
   try {
     let seasonId = parseInt(req.params.season_id);
     let leaderboard = await getTeamLeaderboard(seasonId);
     res.json({ leaderboard });
   } catch (err) {
     console.error(err);
     res.status(500).json({ message: err });
   }
 });
 
 /** Function to get the current team leaderboard standings in a season, or all time.
  * @function
  * @memberof module:routes/leaderboard
  * @param {string} [seasonId=null] - Season ID to filter.
  * @inner */
 const getTeamLeaderboard = async (seasonId: number | null = null) => {
   try {
     // Single query with JOINs instead of N+1 queries per match/map
     let sql = `
       SELECT
         tw.name AS winner_name,
         tl.name AS loser_name,
         CASE WHEN ms.winner = m.team1_id THEN ms.team1_score ELSE ms.team2_score END AS winner_rounds,
         CASE WHEN ms.winner = m.team1_id THEN ms.team2_score ELSE ms.team1_score END AS loser_rounds
       FROM map_stats ms
       JOIN \`match\` m ON m.id = ms.match_id
       JOIN team tw ON tw.id = ms.winner
       JOIN team tl ON tl.id = CASE WHEN ms.winner = m.team1_id THEN m.team2_id ELSE m.team1_id END
       WHERE m.end_time IS NOT NULL
         AND m.winner IS NOT NULL
         AND m.cancelled = 0
         AND ms.winner IS NOT NULL
     `;
     const params: any[] = [];
     if (seasonId) {
       sql += " AND m.season_id = ?";
       params.push(seasonId);
     }

     const rows = await db.query(sql, params);
     const teamMap = new Map<string, TeamStanding>();

     for (const row of rows) {
       const roundDiff = row.winner_rounds - row.loser_rounds;

       // Winner
       if (!teamMap.has(row.winner_name)) {
         teamMap.set(row.winner_name, { name: row.winner_name, wins: 0, losses: 0, rounddiff: 0 });
       }
       const winner = teamMap.get(row.winner_name)!;
       winner.wins += 1;
       winner.rounddiff += roundDiff;

       // Loser
       if (!teamMap.has(row.loser_name)) {
         teamMap.set(row.loser_name, { name: row.loser_name, wins: 0, losses: 0, rounddiff: 0 });
       }
       const loser = teamMap.get(row.loser_name)!;
       loser.losses += 1;
       loser.rounddiff -= roundDiff;
     }

     return Array.from(teamMap.values());
   } catch (err) {
     console.log(err);
     throw err;
   }
 };
 
 /** Function to get the current player leaderboard standings in a season, or all time.
  * @function
  * @memberof module:routes/leaderboard
  * @param {string} [seasonId=null] - Season ID to filter.
  */
 const getPlayerLeaderboard = async (seasonId: number | null = null, pug: boolean = false) => {
   // Single query: aggregate all stats per steam_id (not per steam_id+name)
   // This eliminates the name-collision loop and the N+1 wins query
   let statsSql = `
     SELECT
       ps.steam_id,
       MAX(ps.name) as name,
       SUM(ps.kills) as kills,
       SUM(ps.deaths) as deaths,
       SUM(ps.assists) as assists,
       SUM(ps.k1) as k1, SUM(ps.k2) as k2, SUM(ps.k3) as k3,
       SUM(ps.k4) as k4, SUM(ps.k5) as k5,
       SUM(ps.v1) as v1, SUM(ps.v2) as v2, SUM(ps.v3) as v3,
       SUM(ps.v4) as v4, SUM(ps.v5) as v5,
       SUM(ps.roundsplayed) as trp,
       SUM(ps.flashbang_assists) as fba,
       SUM(ps.damage) as dmg,
       SUM(ps.headshot_kills) as hsk,
       COUNT(ps.id) as totalMaps,
       SUM(ps.friendlies_flashed) as fflash,
       SUM(ps.enemies_flashed) as eflash,
       SUM(ps.util_damage) as utildmg
     FROM player_stats ps
     JOIN \`match\` m ON m.id = ps.match_id
     WHERE m.cancelled = 0
       AND m.is_pug = ?
   `;
   const params: any[] = [pug];
   if (seasonId) {
     statsSql += " AND m.season_id = ?";
     params.push(seasonId);
   }
   statsSql += " GROUP BY ps.steam_id";

   // Wins query: aggregate all wins in one query instead of per-player
   let winsSql = pug
     ? `SELECT pstat.steam_id, COUNT(*) AS wins
        FROM \`match\` mtch
        JOIN player_stats pstat ON mtch.id = pstat.match_id
        WHERE pstat.winner = 1 AND mtch.is_pug = ? AND mtch.cancelled = 0
        ${seasonId ? "AND mtch.season_id = ?" : ""}
        GROUP BY pstat.steam_id`
     : `SELECT pstat.steam_id, COUNT(*) AS wins
        FROM \`match\` mtch
        JOIN player_stats pstat ON mtch.id = pstat.match_id
        WHERE pstat.team_id = mtch.winner AND mtch.is_pug = ? AND mtch.cancelled = 0
        ${seasonId ? "AND mtch.season_id = ?" : ""}
        GROUP BY pstat.steam_id`;

   const winsParams: any[] = [pug];
   if (seasonId) winsParams.push(seasonId);

   // Execute both queries in parallel (2 queries total instead of N+1)
   const [playerStats, winsRows] = await Promise.all([
     db.query(statsSql, params),
     db.query(winsSql, winsParams),
   ]);

   // Build wins lookup map
   const winsMap = new Map<string, number>();
   for (const row of winsRows) {
     winsMap.set(row.steam_id, row.wins);
   }

   // Build player list
   const allPlayers: Array<Player> = [];
   for (const p of playerStats) {
     const kills = parseFloat(p.kills) || 0;
     const deaths = parseFloat(p.deaths) || 0;
     const hsk = parseFloat(p.hsk) || 0;
     const trp = parseFloat(p.trp) || 0;
     const k1 = parseFloat(p.k1) || 0;
     const k2 = parseFloat(p.k2) || 0;
     const k3 = parseFloat(p.k3) || 0;
     const k4 = parseFloat(p.k4) || 0;
     const k5 = parseFloat(p.k5) || 0;

     allPlayers.push({
       steamId: p.steam_id,
       name: p.name || p.steam_id,
       kills,
       deaths,
       assists: parseFloat(p.assists) || 0,
       k1, k2, k3, k4, k5,
       v1: parseFloat(p.v1) || 0,
       v2: parseFloat(p.v2) || 0,
       v3: parseFloat(p.v3) || 0,
       v4: parseFloat(p.v4) || 0,
       v5: parseFloat(p.v5) || 0,
       trp,
       fba: parseFloat(p.fba) || 0,
       total_damage: parseFloat(p.dmg) || 0,
       hsk,
       hsp: kills === 0 ? 0 : +((hsk / kills) * 100).toFixed(2),
       average_rating: Utils.getRating(kills, trp, deaths, k1, k2, k3, k4, k5),
       wins: winsMap.get(p.steam_id) || 0,
       total_maps: p.totalMaps || 0,
       enemies_flashed: parseFloat(p.eflash) || 0,
       friendlies_flashed: parseFloat(p.fflash) || 0,
       util_damage: parseFloat(p.utildmg) || 0,
     });
   }
   return allPlayers;
 };
 export default router;
 
