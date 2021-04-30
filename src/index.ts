import config from "./config";

import path from "path";
import express from 'express';
import io from '@pm2/io';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import fsSync from "fs";
import multer from 'multer';
import {logClient} from "./analytics/logger";
import rimraf from "rimraf";
import cors from 'cors';
import {BuildJobQueueRunner} from "./util/jobQueueRunner";
import {makeCheckHandler} from "./routes/check";
import isUUID from "uuid-validate";
import fs from "fs";
import {makeInstallHarmonyHandler} from "./routes/install";


export async function buildApp() {
    const upload = multer();
    const app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(cors());
    app.set('trust proxy', 1);

    try {
        rimraf.sync(config.PUBLIC_DIR);
        fsSync.mkdirSync(config.PUBLIC_DIR);
        fsSync.mkdirSync(config.HTML_RESULTS_DIR);
    } catch (e) {
        logClient.WARN("Warning: failed to delete public directory.");
    }

    app.get('/html_results/:id', express.static(config.PUBLIC_DIR));

    app.get('/', async (req, res) => {
        return res.redirect("https://harmony.cs.cornell.edu/");
    });

    const downloadCounter = config.isProduction() ? io.counter({
        name: "Download Counter",
        id: "app.requests.download.full.count"
    }) : null;
    app.get('/download/:id', rateLimit({
        windowMs: 20 * 60 * 1000,
        max: 100,
    }), (_, __, next) => {
        downloadCounter?.inc();
        next();
    }, async (req, res) => {
        const id = req.params.id;
        if (id == null) {
            return res.sendStatus(400);
        }
        if (!isUUID(id, 4)) {
            return res.sendStatus(400);
        }
        const target = path.join(config.HTML_RESULTS_DIR, id + ".html");
        if (!fs.existsSync(target)) {
            return res.status(404).send("Not found: You can generate a new copy by running the program.");
        }
        res.download(target, err => {
            if (err) console.log(err);
        });
    });

    const queueRunner = BuildJobQueueRunner(2);
    app.post("/check", makeCheckHandler(upload, queueRunner, logClient));
    app.get("/distributions/:version", makeInstallHarmonyHandler());

    return app;
}


if (require.main === module) {
    buildApp()
        .then(app => {
            const HTTP_PORT = config.HTTP_PORT;
            app.listen(HTTP_PORT, () => {
                console.log(`Server is listening on port ${HTTP_PORT} without SSL`);
                if (config.isProduction()) {
                    console.log(`Make sure you are running this on a proxy server`);
                }
                console.log(`Running as process ${process.pid}`);
            });
        })
        .catch(e => console.log(e));
}
