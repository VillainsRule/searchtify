import crypto from 'crypto';

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

const secretBuffer = Buffer.from(new Uint8Array([
    49, 48, 48, 49, 49, 49, 56, 49, 49, 49, 49, 55, 57, 56, 50, 49, 50,
    51, 49, 50, 52, 54, 56, 56, 52, 54, 57, 51, 55, 56, 49, 51, 50, 54,
    52, 52, 50, 56, 49, 57, 57, 52, 55, 57, 50, 51, 54, 53, 51, 53, 57,
    49, 49, 51, 54, 52, 49, 48, 54, 50, 50, 49, 51, 49, 48, 55, 51, 48
]));

console.log(generateTOTP(secretBuffer));