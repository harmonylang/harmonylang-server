import child_process from 'child_process';
import * as path from "path";
import {HARMONY_DIR, HTML_RESULTS_DIR} from "../config";
import fs from "fs-extra";
import express from "express";
import rimraf from "rimraf";
import {HarmonyLogger} from "../logger/logs";


const HTML_DURATION = 300000 // = 5 * 1000 * 60 (5 minutes)

/**
 * This will save the output HTML file in the {HTML_RESULTS_DIR}, for up to
 * 15 minutes or when the server restarts.
 * @param namespace
 * @param logger
 */
function saveHarmonyHTML(namespace: string, logger: HarmonyLogger): boolean {
    const htmlFile = path.join(namespace, "compiler", "harmony.html");
    const destinationFile = path.join(HTML_RESULTS_DIR, path.basename(namespace) + ".html");
    try {
        if (!fs.existsSync(HTML_RESULTS_DIR)) {
            fs.mkdirSync(HTML_RESULTS_DIR, {recursive: true});
        }
        fs.moveSync(htmlFile, destinationFile, {});
    } catch (error) {
        console.log(error);
        logger.WARN("Warning: failed to save harmony.json file.")
        return false;
    }
    setTimeout(() => {
        fs.removeSync(destinationFile)
    }, HTML_DURATION)
    return true;
}

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
            namespace: path.basename(namespaceDirectory),
            error: JSON.stringify(error) ?? ""
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
        cwd: copiedHarmonyDirectory, shell: true, timeout: 20000
    }, (err, stdout, stderr) => {
        if (err) {
            logger.INFO("Process led to error", {
                error: JSON.stringify(err) ?? "",
                stderr: JSON.stringify(stderr),
            });
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
                const didSaveHTML = saveHarmonyHTML(namespaceDirectory, logger)
                if (results != null && results.issue != null && results.issue != "No issues") {
                    const responseBody: Record<string, unknown> = {status: "FAILURE", jsonData: results};
                    if (didSaveHTML) {
                        responseBody.staticHtmlLocation = `/html_results/${path.basename(namespaceDirectory)}.html`;
                        responseBody.duration = HTML_DURATION;
                    }
                    res.send(responseBody);
                } else {
                    res.send({status: "SUCCESS", message: stdout});
                }
                logger.INFO("Successfully responded with result");
            } catch (error) {
                console.log(error);
                if (fs.existsSync(namespaceDirectory)) {
                    console.log(fs.readdirSync(namespaceDirectory));
                } else {
                    console.log("Cannot find directory!: " + namespaceDirectory);
                }
                logger.ERROR("Error encountered while parsing Harmony results", {
                    error: JSON.stringify(error) ?? "",
                    namespace: path.basename(namespaceDirectory),
                    responseCode: 500,
                })
                res.sendStatus(500);
            }
        }
        cleanup(namespaceDirectory, logger);
    });
}
