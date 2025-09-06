import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const constantPath = path.join(import.meta.dirname, '..', 'src', 'constants.js');
if (fs.existsSync(constantPath)) fs.unlinkSync(constantPath);

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setBypassCSP(true);
    await page.setRequestInterception(true);

    page.on('request', request => {
        if (request.resourceType() === 'script') request.continue();
        else request.continue();
    });

    let foundSecret, foundTotpVer;

    page.on('response', async response => {
        const req = response.request();
        if (req.resourceType() === 'script') {
            try {
                const url = req.url();
                if (/^https?:/.test(url)) {
                    let body = await response.text();
                    if (body.includes('.defaults.counter}){')) {
                        body = body.replaceAll('.defaults.counter}){', '.defaults.counter}){console.log("SECRET:" + e.bytes.toString());');
                        await page.evaluate((scriptUrl, newScript) => {
                            const oldScript = Array.from(document.scripts).find(s => s.src === scriptUrl);
                            if (oldScript) {
                                oldScript.remove();
                                const s = document.createElement('script');
                                s.type = 'text/javascript';
                                s.textContent = newScript;
                                document.head.appendChild(s);
                            }
                        }, url, body);
                    }
                }
            } catch (e) { }
        }

        if (req.resourceType() === 'fetch') {
            try {
                const url = req.url();

                if (url.includes('totpVer=') && !foundTotpVer) {
                    const match = url.match(/totpVer=(\d+)/);
                    if (match) {
                        const totpVer = match[1];
                        console.log('found totpVer:', totpVer);

                        fs.appendFileSync(constantPath, `export const TOTP_VER = ${totpVer};\n`, 'utf-8');

                        foundTotpVer = true;
                        if (foundSecret) await browser.close();
                    }
                }
            } catch (e) { }
        }
    });

    page.on('console', async msg => {
        const text = msg.text();
        if (text.startsWith('SECRET:') && !foundSecret) {
            const secret = text.replace('SECRET:', '').replaceAll(',', ', ');
            console.log('found secret:', secret);

            fs.appendFileSync(constantPath, `export const SECRET = [${secret}];\n`, 'utf-8');

            foundSecret = true;
            if (foundTotpVer) await browser.close();
        }
    });

    await page.goto('https://open.spotify.com', { waitUntil: 'networkidle2' });
})();