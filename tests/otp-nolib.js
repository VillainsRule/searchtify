import crypto from 'crypto';

function De(e) {
    const t = e.map((e, t) => e ^ (t % 33 + 9));
    const joined = t.join('');
    const utf8Bytes = Buffer.from(joined, 'utf8');
    return utf8Bytes;
}

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

const raw = [12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54];
const secret = De(raw);
console.log(secret.buffer);
console.log(generateTOTP(secret));