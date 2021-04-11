import rateLimit from "express-rate-limit";
import express from "express";

export function makeInstallHarmonyHandler() {
    return [
        rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 10, // limit each IP to 10 requests per windowMs
            keyGenerator(req) {
                return req.headers['x-forwarded-for'] as string || req.ip;
            }
        }),
        async function(req: express.Request, res: express.Response) {
            const version = req.params.version;
            if (version == null || version === "" || version === "latest") {
                res.redirect("https://harmony.cs.cornell.edu/distribution/harmony-1.1.zip");
            } else if (version != null) {
                res.redirect(`https://harmony.cs.cornell.edu/distribution/harmony-${version}.zip`);
            } else {
                res.sendStatus(404);
            }
        }
    ]
}
