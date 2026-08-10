export interface ReferenceCard {
  id: string
  brand_name: string | null
  category: string
  summary: string
  description: string
  metrics: Record<string, string> | null
  image_urls: string[] | null
  is_public: boolean
  is_anonymous: boolean
  notion_page_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  sort_order: number
  campaign_type: '비딩형' | '추가미션'
}

export interface ReferenceCardFormData {
  brand_name: string
  category: string
  summary: string
  description: string
  metrics: { key: string; value: string }[]
  image_urls: string[]
  is_public: boolean
  is_anonymous: boolean
}

export const CATEGORIES = [
  '뷰티/화장품',
  '패션/의류',
  '식품/음료',
  '생활/가전',
  '건강/피트니스',
  '반려동물',
  '유아/아동',
  '스포츠/아웃도어',
  '디지털/IT',
  '기타',
] as const

export type Category = typeof CATEGORIES[number]
