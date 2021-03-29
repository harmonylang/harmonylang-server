import {HarmonyLogger} from "../../analytics/logger";
import {HTML_RESULTS_DIR, UPLOADS_DIR} from "../../config";
import path from "path";
import * as uuid from "uuid";
import fs from "fs-extra";
import rimraf from "rimraf";
import {executeCommand} from "../../cmd";
import {objectifyError} from "../../util/isError";

type RunResponse = {
    jsonData: Record<string, unknown>;
    code: 200;
    status: "FAILURE";
    staticHtmlLocation?: string;
    duration?: number;
} | {
    status: "SUCCESS" | "ERROR" | "INTERNAL" | "COMPLETED";
    code: 400 | 500 | 404 | 200;
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
        run: `docker run -m 300M --memory-swap 300M --name ${namespace.id} -v ${namespace.directory}:/code -w /harmony -t anthonyyang/harmony-docker ./wrapper.sh ${harmonyFileArg}`,
        getJSON: `docker cp ${namespace.id}:/harmony/charm.json ${namespace.charmJSON}`,
        getHTML: `docker cp ${namespace.id}:/harmony/harmony.html ${namespace.htmlFile}`,
        clean: `docker container rm --force ${namespace.id}`
    }
}


export function cleanup(namespace: CodeRunnerNamespace): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        rimraf(namespace.directory, error => {
            if (error) reject(error);
        });
    });
}

export async function containerizedHarmonyRun(
    namespace: CodeRunnerNamespace,
    logger: HarmonyLogger
): Promise<RunResponse> {
    if (!fs.existsSync(namespace.mainFile) || !fs.statSync(namespace.mainFile).isFile()) {
        logger.ERROR("Filename does not exist");
        return {
            status: "INTERNAL",
            message: "Filename could not be found on the server",
            code: 200,
        };
    }
    const dockerCommands = makeDockerCommands(namespace);
    const runResult = await executeCommand(dockerCommands.run, {timeout: 40000});
    if (runResult.error) {
        const e = runResult.error
        logger.INFO("Process led to error", {
            errorCode: e.code ?? 0,
            command: e.cmd ?? "",
            killed: e.killed ?? false,
            signal: e.signal ?? "",
            errorName: e.name,
            stack: e.stack ?? "",
            errorMessage: e.message,
            stdout: runResult.stdout,
            stderr: runResult.stderr,
        });
        await executeCommand(dockerCommands.clean, {timeout: 20000});
        return {
            code: 200,
            status: "ERROR",
            message: e.message.startsWith("Command failed") || e.message.startsWith("Traceback") ?
                runResult.stdout : "Unknown error encountered",
        };
    }

    const getJsonResult = await executeCommand(dockerCommands.getJSON, {timeout: 10000});
    if (getJsonResult.error || getJsonResult.stderr) {
        await executeCommand(dockerCommands.clean, {timeout: 20000});
        const e = getJsonResult.error;
        logger.ERROR("Failed to create Harmony model", {
            errorCode: e?.code ?? 0,
            command: e?.cmd ?? "",
            killed: e?.killed ?? false,
            signal: e?.signal ?? "",
            errorName: e?.name ?? "",
            stack: e?.stack ?? "",
            errorMessage: e?.message ?? "",
            getJsonStdout: getJsonResult.stdout,
            getJsonStderr: getJsonResult.stderr,
            runStdout: runResult.stdout,
            runStderr: runResult.stderr,
        });
        return {
            code: 200,
            status: "INTERNAL",
            message: "Failed to create Harmony model"
        };
    }

    const getHtmlResult = await executeCommand(dockerCommands.getHTML, {timeout: 10000});
    const didSaveHTML = !getHtmlResult.error && !getHtmlResult.stderr;
    await executeCommand(dockerCommands.clean, {timeout: 20000});
    let results: any;
    try {
        const data = fs.readFileSync(namespace.charmJSON, {encoding: 'utf-8'});
        results = JSON.parse(data);
    } catch (error) {
        const errorBody = objectifyError(error);
        logger.ERROR("Error encountered while parsing Harmony results", {
            namespace: namespace.id,
            runStdout: runResult.stdout ?? "[none]",
            runStderr: runResult.error ?? "[none]",
            ...errorBody,
        })
        return {
            code: 200,
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
            responseBody.staticHtmlLocation = `/download/${namespace.id}`;
            responseBody.duration = HTML_DURATION;
            const removeHtmlTimeout = setTimeout(() => {
                fs.remove(namespace.htmlFile).catch(console.log);
                clearTimeout(removeHtmlTimeout);
            }, HTML_DURATION);
        }
        return responseBody;
    } else {
        return {code: 200, status: 'COMPLETED', message: runResult.stdout};
    }
}
