import type { RequestEvent } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

// This endpoint proxies requests to the PlantNet API to keep the API key secret
// and avoid CORS issues. It forwards the form data (including the image file)
// from the client to the PlantNet backend and returns the response.
export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const backend = process.env.BACKEND_BASE_URL
  ? `${process.env.BACKEND_BASE_URL}/api/plantnet`
  : 'http://localhost:8000/api/plantnet';

  const res = await fetch(backend, {
    method: 'POST',
    body: form
  });

  // Pass through PlantNet/FastAPI response
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/json'
    }
  });
};
