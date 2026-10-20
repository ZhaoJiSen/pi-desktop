import type { ReactNode } from 'react'

export function SettingsSection({
  id,
  title,
  hidden,
  children,
}: {
  id: string
  title: string
  hidden?: boolean
  children: ReactNode
}) {
  return (
    <section className="settings-section" aria-labelledby={id} hidden={hidden}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  )
}
