import {HarmonyLogger} from "../logger/logs";
import {HTML_RESULTS_DIR, UPLOADS_DIR} from "../config";
import path from "path";
import * as uuid from "uuid";
import fs from "fs-extra";
import rimraf from "rimraf";
import child_process from "child_process";

type RunResponse = {
    jsonData: Record<string, unknown>;
    code: 200;
    status: "FAILURE";
    staticHtmlLocation?: string;
    duration?: number;
} | {
    status: "SUCCESS" | "ERROR" | "INTERNAL";
    code: 400 | 500 | 404;
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
        run: `docker run -m 100M --memory-swap 100M --name ${namespace.id} -v ${namespace.directory}:/code -w /harmony -t anthonyyang/harmony-docker ./wrapper.sh ${harmonyFileArg}`,
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

type ExecResult = {
    error: child_process.ExecException | null;
    stdout: string;
    stderr: string;
}

async function executeCommand(cmd: string, options: child_process.ExecOptions): Promise<ExecResult> {
    return new Promise<ExecResult>(resolve => {
        child_process.exec(cmd, options, (error, stdout, stderr) => {
            resolve({
                error: error,
                stdout: stdout,
                stderr: stderr,
            });
        });
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
    const runResult = await executeCommand(dockerCommands.run, {timeout: 20000});
    if (runResult.error) {
        logger.INFO("Process led to error", {
            error: JSON.stringify(runResult.error),
            stdout: runResult.stdout,
            stderr: runResult.stderr,
        });
        await executeCommand(dockerCommands.clean, {timeout: 20000});
        return {
            code: 400,
            status: "ERROR",
            message: runResult.error.message.startsWith("Command failed") ?
                "Failed to execute Harmony file" : "Unknown error encountered",
        };
    }

    const getJsonResult = await executeCommand(dockerCommands.getJSON, {timeout: 10000});
    if (getJsonResult.error || getJsonResult.stderr) {
        console.log(getJsonResult);
        await executeCommand(dockerCommands.clean, {timeout: 20000});
        return {
            code: 500,
            status: "INTERNAL",
            message: "Failed to create Harmony model"
        };
    }

    const getHtmlResult = await executeCommand(dockerCommands.getHTML, {timeout: 10000});
    const didSaveHTML = !getHtmlResult.error && !getHtmlResult.stderr;
    if (!didSaveHTML) {
        console.log(getHtmlResult);
    }
    await executeCommand(dockerCommands.clean, {timeout: 20000});
    let results: any;
    try {
        const data = fs.readFileSync(namespace.charmJSON, {encoding: 'utf-8'});
        results = JSON.parse(data);
    } catch (error) {
        console.log(error);
        console.log(runResult);
        logger.ERROR("Error encountered while parsing Harmony results", {
            error: JSON.stringify(error) ?? "",
            namespace: namespace.id,
            responseCode: 500,
            stdout: runResult.stdout ?? "[none]",
            stderr: runResult.error ?? "[none]",
        })
        return {
            code: 500,
            status: "INTERNAL",
            message: "Failed to parse Harmony results",
        };
    }
    logger.INFO("Successfully responded with result");
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
        return responseBody;
    } else {
        return {code: 400, status: 'ERROR', message: runResult.stdout};
    }
}
