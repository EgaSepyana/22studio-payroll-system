import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const NONE = '__none__'

interface FieldShellProps {
  label: string
  hint?: string
  className?: string
}

function Shell({ label, hint, className, id, children }: FieldShellProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

export function NumField({
  label,
  value,
  onChange,
  step,
  hint,
  className,
}: FieldShellProps & { value: string; onChange: (value: string) => void; step?: string }) {
  const id = React.useId()
  return (
    <Shell id={id} label={label} hint={hint} className={className}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Shell>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  className,
  type = 'text',
}: FieldShellProps & { value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  const id = React.useId()
  return (
    <Shell id={id} label={label} hint={hint} className={className}>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Shell>
  )
}

export function NoteField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: FieldShellProps & { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const id = React.useId()
  return (
    <Shell id={id} label={label} className={className}>
      <Textarea id={id} rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Shell>
  )
}

export interface Option {
  value: string
  label: string
}

// `noneLabel` adds an empty choice (Radix Select can't hold an empty value,
// so it is mapped to a sentinel and back).
export function SelectField({
  label,
  value,
  onChange,
  options,
  noneLabel,
  hint,
  className,
  trailing,
}: FieldShellProps & {
  value: string
  onChange: (value: string) => void
  options: Option[]
  noneLabel?: string
  trailing?: React.ReactNode
}) {
  const id = React.useId()
  return (
    <Shell id={id} label={label} hint={hint} className={className}>
      <div className="flex items-center gap-2">
        <Select value={value === '' && noneLabel ? NONE : value} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
          <SelectTrigger id={id} className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {trailing}
      </div>
    </Shell>
  )
}
