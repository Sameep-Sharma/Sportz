import "dotenv/config";
import arcjet, {detectBot, shield, slidingWindow} from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;
const isDev = process.env.NODE_ENV !== "production" || process.env.ARCJET_MODE === "DRY_RUN";
export const arcjetMode = isDev ? "DRY_RUN" : (process.env.ARCJET_MODE || "LIVE");


if (!arcjetKey) {
  console.warn("⚠️ ARCJET_KEY environment variable is not set. Rate limiting and security middleware will be bypassed.");
}

export const httpArcjet = arcjetKey ?
    arcjet({
        key: arcjetKey,
        rules: [
            shield({ mode: arcjetMode }),
            detectBot({ mode: arcjetMode, allow: ['CATEGORY:SEARCH_ENGINE', "CATEGORY:PREVIEW","CATEGORY:TOOL",
            "CURL",
            "POSTMAN"]}),
            slidingWindow({ mode: arcjetMode, interval: '10s', max: 50 })
        ],
    }) : null;

export const wsArcjet = arcjetKey ?
    arcjet({
        key: arcjetKey,
        rules: [
            shield({ mode: arcjetMode }),
            detectBot({ mode: arcjetMode, allow: ['CATEGORY:SEARCH_ENGINE', "CATEGORY:PREVIEW", "CATEGORY:TOOL", 'CURL', 'POSTMAN']}),
            slidingWindow({ mode: arcjetMode, interval: '2s', max: 20 })
        ],
    }) : null;

export function securityMiddleware() {
    return async (req, res, next) => {
        if(!httpArcjet) return next();

        try {
            const decision = await httpArcjet.protect(req);

            if(decision.isDenied()) {
                const reasonCode = decision.reason.isRateLimit()
                    ? 'rate_limit'
                    : decision.reason.isBot()
                        ? 'bot'
                        : 'denied';
                console.log(`Arcjet HTTP Denied [${req.method} ${req.path}] - Reason: ${reasonCode}`);

                if(decision.reason.isRateLimit()) {
                    return res.status(429).json({ error: 'Too many requests.' });
                }

                if(decision.reason.isBot()) {
                    return res.status(403).json({ error: 'Forbidden: Bot detected', botType: decision.reason.botType || decision.reason });
                }

                return res.status(403).json({ error: 'Forbidden.' });
            }
        } catch (e) {
            console.error('Arcjet middleware error', e);
            return res.status(503).json({ error: 'Service Unavailable' });
        }

        next();
    }
}