import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');
  if (!ip) {
    return NextResponse.json({ error: 'Missing IP address' }, { status: 400 });
  }

  const url = `http://${ip}/data`;
  // Use AbortController for timeout
  const controller = new AbortController();
  const signal = controller.signal;
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal,
      cache: 'no-store',
    });
    if (timeoutId) clearTimeout(timeoutId);
    if (!res.ok) {
      return NextResponse.json({ error: `ESP32 responded with status ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    // Pass through CORS headers if present
    const corsHeaders: Record<string, string> = {};
    const allowOrigin = res.headers.get('Access-Control-Allow-Origin');
    if (allowOrigin) corsHeaders['Access-Control-Allow-Origin'] = allowOrigin;
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        ...corsHeaders,
      },
    });
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'Timeout: ESP32 did not respond within 5 seconds.' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to fetch from ESP32: ' + err.message }, { status: 502 });
  }
}
