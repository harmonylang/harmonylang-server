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
import PackageVersion from "../../util/packageVersion";


type CheckRequest = {
    mainFile: string;
    zipFile: Express.Multer.File;
    version: string;
    source: string;
    options: string;
}

type CheckRequestBody = {
    main: string,
    version: string,
    source: string,
    options: string,
}

function parseRequestBody(req: express.Request): CheckRequestBody {
    const body = req.body;
    if (body == null || typeof body !== 'object') {
        throw new Error("Request body is not an object")
    }
    const {main, version, source, options} = body as Record<string, unknown>;
    return {
        main: typeof main === 'string' ? main : "",
        version: typeof version === 'string' ? version : "",
        source: typeof source === 'string' ? source : "",
        options: typeof options === 'string' ? options : ""
    };
}

function parseRequest(req: express.Request): CheckRequest {
    const file = req.file;
    if (file == null) {
        throw new Error("Request does not contain a file");
    }
    const {main, version, source, options} = parseRequestBody(req);
    if (main === "") {
        throw new Error("Request does not declare a main file")
    }
    if (source === "") {
        console.log("Source in the request not declared", "Assuming the main file is a literal string");
        return {
            mainFile: main,
            zipFile: req.file,
            version: version,
            options: options,
            source: source,
        }
    }
    if (source === 'web-ide') {
        return {
            mainFile: JSON.parse(main).join(path.sep),
            zipFile: req.file,
            source: source,
            version: version,
            options: options,
        };
    } else if (source === 'vscode') {
        if (version === "") {
            throw new Error(`Request from vscode does not defined a version`);
        }
        const packageVersion = new PackageVersion(version);
        if (packageVersion.isGreaterVersionThan({
            major: 0,
            minor: 2,
            patch: 5
        }, false)) {
            return {
                mainFile: JSON.parse(main).join(path.sep),
                zipFile: req.file,
                version: version,
                source: source,
                options: options
            }
        } else {
            return {
                mainFile: main,
                zipFile: req.file,
                version: version,
                source: source,
                options: options,
            }
        }
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
        rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 4, // limit each IP to 4 requests per windowMs
            keyGenerator(req) {
                return req.headers['x-forwarded-for'] as string || req.ip;
            }
        }),
        (_: express.Request, __: express.Response, next: express.NextFunction) => {
            checkRequestCounter.inc();
            next();
        },
        upload.single("file"),
        async function(req: express.Request, res: express.Response) {
            let parsedRequest: CheckRequest;
            try {
                parsedRequest = parseRequest(req);
            } catch (e: unknown) {
                const errorBody = objectifyError(e);
                baseLogger.ERROR("Cannot parse request body", errorBody);
                return res.status(200).send({
                    status: "INTERNAL",
                    message: "Internal error occurred. Please contact developers: " + errorBody.message
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
                    const response = await containerizedHarmonyRun(namespace, mainFile, logger, parsedRequest.options);
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
                    res.send(200).send({
                        status: "ERROR",
                        message: errorBody.message
                    });
                }
            });
        }
    ]
}
