import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { commentary } from "../db/schema.js";
import { db } from "../db/db.js";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commnetary.js";
import { matchIdParamSchema } from "../validation/matches.js";

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

commentaryRouter.get("/", async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  const parsedQuery = listCommentaryQuerySchema.safeParse(req.query);

  if (!parsedParams.success || !parsedQuery.success) {
    return res.status(400).json({
      error: "Invalid Commentary Request",
      details: {
        params: parsedParams.success ? undefined : parsedParams.error.issues,
        query: parsedQuery.success ? undefined : parsedQuery.error.issues,
      },
    });
  }

  const limit = Math.min(parsedQuery.data.limit ?? MAX_LIMIT, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, parsedParams.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    const formattedData = data.map((item) => ({
      ...item,
      minute: item.minutes,
    }));

    return res.json({ data: formattedData });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to List Commentary",
    });
  }
});

commentaryRouter.post("/", async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  const parsedBody = createCommentarySchema.safeParse(req.body);

  if (!parsedParams.success || !parsedBody.success) {
    return res.status(400).json({
      error: "Invalid Commentary Request",
      details: {
        params: parsedParams.success ? undefined : parsedParams.error.issues,
        body: parsedBody.success ? undefined : parsedBody.error.issues,
      },
    });
  }

  const { minutes, minute, ...commentaryData } = parsedBody.data;

  try {
    const [result] = await db
      .insert(commentary)
      .values({
        ...commentaryData,
        matchId: parsedParams.data.id,
        minutes: minutes,
      })
      .returning();

    const formattedResult = {
      ...result,
      minute: result.minutes,
    };

    if (res.app.locals.broadcastCommentary) {
      res.app.locals.broadcastCommentary(formattedResult.matchId, formattedResult);
    }

    return res.status(201).json({
      data: formattedResult,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to Create Commentary",
    });
  }
});
