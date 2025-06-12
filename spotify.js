import axios from 'axios';
import * as OTPAuth from 'otpauth';

class Spotify {
    constructor(customUserAgent = '') {
        this.customUserAgent = customUserAgent;
    }

    async getVariables() {
        const mainPage = await axios.get('https://open.spotify.com');
        this.deviceId = mainPage.headers['set-cookie'].find(h => h.startsWith('sp_t=')).split(';')[0].split('=')[1];

        const mainScript = mainPage.data.match(/<\/script><script src="(.*?)"/)[1];
        const scriptContent = await axios.get(mainScript);

        this.variables = {
            buildVer: scriptContent.data.match(/buildVer:"(.*?)"/)[1],
            buildDate: scriptContent.data.match(/buildDate:"(.*?)"/)[1],
            clientID: scriptContent.data.match(/clientID:"(.*?)"/)[1],
            clientVersion: scriptContent.data.match(/clientVersion:"(.*?)"/)[1],
            serverTime: mainPage.headers['x-timer'].match(/S([0-9]+)\./)[1]
        };

        return this.variables;
    }

    generateTOTP() {
        const De = function (e) {
            const t = e.map((e, t) => e ^ t % 33 + 9);
            const n = Buffer.from(t.join(''), 'utf8').toString('hex');
            return OTPAuth.Secret.fromHex(n);
        }([12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54]);

        const je = new OTPAuth.TOTP({
            period: 30,
            digits: 6,
            algorithm: 'SHA1',
            secret: De
        });

        return je.generate({ timestamp: Date.now() });
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
        params.append('totpVer', '5');
        params.append('sTime', this.variables.serverTime);
        params.append('cTime', Date.now().toString());
        params.append('buildVer', this.variables.buildVer);
        params.append('buildDate', this.variables.buildDate);

        urlBase.search = params.toString();

        const response = await axios.get(urlBase, {
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            }
        });

        this.accessToken = response.data;
    }

    async getClientToken() {
        if (!this.variables) await this.getVariables();

        this.deviceId = [
            this.deviceId.slice(0, 8),
            this.deviceId.slice(8, 12),
            this.deviceId.slice(12, 16),
            this.deviceId.slice(16, 20),
            this.deviceId.slice(20)
        ].join('-');

        const response = await axios.post('https://clienttoken.spotify.com/v1/clienttoken', {
            client_data: {
                client_version: this.variables.clientVersion,
                client_id: this.variables.clientID,
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
                'Content-Type': 'application/json'
            }
        });

        this.clientToken = response.data.granted_token;
    }

    async getHeaders() {
        if (!this.accessToken) await this.getAccessToken();
        if (!this.clientToken) await this.getClientToken();

        return {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en',
            'App-Platform': 'WebPlayer',
            'Authorization': `Bearer ${this.accessToken.accessToken}`,
            'Cache-Control': 'no-cache',
            'Client-Token': this.clientToken.token,
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

        const headers = {
            ...(await this.getHeaders())
        }

        let response = await axios.post(url.toString(), payload, {
            headers,
            validateStatus: () => true
        });

        return response.data.data.searchV2;
    }

    async getPopular(timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
        let response = await axios.post('https://api-partner.spotify.com/pathfinder/v2/query', {
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
        }, {
            headers: await this.getHeaders(),
            validateStatus: () => true
        });

        return response.data.data.home.sectionContainer.sections.items;
    }

    async getAlbum(uri) {
        let response = await axios.post('https://api-partner.spotify.com/pathfinder/v2/query', {
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
        }, {
            headers: await this.getHeaders(),
            validateStatus: () => true
        });

        return response.data.data.albumUnion;
    }

    async getArtist(uri) {
        let response = await axios.post('https://api-partner.spotify.com/pathfinder/v2/query', {
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
        }, {
            headers: await this.getHeaders(),
            validateStatus: () => true
        });

        return response.data.data.artistUnion;
    }
}

export default Spotify;
