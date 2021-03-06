import {describe, it} from 'mocha';
import {expect} from "chai";
import {BuildJobQueueRunner} from "../../src/util/jobQueueRunner";


describe('Queue Runner tests suite', function () {
    it('should complete all events', function (done) {
        let completed = 0;
        const runner = BuildJobQueueRunner(1);
        for (let i = 0; i < 10; i++) {
            runner.register(async () => {
                completed++;
            });
        }
        runner.wait().then(() => {
            expect(completed).to.equal(10);
            done();
        }).catch(done);
    });


    it('should complete all events with multiple runs allowed', function (done) {
        let completed = 0;
        const runner = BuildJobQueueRunner(5);
        for (let i = 0; i < 100; i++) {
            runner.register(async () => {
                completed++;
            });
        }
        runner.wait().then(() => {
            expect(completed).to.equal(100);
            done();
        }).catch(done);
    });
});
