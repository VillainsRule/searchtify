import crypto from 'node:crypto';
import { axiosLike } from './axiosLike.js';
import { SECRET, TOTP_VER } from './constants.js';

class Spotify {
    setUserAgent(userAgent) {
        this.customUserAgent = userAgent;
    }

    async login(sp_dcCookie) {
        if (!sp_dcCookie) throw new Error('specify the sp_dc cookie in logIn');
        this.cookie = sp_dcCookie;
        return await this.whoAmI();
    }

    async getVariables() {
        const mainPage = await axiosLike.get('https://open.spotify.com', {
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                cookie: this.cookie,
                'user-agent': this.customUserAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
            }
        });

        this.deviceId = mainPage.headers.getSetCookie().find(h => h.startsWith('sp_t=')).split(';')[0].split('=')[1];

        const mainScript = mainPage.data.match(/<\/script><script src="(.*?)"/)[1];
        const scriptContent = await axiosLike.get(mainScript);

        this.variables = {
            // spotify seems to have broken their own client...
            buildVer: 'unknown', // scriptContent.data.match(/buildVer:"(.*?)"/)?.[1],
            buildDate: 'unknown', // scriptContent.data.match(/buildDate:"(.*?)"/)?.[1],
            clientVersion: scriptContent.data.match(/clientVersion:"(.*?)"/)?.[1],
            serverTime: mainPage.headers.get('x-timer').match(/S([0-9]+)\./)?.[1]
        };

        return this.variables;
    }

    generateTOTP(timestamp = Date.now()) {
        const secretBuffer = Buffer.from(new Uint8Array(SECRET));

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

    async getAccessToken() {
        if (!this.variables) await this.getVariables();

        const urlBase = new URL('https://open.spotify.com/api/token');
        const params = new URLSearchParams();
        const totp = this.generateTOTP();

        params.append('reason', 'init');
        params.append('productType', 'web-player');
        params.append('totp', totp);
        params.append('totpServer', totp);
        params.append('totpVer', TOTP_VER.toString());
        // params.append('sTime', this.variables.serverTime);
        // params.append('cTime', Date.now().toString());
        // params.append('buildVer', this.variables.buildVer);
        // params.append('buildDate', this.variables.buildDate);
        // params.append('totpValidUntil', '');

        urlBase.search = params.toString();

        const response = await axiosLike.get(urlBase, {
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cookie': this.cookie
            }
        });

        if (response.data.error) {
            console.error('spotify patched searchtify yet again. here\'s how to fix:');
            console.error('1. ensure you have the latest version of searchtify installed');
            console.error('2. open an issue @ https://github.com/VillainsRule/searchtify');
            process.exit(1);
        }

        this.accessToken = response.data;
    }

    async getClientToken() {
        if (!this.variables) await this.getVariables();

        const response = await axiosLike.post('https://clienttoken.spotify.com/v1/clienttoken', {
            client_data: {
                client_version: this.variables.clientVersion,
                client_id: this.accessToken.clientId,
                js_sdk_data: {
                    device_brand: 'Apple',
                    device_model: 'unknown',
                    os: 'macos',
                    os_version: '10.15.7',
                    device_id: this.deviceId,
                    device_type: 'computer'
                }
            }
        }, {
            headers: {
                'Accept': 'application/json',
                'Cookie': this.cookie,
                'Content-Type': 'application/json'
            }
        });

        this.clientToken = response.data.granted_token;
        this.clientToken.refreshAt = Date.now() + 1209600;
    }

    async getHeaders() {
        if (!this.accessToken) await this.getAccessToken();
        // if (!this.clientToken) await this.getClientToken();

        if (this.accessToken.accessTokenExpirationTimestampMs - Date.now() <= 1) await this.getAccessToken();
        // if (this.clientToken.refreshAt <= Date.now()) await this.getClientToken();

        return {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en',
            'App-Platform': 'WebPlayer',
            'Authorization': `Bearer ${this.accessToken.accessToken}`,
            'Cache-Control': 'no-cache',
            // 'Client-Token': this.clientToken.token,
            'Content-Type': 'application/json;charset=UTF-8',
            'Origin': 'https://open.spotify.com',
            'Referer': 'https://open.spotify.com/',
            'Spotify-App-Version': this.variables.clientVersion,
            'User-Agent': this.customUserAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
        }
    }

    async search(query, opts = {}) {
        const url = new URL('https://api-partner.spotify.com/pathfinder/v2/query');

        const payload = {};

        payload.operationName = 'searchDesktop';

        const variables = opts;

        variables.searchTerm = query;

        if (!variables.offset) variables.offset = 0;
        if (!variables.limit) variables.limit = 10;
        if (!variables.numberOfTopResults) variables.numberOfTopResults = 5;
        if (!variables.includeAudiobooks) variables.includeAudiobooks = true;
        if (!variables.includeArtistHasConcertsField) variables.includeArtistHasConcertsField = false;
        if (!variables.includePreReleases) variables.includePreReleases = true;
        if (!variables.includeLocalConcertsField) variables.includeLocalConcertsField = false;
        if (!variables.includeAuthors) variables.includeAuthors = false;

        payload.variables = variables;

        payload.extensions = {
            persistedQuery: {
                version: 1,
                sha256Hash: 'd9f785900f0710b31c07818d617f4f7600c1e21217e80f5b043d1e78d74e6026'
            }
        };

        let response = await axiosLike.post(url.toString(), payload, { headers: await this.getHeaders() });
        return response.data.data.searchV2;
    }

    async getPopular(timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
        let response = await axiosLike.post('https://api-partner.spotify.com/pathfinder/v2/query', {
            operationName: 'home',
            variables: {
                timeZone: timezone,
                sp_t: this.deviceId,
                facet: '',
                sectionItemsLimit: 10
            },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: '72325e84c876c72564fb9ab012f602be8ef6a1fdd3039be2f8b4f2be4c229a30'
                }
            }
        }, { headers: await this.getHeaders() });

        return response.data.data.home.sectionContainer.sections.items;
    }

    async getAlbum(uri) {
        let response = await axiosLike.post('https://api-partner.spotify.com/pathfinder/v2/query', {
            operationName: 'getAlbum',
            variables: {
                uri: uri,
                locale: '',
                offset: 0,
                limit: 50
            },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: '97dd13a1f28c80d66115a13697a7ffd94fe3bebdb94da42159456e1d82bfee76'
                }
            }
        }, { headers: await this.getHeaders() });

        return response.data.data.albumUnion;
    }

    async getArtist(uri) {
        let response = await axiosLike.post('https://api-partner.spotify.com/pathfinder/v2/query', {
            operationName: 'queryArtistOverview',
            variables: {
                uri: uri,
                locale: ''
            },
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: '1ac33ddab5d39a3a9c27802774e6d78b9405cc188c6f75aed007df2a32737c72'
                }
            }
        }, { headers: await this.getHeaders() });

        return response.data.data.artistUnion;
    }

    isLoggedIn() {
        return this.accessToken?.isAnonymous;
    }

    async whoAmI() {
        try {
            const response = await axiosLike.post('https://api-partner.spotify.com/pathfinder/v2/query', {
                operationName: 'profileAttributes',
                variables: {},
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: '53bcb064f6cd18c23f752bc324a791194d20df612d8e1239c735144ab0399ced'
                    }
                }
            }, {
                headers: {
                    ...(await this.getHeaders()),
                    'Accept': 'application/json'
                },
            });

            return response.data.data.me.profile;
        } catch (error) {
            if (error.response?.data) return error.response.data;
            throw error;
        }
    }
}

export default Spotify;
