import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import generateNamespace from "./genNamespace";
import fsSync, {promises as fs} from "fs";
import path from "path";
import {AWS_HTTP_ENDPOINT, HTML_RESULTS_DIR, PUBLIC_DIR} from "./config";
import AdmZip from 'adm-zip';
import multer from 'multer';
import {logClient} from "./logger/logs";
import rimraf from "rimraf";
import cors from 'cors';
import {cleanup, containerizedHarmonyRun, createNamespace} from "./docker/containerIzedRun";


async function buildApp() {
    const upload = multer();

    const app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(cors());

    try {
        rimraf.sync(PUBLIC_DIR);
        fsSync.mkdirSync(PUBLIC_DIR);
        fsSync.mkdirSync(HTML_RESULTS_DIR);
    } catch (e) {
        logClient.WARN("Warning: failed to delete public directory.");
    }
    app.get('/html_results/:id',  async (req, res) => {
        return res.redirect(AWS_HTTP_ENDPOINT + '/html_results/' + req.params.id);
    });

    app.get('/', async (req, res) => {
        return res.redirect(AWS_HTTP_ENDPOINT + "/");
    });

    app.get('/home', (_, res) => {
        return res.redirect(AWS_HTTP_ENDPOINT + "/home");
    });

    app.post("/check", upload.single("file"), async (req, res) => {
        return res.redirect(307, AWS_HTTP_ENDPOINT + "/check");
    });

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}

buildApp().catch(e => console.log(e));
