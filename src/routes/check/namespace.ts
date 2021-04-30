import * as uuid from "uuid";
import path from "path";
import config from "../../config";
import fs from "fs-extra";
import rimraf from "rimraf";


export type CodeRunnerNamespace = {
    id: string;
    directory: string;
    mainFile: string;
    charmJSON: string;
    htmlFile: string;

    /**
     * Deletes the namespace at `this.directory`
     */
    cleanup(): Promise<void>;
}


/**
 * Creates a new namespace for a Harmony program to be run. Returns null if a namespace_ cannot be created.
 *
 * This returns the namespace id and the directory that can be used to write the files.
 * Additionally, it returns unique filenames which can be used to store charmJSON files
 * and HTML files as a result of running the Harmony program.
 */
function createNamespace(mainFilename: string): CodeRunnerNamespace | null {
    const id = uuid.v4();
    const directory = path.join(config.UPLOADS_DIR, id);
    if (fs.existsSync(directory)) {
        return null;
    }
    fs.mkdirSync(directory, {recursive: true});

    const charmJSON = path.join(directory, uuid.v4());
    const htmlFile = path.join(config.HTML_RESULTS_DIR, id + '.html');
    return {
        id,
        directory,
        mainFile: path.join(directory, mainFilename),
        htmlFile,
        charmJSON,
        cleanup() {
            return new Promise<void>((resolve, reject) => {
                rimraf(directory, error => {
                    if (error) reject(error);
                    resolve();
                });
            });
        }
    };
}


export default {
    createNamespace
};
