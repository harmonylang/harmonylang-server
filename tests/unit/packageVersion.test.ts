import {describe, it} from 'mocha';
import {expect} from 'chai';
import PackageVersion from "../../src/util/packageVersion";


describe('Test package version', function () {
    it('should prevent malformed versions', function () {
        const versions = ["", ".", ".5.42.", "4..4"];
        for (const v of versions) {
            expect(() => new PackageVersion(v)).to.not.throw;
            const pv = new PackageVersion(v)
            expect(pv.version.parsed).equals(false);

            expect(pv.isGreaterVersionThan({})).equals(false);
            expect(pv.isGreaterVersionThan({}, false)).equals(false);
            expect(pv.isGreaterVersionThan({}, true)).equals(true);

            expect(pv.isLesserVersionThan({})).equals(false);
            expect(pv.isLesserVersionThan({}, false)).equals(false);
            expect(pv.isLesserVersionThan({}, true)).equals(true);
        }
    });

    it('should be a lower version', function () {
        const version = new PackageVersion("1.0.0");
        expect(version.isLesserVersionThan({major: 5, minor: 6, patch: 1})).to.equal(true);
        expect(version.isLesserVersionThan({major: 2})).to.equal(true);
        expect(version.isLesserVersionThan({major: 1})).to.equal(false);
        expect(version.isLesserVersionThan({major: 1, minor: 1})).to.equal(true);
        expect(version.isLesserVersionThan({major: 1, minor: 1, patch: 1})).to.equal(true);
        expect(version.isLesserVersionThan({major: 0, minor: 1, patch: 1})).to.equal(false);
        expect(version.isLesserVersionThan({major: 1, minor: 0, patch: 0})).to.equal(false);
        expect(version.isLesserVersionThan({major: 0, minor: 0, patch: 1})).to.equal(false);
        expect(version.isLesserVersionThan({major: 1, minor: 0, patch: 1})).to.equal(true);
    });

    it('should be a greater version', function () {
        const version = new PackageVersion("1.0.0");
        expect(version.isGreaterVersionThan({major: 5, minor: 6, patch: 1})).to.equal(false);
        expect(version.isGreaterVersionThan({major: 2})).to.equal(false);
        expect(version.isGreaterVersionThan({major: 1})).to.equal(false);
        expect(version.isGreaterVersionThan({major: 1, minor: 1})).to.equal(false);
        expect(version.isGreaterVersionThan({major: 1, minor: 1, patch: 1})).to.equal(false);
        expect(version.isGreaterVersionThan({major: 0, minor: 1, patch: 1})).to.equal(true);
        expect(version.isGreaterVersionThan({major: 1, minor: 0, patch: 0})).to.equal(false);
        expect(version.isGreaterVersionThan({major: 0, minor: 0, patch: 1})).to.equal(true);
        expect(version.isGreaterVersionThan({major: 1, minor: 0, patch: 1})).to.equal(false);
    });
});
