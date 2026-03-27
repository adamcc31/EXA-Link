import { NextResponse } from 'next/server';

/**
 * Health check endpoint — GET /api/health
 * Endpoint publik untuk monitoring status sistem.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    },
    { status: 200 },
  );
}
