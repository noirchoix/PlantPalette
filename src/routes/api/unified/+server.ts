import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const backend = process.env.BACKEND_BASE_URL
    ? `${process.env.BACKEND_BASE_URL}/api/unified`
    : 'http://localhost:8000/api/unified';

  const res = await fetch(backend, { method: 'POST', body: form });
  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' }
  });
};
