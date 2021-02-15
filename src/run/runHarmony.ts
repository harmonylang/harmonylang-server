import child_process from 'child_process';
import * as path from "path";
import {HARMONY_DIR} from "../config";
import fs from "fs-extra";
import express from "express";
import rimraf from "rimraf";
import {HarmonyLogger} from "../logger/logs";

/**
 * Removes an allocated namespace directory.
 * @param namespace
 * @param logger
 */
function cleanup(namespace: string, logger: HarmonyLogger) {
    rimraf(namespace, error => {
        if (error) {
            logger.WARN("Warning: failed to cleanup namespace", {namespace: path.basename(namespace)});
        }
    });
}

/**
 * Copies the contents of the Harmony compiler into the namespace directory as <namesapce>/compiler.
 * For convenience, the path to the directory that contains the copied compiler is returned.
 * @param namespace
 */
function copyCompiler(namespace: string): string {
    const copiedDirectory = path.join(namespace, "compiler");
    fs.copySync(HARMONY_DIR, copiedDirectory);
    return copiedDirectory;
}

export function runHarmony(
    namespaceDirectory: string,
    filename: string,
    res: express.Response,
    logger: HarmonyLogger
) {
    let copiedHarmonyDirectory = "";
    try {
        copiedHarmonyDirectory = copyCompiler(namespaceDirectory);
    } catch (error) {
        logger.ERROR("Error copying the compiler into the namespace", {
            namespace: path.basename(namespaceDirectory), error
        });
        return res.sendStatus(500);
    }
    const harmonyFile = filename;
    if (!fs.existsSync(harmonyFile) || !fs.statSync(harmonyFile).isFile()) {
        logger.ERROR("Filename does not exist", {
            harmonyFile, code: 404, namespace: path.basename(namespaceDirectory)
        });
        res.sendStatus(404);
        cleanup(namespaceDirectory, logger);
        return;
    }

    child_process.execFile('./harmony', [harmonyFile], {
        cwd: copiedHarmonyDirectory, shell: true
    }, (err, stdout, stderr) => {
        if (err) {
            logger.INFO("Process led to error", {error: err.message, stderr});
            if (err.message.startsWith("Command failed")) {
                res.send({
                    status: "ERROR",
                    message: "Failed to execute Harmony file"
                })
            } else {
                res.send({
                    status: "ERROR",
                    message: err.message
                });
            }
        } else {
            try {
                let data = fs.readFileSync(path.join(copiedHarmonyDirectory, "charm.json"), {encoding: 'utf-8'});
                const results = JSON.parse(data);
                if (results != null && results.issue != null && results.issue != "No issues") {
                    res.send({
                        status: "FAILURE",
                        jsonData: results
                    });
                } else {
                    res.send({status: "SUCCESS", message: stdout});
                }
                logger.INFO("Successfully responded with result");
            } catch (error) {
                logger.ERROR("Error encountered while parsing Harmony results", {
                    error, namespace: path.basename(namespaceDirectory),
                    responseCode: 500
                })
                res.sendStatus(500);
            }
        }
        cleanup(namespaceDirectory, logger);
    });
}
