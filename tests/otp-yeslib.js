import * as OTPAuth from 'otpauth';

const De = function (e) {
    const t = e.map((e, t) => e ^ t % 33 + 9);
    const n = Buffer.from(t.join(''), 'utf8').toString('hex');
    return OTPAuth.Secret.fromHex(n);
}([12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54]);

console.log(De);

const je = new OTPAuth.TOTP({
    period: 30,
    digits: 6,
    algorithm: 'SHA1',
    secret: De
});

console.log(je.generate({ timestamp: Date.now() }));