import express from "express";
import {HarmonyLogger} from "../../analytics/logger";
import path from "path";
import {cleanup, containerizedHarmonyRun, createNamespace} from "./codeRunner/containerizedRun";
import {promises as fs} from "fs";
import AdmZip from "adm-zip";
import {JobQueueRunner} from "../../util/jobQueueRunner";
import multer from "multer";
import rateLimit from "express-rate-limit";
import {objectifyError} from "../../util/isError";
import io from "@pm2/io";


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
            version: version ?? "", source: "",
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
    const checkRequestCounter = io.counter({
        name: "Check Requests",
        id: "app.requests.check.full.count"
    });
    const checkSuccessCounter = io.counter({
        name: "Check Successful Requests",
        id: "app.requests.check.success.count"
    });

    return [
        (_: express.Request, __: express.Response, next: express.NextFunction) => {
            checkRequestCounter.inc();
            next();
        },
        rateLimit({
            windowMs: 60 * 1000, // 15 minutes
            max: 3 // limit each IP to 100 requests per windowMs
        }),
        upload.single("file"),
        async function(req: express.Request, res: express.Response) {
            let parsedRequest: CheckRequest;
            try {
                parsedRequest = parseRequestBody(req);
            } catch (e: unknown) {
                const errorBody = objectifyError(e);
                baseLogger.ERROR("Cannot parse request body", errorBody);
                return res.status(200).send({
                    status: "INTERNAL",
                    message: "Internal error occurred. Please contact developers"
                });
            }
            const {version, source, zipFile, mainFile} = parsedRequest;

            const namespace = createNamespace(mainFile);
            if (namespace == null) {
                baseLogger.ERROR("Failed to generate namespace. May be a sign that the uploads directory is too" +
                    " big, or we were severely unlucky", {
                    version,
                    source,
                    mainFile,
                    size: zipFile.size,
                });
                return res.status(200).send({
                    status: "ERROR",
                    message: "Your request could not be served at this time. Please try again later"
                });
            }
            const logger = baseLogger.WITH({
                namespace: namespace.id,
                version,
                source,
                mainFile,
                size: zipFile.size,
            });
            logger.INFO("Received request");

            // Ensure there is only file being sent.
            const zipFilename = path.join(namespace.directory, zipFile.originalname)
            try {
                await fs.writeFile(zipFilename, zipFile.buffer);
            } catch (error: unknown) {
                const errorBody = objectifyError(error);
                logger.ERROR("Error writing the zip file to a zip directory", {
                    namespace: namespace.id, ...errorBody
                });
                return res.status(200).send({
                    status: "ERROR",
                    message: "Failed to save uploaded file on the server"
                });
            }
            // Create a directory to extract the source files from the zip into.
            try {
                new AdmZip(zipFilename).extractAllTo(namespace.directory);
            } catch (e: unknown) {
                const errorBody = objectifyError(e);
                logger.ERROR("ERROR: failed to extract source file", {
                    namespace: namespace.id,
                    ...errorBody
                });
                return res.status(200).send({
                    status: "ERROR",
                    message: "Failed to extract files from the submitted source zip"
                });
            }
            jobRunner.register(async () => {
                // Run the Harmony model checker.
                try {
                    const response = await containerizedHarmonyRun(namespace, logger);
                    cleanup(namespace).catch(e => {
                        const errorBody = objectifyError(e);
                        logger.ERROR("ERROR: failed to cleanup namespace", {
                            ...errorBody
                        })
                    });
                    checkSuccessCounter.inc();
                    if (response.code === 200) {
                        res.status(response.code).send(response);
                    } else {
                        res.status(response.code).send(response.message);
                    }
                } catch (e: unknown) {
                    const errorBody = objectifyError(e);
                    logger.ERROR("Unknown error occurred in code runner", {
                        ...errorBody
                    });
                }
            });
        }
    ]
}
