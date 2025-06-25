const get = (url, params) => new Promise((r) => {
    const response = {};

    fetch(url, params).then((res) => {
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

const post = (url, body, params) => new Promise((r) => {
    const response = {};

    fetch(url, {
        method: 'POST',
        body: typeof body === 'object' ? JSON.stringify(body) : body,
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

export const axiosLike = { get, post };