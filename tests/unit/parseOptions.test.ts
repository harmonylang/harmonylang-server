import {describe, it} from 'mocha';
import {expect} from 'chai';

import parseOptions from "../../src/routes/check/codeRunner/parseOptions";


describe('Parse Harmony options', function () {
    it('should return empty string on undefined', function () {
        const onUndefined = parseOptions(undefined);
        expect(typeof onUndefined).to.equal('string');
        expect(onUndefined).to.equal("");
    });

    it('should return a string', function () {
        const args = parseOptions("");
        expect(typeof args).to.equal('string');
        expect(args).to.equal("");
    });

    it('should fail on unsupported options', function () {
        const badArgs = () => parseOptions("-t");
        expect(badArgs).to.throw("Invalid option used: -t");

        const badArgsWithSupportedOne = () => parseOptions("-t -c C=2");
        expect(badArgsWithSupportedOne).to.throw("Invalid option used: -t");
    });

    it('should pass on supported options', function () {
        const cArgs = parseOptions("--const C=12");
        expect(cArgs).to.equal(`--const "C=12"`)

        const mArgs = parseOptions("-m sync=syncM");
        expect(mArgs).to.equal(`--module "sync=syncM"`);

        const bArgs = parseOptions("-c C=21 --module sync=syncM");
        expect(bArgs).to.equal(`--const "C=21" --module "sync=syncM"`);

        const argsWithStr = parseOptions(`-c C="hello"`);
        expect(argsWithStr).to.equal(`--const "C=\\"hello\\""`);

        const argsWithEmptyStr = parseOptions(`-c C=''`);
        expect(argsWithEmptyStr).to.equal(`--const "C=''"`);
    });

    it('should gracefully handle bad inputs', function () {
        const badInputs = () => parseOptions("324rf edwc32 c ewd23");
        expect(badInputs).to.throw();
    });
});
