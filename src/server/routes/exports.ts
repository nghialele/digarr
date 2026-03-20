import { Hono } from 'hono'
import type { HonoEnv } from '@/server/types'
import type {
  ListRecommendationsFilters,
  ListRecommendationsResult,
} from '@/db/queries/recommendations'
import { exportToJson } from '@/core/targets/export-json'
import { exportToCsv } from '@/core/targets/export-csv'
import { exportToM3u } from '@/core/targets/export-m3u'
import type { ExportableRecommendation } from '@/core/targets/types'

type ExportDeps = {
  listRecommendations: (
    filters?: ListRecommendationsFilters,
  ) => Promise<ListRecommendationsResult>
}

const CONTENT_TYPES: Record<string, string> = {
  json: 'application/json',
  csv: 'text/csv',
  m3u: 'audio/x-mpegurl',
}

const EXPORTERS: Record<string, (recs: ExportableRecommendation[]) => string> = {
  json: exportToJson,
  csv: exportToCsv,
  m3u: exportToM3u,
}

export function exportRoutes(deps: ExportDeps) {
  const router = new Hono<HonoEnv>()

  router.get('/api/exports/:format', async (c) => {
    const format = c.req.param('format')
    if (!CONTENT_TYPES[format] || !EXPORTERS[format]) {
      return c.json(
        { error: `Unsupported format: ${format}. Use json, csv, or m3u` },
        400,
      )
    }

    const userId = c.get('userId')
    const query = c.req.query()
    const filters: ListRecommendationsFilters = {
      userId,
      limit: 10000, // Export all matching
      status: query.status,
      batchId: query.batchId ? Number(query.batchId) : undefined,
    }

    const result = await deps.listRecommendations(filters)

    const exportable: ExportableRecommendation[] = result.items.map((rec) => ({
      artistName: rec.artist?.name ?? 'Unknown',
      artistMbid: rec.artist?.mbid ?? '',
      genres: rec.artist?.genres ?? [],
      score: rec.score ?? 0,
      status: rec.status ?? 'pending',
      aiReasoning: rec.aiReasoning ?? undefined,
      imageUrl: rec.artist?.imageUrl ?? undefined,
      streamingUrls: rec.artist?.streamingUrls ?? {},
      createdAt:
        typeof rec.createdAt === 'string'
          ? rec.createdAt
          : new Date(rec.createdAt).toISOString(),
      suggestedAlbum: rec.recommendedReleaseGroupTitle ?? undefined,
    }))

    const output = EXPORTERS[format]!(exportable)
    const timestamp = new Date().toISOString().slice(0, 10)

    return new Response(output, {
      headers: {
        'Content-Type': CONTENT_TYPES[format]!,
        'Content-Disposition': `attachment; filename="digarr-export-${timestamp}.${format}"`,
      },
    })
  })

  return router
}
