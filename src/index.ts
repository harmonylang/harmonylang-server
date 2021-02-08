import express from 'express';
import bodyParser from 'body-parser';
import generateNamespace from "./genNamespace";
import fsSync, {promises as fs} from "fs";
import path from "path";
import {UPLOADS_DIR} from "./config";
import AdmZip from 'adm-zip';
import {runHarmony} from "./run/runHarmony";
import multer from 'multer';

const upload = multer();

const app = express();
app.disable('x-powered-by');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.post("/check", upload.single("file"), async (req, res) => {
    const {main} = req.body
    if (main == null) {
        return res.status(400).send("No main file was declared");
    }
    const zippedFile = req.file;
    if (zippedFile == null) {
        return res.status(400).send("No files were uploaded");
    }
    // Ensure there is only file being sent.
    const namespace = generateNamespace((name) => {
        return !fsSync.existsSync(path.join(UPLOADS_DIR, name));
    })
    if (namespace == null) {
        return res.status(400).send("Your request could not be served at this time. Please try again later");
    }
    // Create a directory to hold the zip file.
    const zipDirectory = path.join(UPLOADS_DIR, namespace, "zips");
    await fs.mkdir(zipDirectory, {recursive: true});

    // Write the zip file to the zip directory.
    const filename = path.join(zipDirectory, zippedFile.originalname);
    await fs.writeFile(filename, zippedFile.buffer);

    // Create a directory to extract the source files from the zip into.
    const harmonyDirectory = path.join(UPLOADS_DIR, namespace, "source");
    new AdmZip(filename).extractAllTo(harmonyDirectory);

    // Run the Harmony model checker.
    return runHarmony(
        path.join(UPLOADS_DIR, namespace),
        path.join(harmonyDirectory, main),
        res
    );
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
