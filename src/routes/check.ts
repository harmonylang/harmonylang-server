import express from "express";
import {HarmonyLogger} from "../logger/logs";
import generateNamespace from "../util/genNamespace";
import path from "path";
import {cleanup, containerizedHarmonyRun, createNamespace} from "./codeRunner/containerizedRun";
import {promises as fs} from "fs";
import AdmZip from "adm-zip";
import {JobQueueRunner} from "../util/jobQueueRunner";
import multer from "multer";
import rateLimit from "express-rate-limit";


type CheckRequest = {
    mainFile: string;
    zipFile: Express.Multer.File;
    version: string;
    source: string;
}

function parseRequestBody(req: express.Request): CheckRequest {
    const body = req.body;
    const file = req.file;
    if (file == null) {
        throw new Error("Request does not contain a file");
    }
    if (body == null || typeof body !== 'object') {
        throw new Error("Request body is not an object")
    }
    const {main, version, source} = body;
    if (main == null || typeof main !== 'string') {
        throw new Error("Request does not declare a main file")
    }
    if (source == null || typeof source !== 'string') {
        console.log("Source in the request not declared", "Assuming the main file is a literal string");
        return {
            mainFile: main,
            zipFile: req.file,
            version: "", source: "",
        }
    }
    if (source === 'web-ide') {
        return {
            mainFile: JSON.parse(main).join(path.sep),
            zipFile: req.file,
            source, version: typeof version === 'string' ? version : ""
        };
    } else if (source === 'vscode') {
        if (version == null || typeof version !== 'string') {
            throw new Error(`Request from vscode does not defined a version`);
        }
        const parsedVersion = version.split(".").map(v => Number.parseInt(v));
        if (parsedVersion.length !== 3 || parsedVersion.some(v => Number.isNaN(v))) {
            throw new Error(`The version in the request from vscode is invalid: ${version}`);
        }
        const [major, minor, patch] = parsedVersion;
        if (major >= 0 && minor >= 2 && patch >= 6) {
            return {
                mainFile: JSON.parse(main).join(path.sep),
                zipFile: req.file,
                version, source,
            };
        }
        return {
            mainFile: main,
            zipFile: req.file,
            version, source,
        };
    } else {
        throw new Error(`Request contains an unknown source: ${source}`);
    }
}

export function makeCheckHandler(
    upload: multer.Multer,
    jobRunner: JobQueueRunner,
    baseLogger: HarmonyLogger
) {
    return [
        rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        }),
        upload.single("file"),
        async function(req: express.Request, res: express.Response) {
            let parsedRequest: CheckRequest;
            try {
                parsedRequest = parseRequestBody(req);
            } catch (e: unknown) {
                if (e instanceof Error) {
                    return res.status(200).send({
                        status: "ERROR",
                        message: e.message
                    });
                }
                return res.status(200).send({
                    status: "INTERNAL",
                    message: "Internal error occurred. Please contact developers"
                });
            }
            const {version, source, zipFile, mainFile} = parsedRequest;
            const logger = baseLogger.WITH({
                id: generateNamespace(() => true) ?? "",
                server: "aws",
                version,
                source,
                size: zipFile.size
            });
            logger.INFO("Received request");
            const namespace = createNamespace(mainFile);
            // Ensure there is only file being sent.
            if (namespace == null) {
                logger.WARN("Failed to generate a uuid. May be a sign that the uploads directory is too big, or we" +
                    " were severely unlucky");
                return res.status(200).send({
                    status: "ERROR",
                    message: "Your request could not be served at this time. Please try again later"
                });
            }
            const zipFilename = path.join(namespace.directory, zipFile.originalname)
            try {
                await fs.writeFile(zipFilename, zipFile.buffer);
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
            try {
                new AdmZip(zipFilename).extractAllTo(namespace.directory);
            } catch {
                return res.status(200).send({
                    status: "ERROR",
                    message: "Failed to extract files from the submitted source zip"
                });
            }
            jobRunner.register(async () => {
                // Run the Harmony model checker.
                const response = await containerizedHarmonyRun(namespace, logger);
                cleanup(namespace, logger);
                if (response.code === 200) {
                    res.status(response.code).send(response);
                } else {
                    res.status(response.code).send(response.message);
                }
            });
        }
    ]
}
