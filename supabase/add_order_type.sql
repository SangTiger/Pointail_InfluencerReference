-- 순서 및 캠페인 유형 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE public.reference_cards
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaign_type text DEFAULT '비딩형';

-- 기존 카드에 순서 부여 (생성일 기준)
WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1) AS rn
  FROM public.reference_cards
)
UPDATE public.reference_cards
SET sort_order = numbered.rn
FROM numbered
WHERE public.reference_cards.id = numbered.id;
