import {describe, it} from 'mocha';
import request from 'supertest';
import {buildApp} from "../../src";
import path from "path";
import * as fs from "fs";
import config from "../../src/config";
import * as rimraf from "rimraf";

type TestInstance = {
    zipFile: string;
    mainFilename: string;
};

const tests: TestInstance[] = [{
    zipFile: path.join(__dirname, "diners", "diners.hny.zip"),
    mainFilename: "diners.hny",
}, {
    zipFile: path.join(__dirname, "nested", "src.zip"),
    mainFilename: "src/petersons.hny"
}, {
    zipFile: path.join(__dirname, "pascal", "pascal.hny.zip"),
    mainFilename: "pascal.hny"
}, {
    zipFile: path.join(__dirname, "petersons", "petersons.hny.zip"),
    mainFilename: "petersons.hny"
}, {
    zipFile: path.join(__dirname, "queue", "Archive.zip"),
    mainFilename: "queue_test.hny"
}, {
    zipFile: path.join(__dirname, "syntax", "code.hny.zip"),
    mainFilename: "code.hny"
}]

describe('Run Example requests', function () {
    after(() => {
        const directory = fs.opendirSync(config.UPLOADS_DIR);
        while (true) {
            const entry = directory.readSync();
            if (!entry) break;
            rimraf.sync(path.join(config.UPLOADS_DIR, entry.name));
        }
        directory.closeSync();
    })

    it('should handle all requests without crashing app', function (done) {
        this.timeout(0);
        buildApp().then(app => {
            const testResult = tests.map(({zipFile, mainFilename}) => {
                return new Promise((resolve, reject) => {
                    request(app)
                        .post("/check")
                        .send()
                        .attach("file", zipFile)
                        .field("main", JSON.stringify(mainFilename.split("/")))
                        .field("version", "1.0.0")
                        .field("source", "web-ide")
                        .expect(200)
                        .end(function(err) {
                            if (err) reject(err);
                            else resolve(true);
                        });
                })
            })
            Promise.all(testResult).then(() => done()).catch(done);
        }).catch(done);
    });
});
