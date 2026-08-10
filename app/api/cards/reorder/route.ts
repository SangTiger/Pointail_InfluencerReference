import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { password, items } = await request.json() as {
    password: string
    items: { id: string; sort_order: number; campaign_type: string }[]
  }

  if (password !== process.env.EDIT_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const results = await Promise.all(
    items.map(({ id, sort_order, campaign_type }) =>
      supabase
        .from('reference_cards')
        .update({ sort_order, campaign_type })
        .eq('id', id)
    )
  )

  const errors = results.filter(r => r.error)
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Partial failure', details: errors }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: items.length })
}
