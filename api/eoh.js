const DEFAULT_BACKEND_BASE_URL = 'https://backend.eoh.io/api';
const API_PREFIX = '/api/eoh';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT',
        },
      });
    }

    const token = process.env.EOH_API_TOKEN || process.env.VITE_EOH_API_TOKEN;

    if (!token) {
      return jsonResponse(
        {
          detail: 'EOH_API_TOKEN is not configured in Vercel Environment Variables.',
        },
        500,
      );
    }

    const requestUrl = new URL(request.url);
    const backendBaseUrl = (process.env.EOH_API_BASE_URL || DEFAULT_BACKEND_BASE_URL).replace(/\/+$/, '');
    const backendPath = readBackendPath(requestUrl);
    const targetUrl = buildBackendUrl(backendBaseUrl, backendPath, requestUrl.searchParams);

    try {
      const headers = new Headers({
        Accept: 'application/json',
        Authorization: formatAuthorization(token),
      });
      const contentType = request.headers.get('content-type');

      if (contentType) {
        headers.set('Content-Type', contentType);
      }

      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: shouldSendBody(request.method) ? await request.arrayBuffer() : undefined,
        redirect: 'follow',
      });

      return new Response(response.body, {
        status: response.status,
        headers: copyResponseHeaders(response.headers),
      });
    } catch (error) {
      return jsonResponse(
        {
          detail: error instanceof Error ? error.message : 'Unable to reach EoH API.',
        },
        502,
      );
    }
  },
};

function readBackendPath(requestUrl) {
  const rewrittenPath = requestUrl.searchParams.get('path');

  if (rewrittenPath) {
    return normalizeBackendPath(rewrittenPath);
  }

  const directPath = requestUrl.pathname.startsWith(API_PREFIX)
    ? requestUrl.pathname.slice(API_PREFIX.length)
    : requestUrl.pathname;

  return normalizeBackendPath(directPath);
}

function normalizeBackendPath(path) {
  const trimmed = path.trim();

  if (!trimmed || trimmed === '/') {
    return '/';
  }

  return `/${trimmed.replace(/^\/+/, '')}`;
}

function buildBackendUrl(baseUrl, path, searchParams) {
  const query = new URLSearchParams(searchParams);
  query.delete('path');

  const queryString = query.toString();
  return `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
}

function copyResponseHeaders(headers) {
  const responseHeaders = new Headers();
  const contentType = headers.get('content-type');

  if (contentType) {
    responseHeaders.set('Content-Type', contentType);
  }

  responseHeaders.set('Cache-Control', 'no-store');
  return responseHeaders;
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function formatAuthorization(token) {
  return /^(token|bearer)\s+/i.test(token) ? token : `Token ${token}`;
}

function shouldSendBody(method) {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}
