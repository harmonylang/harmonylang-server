import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import fsSync from "fs";
import {AWS_HTTP_ENDPOINT, HTML_RESULTS_DIR, PUBLIC_DIR, UPLOADS_DIR} from "./config";
import multer from 'multer';
import {logClient} from "./logger/logs";
import ping from 'ping';
import rimraf from "rimraf";
import cors from 'cors';
import AdmZip from "adm-zip";
import path from "path";
import {runHarmony} from "./run/runHarmony";
import fs from "fs";
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

    async function awsServerIsAlive() {
        try {
            const response = await ping.promise.probe(AWS_HTTP_ENDPOINT.slice("https://".length));
            return response.alive;
        } catch {
            return false;
        }
    }

    app.get('/html_results/:id',  async (req, res, next) => {
        if (await awsServerIsAlive()) {
            return res.redirect(AWS_HTTP_ENDPOINT + '/html_results/' + req.params.id);
        }
        next();
    }, express.static(PUBLIC_DIR));

    app.get('/', async (req, res) => {
        if (await awsServerIsAlive()) {
            return res.redirect(AWS_HTTP_ENDPOINT + "/");
        }
        return res.redirect("https://harmony.cs.cornell.edu");
    });

    app.get('/home', async (_, res) => {
        if (await awsServerIsAlive()) {
            return res.redirect(AWS_HTTP_ENDPOINT + "/");
        }
        return res.redirect("https://harmony.cs.cornell.edu");
    });

    app.get('/download/:id', async (req, res) => {
        if (await awsServerIsAlive()) {
            return res.redirect(AWS_HTTP_ENDPOINT + "/download/" + req.params.id);
        }
        return res.download(path.join(HTML_RESULTS_DIR, req.params.id + ".html"));
    });

    app.post("/check", upload.single("file"), async (req, res) => {
        if (await awsServerIsAlive()) {
            return res.redirect(308, AWS_HTTP_ENDPOINT + "/check");
        }
        const {main: pathToMainFile, version, source} = req.body;
        const logger = logClient
            .WITH({id: generateNamespace(() => true) ?? ""})
            .WITH({version: version ?? "", source: source ?? ""})

        logger.INFO("Received request");

        let main: string | null | undefined = "";
        if (source === "web-ide") {
            main = JSON.parse(pathToMainFile).join(path.sep);
        } else if (version != null && typeof version === "string" && source === "vscode") {
            const [major, minor, patch] = version.split(".").map(v => Number.parseInt(v));
            if (major >= 0 && minor >= 2 && patch >= 6) {
                main = JSON.parse(pathToMainFile).join(path.sep);
            }
        }
        if (main === "") {
            main = pathToMainFile;
        }
        if (main == null) {
            return res.send({
                status: "INTERNAL",
                message: "No main file was declared"
            });
        }
        const zippedFile = req.file;
        if (zippedFile == null) {
            return res.send({
                status: "INTERNAL",
                message: "No files were uploaded"
            });
        }
        logger.INFO("Uploaded file metadata", {
            size: zippedFile.size
        });
        // Ensure there is only file being sent.
        const namespace = generateNamespace((name) => {
            return !fsSync.existsSync(path.join(UPLOADS_DIR, name));
        })
        if (namespace == null) {
            logger.WARN("Failed to generate a uuid. May be a sign the uploads directory is too big, or we were" +
                " severely unlucky");
            return res.send({
                status: "INTERNAL",
                message: "Your request could not be served at this time. Please try again"
            });
        }

        // Create a directory to hold the zip file.
        const zipDirectory = path.join(UPLOADS_DIR, namespace, "zips");
        try {
            fs.mkdirSync(zipDirectory, {recursive: true});
        } catch (error) {
            logger.ERROR("Error making an empty zip directory", {
                namespace, error
            });
            return res.send({
                status: "INTERNAL",
                message: "Error uploading Harmony files"
            });
        }

        // Write the zip file to the zip directory.
        const filename = path.join(zipDirectory, zippedFile.originalname);
        try {
            fs.writeFileSync(filename, zippedFile.buffer);
        } catch (error) {
            logger.ERROR("Error writing the zip file to a zip directory", {
                namespace, error
            });
            return res.send({
                status: "INTERNAL",
                message: "Error uploading Harmony files"
            });
        }

        // Create a directory to extract the source files from the zip into.
        const harmonyDirectory = path.join(UPLOADS_DIR, namespace, "source");
        new AdmZip(filename).extractAllTo(harmonyDirectory);

        // Run the Harmony model checker.
        return runHarmony(
            path.join(UPLOADS_DIR, namespace),
            path.join(harmonyDirectory, main),
            res,
            logger
        );
    });

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}

buildApp().catch(e => console.log(e));
