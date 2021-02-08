import express from 'express';
import bodyParser from 'body-parser';
import generateNamespace from "./genNamespace";
import fsSync, {promises as fs} from "fs";
import * as path from "path";
import {UPLOADS_DIR} from "./config";
import AdmZip from 'adm-zip';
import {runHarmony} from "./run/runHarmony";
import multer from 'multer';

const upload = multer();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.post("/check", upload.any(), async (req, res) => {
    console.log("Ping", req.body);
    const {main} = req.body
    if (main == null) {
        return res.status(400).send("No main file was declared");
    }
    const files = req.files;
    if (files == null) {
        return res.status(400).send("No files were uploaded");
    }
    const namespace = generateNamespace((name) => {
        return !fsSync.existsSync(path.join(UPLOADS_DIR, name));
    })
    if (namespace == null) {
        return res.status(400).send("Your request could not be served at this time. Please try again later");
    }
    console.log(files);
    const zipDirectory = path.join(UPLOADS_DIR, namespace, "zips");
    await fs.mkdir(zipDirectory, {recursive: true});
    if (!Array.isArray(files) || files.length != 1) {
        return res.status(407).send("Invalid file argument");
    }
    const zippedFile = files[0];
    const filename = path.join(zipDirectory, zippedFile.originalname);
    await fs.writeFile(filename, zippedFile.buffer);
    const harmonyDirectory = path.join(UPLOADS_DIR, namespace, "source");
    new AdmZip(filename).extractAllTo(harmonyDirectory);
    return runHarmony(path.join(UPLOADS_DIR, namespace), path.join(harmonyDirectory, main), res);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
