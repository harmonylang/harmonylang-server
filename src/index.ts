import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import io from '@pm2/io';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import fsSync from "fs";
import {HTML_RESULTS_DIR, PUBLIC_DIR} from "./config";
import multer from 'multer';
import {logClient} from "./analytics/logger";
import rimraf from "rimraf";
import cors from 'cors';
import https from 'https';
import {BuildJobQueueRunner} from "./util/jobQueueRunner";
import {makeCheckHandler} from "./routes/check";
import isUUID from "uuid-validate";
import path from "path";
import fs from "fs";


async function buildApp() {
    const upload = multer();
    const app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(cors());
    app.set('trust proxy', 1);

    try {
        rimraf.sync(PUBLIC_DIR);
        fsSync.mkdirSync(PUBLIC_DIR);
        fsSync.mkdirSync(HTML_RESULTS_DIR);
    } catch (e) {
        logClient.WARN("Warning: failed to delete public directory.");
    }
    app.use(express.static('public'));

    app.get('/', async (req, res) => {
        return res.redirect("https://harmony.cs.cornell.edu/");
    });

    const downloadCounter = io.counter({
        name: "Download Counter",
        id: "app.requests.download.full.count"
    });
    app.get('/download/:id', (_, __, next) => {
        downloadCounter.inc();
        next();
    }, rateLimit({
        windowMs: 20 * 60 * 1000,
        max: 100,
    }), async (req, res) => {
        const id = req.params.id;
        if (id == null) {
            return res.sendStatus(400);
        }
        if (!isUUID(id, 4)) {
            return res.sendStatus(400);
        }
        const target = path.join(HTML_RESULTS_DIR, id + ".html");
        if (!fs.existsSync(target)) {
            return res.status(404).send("Not found: You can generate a new copy by running the program.");
        }
        res.download(target, err => {
            if (err) console.log(err);
        });
    });

    const queueRunner = BuildJobQueueRunner(1);
    app.post("/check", makeCheckHandler(upload, queueRunner, logClient));

    return app;
}

buildApp()
    .then(app => {
        const HTTPS_PORT = process.env.HTTPS_PORT || 8080;
        const HTTP_PORT = process.env.HTTP_PORT || 8080;
        const pathToKey = process.env.PATH_TO_HTTPS_KEY;
        const pathToChain = process.env.PATH_TO_HTTPS_CHAIN;
        const pathToCertificate = process.env.PATH_TO_HTTPS_CERTIFICATE;
        if (pathToKey && pathToChain && pathToCertificate) {
            console.log("Attempting to listen with SSL")
            https.createServer({
                key: fsSync.readFileSync(pathToKey),
                cert: fsSync.readFileSync(pathToCertificate),
                ca: fsSync.readFileSync(pathToChain)
            }, app).listen(HTTPS_PORT, () => {
                console.log(`Server is listening on port ${HTTPS_PORT} with SSL`);
                console.log(`Running as process ${process.pid}`);
            });
        } else {
            app.listen(HTTP_PORT, () => {
                console.log(`Server is listening on port ${HTTP_PORT} without SSL`);
                console.log(`Running as process ${process.pid}`);
            })
        }
    })
    .catch(e => console.log(e));
