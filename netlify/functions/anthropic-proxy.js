export default async req => {
  const url = new URL(req.url)
  const apiPath = url.pathname.replace('/api/anthropic', '')
  const apiUrl = `https://api.anthropic.com${apiPath}${url.search}`

  const response = await fetch(apiUrl, {
    method: req.method,
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: req.method !== 'GET' ? await req.text() : undefined,
  })

  const body = await response.text()
  return new Response(body, {
    status: response.status,
    headers: { 'content-type': 'application/json' },
  })
}

export const config = { path: '/api/anthropic/*' }
