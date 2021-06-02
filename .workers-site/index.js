import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler';

addEventListener('fetch', (event) => {
    try {
        event.respondWith(handleEvent(event));
    } catch (e) {
        event.respondWith(new Response('Internal Error', { status: 500 }));
    }
});

/* From: https://github.com/SukkaW/cloudflare-workers-async-google-analytics/blob/master/worker.js
 * Proxy Google Analytics
 */
async function sendDataToGa(event, url, uuid, user_agent, page_url) {
    const encode = (data) => encodeURIComponent(decodeURIComponent(data));

    const getReqHeader = (key) => event.request.headers.get(key);
    const getQueryString = (name) => url.searchParams.get(name);

    const reqParameter = {
        headers: {
            'Host': 'www.google-analytics.com',
            'User-Agent': user_agent,
            'Accept': getReqHeader('Accept'),
            'Accept-Language': getReqHeader('Accept-Language'),
            'Accept-Encoding': getReqHeader('Accept-Encoding'),
            'Cache-Control': 'max-age=0'
        }
    };

    const pvData = `tid=${encode(getQueryString('ga'))}&cid=${uuid}&dl=${encode(page_url)}&uip=${getReqHeader('CF-Connecting-IP')}&ua=${user_agent}&dt=${encode(getQueryString('dt'))}&de=${encode(getQueryString('de'))}&dr=${encode(getQueryString('dr'))}&ul=${getQueryString('ul')}&sd=${getQueryString('sd')}&sr=${getQueryString('sr')}&vp=${getQueryString('vp')}`;

    const perfData = `plt=${getQueryString('plt')}&dns=${getQueryString('dns')}&pdt=${getQueryString('pdt')}&rrt=${getQueryString('rrt')}&tcp=${getQueryString('tcp')}&srt=${getQueryString('srt')}&dit=${getQueryString('dit')}&clt=${getQueryString('clt')}`

    const pvUrl = `https://www.google-analytics.com/collect?v=1&t=pageview&${pvData}&z=${getQueryString('z')}`;
    const perfUrl = `https://www.google-analytics.com/collect?v=1&t=timing&${pvData}&${perfData}&z=${getQueryString('z')}`

    await fetch(pvUrl, reqParameter);
    await fetch(perfUrl, reqParameter);
}

/* From: https://github.com/SukkaW/cloudflare-workers-async-google-analytics/blob/master/worker.js
 * Proxy Google Analytics
 */
async function proxyGa(event) {
    const url = new URL(event.request.url);

    const getReqHeader = (key) => event.request.headers.get(key);

    const Referer = getReqHeader('Referer');
    const user_agent = getReqHeader('User-Agent');
    const ref_host = (() => {
        try {
            return new URL(Referer).hostname;
        } catch (e) {
            return ''
        }
    })();

    let needBlock = false;

    needBlock = (!ref_host || ref_host === '' || !user_agent || !url.search.includes('ga=UA-')) ? true : false;

    if (typeof AllowedReferrer !== 'undefined' && AllowedReferrer !== null && AllowedReferrer) {
      let _AllowedReferrer = AllowedReferrer;

      if (!Array.isArray(AllowedReferrer)) _AllowedReferrer = [_AllowedReferrer];
    
      const rAllowedReferrer = new RegExp(_AllowedReferrer.join('|'), 'g');

      needBlock = (!rAllowedReferrer.test(ref_host)) ? true : false;
      console.log(_AllowedReferrer, rAllowedReferrer, ref_host);
    }

    if (needBlock) {
        return new Response('403 Forbidden', {
            headers: { 'Content-Type': 'text/html' },
            status: 403,
            statusText: 'Forbidden'
        });
    }

    const getCookie = (name) => {
        const pattern = new RegExp('(^| )' + name + '=([^;]*)(;|$)');
        const r = (getReqHeader('cookie') || '').match(pattern);
        return (r !== null) ? unescape(r[2]) : null;
    };

    const createUuid = () => {
        let s = [];
        const hexDigits = '0123456789abcdef';
        for (let i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[14] = '4'; // bits 12-15 of the time_hi_and_version field to 0010
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01
        s[8] = s[13] = s[18] = s[23] = '-';

        return s.join('');
    };

    const _uuid = getCookie('uuid');
    const uuid = (_uuid) ? _uuid : createUuid();

    // To sent data to google analytics after response id finished
    event.waitUntil(sendDataToGa(event, url, uuid, user_agent, Referer));

    // Return an 204 to speed up: No need to download a gif
    let response = new Response(null, {
        status: 204,
        statusText: 'No Content'
    });

    if (!_uuid) response.headers.set('Set-Cookie', `uuid=${uuid}; Expires=${new Date((new Date().getTime() + 365 * 86400 * 30 * 1000)).toGMTString()}; Path='/';`);

    return response
}

async function proxyApi(event) {
  const getReqHeader = (key) => event.request.headers.get(key);

  let url = new URL(event.request.url);
  var host = '';
  if (url.pathname.startsWith('/disqus')) {
    host = 'disqus.com';
    url.hostname = host;
    url.pathname = '/api' + url.pathname.slice(7);
  } else if (url.pathname.startsWith('/gist')) {
    host = 'gist.github.com';
    url.hostname = host;
    url.pathname = url.pathname.slice(5);
  }

  let parameter = {
    headers: {
      'Host': host,
      'User-Agent': getReqHeader("User-Agent"),
      'Accept': getReqHeader("Accept"),
      'Accept-Language': getReqHeader("Accept-Language"),
      'Accept-Encoding': getReqHeader("Accept-Encoding"),
      'Connection': 'keep-alive',
      'Cache-Control': 'max-age=0'
    }
  };

  if (event.request.headers.has("Referer")) {
    parameter.headers.Referer = getReqHeader("Referer");
  }

  if (event.request.headers.has("Origin")) {
    parameter.headers.Origin = getReqHeader("Origin");
  }

  let response = await fetch(new Request(url, event.request), parameter);

  response = new Response(response.body, response);
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "*");

  return response;
}

async function handleEvent(event) {
    const url = new URL(event.request.url);
    const { origin, pathname: path, search } = new URL(event.request.url);
    let options = {};

    try {
        if (path.startsWith('/disqus') || path.startsWith('/gist')) {
            return proxyApi(event)
        }

        if (path.startsWith('/ga-proxy')) {
            return proxyGa(event)
        }

        // 将 `/index.html` 结尾的请求重定向至 `/`
        if (path.startsWith('/blog')) {
            return new Response(null, {
                status: 301,
                headers: {
                    Location: `${origin}${path.substring(5)}${search}`,
                    'Cache-Control': 'max-age=3600',
                },
            });
        }

        // 将 `/index.html` 结尾的请求重定向至 `/`
        if (path.endsWith('/index.html')) {
            return new Response(null, {
                status: 301,
                headers: {
                    Location: `${origin}${path.substring(0, path.length - 10)}${search}`,
                    'Cache-Control': 'max-age=3600',
                },
            });
        }

        // CSS 文件超长时间缓存
        if (path.startsWith('/css/')) {
            const response = await getAssetFromKV(event, {
                cacheControl: {
                    edgeTtl: 365 * 24 * 60 * 60,
                    browserTtl: 365 * 24 * 60 * 60,
                    cacheEverything: true,
                },
            });
            response.headers.set('cache-control', `public, max-age=${365 * 24 * 60 * 60}, immutable`);
            return response;
        }

        // 字体文件超长时间缓存
        if (path.endsWith('.woff') || path.endsWith('.woff2')) {
            const response = await getAssetFromKV(event, {
                cacheControl: {
                    edgeTtl: 30 * 24 * 60 * 60,
                    browserTtl: 30 * 24 * 60 * 60,
                    cacheEverything: true,
                },
            });
            response.headers.set('cache-control', `public, max-age=${30 * 24 * 60 * 60}, immutable`);
            return response;
        }

        // 图片文件超长时间缓存
        if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.ico')) {
            const response = await getAssetFromKV(event, {
                cacheControl: {
                    edgeTtl: 30 * 24 * 60 * 60,
                    browserTtl: 30 * 24 * 60 * 60,
                    cacheEverything: true,
                },
            });
            response.headers.set('cache-control', `public, max-age=${30 * 24 * 60 * 60}, immutable`);
            return response;
        }

        // 其余默认 4 小时 CDN 缓存、1 小时浏览器缓存
        const response = await getAssetFromKV(event, {
            cacheControl: {
                edgeTtl: 4 * 60 * 60,
                browserTtl: 60 * 60,
                cacheEverything: true,
            },
        });

        response.headers.set('X-XSS-Protection', '1; mode=block');

        // Server Push 样式文件
        if (response.headers.get("Content-Type").includes('text/html')) {
            response.headers.append('Link', '</css/main.min.3bcbe33ae5c46485bcebc6352fc91232f950eb735ccac53f81bd19d79251ba9c.css>; rel=preload; as=style');
        }

        return response;
    } catch (e) {
        // 未找到资源，返回 404 页面
        let notFoundResponse = await getAssetFromKV(event, {
            mapRequestToAsset: (req) => new Request(`${new URL(req.url).origin}/404.html`, req),
        });

        return new Response(notFoundResponse.body, { ...notFoundResponse, status: 404 });
    }
}
