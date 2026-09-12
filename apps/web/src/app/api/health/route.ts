import { NextResponse } from 'next/server';

// Phase 1: minimal liveness check for the web process.
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
