const handle = (method, url, body, params) => new Promise((r) => {
    const response = {};

    const body2 = body ? { body: typeof body === 'object' ? JSON.stringify(body) : body } : {};

    fetch(url, {
        method,
        ...body2,
        ...params
    }).then((res) => {
        response.headers = res.headers;
        response.status = res.status;
        response.statusText = res.statusText;

        res.text().then((text) => {
            try {
                response.data = JSON.parse(text);
            } catch {
                response.data = text;
            }
            r(response);
        });
    });
});

const get = (url, params) => handle('GET', url, null, params);
const post = (url, body, params) => handle('POST', url, body, params);

export const axiosLike = { get, post };