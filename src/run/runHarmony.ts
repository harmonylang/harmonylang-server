import child_process from 'child_process';
import * as path from "path";
import {HARMONY_DIR} from "../config";
import fs from "fs";
import express from "express";
import rimraf from "rimraf";

const HARMONY_SCRIPT = path.join(HARMONY_DIR, "harmony");

function cleanup(namespace: string) {
    rimraf(namespace, err => console.log(err));
}

export function runHarmony(
    namespace: string,
    filename: string,
    res: express.Response,
) {
    const pathToScriptFromNamespace = path.relative(namespace, HARMONY_SCRIPT);
    const harmonyFile = path.relative(namespace, filename);
    child_process.exec(`${pathToScriptFromNamespace} ${harmonyFile}`, {cwd: namespace}, (error, stdout, stderr) => {
        if (error) {
            cleanup(namespace);
            return res.send({
                status: "ERROR",
                message: stdout
            });
        }
        try {
            const results = JSON.parse(fs.readFileSync(path.join(namespace, "charm.json"), {encoding: 'utf-8'}));
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
