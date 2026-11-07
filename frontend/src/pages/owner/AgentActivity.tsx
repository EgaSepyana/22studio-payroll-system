import * as React from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MobileCardList, MobileCard, MobileCardRow } from '@/components/MobileCardList'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import * as ownerAgentActivityApi from '@/services/ownerAgentActivityApi'
import { formatDateTime } from '@/utils/format'
import type { AgentActivityEntry } from '@/types'

const ALL_AGENTS = '__all__'

function StatusBadge({ code }: { code: number }) {
  return <Badge variant={code >= 400 ? 'destructive' : 'secondary'}>{code}</Badge>
}

function MethodPath({ entry }: { entry: AgentActivityEntry }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{entry.method}</Badge>
      <span className="font-mono text-xs break-all">{entry.path}</span>
    </span>
  )
}

export default function OwnerAgentActivityPage() {
  const queryClient = useQueryClient()
  const [agent, setAgent] = React.useState(ALL_AGENTS)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['owner-agent-activity', agent],
    queryFn: () => ownerAgentActivityApi.getAgentActivity(agent === ALL_AGENTS ? undefined : agent),
    placeholderData: keepPreviousData,
  })

  const entries = data?.entries ?? []

  return (
    <div>
      <PageHeader
        title="Aktivitas Agent"
        description="Perubahan data yang dilakukan akun agent, terbaru di atas (hanya aksi tulis)"
        breadcrumbs={[{ label: 'Dashboard', to: '/owner' }, { label: 'Aktivitas Agent' }]}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['owner-agent-activity'] })}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} /> Refresh
          </Button>
        }
      />

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Semua agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_AGENTS}>Semua agent</SelectItem>
              {data?.agents.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Belum ada aktivitas agent.</p>
          ) : (
            <>
              <div className="hidden rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Waktu</TableHead>
                      <TableHead className="w-40">Agent</TableHead>
                      <TableHead>Aksi</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                      <TableHead>Ringkasan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">{formatDateTime(entry.created_at)}</TableCell>
                        <TableCell className="text-sm font-medium">{entry.username}</TableCell>
                        <TableCell>
                          <MethodPath entry={entry} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge code={entry.status_code} />
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate font-mono text-xs" title={entry.summary}>
                          {entry.summary || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileCardList>
                {entries.map((entry) => (
                  <MobileCard key={entry.id}>
                    <MobileCardRow label="Waktu">{formatDateTime(entry.created_at)}</MobileCardRow>
                    <MobileCardRow label="Agent">{entry.username}</MobileCardRow>
                    <MobileCardRow label="Aksi">
                      <MethodPath entry={entry} />
                    </MobileCardRow>
                    <MobileCardRow label="Status">
                      <StatusBadge code={entry.status_code} />
                    </MobileCardRow>
                    {entry.summary && (
                      <p className="text-muted-foreground mt-1 font-mono text-xs break-all">{entry.summary}</p>
                    )}
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
