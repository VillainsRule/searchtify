import crypto from 'crypto';

const SECRET = []; // add secret bytes to test

function generateTOTP(secretBuffer, timestamp = Date.now()) {
    const digits = 6;
    const timeStep = 30;
    const time = Math.floor(timestamp / 1000 / timeStep);

    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(time));

    const hmac = crypto.createHmac('sha1', secretBuffer).update(counter).digest();
    const offset = hmac[hmac.length - 1] & 0xf;

    const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    ) % 10 ** digits;

    return code.toString().padStart(digits, '0');
}

const secretBuffer = Buffer.from(new Uint8Array(SECRET));

console.log(generateTOTP(secretBuffer));