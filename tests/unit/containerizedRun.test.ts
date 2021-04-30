import config from "../../src/config";
import {describe, it, afterEach} from 'mocha';
import {expect} from 'chai';
import codeRunner from "../../src/routes/check/codeRunner";
import assert from "assert";
import * as fs from "fs";
import path from "path";
import rimraf from "rimraf";
import {silentLogClient} from "../../src/analytics/logger";
import namespace from "../../src/routes/check/namespace";

describe('Containerized Run Tests', function () {
    describe('Namespace tests', function () {
        afterEach(() => {
            const directory = fs.opendirSync(config.UPLOADS_DIR);
            while (true) {
                const entry = directory.readSync();
                if (!entry) break;
                rimraf.sync(path.join(config.UPLOADS_DIR, entry.name));
            }
            directory.closeSync();
        });

        it('should create a unique namespace', function () {
            const main = "charm.json";
            const result = namespace.createNamespace(main);
            assert(result);
            const {directory, htmlFile, id, charmJSON, mainFile} = result;
            expect(fs.existsSync(directory)).to.be.true;
            expect(mainFile).equals(path.join(directory, main));
            expect(id).equals(path.basename(directory));
            expect(path.dirname(charmJSON)).equals(directory);
            expect(charmJSON).does.not.equal(mainFile);
            expect(htmlFile).equals(path.join(config.HTML_RESULTS_DIR, path.basename(directory) + ".html"));
        });
    });

    describe('Cleanup namespace test', function () {
        it('should cleanup created namespaces',  function (done) {
            const main = "charm.json";
            const result = namespace.createNamespace(main);
            assert(result);
            result.cleanup().then(() => {
                    const {directory} = result;
                    expect(fs.existsSync(directory)).is.false;
                    done()
                })
                .catch(done);
        });
    });

    describe('Containerized Harmony programs', function () {
        afterEach(() => {
            const directory = fs.opendirSync(config.HTML_RESULTS_DIR);
            while (true) {
                const entry = directory.readSync();
                if (!entry) break;
                fs.unlinkSync(path.join(config.HTML_RESULTS_DIR, entry.name));
            }
            directory.closeSync();
        })

        it('should run Harmony programs in a container', function (done) {
            this.timeout(6000);
            const mainFile = "main.hny"
            const codeNamespace = namespace.createNamespace(mainFile);
            assert(codeNamespace);
            fs.writeFileSync(codeNamespace.mainFile, "assert False\n", 'utf-8');
            codeRunner.run(codeNamespace, mainFile, silentLogClient)
                .then(r => {
                    codeNamespace.cleanup().then(() => {
                        assert(r.status === "FAILURE");
                        assert(r.code === 200);
                        expect(r.staticHtmlLocation).equals(path.join("/download", path.basename(codeNamespace.directory)))
                        done();
                    }).catch(done)
                }).catch(done);
        });

        it('should run Harmony programs with flags', function (done) {
            this.timeout(6000);
            const mainFile = "main.hny"
            const codeNamespace = namespace.createNamespace(mainFile);
            assert(codeNamespace);
            fs.writeFileSync(codeNamespace.mainFile, "const C = 2\nassert C == 2;", 'utf-8');
            codeRunner.run(codeNamespace, mainFile, silentLogClient, " -c C=3 ").then(r => {
                codeNamespace.cleanup().then(() => {
                    assert(r.status === "FAILURE");
                    done();
                }).catch(done)
            }).catch(done);
        });
    });
});
