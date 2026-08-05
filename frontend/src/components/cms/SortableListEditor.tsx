import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Pencil, Trash2, Loader2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ImageUploadField } from '@/components/ImageUploadField'
import * as cmsApi from '@/services/cmsApi'
import { uploadCmsImage } from '@/services/uploadApi'
import { getErrorMessage } from '@/services/api'
import type { CmsSection } from '@/types'

export type CmsFieldType = 'text' | 'textarea' | 'image' | 'select' | 'points'

export interface CmsFieldConfig<T> {
  key: keyof T & string
  label: string
  type: CmsFieldType
  options?: { value: string; label: string }[]
  placeholder?: string
}

interface Item {
  id: string
}

function emptyValues<T extends Item>(fields: CmsFieldConfig<T>[]) {
  const values: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.type === 'select') values[f.key] = f.options?.[0]?.value || ''
    else if (f.type === 'points') values[f.key] = ['', '', '']
    else values[f.key] = ''
  }
  return values
}

function FieldEditDialog<T extends Item>({
  item,
  fields,
  open,
  onOpenChange,
  onSave,
  saving,
  title,
}: {
  item?: T
  fields: CmsFieldConfig<T>[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: Record<string, unknown>) => void
  saving: boolean
  title: string
}) {
  const [values, setValues] = React.useState<Record<string, unknown>>(emptyValues(fields))

  React.useEffect(() => {
    if (open) {
      if (!item) {
        setValues(emptyValues(fields))
        return
      }
      const next: Record<string, unknown> = {}
      const itemRecord = item as unknown as Record<string, unknown>
      for (const f of fields) next[f.key] = itemRecord[f.key]
      setValues(next)
    }
  }, [open, item, fields])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(values)
          }}
        >
          {fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{f.label}</label>
              {f.type === 'text' && (
                <Input
                  autoFocus
                  placeholder={f.placeholder}
                  value={String(values[f.key] ?? '')}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
              {f.type === 'textarea' && (
                <Textarea
                  placeholder={f.placeholder}
                  value={String(values[f.key] ?? '')}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
              {f.type === 'select' && (
                <Select
                  value={String(values[f.key] ?? '')}
                  onValueChange={(v) => setValues((val) => ({ ...val, [f.key]: v }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {f.options?.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {f.type === 'image' && (
                <ImageUploadField
                  value={String(values[f.key] ?? '')}
                  onChange={(url) => setValues((v) => ({ ...v, [f.key]: url }))}
                  upload={uploadCmsImage}
                />
              )}
              {f.type === 'points' && (
                <div className="flex flex-col gap-1.5">
                  {[0, 1, 2].map((i) => {
                    const points = Array.isArray(values[f.key]) ? (values[f.key] as string[]) : ['', '', '']
                    return (
                      <Input
                        key={i}
                        placeholder={`Poin ${i + 1}`}
                        value={points[i] ?? ''}
                        onChange={(e) => {
                          const next = [...points]
                          next[i] = e.target.value
                          setValues((v) => ({ ...v, [f.key]: next }))
                        }}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SortableRow<T extends Item>({
  item,
  fields,
  primaryField,
  onEdit,
  onDelete,
}: {
  item: T
  fields: CmsFieldConfig<T>[]
  primaryField: keyof T & string
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const secondaryField = fields.find((f) => f.key !== primaryField && f.type !== 'image')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
    >
      <button
        type="button"
        className="text-muted-foreground cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{String(item[primaryField] ?? '')}</p>
        {secondaryField && (
          <p className="text-muted-foreground line-clamp-1 text-xs">{String(item[secondaryField.key] ?? '')}</p>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Trash2 className="text-destructive size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus item ini?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={onDelete}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Generic list-management UI reused across every array-based CMS section
// (nav links, services, FAQs, ...) — driven entirely by the `fields` config
// so each section only needs to describe its shape, not re-implement the
// list/dialog/delete/reorder wiring.
export function SortableListEditor<T extends Item>({
  section,
  title,
  emptyLabel,
  addLabel,
  fields,
  primaryField,
}: {
  section: CmsSection
  title: string
  emptyLabel: string
  addLabel: string
  fields: CmsFieldConfig<T>[]
  primaryField: keyof T & string
}) {
  const queryClient = useQueryClient()
  const queryKey = ['cms', section]
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<T | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => cmsApi.listSection<T>(section),
  })

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      editing
        ? cmsApi.updateItem<T>(section, editing.id, values as Partial<T>)
        : cmsApi.createItem<T>(section, values as Partial<T>),
    onSuccess: () => {
      toast.success(editing ? 'Item diperbarui' : 'Item ditambahkan')
      queryClient.invalidateQueries({ queryKey })
      setDialogOpen(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cmsApi.deleteItem(section, id),
    onSuccess: () => {
      toast.success('Item dihapus')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => cmsApi.reorderSection<T>(section, orderedIds),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<T[]>(queryKey)
      if (previous) {
        const byId = new Map(previous.map((item) => [item.id, item]))
        queryClient.setQueryData(
          queryKey,
          orderedIds.map((id) => byId.get(id)).filter(Boolean)
        )
      }
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      toast.error(getErrorMessage(err))
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
    },
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !data) return
    const oldIndex = data.findIndex((item) => item.id === active.id)
    const newIndex = data.findIndex((item) => item.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = [...data]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    reorderMutation.mutate(reordered.map((item) => item.id))
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-sm font-medium">{title}</h3>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="size-4" /> {addLabel}
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="px-0">
          {isLoading ? (
            <div className="space-y-3 px-4 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data?.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">{emptyLabel}</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={data?.map((i) => i.id) || []} strategy={verticalListSortingStrategy}>
                {data?.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    fields={fields}
                    primaryField={primaryField}
                    onEdit={() => {
                      setEditing(item)
                      setDialogOpen(true)
                    }}
                    onDelete={() => deleteMutation.mutate(item.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <FieldEditDialog
        item={editing}
        fields={fields}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={(values) => saveMutation.mutate(values)}
        saving={saveMutation.isPending}
        title={editing ? `Edit ${title}` : addLabel}
      />
    </div>
  )
}
