import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import generateNamespace from "./genNamespace";
import fsSync, {promises as fs} from "fs";
import path from "path";
import {HTML_RESULTS_DIR, PUBLIC_DIR} from "./config";
import AdmZip from 'adm-zip';
import multer from 'multer';
import {logClient} from "./logger/logs";
import rimraf from "rimraf";
import cors from 'cors';
import {cleanup, containerizedHarmonyRun, createNamespace} from "./docker/containerizedRun";


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
    app.use(express.static('public'));

    app.get('/', async (req, res) => {
        res.sendStatus(200);
    });

    app.get('/home', (_, res) => {
        return res.redirect("https://harmony.cs.cornell.edu/");
    });

    app.post("/check", upload.single("file"), async (req, res) => {
        const {main: pathToMainFile, version, source} = req.body;
        const logger = logClient
        .WITH({id: generateNamespace(() => true) ?? ""})
        .WITH({version: version ?? "", source: source ?? ""})

        logger.INFO("Received request");

        let main: string | null | undefined = "";
        try {
            if (source === "web-ide") {
                main = JSON.parse(pathToMainFile).join(path.sep);
            } else if (version != null && typeof version === "string" && source === "vscode") {
                const [major, minor, patch] = version.split(".").map(v => Number.parseInt(v));
                if (major >= 0 && minor >= 2 && patch >= 6) {
                    main = JSON.parse(pathToMainFile).join(path.sep);
                }
            }
        } catch {
            main = "";
        }
        if (main === "") {
            main = pathToMainFile;
        }
        if (main == null) {
            return res.status(200).send({
                status: "ERROR",
                message: "No main file was declared"
            });
        }
        const zippedFile = req.file;
        if (zippedFile == null) {
            return res.status(200).send({
                status: "ERROR",
                message: "No files were uploaded"
            });
        }
        logger.INFO("Uploaded file metadata", {
            size: zippedFile.size
        });

        const namespace = createNamespace(main);
        // Ensure there is only file being sent.
        if (namespace == null) {
            logger.WARN("Failed to generate a uuid. May be a sign the uploads directory is too big, or we were" +
                " severely unlucky");
            return res.status(200).send({
                status: "ERROR",
                message: "Your request could not be served at this time. Please try again later"
            });
        }

        const zipFilename = path.join(namespace.directory, zippedFile.originalname)
        try {
            await fs.writeFile(zipFilename, zippedFile.buffer);
        } catch (error) {
            logger.ERROR("Error writing the zip file to a zip directory", {
                namespace, error: JSON.stringify(error)
            });
            return res.status(200).send({
                status: "ERROR",
                message: "Failed to save uploaded file on the server"
            });
        }

        // Create a directory to extract the source files from the zip into.
        new AdmZip(zipFilename).extractAllTo(namespace.directory);

        // Run the Harmony model checker.
        const response = await containerizedHarmonyRun(namespace, logger);
        cleanup(namespace, logger);
        if (response.code === 200) {
            return res.status(response.code).send(response);
        } else {
            return res.status(response.code).send(response.message);
        }
    });

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}

buildApp().catch(e => console.log(e));
