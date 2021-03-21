import {HarmonyLogger} from "../logger/logs";
import {HTML_RESULTS_DIR, UPLOADS_DIR} from "../config";
import path from "path";
import * as uuid from "uuid";
import fs from "fs-extra";
import rimraf from "rimraf";
import child_process from "child_process";

type RunResponse = {
    jsonData: Record<string, unknown>;
    code: number;
    status: "FAILURE";
    staticHtmlLocation?: string;
    duration?: number;
} | {
    status: "SUCCESS" | "ERROR" | "INTERNAL";
    code: number;
    message: string;
}

const HTML_DURATION = 300000 // = 5 * 1000 * 60 (5 minutes)

type CodeRunnerNamespace = {
    id: string;
    directory: string;
    mainFile: string;
    mainFilename: string;
    charmJSON: string;
    htmlFile: string;
}

type DockerCommands = {
    run: string;
    getJSON: string;
    getHTML: string;
    clean: string;
}

/**
 * Creates a new namespace for a Harmony program to be run. This returns the namespace id and the directory that can be
 * used to write the files.
 */
export function createNamespace(mainFilename: string): CodeRunnerNamespace | null {
    const id = uuid.v4();
    const directory = path.join(UPLOADS_DIR, id);
    if (fs.existsSync(directory)) {
        return null;
    }
    fs.mkdirSync(directory, {recursive: true});

    const charmJSON = path.join(directory, "charm.json");
    const htmlFile = path.join(HTML_RESULTS_DIR, id + '.html');
    return {
        id,
        directory,
        mainFile: path.join(directory, mainFilename),
        mainFilename,
        htmlFile,
        charmJSON
    };
}

function makeDockerCommands(
    namespace: CodeRunnerNamespace,
): DockerCommands {
    const harmonyFileArg = path.join("..", "code", namespace.mainFilename);
    return {
        run: `docker run -m 100M --memory-swap 100M --name ${namespace.id} -v ${namespace.directory}:/code -w /harmony -t harmony ./harmony -t ${harmonyFileArg}`,
        getJSON: `docker cp ${namespace.id}:/harmony/charm.json ${namespace.charmJSON}`,
        getHTML: `docker cp ${namespace.id}:/harmony/harmony.html ${namespace.htmlFile}`,
        clean: `docker container rm ${namespace.id}`
    }
}


export function cleanup(namespace: CodeRunnerNamespace, logger: HarmonyLogger) {
    rimraf(namespace.directory, error => {
        if (error) {
            logger.WARN("Warning: failed to cleanup namespace", {namespace: namespace.id});
        }
    });
}

export async function containerizedHarmonyRun(
    namespace: CodeRunnerNamespace,
    logger: HarmonyLogger
): Promise<RunResponse> {
    if (!fs.existsSync(namespace.mainFile) || !fs.statSync(namespace.mainFile).isFile()) {
        const code = 404;
        logger.ERROR("Filename does not exist", {
            mainFile: namespace.mainFile, code, namespace: namespace.id,
        });
        return {
            status: "INTERNAL",
            message: "Filename could not be found on the server",
            code
        };
    }
    const dockerCommands = makeDockerCommands(namespace);
    return new Promise<RunResponse>(resolve => {
        child_process.exec(dockerCommands.run, {
            timeout: 20000
        }, (err, stdout, stderr) => {
            if (err) {
                logger.INFO("Process led to error", {
                    error: JSON.stringify(err),
                    stdout: stdout,
                    stderr: stderr,
                });
                return resolve({
                    status: "ERROR",
                    message: err.message.startsWith("Command failed") ?
                        "Failed to execute Harmony file" : "Unknown error encountered",
                    code: 200
                });
            } else {
                child_process.exec(dockerCommands.getJSON, (err, stdout, stderr) => {
                    if (err || stderr) {
                        console.log(err, stdout, stderr);
                        return resolve({
                            code: 200,
                            status: "INTERNAL",
                            message: "Failed to create Harmony model"
                        });
                    }
                    child_process.exec(dockerCommands.getHTML, (err, stdout, stderr) => {
                        const didSaveHTML = !err && !stderr;
                        child_process.exec(dockerCommands.clean, (err, stdout, stderr) => {
                            if (err || stderr) {
                                logger.WARN("Failed to remove Docker container!", {
                                    name: namespace.id
                                });
                            }
                        });
                        let results: any;
                        try {
                            const data = fs.readFileSync(namespace.charmJSON, {encoding: 'utf-8'});
                            results = JSON.parse(data);
                        } catch (error) {
                            console.log(error);
                            console.log(err, "\n", stdout, "\n", stderr);
                            logger.ERROR("Error encountered while parsing Harmony results", {
                                error: JSON.stringify(error) ?? "",
                                namespace: namespace.id,
                                responseCode: 500,
                                stdout: stdout ?? "[none]",
                                stderr: stderr ?? "[none]",
                            })
                            return resolve({
                                status: "INTERNAL",
                                message: "Failed to parse Harmony results",
                                code: 500,
                            });
                        }
                        if (results != null &&
                            typeof results === "object" &&
                            results.issue != null &&
                            results.issue !== "No issues"
                        ) {
                            const responseBody: RunResponse = {status: "FAILURE", jsonData: results, code: 200};
                            if (didSaveHTML) {
                                responseBody.staticHtmlLocation = `/html_results/${namespace.id}.html`;
                                responseBody.duration = HTML_DURATION;
                                setTimeout(() => fs.removeSync(namespace.htmlFile), HTML_DURATION);
                            }
                            resolve(responseBody);
                        } else {
                            resolve({code: 200, status: 'ERROR', message: stdout});
                        }
                        logger.INFO("Successfully responded with result");
                    });
                });
            }
        });
    });
}
