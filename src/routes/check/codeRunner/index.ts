import {HarmonyLogger} from "../../../analytics/logger";
import config from "../../../config";
import path from "path";
import fs from "fs-extra";
import {executeCommand} from "../../../cmd";
import {objectifyError} from "../../../util/isError";
import io from "@pm2/io";
import {CheckResponse} from "../schema";
import parseOptions from "./parseOptions";
import {CodeRunnerNamespace} from "../namespace";

const HTML_DURATION = 300000 // = 5 * 1000 * 60 (5 minutes)


type DockerCommands = {
    run: string;
    getJSON: string;
    getHTML: string;
    clean: string;
}

function makeDockerCommands(
    namespace: CodeRunnerNamespace,
    mainFilename: string,
    options?: string
): DockerCommands {
    const harmonyFileArg = path.join("..", "code", mainFilename);
    const compilerOptions = parseOptions(options);
    return {
        run: `docker run -m="400M" --memory-swap="400M" --cpus=".5" --name ${namespace.id} -v ${namespace.directory}:/code -w /harmony -t anthonyyang/harmony-docker ./wrapper.sh ${compilerOptions} ${harmonyFileArg}`,
        getJSON: `docker cp ${namespace.id}:/harmony/charm.json ${namespace.charmJSON}`,
        getHTML: `docker cp ${namespace.id}:/harmony/harmony.html ${namespace.htmlFile}`,
        clean: `docker container rm --force ${namespace.id}`
    }
}

const numberOfHtmlFilesCounter = config.isProduction() ? io.counter({
    name: "Number of HTML Files",
    id: "app.data.html.count"
}) : null;

export async function run(
    namespace: CodeRunnerNamespace,
    mainFilename: string,
    logger: HarmonyLogger,
    options?: string
): Promise<CheckResponse> {
    if (!fs.existsSync(namespace.mainFile) || !fs.statSync(namespace.mainFile).isFile()) {
        logger.ERROR("Filename does not exist");
        return {
            status: "INTERNAL",
            message: "Filename could not be found on the server",
            code: 200,
        };
    }
    let dockerCommands: DockerCommands
    try {
        dockerCommands = makeDockerCommands(namespace, mainFilename, options);
    } catch (e) {
        const err = objectifyError(e);
        return {
            code: 200,
            status: "ERROR",
            message: err.message,
        }
    }

    const runResult = await executeCommand(dockerCommands.run, {timeout: 30000});
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
        let status: "ERROR" | "TIMEOUT" | "OUT OF MEMORY";
        if (e.code === 137) {
            status = "OUT OF MEMORY";
        } else if (e.code === 255) {
            status = "TIMEOUT";
        } else {
            status = "ERROR";
        }
        await executeCommand(dockerCommands.clean, {timeout: 20000});
        console.log(status + "\n" + runResult.stdout);
        return {
            status,
            code: 200,
            message: status + "\n" + runResult.stdout,
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
            message: "INTERNAL" + "\n" +"Failed to create Harmony model"
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

        if (didSaveHTML) fs.remove(namespace.htmlFile).catch(console.log);

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
        const responseBody: CheckResponse = {status: "FAILURE", jsonData: results, code: 200};
        if (didSaveHTML) {
            responseBody.staticHtmlLocation = `/download/${namespace.id}`;
            responseBody.duration = HTML_DURATION;
            if (!config.isDevelopment()) {
                numberOfHtmlFilesCounter?.inc();
                const removeHtmlTimeout = setTimeout(() => {
                    fs.remove(namespace.htmlFile).catch(console.log);
                    numberOfHtmlFilesCounter?.dec();
                    clearTimeout(removeHtmlTimeout);
                }, HTML_DURATION);
            }
        }
        return responseBody;
    } else {
        return {code: 200, status: 'COMPLETED', message: "COMPLETED\n" + runResult.stdout};
    }
}

export default { run };
