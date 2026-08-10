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
    <div className="min-h-screen" style={{ background: '#f7f7f5', fontFamily: "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif" }}>

      {/* 비밀번호 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 w-80 mx-4" style={{ borderRadius: 4 }}>
            <h3 className="text-base font-bold text-black mb-1 tracking-tight">편집 모드</h3>
            <p className="text-xs text-gray-400 mb-5">비밀번호를 입력하세요.</p>
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="비밀번호"
              autoFocus
              className="w-full border px-3 py-2.5 text-sm outline-none transition-all"
              style={passwordError
                ? { borderColor: '#111', background: '#fafafa', borderRadius: 2 }
                : { borderColor: '#e0e0e0', borderRadius: 2 }
              }
            />
            {passwordError && (
              <p className="text-xs text-red-500 mt-1.5">비밀번호가 틀렸습니다.</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setShowPasswordModal(false); setPasswordInput(''); setPasswordError(false) }}
                className="flex-1 text-xs font-bold py-2.5 border border-gray-200 text-gray-500 hover:border-gray-400 transition-all"
                style={{ borderRadius: 2 }}>
                취소
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={verifying || !passwordInput}
                className="flex-1 text-xs font-bold py-2.5 text-white disabled:opacity-40 transition-all"
                style={{ background: '#111', borderRadius: 2 }}>
                {verifying ? '...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 헤더 */}
      <header style={{ borderBottom: '1px solid #e8e8e4', background: '#f7f7f5' }}>
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-end justify-between">
          {/* 좌: 브랜드 + 타이틀 */}
          <div>
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Storelink</div>
            <h1 style={{ fontSize: '2.6rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: '#111' }}>
              캠페인 레퍼런스
            </h1>
          </div>
          {/* 우: 카운트 + 버튼 */}
          <div className="flex items-end gap-6 pb-1">
            <div className="text-right">
              <div className="text-3xl font-black text-black" style={{ letterSpacing: '-0.03em' }}>{cards.length}</div>
              <div className="text-xs text-gray-400 font-semibold mt-0.5">캠페인</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowPasswordModal(true)}
                className="text-xs font-bold px-3 py-1.5 text-gray-500 hover:text-black transition-colors border border-transparent hover:border-gray-300"
                style={{ borderRadius: 2 }}>
                편집
              </button>
              <button onClick={handleSync} disabled={syncing}
                className="text-xs font-bold px-3 py-1.5 text-gray-500 hover:text-black transition-colors border border-transparent hover:border-gray-300 disabled:opacity-40"
                style={{ borderRadius: 2 }}>
                {syncing ? '동기화 중...' : '동기화'}
              </button>
              {syncMsg && <span className="text-xs text-green-600">{syncMsg}</span>}
            </div>
          </div>
        </div>

        {/* 탭 + 카테고리 필터 */}
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between">
            {/* 캠페인 유형 탭 */}
            <div className="flex">
              {(['전체', '비딩형', '추가미션'] as (CampaignType | '전체')[]).map(tab => (
                <button key={tab}
                  onClick={() => { setActiveTab(tab); setFilter('전체') }}
                  className="text-sm font-bold mr-8 py-3 transition-all"
                  style={{
                    color: activeTab === tab ? '#111' : '#aaa',
                    borderBottom: activeTab === tab ? '2px solid #111' : '2px solid transparent',
                  }}>
                  {tab}
                  <span className="ml-1.5 text-xs font-semibold" style={{ color: activeTab === tab ? '#555' : '#ccc' }}>
                    {tab === '전체' ? cards.length : cards.filter(c => getCampaignType(c) === tab).length}
                  </span>
                </button>
              ))}
            </div>
            {/* 카테고리 필터 */}
            <div className="flex items-center gap-1 pb-0.5">
              {categories.map(cat => (
                <button key={cat} onClick={() => setFilter(cat)}
                  className="text-xs font-bold px-3 py-1 transition-all"
                  style={{
                    color: filter === cat ? '#111' : '#aaa',
                    background: filter === cat ? '#111' : 'transparent',
                    color: filter === cat ? '#fff' : '#888',
                    borderRadius: 2,
                  }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* 카드 그리드 */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        {filtered.length === 0 ? (
          <div className="text-center py-32 text-gray-300 text-sm tracking-widest uppercase">No results</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(card => <CampaignCard key={card.id} card={card} showTypeBadge={activeTab === '전체'} />)}
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-8 py-8 flex items-center justify-between" style={{ borderTop: '1px solid #e8e8e4' }}>
        <span className="text-xs text-gray-300 tracking-widest uppercase">Storelink · Campaign Reference</span>
        <span className="text-xs text-gray-300">{new Date().getFullYear()}</span>
      </footer>
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

  const platform = getPlatform(card)

  return (
    <article className="flex flex-col group" style={{ background: '#fff' }}>
      {/* 미디어 영역 */}
      <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: 480 }}>
        {isEditing ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onTypeChange?.(type === '비딩형' ? '추가미션' : '비딩형') }}
              className="absolute top-2 left-2 z-20 text-xs font-bold px-2.5 py-1"
              style={{
                background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 2,
                backdropFilter: 'blur(4px)',
              }}>
              {type}
            </button>
            <div className="absolute top-2 right-2 z-20 px-2 py-1" style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 2, backdropFilter: 'blur(4px)' }}>
              <span className="text-white text-sm" style={{ fontFamily: 'monospace' }}>⠿</span>
            </div>
          </>
        ) : showTypeBadge && (
          <div
            className="absolute top-2 left-2 z-20 text-xs font-bold px-2.5 py-1 pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 2, backdropFilter: 'blur(4px)' }}>
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
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs bg-gray-900">
            미리보기 없음
          </div>
        )}
        {/* 호버 오버레이 */}
        {!isEditing && postUrl && (
          <a href={postUrl} target="_blank" rel="noopener noreferrer"
            className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.45)' }}>
            <span className="text-white text-xs font-bold tracking-widest uppercase border border-white px-4 py-2">
              View Post ↗
            </span>
          </a>
        )}
      </div>
      {/* 메타 정보 */}
      <div className="py-3 px-1 flex items-center justify-between" style={{ borderBottom: '1px solid #e8e8e4' }}>
        <div>
          <div className="text-xs font-bold text-black tracking-tight truncate" style={{ maxWidth: 160 }}>
            {card.brand_name || '—'}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{platform} · {card.category}</div>
        </div>
        <PlatformLogo platform={platform} size="sm" />
      </div>
    </article>
  )
}
