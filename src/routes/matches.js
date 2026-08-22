import { Router } from "express";

import {
  createMatchSchema,
  listMatchesQuerySchema,
  matchIdParamSchema,
  updateScoreSchema,
} from "../validation/matches.js";

import { matches } from "../db/schema.js";
import { db } from "../db/db.js";
import { getMatchStatus } from "../utils/match-status.js";
import { desc, eq } from "drizzle-orm";

export const matchRouter = Router();

const MAX_LIMIT = 100;

matchRouter.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid Query",
      details: parsed.error.issues,
    });
  }

  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);

    return res.json({ data });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to list Matches",
    });
  }
});

matchRouter.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid Payload",
      details: parsed.error.issues,
    });
  }

  const {
    data: { startTime, endTime, homeScore, awayScore },
  } = parsed;

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime),
      })
      .returning();

    if (res.app.locals.broadcastMatchCreated) {
      res.app.locals.broadcastMatchCreated(event);
    }

    return res.status(201).json({
      data: event,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to Create Match",
      details: JSON.stringify(error),
    });
  }
});

matchRouter.patch("/:id/score", async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  const parsedBody = updateScoreSchema.safeParse(req.body);

  if (!parsedParams.success || !parsedBody.success) {
    return res.status(400).json({
      error: "Invalid Score Payload",
      details: {
        params: parsedParams.success ? undefined : parsedParams.error.issues,
        body: parsedBody.success ? undefined : parsedBody.error.issues,
      },
    });
  }

  const { homeScore, awayScore } = parsedBody.data;

  try {
    const [updated] = await db
      .update(matches)
      .set({ homeScore, awayScore })
      .where(eq(matches.id, parsedParams.data.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Match not found" });
    }

    if (res.app.locals.broadcastScoreUpdate) {
      res.app.locals.broadcastScoreUpdate(updated.id, {
        homeScore: updated.homeScore,
        awayScore: updated.awayScore,
      });
    }

    return res.json({ data: updated });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to Update Match Score",
    });
  }
});

