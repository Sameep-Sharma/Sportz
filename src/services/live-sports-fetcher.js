import "dotenv/config";
import { db } from "../db/db.js";
import { matches, commentary } from "../db/schema.js";
import { eq } from "drizzle-orm";

const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const CRIC_API_KEY = process.env.CRIC_API_KEY;
const BALLDONTLIE_API_KEY = process.env.BALLDONTLIE_API_KEY;

// Safe Date Parser that never returns NaN or Invalid Date to PostgreSQL
export function safeDate(val, defaultOffsetMs = 0) {
  if (!val) return new Date(Date.now() + defaultOffsetMs);
  try {
    const parsed = new Date(val);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getTime() + defaultOffsetMs);
    }
    // Attempt parsing non-standard ISO formats
    const cleaned = new Date(String(val).replace(" ", "T") + "Z");
    if (!Number.isNaN(cleaned.getTime())) {
      return new Date(cleaned.getTime() + defaultOffsetMs);
    }
  } catch {
    // Fallback to current time
  }
  return new Date(Date.now() + defaultOffsetMs);
}

// Ensure status is strictly one of PostgreSQL enum values: 'scheduled' | 'live' | 'finished'
export function sanitizeStatus(val) {
  const s = String(val || "").toLowerCase().trim();
  if (s === "live" || s === "finished" || s === "scheduled") {
    return s;
  }
  return "scheduled";
}

// Normalize Match Status with live time-window checks
export function normalizeStatus(rawStatus, startTime, endTime, homeScore = 0, awayScore = 0) {
  const s = String(rawStatus || "").toUpperCase();

  // 1. Explicit provider live states
  if (
    s.includes("IN_PLAY") ||
    s.includes("LIVE") ||
    s.includes("1H") ||
    s.includes("2H") ||
    s.includes("Q1") ||
    s.includes("Q2") ||
    s.includes("Q3") ||
    s.includes("Q4") ||
    s.includes("HALF") ||
    s.includes("PAUSED") ||
    s.includes("EXTRA_TIME") ||
    s.includes("PENALTY")
  ) {
    return "live";
  }

  // 2. Explicit provider finished states
  if (
    s.includes("FINISHED") ||
    s.includes("FT") ||
    s.includes("FINAL") ||
    s.includes("ENDED") ||
    s.includes("AWARDED")
  ) {
    return "finished";
  }

  // 3. Dynamic time-based status check
  if (startTime) {
    const now = Date.now();
    const start = safeDate(startTime).getTime();
    const end = endTime ? safeDate(endTime).getTime() : start + 115 * 60 * 1000;

    if (now >= start && now <= end) {
      return "live";
    }
    if (now > end && (homeScore > 0 || awayScore > 0)) {
      return "finished";
    }
  }

  // 4. Score detected during active time
  if (homeScore > 0 || awayScore > 0) {
    return "live";
  }

  return "scheduled";
}

// 1. Fetch Real-World Football Matches
export async function fetchFootballMatches() {
  if (!FOOTBALL_API_KEY) return [];
  try {
    const res = await fetch("https://api.football-data.org/v4/matches", {
      headers: { "X-Auth-Token": FOOTBALL_API_KEY },
    });
    if (!res.ok) {
      console.warn(`[Football API] Notice: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    let list = Array.isArray(data.matches) ? data.matches : [];

    // Prioritize live and active matches first
    list.sort((a, b) => {
      const statusA = normalizeStatus(a.status, a.utcDate, null, a.score?.fullTime?.home, a.score?.fullTime?.away);
      const statusB = normalizeStatus(b.status, b.utcDate, null, b.score?.fullTime?.home, b.score?.fullTime?.away);
      if (statusA === "live" && statusB !== "live") return -1;
      if (statusB === "live" && statusA !== "live") return 1;
      return new Date(b.utcDate || 0) - new Date(a.utcDate || 0);
    });

    return list.slice(0, 25).map((m) => {
      const homeScore = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0;
      const awayScore = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0;
      const startTime = safeDate(m.utcDate);
      const endTime = safeDate(startTime, 110 * 60 * 1000);
      const status = normalizeStatus(m.status, startTime, endTime, homeScore, awayScore);

      return {
        externalId: `football_${m.id}`,
        sport: "football",
        league: m.competition?.name || "Football League",
        homeTeam: m.homeTeam?.name || m.homeTeam?.shortName || "Home",
        awayTeam: m.awayTeam?.name || m.awayTeam?.shortName || "Away",
        homeLogo: m.homeTeam?.crest || null,
        awayLogo: m.awayTeam?.crest || null,
        homeScore: Number(homeScore) || 0,
        awayScore: Number(awayScore) || 0,
        status: sanitizeStatus(status),
        startTime,
        endTime,
        rawDetails: m,
      };
    });
  } catch (err) {
    console.error("[Football API Error]:", err.message);
    return [];
  }
}

// 2. Fetch Real-World Cricket Matches (CricAPI)
export async function fetchCricketMatches() {
  if (!CRIC_API_KEY) return [];
  try {
    const res = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${CRIC_API_KEY}&offset=0`);
    if (!res.ok) {
      console.warn(`[Cricket API] Notice: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    const list = Array.isArray(data.data) ? data.data : [];

    return list.slice(0, 15).map((m) => {
      const teams = m.teams || [];
      const homeTeam = teams[0] || m.name?.split(" vs ")?.[0] || "Team A";
      const awayTeam = teams[1] || m.name?.split(" vs ")?.[1] || "Team B";

      const scores = Array.isArray(m.score) ? m.score : [];
      const homeInning = scores[0] || {};
      const awayInning = scores[1] || {};

      const homeRuns = Number(homeInning.r ?? 0);
      const awayRuns = Number(awayInning.r ?? 0);

      const status = m.matchEnded ? "finished" : m.matchStarted ? "live" : "scheduled";
      const startTime = safeDate(m.dateTimeGMT || m.date);
      const endTime = safeDate(startTime, 240 * 60 * 1000);

      return {
        externalId: `cricket_${m.id}`,
        sport: "cricket",
        league: m.matchType ? `${m.matchType.toUpperCase()} Series` : "International Cricket",
        homeTeam,
        awayTeam,
        homeLogo: m.teamInfo?.[0]?.img || null,
        awayLogo: m.teamInfo?.[1]?.img || null,
        homeScore: homeRuns,
        awayScore: awayRuns,
        status: sanitizeStatus(status),
        startTime,
        endTime,
        rawDetails: m,
      };
    });
  } catch (err) {
    console.error("[Cricket API Error]:", err.message);
    return [];
  }
}

// 3. Fetch Real-World Basketball Matches (Balldontlie API)
export async function fetchBasketballMatches() {
  if (!BALLDONTLIE_API_KEY) return [];
  try {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(`https://api.balldontlie.io/v1/games?dates[]=${today}`, {
      headers: { Authorization: BALLDONTLIE_API_KEY },
    });
    let list = [];
    if (res.ok) {
      const data = await res.json();
      list = Array.isArray(data.data) ? data.data : [];
    }

    if (list.length === 0) {
      const fallbackRes = await fetch(`https://api.balldontlie.io/v1/games?per_page=12`, {
        headers: { Authorization: BALLDONTLIE_API_KEY },
      });
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        list = Array.isArray(fbData.data) ? fbData.data : [];
      }
    }

    return list.slice(0, 15).map((m) => {
      const homeTeam = m.home_team?.full_name || m.home_team?.name || "Home";
      const awayTeam = m.visitor_team?.full_name || m.visitor_team?.name || "Away";
      const startTime = safeDate(m.date);
      const endTime = safeDate(startTime, 150 * 60 * 1000);
      const status = normalizeStatus(m.status, startTime, endTime, m.home_team_score, m.visitor_team_score);

      return {
        externalId: `nba_${m.id}`,
        sport: "basketball",
        league: "NBA",
        homeTeam,
        awayTeam,
        homeLogo: null,
        awayLogo: null,
        homeScore: Number(m.home_team_score ?? 0),
        awayScore: Number(m.visitor_team_score ?? 0),
        status: sanitizeStatus(status),
        startTime,
        endTime,
        rawDetails: m,
      };
    });
  } catch (err) {
    console.error("[Basketball API Error]:", err.message);
    return [];
  }
}

// 4. Ingest and Synchronize Live Matches into Database & WebSocket
export async function syncLiveSports(appLocals) {
  try {
    console.log("🌐 [Live Sports Ingestion] Syncing real-world sports feeds...");

    const [football, cricket, basketball] = await Promise.all([
      fetchFootballMatches(),
      fetchCricketMatches(),
      fetchBasketballMatches(),
    ]);

    const allLiveMatches = [...football, ...cricket, ...basketball];
    console.log(`📡 Retrieved ${allLiveMatches.length} real-world fixtures (⚽ ${football.length} Football, 🏏 ${cricket.length} Cricket, 🏀 ${basketball.length} Basketball)`);

    for (const item of allLiveMatches) {
      try {
        if (!item || !item.homeTeam || !item.awayTeam) continue;

        const cleanStatus = sanitizeStatus(item.status);
        const startTime = safeDate(item.startTime);
        const endTime = safeDate(item.endTime, 110 * 60 * 1000);

        const existing = await db
          .select()
          .from(matches)
          .where(eq(matches.homeTeam, item.homeTeam))
          .limit(1);

        let currentMatch = existing[0];

        if (!currentMatch) {
          const [inserted] = await db
            .insert(matches)
            .values({
              sport: item.sport,
              homeTeam: item.homeTeam,
              awayTeam: item.awayTeam,
              status: cleanStatus,
              startTime,
              endTime,
              homeScore: item.homeScore || 0,
              awayScore: item.awayScore || 0,
            })
            .returning();

          currentMatch = inserted;
          console.log(`✨ [New Match Created] ${item.sport.toUpperCase()}: ${item.homeTeam} vs ${item.awayTeam}`);
          appLocals?.broadcastMatchCreated?.(inserted);

          const [comment] = await db
            .insert(commentary)
            .values({
              matchId: inserted.id,
              minutes: 1,
              sequence: 1,
              period: "1st Half",
              eventType: "start",
              team: inserted.homeTeam,
              message: `Match underway! ${inserted.homeTeam} vs ${inserted.awayTeam} in ${item.league}.`,
              tags: ["start", "live"],
            })
            .returning();

          appLocals?.broadcastCommentary?.(inserted.id, { ...comment, minute: comment.minutes });
        } else {
          const scoreChanged =
            currentMatch.homeScore !== item.homeScore || currentMatch.awayScore !== item.awayScore;

          if (scoreChanged || currentMatch.status !== cleanStatus) {
            const [updated] = await db
              .update(matches)
              .set({
                homeScore: item.homeScore,
                awayScore: item.awayScore,
                status: cleanStatus,
              })
              .where(eq(matches.id, currentMatch.id))
              .returning();

            if (updated) {
              console.log(`📊 [Live Update] ${item.homeTeam} vs ${item.awayTeam} -> Status: ${updated.status}, Score: ${item.homeScore}-${item.awayScore}`);
              appLocals?.broadcastScoreUpdate?.(updated.id, {
                homeScore: updated.homeScore,
                awayScore: updated.awayScore,
                status: updated.status,
              });

              if (scoreChanged) {
                const [comment] = await db
                  .insert(commentary)
                  .values({
                    matchId: updated.id,
                    minutes: Math.floor(Math.random() * 80) + 1,
                    sequence: Math.floor(Date.now() / 1000) % 1000,
                    period: item.sport === "cricket" ? "Innings" : item.sport === "basketball" ? "Quarter" : "2nd Half",
                    eventType: item.sport === "cricket" ? "boundary" : item.sport === "football" ? "goal" : "basket",
                    team: item.homeScore > currentMatch.homeScore ? updated.homeTeam : updated.awayTeam,
                    message: `Score updated: ${updated.homeTeam} ${item.homeScore} - ${item.awayScore} ${updated.awayTeam}`,
                    tags: ["score", "update"],
                  })
                  .returning();

                appLocals?.broadcastCommentary?.(updated.id, { ...comment, minute: comment.minutes });
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error syncing item ${item?.homeTeam}:`, e.message);
      }
    }
  } catch (err) {
    console.error("syncLiveSports top-level error:", err.message);
  }
}
