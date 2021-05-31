import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler';

addEventListener('fetch', (event) => {
    try {
        event.respondWith(handleEvent(event));
    } catch (e) {
        event.respondWith(new Response('Internal Error', { status: 500 }));
    }
});

async function proxy(event) {
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
            return proxy(event)
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
            response.headers.append('Link', '</css/main.min.3e07042924f5f343751777161df11be0644abfc5b0c6b2a193c888cc048b16ed.css>; rel=preload; as=style');
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
