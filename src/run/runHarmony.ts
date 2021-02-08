import child_process from 'child_process';
import * as path from "path";
import {HARMONY_DIR} from "../config";
import fs from "fs-extra";
import express from "express";
import rimraf from "rimraf";

/**
 * Removes an allocated namespace directory.
 * @param namespace
 */
function cleanup(namespace: string) {
    rimraf(namespace, err => err && console.log(err));
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
    const copiedHarmonyDirectory = copyCompiler(namespaceDirectory);
    const harmonyFile = path.relative(copiedHarmonyDirectory, filename);
    child_process.exec(`./harmony ${harmonyFile}`,
        {cwd: copiedHarmonyDirectory}, (error, stdout) => {
        if (error) {
            res.send({
                status: "ERROR",
                message: stdout
            });
        } else {
            try {
                const results = JSON.parse(fs.readFileSync(path.join(copiedHarmonyDirectory, "charm.json"), {encoding: 'utf-8'}));
                if (results != null && results.issue != null && results.issue != "No issues") {
                    res.send({
                        status: "FAILURE",
                        jsonData: results
                    });
                } else {
                    res.send({status: "SUCCESS", message: stdout});
                }
            } catch (error) {
                res.sendStatus(500);
            }
        }
        cleanup(namespaceDirectory);
    });
}
