import { Alert, Spinner } from '@heroui/react'
import { SearchX } from 'lucide-react'

export function CommandNotice({
  status,
  children,
}: {
  status: 'danger' | 'success' | 'default'
  children: string
}) {
  return (
    <Alert
      status={status}
      className="commands-alert"
      role={status === 'danger' ? 'alert' : 'status'}
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

export function CommandEmpty({
  title,
  detail,
  loading = false,
}: {
  title: string
  detail: string
  loading?: boolean
}) {
  return (
    <div className="utility-empty" role={loading ? 'status' : undefined}>
      <div className="commands-empty-icon" aria-hidden="true">
        {loading ? <Spinner size="sm" /> : <SearchX />}
      </div>
      <p>{title}</p>
      {detail && <span>{detail}</span>}
    </div>
  )
}
