'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ReferenceCard } from '@/types'
import { createClient } from '@/lib/supabase/client'

type CampaignType = '비딩형' | '추가미션'

function getPlatform(card: ReferenceCard) {
  return card.metrics?.['플랫폼'] || '기타'
}
function getFollowers(card: ReferenceCard) {
  return Number(card.metrics?.['팔로워 수'] || 0)
}
function getQualityNum(card: ReferenceCard) {
  const q = card.metrics?.['퀄리티'] || ''
  const stars = (q.match(/★/g) || []).length
  if (stars > 0) return stars
  const map: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 }
  return map[q] || Number(q) || 0
}
function getPostUrl(card: ReferenceCard) {
  return card.metrics?.['게시물 URL'] || ''
}
function igEmbedUrl(url: string): string | null {
  const m = (url || '').match(/\/(p|reels?|tv)\/([A-Za-z0-9_-]+)/)
  if (!m) return null
  const type = m[1] === 'reels' ? 'reel' : m[1]
  return `https://www.instagram.com/${type}/${m[2]}/embed`
}
function fmt(n: number) {
  return n.toLocaleString('ko-KR')
}
function getCampaignType(card: ReferenceCard): CampaignType {
  return card.campaign_type ?? '비딩형'
}

function PlatformLogo({ platform, size = 'md' }: { platform: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-11 h-11'
  const iconSize = size === 'sm' ? 16 : 22
  if (platform === 'Instagram') {
    return (
      <div className={`${dim} rounded-xl flex-none flex items-center justify-center`}
        style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' }}>
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5"/>
          <circle cx="12" cy="12" r="5"/>
          <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/>
        </svg>
      </div>
    )
  }
  if (platform === 'X (Twitter)') {
    return (
      <div className={`${dim} rounded-xl flex-none flex items-center justify-center`} style={{ background: '#000' }}>
        <svg viewBox="0 0 24 24" width={iconSize - 2} height={iconSize - 2} fill="white">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </div>
    )
  }
  if (platform === 'Lips') {
    return (
      <div className={`${dim} rounded-xl flex-none overflow-hidden`}>
        <img src="/lips.png" alt="Lips" className="w-full h-full object-cover" />
      </div>
    )
  }
  if (platform === '@cosme') {
    return (
      <div className={`${dim} rounded-xl flex-none overflow-hidden`}>
        <img src="/cosme.png" alt="@cosme" className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`${dim} rounded-xl flex-none flex items-center justify-center bg-slate-400`}>
      <svg viewBox="0 0 24 24" width={iconSize - 2} height={iconSize - 2} fill="white">
        <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
      </svg>
    </div>
  )
}

interface Props { initialCards: ReferenceCard[] }

export default function PublicShowcase({ initialCards }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<ReferenceCard[]>(initialCards)
  const [activeTab, setActiveTab] = useState<CampaignType | '전체'>('전체')
  const [filter, setFilter] = useState('전체')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // 편집 모드
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editPassword, setEditPassword] = useState('')
  const [editCards, setEditCards] = useState<ReferenceCard[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  async function fetchCards() {
    const supabase = createClient()
    const { data } = await supabase
      .from('reference_cards')
      .select('*')
      .eq('is_public', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
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

  async function handlePasswordSubmit() {
    if (!passwordInput) return
    setVerifying(true)
    setPasswordError(false)
    try {
      const res = await fetch('/api/auth/edit-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      })
      if (res.ok) {
        setEditPassword(passwordInput)
        setPasswordInput('')
        setShowPasswordModal(false)
        setEditCards(cards.map((c, i) => ({
          ...c,
          sort_order: c.sort_order ?? i,
          campaign_type: c.campaign_type ?? '비딩형',
        })))
        setEditMode(true)
      } else {
        setPasswordError(true)
      }
    } catch {
      setPasswordError(true)
    } finally {
      setVerifying(false)
    }
  }

  function handleTypeChange(id: string, type: CampaignType) {
    setEditCards(prev => prev.map(c => c.id === id ? { ...c, campaign_type: type } : c))
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOver(index)
    if (dragIndex === null || dragIndex === index) return
    setEditCards(prev => {
      const next = [...prev]
      const [removed] = next.splice(dragIndex, 1)
      next.splice(index, 0, removed)
      return next
    })
    setDragIndex(index)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOver(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const items = editCards.map((c, i) => ({
        id: c.id,
        sort_order: i,
        campaign_type: getCampaignType(c),
      }))
      const res = await fetch('/api/cards/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: editPassword, items }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaveMsg('저장 완료!')
      await fetchCards()
      setEditMode(false)
      setEditPassword('')
    } catch {
      setSaveMsg('저장 실패')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  function handleCancel() {
    setEditMode(false)
    setEditPassword('')
    setEditCards([])
    setDragIndex(null)
  }

  // 일반 모드 계산
  const categories = useMemo(() => {
    const tabCards = activeTab === '전체' ? cards : cards.filter(c => getCampaignType(c) === activeTab)
    const all = tabCards.flatMap(c => (c.category || '').split(',').map(s => s.trim()).filter(Boolean))
    const counts: Record<string, number> = {}
    for (const cat of all) counts[cat] = (counts[cat] || 0) + 1
    const sorted = Array.from(new Set(all)).sort((a, b) => counts[b] - counts[a])
    return ['전체', ...sorted]
  }, [cards, activeTab])

  const filtered = useMemo(() => {
    return cards
      .filter(c => activeTab === '전체' || getCampaignType(c) === activeTab)
      .filter(c => filter === '전체' || (c.category || '').split(',').map(s => s.trim()).includes(filter))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }, [cards, activeTab, filter])

  // KPI
  const totalReach = cards.reduce((s, c) => s + getFollowers(c), 0)
  const avgQuality = cards.length ? cards.reduce((s, c) => s + getQualityNum(c), 0) / cards.length : 0
  const platformCnt = new Set(cards.map(getPlatform)).size
  const categoryCnt = new Set(cards.flatMap(c => (c.category || '').split(',').map(s => s.trim()).filter(Boolean))).size
  const kpis = [
    { label: '진행 캠페인',   value: cards.length,          unit: '건', foot: '기록된 레퍼런스' },
    { label: '평균 퀄리티',   value: avgQuality.toFixed(1), unit: '/5', foot: '콘텐츠 완성도' },
    { label: '누적 팔로워',   value: fmt(totalReach),       unit: '명', foot: '인플루언서 합산' },
    { label: '활용 플랫폼',   value: platformCnt,           unit: '개', foot: '채널 다양성' },
    { label: '제품 카테고리', value: categoryCnt,           unit: '개', foot: '제품군 다양성' },
  ]

  // ── 편집 모드 UI ──────────────────────────────────────────
  if (editMode) {
    return (
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif" }}>
        {/* 상단 편집 헤더 */}
        <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-black text-slate-900" style={{ fontSize: '1.4rem', letterSpacing: '-0.03em' }}>storelink.</span>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                편집 모드
              </span>
            </div>
            <div className="flex items-center gap-2">
              {saveMsg && (
                <span className={`text-sm font-semibold ${saveMsg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>
                  {saveMsg}
                </span>
              )}
              <button onClick={handleCancel}
                className="text-sm font-bold px-4 py-2 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 transition-all">
                취소
              </button>
              <button onClick={handleSave} disabled={saving}
                className="text-sm font-bold px-5 py-2 rounded-full text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-sm text-gray-400 mb-6 font-semibold">
            카드를 드래그해서 순서 변경 · 왼쪽 배지 클릭으로 유형 전환
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {editCards.map((card, index) => (
              <div
                key={card.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  opacity: dragIndex === index ? 0.4 : 1,
                  outline: dragOver === index && dragIndex !== index ? '2px solid #93c5fd' : 'none',
                  outlineOffset: '2px',
                  borderRadius: '16px',
                  cursor: dragIndex === index ? 'grabbing' : 'grab',
                }}
              >
                <CampaignCard
                  card={card}
                  isEditing
                  campaignType={getCampaignType(card)}
                  onTypeChange={(type) => handleTypeChange(card.id, type)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── 일반 모드 UI ──────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#ffffff', fontFamily: "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif" }}>

      {/* 비밀번호 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 mx-4">
            <h3 className="text-xl font-black text-slate-900 mb-1">편집 모드</h3>
            <p className="text-sm text-gray-500 mb-5">비밀번호를 입력하면 순서와 유형을 편집할 수 있습니다.</p>
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="비밀번호"
              autoFocus
              className="w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={passwordError
                ? { borderColor: '#f87171', background: '#fff7f7' }
                : { borderColor: '#e5e7eb' }
              }
            />
            {passwordError && (
              <p className="text-xs text-red-500 mt-1.5 font-semibold">비밀번호가 틀렸습니다.</p>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(false) }}
                className="flex-1 text-sm font-bold py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-gray-400 transition-all">
                취소
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={verifying || !passwordInput}
                className="flex-1 text-sm font-bold py-2.5 rounded-xl text-white disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
                {verifying ? '확인 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <header className="relative overflow-hidden pb-12 pt-20"
        style={{ background: 'linear-gradient(135deg,#e4edff 0%,#eeebff 40%,#faeeff 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-28 -top-28 w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(167,139,250,.2),transparent 60%)' }} />
          <div className="absolute -left-24 -bottom-32 w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(99,102,241,.15),transparent 60%)' }} />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6">
          <div className="mb-8">
            <span className="text-slate-900 tracking-tight" style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
              storelink.
            </span>
          </div>
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
        {/* 탭: 전체 / 비딩형 / 추가미션 */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {(['전체', '비딩형', '추가미션'] as (CampaignType | '전체')[]).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setFilter('전체') }}
              className="px-6 py-2.5 rounded-full font-black text-sm transition-all"
              style={activeTab === tab
                ? { background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,.3)' }
                : { background: '#f1f5f9', color: '#64748b' }
              }>
              {tab}
              <span className="ml-2 font-semibold opacity-70 text-xs">
                {tab === '전체' ? cards.length : cards.filter(c => getCampaignType(c) === tab).length}
              </span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowPasswordModal(true)}
              className="text-sm font-bold px-4 py-2 rounded-full border border-gray-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all shadow-sm">
              편집
            </button>
            <button onClick={handleSync} disabled={syncing}
              className="text-sm font-bold px-4 py-2 rounded-full border border-gray-200 bg-white text-slate-700 hover:border-slate-400 disabled:opacity-50 transition-all shadow-sm">
              {syncing ? '동기화 중...' : '동기화'}
            </button>
            {syncMsg && <span className="text-xs font-semibold text-green-600">{syncMsg}</span>}
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="text-sm font-semibold px-4 py-2 rounded-full border transition-all shadow-sm"
              style={filter === cat
                ? { background: '#eff6ff', color: '#475569', borderColor: '#93c5fd' }
                : { background: '#fff', color: '#475569', borderColor: '#e5e7eb' }
              }>
              {cat}
            </button>
          ))}
        </div>

        {/* 헤더 */}
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-2xl font-black text-slate-900">SNS 캠페인 레퍼런스</h2>
          <span className="text-sm text-gray-400 font-semibold">· {filtered.length}건</span>
        </div>

        {/* 카드 그리드 */}
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400 font-semibold">데이터 없음</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(card => <CampaignCard key={card.id} card={card} showTypeBadge={activeTab === '전체'} />)}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400">© STORELINK · 캠페인 레퍼런스 대시보드</div>
      </div>
    </div>
  )
}

// ── 카드 (일반 + 편집 겸용) ───────────────────────────────
function CampaignCard({
  card,
  isEditing = false,
  showTypeBadge = false,
  campaignType,
  onTypeChange,
}: {
  card: ReferenceCard
  isEditing?: boolean
  showTypeBadge?: boolean
  campaignType?: CampaignType
  onTypeChange?: (type: CampaignType) => void
}) {
  const postUrl = getPostUrl(card)
  const embedUrl = igEmbedUrl(postUrl)
  const type = campaignType || getCampaignType(card)

  return (
    <article className={`bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-md flex flex-col transition-all${!isEditing ? ' hover:-translate-y-1 hover:shadow-xl' : ''}`}>
      <div className="relative w-full overflow-hidden bg-black" style={{ height: 400 }}>
        {isEditing ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onTypeChange?.(type === '비딩형' ? '추가미션' : '비딩형') }}
              className="absolute top-2 left-2 z-20 text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm"
              style={type === '비딩형'
                ? { background: '#eff6ff', color: '#2563eb', borderColor: '#93c5fd' }
                : { background: '#fdf4ff', color: '#9333ea', borderColor: '#d8b4fe' }
              }>
              {type}
            </button>
            <div className="absolute top-2 right-2 z-20 bg-white/80 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm">
              <span className="text-gray-400 text-sm" style={{ fontFamily: 'monospace' }}>⠿</span>
            </div>
          </>
        ) : showTypeBadge && (
          <div
            className="absolute top-2 left-2 z-20 text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm pointer-events-none"
            style={type === '비딩형'
              ? { background: '#eff6ff', color: '#2563eb', borderColor: '#93c5fd' }
              : { background: '#fdf4ff', color: '#9333ea', borderColor: '#d8b4fe' }
            }>
            {type}
          </div>
        )}
        {embedUrl ? (
          <iframe
            src={embedUrl}
            loading="lazy"
            scrolling="no"
            {...(!postUrl.includes('/reel/') && { sandbox: 'allow-scripts allow-same-origin' })}
            className="absolute border-0"
            style={{
              top: -60, left: '50%', width: 326, height: 580,
              transform: 'translateX(-50%)',
              transformOrigin: 'top center',
              pointerEvents: isEditing ? 'none' : 'auto',
            }}
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
