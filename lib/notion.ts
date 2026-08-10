import { Client } from '@notionhq/client'

export function getNotionClient() {
  return new Client({ auth: process.env.NOTION_API_KEY })
}

export async function fetchNotionDatabase() {
  const notion = getNotionClient()
  const databaseId = process.env.NOTION_DATABASE_ID

  if (!databaseId) throw new Error('NOTION_DATABASE_ID is not set')

  const response = await notion.databases.query({
    database_id: databaseId,
  })

  return response.results
}

// SNS 캠페인 결과 관리 DB → reference_cards 매핑
// 노션 필드: 계정(title), 플랫폼(select), 팔로워 수(number), 카테고리(multi_select),
//           실행일(date), 게시물 URL(url), 비용/보수(number), 퀄리티(select), 메모(text), 컨택(checkbox)
export function mapNotionPageToCard(page: any) {
  const props = page.properties

  const getTitle = (prop: any) => prop?.title?.map((t: any) => t.plain_text || '').join('') || ''
  const getText = (prop: any) => prop?.rich_text?.[0]?.plain_text || ''
  const getSelect = (prop: any) => prop?.select?.name || ''
  const getMultiSelect = (prop: any) =>
    prop?.multi_select?.map((o: any) => o.name).join(', ') || ''
  const getNumber = (prop: any) => prop?.number ?? null
  const getUrl = (prop: any) => prop?.url || ''
  const getDate = (prop: any) => prop?.date?.start || ''

  const account = getTitle(props['계정'])
  const platform = getSelect(props['플랫폼'])
  const followers = getNumber(props['팔로워 수'])
  const category = getMultiSelect(props['카테고리']) || '기타'
  const quality = getSelect(props['퀄리티'])
  const cost = getNumber(props['비용/보수'])
  const memo = getText(props['메모'])
  const postUrl = getUrl(props['게시물 URL'])
  const executedAt = getDate(props['실행일'])
  const notionType = getSelect(props['유형'])
  const campaignType = notionType === '추가미션' ? '추가미션' : '비딩형'

  const metrics: Record<string, string> = {}
  if (platform) metrics['플랫폼'] = platform
  if (followers !== null) metrics['팔로워 수'] = String(followers)
  if (cost !== null) metrics['비용/보수'] = `¥${cost.toLocaleString()}`
  if (quality) metrics['퀄리티'] = quality
  if (executedAt) metrics['실행일'] = executedAt
  if (postUrl) metrics['게시물 URL'] = postUrl

  const summary = [platform, followers ? `${followers.toLocaleString()}명` : ''].filter(Boolean).join(' · ')

  return {
    notion_page_id: page.id,
    brand_name: account || null,
    category: category,
    summary: summary || account,
    description: memo,
    metrics,
    image_urls: [] as string[],
    is_public: true,
    is_anonymous: false,
    campaign_type: campaignType,
  }
}
