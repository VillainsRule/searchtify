import Bun from 'bun';
import path from 'path';

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const BUNDLE_RE = /(?:vendor~web-player|encore~web-player|web-player)\.[0-9a-f]{4,}\.(?:js|mjs)/;
const TIMEOUT = 45000;

interface Capture {
    secret?: string;
    version?: string | number;
    obj?: {
        version?: string | number;
        [key: string]: any;
    };
}

function summarise(caps: Capture[]): void {
    const real: Record<string, string> = {};

    for (const cap of caps) {
        const sec = cap.secret;
        if (typeof sec !== 'string') continue;

        const ver = cap.version || (typeof cap.obj === 'object' && cap.obj !== null && cap.obj.version);
        if (ver == null) continue;

        real[String(ver)] = sec;
    }

    if (Object.keys(real).length === 0) return console.log('could not identify secrets in version :(');

    const sortedEntries = Object.entries(real).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    const formattedData = sortedEntries.map(([version, secret]) => ({ version: parseInt(version), secret }));

    const secretBytes = sortedEntries.map(([version, secret]) => ({
        version: parseInt(version),
        secret: Array.from(secret).map((c) => c.charCodeAt(0))
    }));

    Bun.write(path.join(import.meta.dirname, 'secrets.json'), JSON.stringify(formattedData, null, 2));
    Bun.write(path.join(import.meta.dirname, 'secretBytes.json'), JSON.stringify(secretBytes));

    console.log('formattedData', formattedData);
    console.log('secretBytes', secretBytes);
}

async function grabLive(): Promise<Capture[]> {
    const hook = `(()=>{if(globalThis.__secretHookInstalled)return;globalThis.__secretHookInstalled=true;globalThis.__captures=[];
Object.defineProperty(Object.prototype,'secret',{configurable:true,set:function(v){try{__captures.push({secret:v,version:this.version,obj:this});}catch(e){}
Object.defineProperty(this,'secret',{value:v,writable:true,configurable:true,enumerable:true});}});})();`;

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();

        await page.evaluateOnNewDocument(hook);

        page.on('response', (response) => {
            const url = response.url();
            const filename = url.split('/').pop() || '';
            if (BUNDLE_RE.test(filename)) {
                console.log(`${filename}: ${response.status()}`);
            }
        });

        console.log('opening Spotify...');

        await page.goto('https://open.spotify.com', {
            waitUntil: 'networkidle2',
            timeout: TIMEOUT,
        });

        await page.waitForTimeout(3000);

        const caps = (await page.evaluate(() => {
            return (globalThis as any).__captures || [];
        })) as Capture[];

        if (caps.length > 0) {
            for (const c of caps) {
                if (typeof c.secret === 'string' && c.version != null) {
                    console.log(`secret(${c.version}): ${c.secret}`);
                }
            }
        }

        return caps;
    } finally {
        await browser.close();
    }
}

async function main(): Promise<void> {
    try {
        const caps = await grabLive();
        summarise(caps);
    } catch (error) {
        console.error('error:', error);
        process.exit(1);
    }
}

main();
