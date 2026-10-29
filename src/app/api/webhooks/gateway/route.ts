import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/auth'
import { processGatewayWebhookService, GatewayError } from '@/lib/services/gateway.service'

export async function POST(req: Request) {
  const fields: Record<string, string> = {}

  try {
    const text = await req.text()
    const params = new URLSearchParams(text)
    for (const [key, value] of params.entries()) {
      fields[key] = value
    }
  } catch {
    return jsonError('Invalid urlencoded payload', 400)
  }

  try {
    const result = await processGatewayWebhookService(fields)
    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof GatewayError) {
      return jsonError(err.message, err.statusCode)
    }
    return jsonError('Internal server error', 500)
  }
}

