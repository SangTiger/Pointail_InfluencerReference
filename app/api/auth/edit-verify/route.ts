import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { password } = await request.json()
  if (password === process.env.EDIT_PASSWORD) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
