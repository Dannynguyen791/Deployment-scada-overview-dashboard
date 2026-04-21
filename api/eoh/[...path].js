const DEFAULT_BACKEND_BASE_URL = 'https://backend.eoh.io/api';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT');
    res.status(204).end();
    return;
  }

  const token = process.env.EOH_API_TOKEN || process.env.VITE_EOH_API_TOKEN;

  if (!token) {
    res.status(500).json({
      detail: 'EOH_API_TOKEN is not configured in Vercel Environment Variables.',
    });
    return;
  }

  const backendBaseUrl = (process.env.EOH_API_BASE_URL || DEFAULT_BACKEND_BASE_URL).replace(/\/+$/, '');
  const incomingUrl = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
  const backendPath = incomingUrl.pathname.replace(/^\/api\/eoh/, '') || '/';
  const targetUrl = `${backendBaseUrl}${backendPath}${incomingUrl.search}`;

  try {
    const headers = {
      Accept: 'application/json',
      Authorization: formatAuthorization(token),
    };

    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: shouldSendBody(req.method) ? normalizeBody(req.body) : undefined,
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type');

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const body = await response.text();
    res.status(response.status).send(body);
  } catch (error) {
    res.status(502).json({
      detail: error instanceof Error ? error.message : 'Unable to reach EoH API.',
    });
  }
};

function formatAuthorization(token) {
  return /^(token|bearer)\s+/i.test(token) ? token : `Token ${token}`;
}

function shouldSendBody(method) {
  return !['GET', 'HEAD'].includes((method || 'GET').toUpperCase());
}

function normalizeBody(body) {
  if (body == null) {
    return undefined;
  }

  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    return body;
  }

  return JSON.stringify(body);
}
