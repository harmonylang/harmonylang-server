import {describe, it} from 'mocha';
import request from 'supertest';
import {buildApp} from "../../src";

describe('Test compilation', () => {
    it('should pass basic endpoint', (done) => {
        const app = buildApp();
        request(app)
            .get('/')
            .expect(200, done)
    });

    it('should pass redirect to home page', (done) => {
        const app = buildApp();
        request(app)
            .get('/home')
            .expect(302, done)
    });

    // it('should compile Harmony files. Diners', function () {
    //     const app = buildApp();
    //     request(app)
    //         .post('/check')
    //         .attach("file", "[]")
    // });

});
