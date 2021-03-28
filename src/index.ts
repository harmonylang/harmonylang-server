import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import fsSync, {promises as fs} from "fs";
import fetch from 'node-fetch';
import FormData from 'form-data';
import {AWS_HTTP_ENDPOINT, HTML_RESULTS_DIR, PUBLIC_DIR, UPLOADS_DIR} from "./config";
import multer from 'multer';
import {logClient} from "./logger/logs";
import rimraf from "rimraf";
import cors from 'cors';
import path from "path";
import {runHarmony} from "./run/runHarmony";
import AdmZip from "adm-zip";
import generateNamespace from "./genNamespace";

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
        return res.redirect(AWS_HTTP_ENDPOINT + "/");
    });

    app.post("/check", upload.single("file"), async (req, res) => {
        return res.redirect(308, AWS_HTTP_ENDPOINT + "/check");
    });

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}

buildApp().catch(e => console.log(e));
