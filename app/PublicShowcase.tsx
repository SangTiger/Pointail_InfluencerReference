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
                style={{ background: '#e87ab8' }}>
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
    <div className="min-h-screen" style={{ background: '#f5f5f3', fontFamily: "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif" }}>

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
                style={{ background: '#e87ab8', borderRadius: 2 }}>
                {verifying ? '...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ① 메인 네비 */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e2e2de' }}>
        <div className="max-w-[1600px] mx-auto px-6" style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* 로고 */}
          <img src="/pointail_logo.png" alt="Pointail" style={{ height: 36, width: 'auto' }} />
          {/* 오른쪽 액션 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 2,
                border: '1px solid #f0a0c8', background: '#fff', color: '#e87ab8',
                cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.5 : 1,
                letterSpacing: '0.04em',
              }}>
              {syncing ? '동기화 중...' : '동기화'}
            </button>
            <button
              onClick={() => setShowPasswordModal(true)}
              style={{
                fontSize: 13, fontWeight: 700, padding: '7px 20px', borderRadius: 2,
                border: '1px solid #e87ab8', background: '#e87ab8', color: '#fff',
                cursor: 'pointer', letterSpacing: '0.04em',
              }}>
              편집
            </button>
          </div>
        </div>
      </nav>

      {/* ③ 필터 / 탭 바 */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e2de' }}>
        <div className="max-w-[1600px] mx-auto px-6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50 }}>
          {/* 캠페인 유형 탭 */}
          <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
            {(['전체', '비딩형', '추가미션'] as (CampaignType | '전체')[]).map(tab => (
              <button key={tab}
                onClick={() => { setActiveTab(tab); setFilter('전체') }}
                style={{
                  fontSize: 16, fontWeight: 700, paddingInline: 18, marginRight: 0,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: activeTab === tab ? '#e87ab8' : '#aaa',
                  borderBottom: activeTab === tab ? '2px solid #e87ab8' : '2px solid transparent',
                  transition: 'color 0.15s, border-color 0.15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                {tab}
                <span style={{ fontSize: 18, fontWeight: 800, color: activeTab === tab ? '#e87ab8' : '#ccc' }}>
                  {tab === '전체' ? cards.length : cards.filter(c => getCampaignType(c) === tab).length}
                </span>
              </button>
            ))}
          </div>
          {/* 카테고리 필터 칩 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                style={{
                  fontSize: 14, fontWeight: 700, padding: '5px 13px', borderRadius: 2, border: '1px solid',
                  borderColor: filter === cat ? '#e87ab8' : '#e2e2de',
                  background: filter === cat ? '#e87ab8' : '#fff',
                  color: filter === cat ? '#fff' : '#666',
                  cursor: 'pointer', letterSpacing: '0.02em', transition: 'all 0.12s',
                }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ⑤ 카드 그리드 */}
      <main className="max-w-[1600px] mx-auto px-6 pt-5 pb-16">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '120px 0', color: '#ccc', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            No results
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(card => <CampaignCard key={card.id} card={card} showTypeBadge={activeTab === '전체'} />)}
          </div>
        )}
      </main>

      <footer className="max-w-[1600px] mx-auto px-6 py-6" style={{ borderTop: '1px solid #e2e2de', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#bbb', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>Storelink · Campaign Reference</span>
        <span style={{ fontSize: 11, color: '#bbb' }}>{new Date().getFullYear()}</span>
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
    <article className="flex flex-col group" style={{ background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', borderRadius: 4, transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.14)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)' }}>
      {/* 미디어 영역 */}
      <div className="relative w-full overflow-hidden bg-white" style={{ aspectRatio: '9/16', maxHeight: 440 }}>
        {isEditing && (
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
        {/* 게시물 바로가기 버튼 */}
        {!isEditing && postUrl && (
          <a href={postUrl} target="_blank" rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              position: 'absolute', bottom: 8, right: 8, zIndex: 20,
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
              color: '#999', whiteSpace: 'nowrap',
            }}>
            게시물 바로가기
          </a>
        )}
      </div>
      {/* 메타 정보 */}
      <div style={{ padding: '8px 12px 8px 10px', borderTop: '1px solid #e8e8e4', borderBottom: '1px solid #e8e8e4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 2,
            background: type === '추가미션' ? '#e87ab8' : '#fff',
            color: type === '추가미션' ? '#fff' : '#e87ab8',
            border: type === '추가미션' ? '1px solid #e87ab8' : '1px solid #f0a0c8',
            whiteSpace: 'nowrap',
          }}>
            {type}
          </span>
          {card.category && (
            <span style={{ fontSize: 13, color: '#666', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
              #{card.category}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
