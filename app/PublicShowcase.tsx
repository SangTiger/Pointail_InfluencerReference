'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ReferenceCard } from '@/types'
import { createClient } from '@/lib/supabase/client'

const PF: Record<string, { color: string; badge: string; label: string; accent: string }> = {
  Instagram:    { color: '#e1306c', badge: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', label: 'IG', accent: '#e1306c' },
  'X (Twitter)':{ color: '#000000', badge: '#000000', label: 'X',  accent: '#000000' },
  Lips:         { color: '#1a0a0a', badge: '#C2185B', label: 'LP', accent: '#C2185B' },
  '@cosme':     { color: '#3DBDB0', badge: '#3DBDB0', label: 'AC', accent: '#3DBDB0' },
  기타:          { color: '#64748b', badge: '#94a3b8', label: '기타', accent: '#64748b' },
}

const qualityToNum: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1, '★': 1, '★★': 2, '★★★': 3, '★★★★': 4, '★★★★★': 5 }

function getPlatform(card: ReferenceCard): string {
  return card.metrics?.['플랫폼'] || '기타'
}
function getFollowers(card: ReferenceCard): number {
  return Number(card.metrics?.['팔로워 수'] || 0)
}
function getQualityNum(card: ReferenceCard): number {
  const q = card.metrics?.['퀄리티'] || ''
  const starCount = (q.match(/★/g) || []).length
  if (starCount > 0) return starCount
  return qualityToNum[q] || Number(q) || 0
}
function getPostUrl(card: ReferenceCard): string {
  return card.metrics?.['게시물 URL'] || ''
}
function getCost(card: ReferenceCard): string {
  return card.metrics?.['비용/보수'] || ''
}
function getExecutedAt(card: ReferenceCard): string {
  return card.metrics?.['실행일'] || ''
}
function igEmbedUrl(url: string): string | null {
  const m = (url || '').match(/\/(p|reels?|tv)\/([A-Za-z0-9_-]+)/)
  if (!m) return null
  const type = m[1] === 'reels' ? 'reel' : m[1]
  return `https://www.instagram.com/${type}/${m[2]}/embed`
}
function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}
function Stars({ q }: { q: number }) {
  return (
    <span className="text-base tracking-wide">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < q ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

function PlatformLogo({ platform }: { platform: string }) {
  if (platform === 'Instagram') {
    return (
      <div className="w-11 h-11 rounded-xl flex-none flex items-center justify-center"
        style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' }}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5"/>
          <circle cx="12" cy="12" r="5"/>
          <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/>
        </svg>
      </div>
    )
  }
  if (platform === 'X (Twitter)') {
    return (
      <div className="w-11 h-11 rounded-xl flex-none flex items-center justify-center" style={{ background: '#000' }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </div>
    )
  }
  if (platform === 'Lips') {
    return (
      <div className="w-11 h-11 rounded-xl flex-none overflow-hidden">
        <img src="/lips.png" alt="Lips" className="w-full h-full object-cover" />
      </div>
    )
  }
  if (platform === '@cosme') {
    return (
      <div className="w-11 h-11 rounded-xl flex-none overflow-hidden">
        <img src="/cosme.png" alt="@cosme" className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className="w-11 h-11 rounded-xl flex-none flex items-center justify-center bg-slate-400">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
        <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
      </svg>
    </div>
  )
}

interface Props { initialCards: ReferenceCard[] }

export default function PublicShowcase({ initialCards }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState(initialCards)
  const [filter, setFilter] = useState('전체')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  async function fetchCards() {
    const supabase = createClient()
    const { data } = await supabase
      .from('reference_cards')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
    if (data) setCards(data as ReferenceCard[])
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/notion-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setSyncMsg(`${data.upserted}건 동기화 완료`)
      await fetchCards()
      router.refresh()
    } catch {
      setSyncMsg('동기화 실패')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 4000)
    }
  }

  const categories = useMemo(() => {
    const all = cards.flatMap(c => (c.category || '').split(',').map(s => s.trim()).filter(Boolean))
    const counts: Record<string, number> = {}
    for (const cat of all) counts[cat] = (counts[cat] || 0) + 1
    const sorted = Array.from(new Set(all)).sort((a, b) => counts[b] - counts[a])
    return ['전체', ...sorted]
  }, [cards])

  const filtered = useMemo(() => {
    return cards
      .filter(c => filter === '전체' || (c.category || '').split(',').map(s => s.trim()).includes(filter))
      .sort((a, b) => getQualityNum(b) - getQualityNum(a) || getFollowers(b) - getFollowers(a))
  }, [cards, filter])

  // KPI 계산
  const totalReach   = cards.reduce((s, c) => s + getFollowers(c), 0)
  const avgQuality   = cards.length ? (cards.reduce((s, c) => s + getQualityNum(c), 0) / cards.length) : 0
  const platformCnt  = new Set(cards.map(getPlatform)).size
  const categoryCnt  = new Set(cards.flatMap(c => (c.category || '').split(',').map(s => s.trim()).filter(Boolean))).size

  const kpis = [
    { label: '진행 캠페인',      value: cards.length,          unit: '건',  dot: '#2563eb', foot: '기록된 레퍼런스' },
    { label: '평균 퀄리티',      value: avgQuality.toFixed(1), unit: '/5', dot: '#2563eb', foot: '콘텐츠 완성도' },
    { label: '누적 팔로워',      value: fmt(totalReach),       unit: '명',  dot: '#2563eb', foot: '인플루언서 합산' },
    { label: '활용 플랫폼',      value: platformCnt,           unit: '개',  dot: '#2563eb', foot: '채널 다양성' },
    { label: '제품 카테고리',    value: categoryCnt,           unit: '개',  dot: '#2563eb', foot: '제품군 다양성' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#ffffff', fontFamily: "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif" }}>

      {/* Hero */}
      <header className="relative overflow-hidden pb-36 pt-20"
        style={{ background: 'linear-gradient(135deg,#e4edff 0%,#eeebff 40%,#faeeff 100%)' }}>
        {/* 배경 장식 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-28 -top-28 w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(167,139,250,.2),transparent 60%)' }} />
          <div className="absolute -left-24 -bottom-32 w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(99,102,241,.15),transparent 60%)' }} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6">
          {/* 브랜드 + 태그 */}
          <div className="mb-8">
            <span className="text-slate-900 tracking-tight" style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-0.03em' }}>storelink.</span>
          </div>

          {/* 메인 카피 */}
          <div className="max-w-2xl">
            <h1 className="text-4xl font-black text-slate-900 leading-tight tracking-tight">
              검증된 인플루언서 레퍼런스로,<br />
              <span className="text-blue-600">캠페인의 성과를 증명합니다.</span>
            </h1>
            <p className="mt-4 text-slate-700 text-lg leading-relaxed font-semibold">
              스토어링크의 캠페인 성과를 정리했습니다.<br />
              퀄리티·규모·채널 다양성을 한눈에 확인하세요.
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-16">

        {/* KPI 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 -mt-16 relative z-10 mb-8">
          {kpis.map((k) => (
            <div key={k.label} className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 text-center">
              <div className="flex items-center justify-center gap-1.5 text-base text-gray-600 font-bold">
                {k.label}
              </div>
              <div className="text-2xl font-black mt-2 text-slate-900 tracking-tight">
                {k.value}<span className="text-sm font-bold text-gray-500 ml-0.5">{k.unit}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 font-semibold">{k.foot}</div>
            </div>
          ))}
        </div>

        {/* 필터 + 동기화 */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-2xl font-black text-slate-900">SNS 캠페인 레퍼런스</h2>
            <span className="text-sm text-gray-400 font-semibold">· {filtered.length}건</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map(cat => {
              const isSelected = filter === cat
              return (
                <button key={cat} onClick={() => setFilter(cat)}
                  className="text-sm font-semibold px-4 py-2 rounded-full border transition-all shadow-sm"
                  style={isSelected
                    ? { background: '#eff6ff', color: '#475569', borderColor: '#93c5fd' }
                    : { background: '#fff', color: '#475569', borderColor: '#e5e7eb' }
                  }>
                  {cat}
                </button>
              )
            })}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={handleSync} disabled={syncing}
                className="text-sm font-bold px-4 py-2 rounded-full border border-gray-200 bg-white text-slate-700 hover:border-slate-400 disabled:opacity-50 transition-all shadow-sm">
                동기화
              </button>
            </div>
          </div>
        </div>

        {/* 카드 그리드 */}
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400">데이터 없음</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(card => <CampaignCard key={card.id} card={card} />)}
          </div>
        )}

        <div className="mt-6 text-center text-xs text-gray-400">© STORELINK · 캠페인 레퍼런스 대시보드</div>
      </div>
    </div>
  )
}

function CampaignCard({ card }: { card: ReferenceCard }) {
  const platform = getPlatform(card)
  const pf = PF[platform] || PF['기타']
  const postUrl = getPostUrl(card)
  const embedUrl = igEmbedUrl(postUrl)

  return (
    <article className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-md hover:-translate-y-1 hover:shadow-xl transition-all flex flex-col">
      <div className="relative w-full overflow-hidden" style={{ height: 400 }}>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            loading="lazy"
            scrolling="no"
            {...(!postUrl.includes('/reel/') && { sandbox: 'allow-scripts allow-same-origin' })}
            className="absolute border-0"
            style={{ top: -60, left: '50%', width: 326, height: 580, transform: 'translateX(-50%)' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs text-center px-4 leading-relaxed bg-gray-100">
            미리보기를 불러올 수 없습니다<br />게시물 보기로 확인하세요
          </div>
        )}
      </div>
      <div className="px-4 py-3">
        {postUrl ? (
          <a href={postUrl} target="_blank" rel="noopener noreferrer"
            className="block text-center text-sm font-bold py-2.5 rounded-xl text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
            게시물 보기
          </a>
        ) : (
          <span className="block text-center text-sm font-bold py-2.5 rounded-xl bg-gray-100 text-gray-400">
            URL 없음
          </span>
        )}
      </div>
    </article>
  )
}
