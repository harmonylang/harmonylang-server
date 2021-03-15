import child_process from 'child_process';
import * as path from "path";
import {HARMONY_DIR, HTML_RESULTS_DIR, UPLOADS_DIR} from "../config";
import fs from "fs-extra";
import {HarmonyLogger} from "../logger/logs";
import {CheckResponse} from "../schema/check";


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
        logger.WARN("Warning: failed to save harmony.json file.")
        return false;
    }
    setTimeout(() => {
        fs.removeSync(destinationFile)
    }, HTML_DURATION)
    return true;
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

export async function runHarmony(
    namespace: string,
    harmonyFile: string,
    logger: HarmonyLogger
): Promise<CheckResponse> {
    const namespaceDirectory = path.join(UPLOADS_DIR, namespace);
    let copiedHarmonyDirectory = "";
    try {
        copiedHarmonyDirectory = copyCompiler(namespaceDirectory);
    } catch (error) {
        logger.ERROR("Error copying the compiler into the namespace", {
            namespace, error: JSON.stringify(error) ?? ""
        });
        return {
            status: "INTERNAL",
            message: "Internal error detected while compiling the Harmony program"
        };
    }
    if (!fs.existsSync(harmonyFile) || !fs.statSync(harmonyFile).isFile()) {
        logger.ERROR("Filename does not exist", {
            harmonyFile, responseCode: 404, namespace
        });
        return {
            status: "INTERNAL",
            message: "Cannot find Harmony file to compile"
        };
    }

    return new Promise<CheckResponse>((resolve) => {
        child_process.execFile('./harmony', [harmonyFile], {
            cwd: copiedHarmonyDirectory, shell: true, timeout: 20000
        }, (err, stdout, stderr) => {
            if (err) {
                logger.INFO("Process led to error", {
                    error: JSON.stringify(err) ?? "",
                    stderr: JSON.stringify(stderr),
                });
                if (err.message.startsWith("Command failed")) {
                    resolve({
                        status: "ERROR",
                        message: "Failed to execute Harmony file"
                    })
                } else {
                    resolve({
                        status: "ERROR",
                        message: err.message
                    });
                }
            } else {
                try {
                    const data = fs.readFileSync(path.join(copiedHarmonyDirectory, "charm.json"), {encoding: 'utf-8'});
                    const results = JSON.parse(data);
                    const didSaveHTML = saveHarmonyHTML(namespaceDirectory, logger);
                    logger.INFO("Successfully responded with result");
                    if (results != null && results.issue != null && results.issue != "No issues") {
                        const responseBody: CheckResponse = {status: "FAILURE", jsonData: results};
                        if (didSaveHTML) {
                            responseBody.staticHtmlLocation = `/html_results/${path.basename(namespaceDirectory)}.html`;
                            responseBody.duration = HTML_DURATION;
                        }
                        resolve(responseBody);
                    } else {
                        resolve({status: "SUCCESS", message: stdout});
                    }
                } catch (error) {
                    logger.ERROR("Error encountered while parsing Harmony results", {
                        error: JSON.stringify(error) ?? "",
                        namespace,
                        responseCode: 500
                    });
                    resolve({
                        status: "INTERNAL",
                        message: "Error encountered while parsing Harmony file results"
                    });
                }
            }
        });
    });
}
