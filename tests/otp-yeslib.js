import * as OTPAuth from 'otpauth';

const je = new OTPAuth.TOTP({
    period: 30,
    digits: 6,
    algorithm: 'SHA1',
    secret: {
        'bytes': new Uint8Array([
            49, 48, 48, 49, 49, 49, 56, 49, 49, 49, 49, 55, 57, 56, 50, 49, 50,
            51, 49, 50, 52, 54, 56, 56, 52, 54, 57, 51, 55, 56, 49, 51, 50, 54,
            52, 52, 50, 56, 49, 57, 57, 52, 55, 57, 50, 51, 54, 53, 51, 53, 57,
            49, 49, 51, 54, 52, 49, 48, 54, 50, 50, 49, 51, 49, 48, 55, 51, 48
        ])
    }
});

console.log(je.generate({ timestamp: Date.now() }));