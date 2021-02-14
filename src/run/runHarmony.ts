import child_process from 'child_process';
import * as path from "path";
import {HARMONY_DIR} from "../config";
import fs from "fs-extra";
import express from "express";
import rimraf from "rimraf";
import {logClient} from "../logger/logs";

/**
 * Removes an allocated namespace directory.
 * @param namespace
 */
function cleanup(namespace: string) {
    rimraf(namespace, error => {
        if (error) {
            logClient.WARN("Warning: failed to cleanup namespace", {namespace: path.basename(namespace)});
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
) {
    let copiedHarmonyDirectory = "";
    try {
        copiedHarmonyDirectory = copyCompiler(namespaceDirectory);
    } catch (error) {
        logClient.ERROR("Error copying the compiler into the namespace", {
            namespace: path.basename(namespaceDirectory), error
        });
        return res.sendStatus(500);
    }
    const harmonyFile = `"${filename}"`;
    child_process.execFile('./harmony', [harmonyFile], {
        cwd: copiedHarmonyDirectory, shell: true
    }, (error, stdout, stderr) => {
        if (error) {
            console.log(error);
            res.send({
                status: "ERROR",
                message: error
            });
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
            } catch (error) {
                logClient.ERROR("Error encountered while parsing Harmony results", {
                    error, namespace: path.basename(namespaceDirectory)
                })
                res.sendStatus(500);
            }
        }
        cleanup(namespaceDirectory);
    });
}
