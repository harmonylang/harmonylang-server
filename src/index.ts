import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import generateNamespace from "./genNamespace";
import fsSync, {promises as fs} from "fs";
import path from "path";
import {PUBLIC_DIR, UPLOADS_DIR} from "./config";
import AdmZip from 'adm-zip';
import {runHarmony} from "./run/runHarmony";
import multer from 'multer';
import {logClient} from "./logger/logs";
import rimraf from "rimraf";
import cors from 'cors';


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
        type CheckResponse = {
            status: "SUCCESS" | "ERROR";
            message: string;
        } | {
            status: "FAILURE";
            jsonData: Record<string, unknown>;
            staticHtmlLocation?: string;
            duration?: number;
        };
        const {main: pathToMainFile, version, source} = req.body;
        const logger = logClient
        .WITH({id: generateNamespace(() => true) ?? ""})
        .WITH({version: version ?? "", source: source ?? ""})

        logger.INFO("Received request");
        if (!pathToMainFile) {
            return res.sendStatus(400);
        }

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
            return res.status(400).send("No main file was declared");
        }
        const zippedFile = req.file;
        if (zippedFile == null) {
            return res.status(400).send("No files were uploaded");
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
            return res.status(400).send("Your request could not be served at this time. Please try again later");
        }

        // Create a directory to hold the zip file.
        const zipDirectory = path.join(UPLOADS_DIR, namespace, "zips");
        try {
            await fs.mkdir(zipDirectory, {recursive: true});
        } catch (error) {
            logger.ERROR("Error making an empty zip directory", {
                namespace, error
            });
            return res.sendStatus(500)
        }

        // Write the zip file to the zip directory.
        const filename = path.join(zipDirectory, zippedFile.originalname);
        try {
            await fs.writeFile(filename, zippedFile.buffer);
        } catch (error) {
            logger.ERROR("Error writing the zip file to a zip directory", {
                namespace, error
            });
            return res.sendStatus(500);
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
