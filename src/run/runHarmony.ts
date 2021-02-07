import child_process from 'child_process';
import * as path from "path";
import {HARMONY_DIR} from "../config";
import fs from "fs-extra";
import express from "express";
import rimraf from "rimraf";

function cleanup(namespace: string) {
    rimraf(namespace, err => console.log(err));
}

function copyCompiler(namespace: string): string {
    const copiedDirectory = path.join(namespace, "compiler");
    fs.copySync(HARMONY_DIR, copiedDirectory);
    return copiedDirectory;
}

export function runHarmony(
    namespace: string,
    filename: string,
    res: express.Response,
) {
    const copiedHarmonyDirectory = copyCompiler(namespace);
    const harmonyFile = path.relative(copiedHarmonyDirectory, filename);
    child_process.exec(`./harmony ${harmonyFile}`,
        {cwd: copiedHarmonyDirectory}, (error, stdout, stderr) => {
        if (error) {
            cleanup(namespace);
            return res.send({
                status: "ERROR",
                message: stdout
            });
        }
        try {
            const results = JSON.parse(fs.readFileSync(path.join(copiedHarmonyDirectory, "charm.json"), {encoding: 'utf-8'}));
            cleanup(namespace);
            if (results != null && results.issue != null && results.issue != "No issues") {
                return res.send({
                    status: "FAILURE",
                    jsonData: results
                });
            } else {
                return res.send({
                    status: "SUCCESS",
                    message: stdout
                });
            }
        } catch (error) {
            res.sendStatus(500);
        }
    });
}
