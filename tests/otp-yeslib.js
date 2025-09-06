import * as OTPAuth from 'otpauth';
import { SECRET } from '../src/constants.js';

const je = new OTPAuth.TOTP({
    period: 30,
    digits: 6,
    algorithm: 'SHA1',
    secret: {
        'bytes': new Uint8Array(SECRET)
    }
});

console.log(je.generate({ timestamp: Date.now() }));