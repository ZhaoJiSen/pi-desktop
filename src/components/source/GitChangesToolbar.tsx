import { Button, Dropdown } from '@heroui/react'
import {
  Columns2,
  Ellipsis,
  FileSymlink,
  PanelLeftClose,
  PanelLeftOpen,
  Rows3,
  Undo2,
} from 'lucide-react'
import { SourceAction } from './SourceAction'
import { SourceFilePath } from './SourceFilePath'
import type { useChangesPane } from './useChangesPane'

export function GitChangesToolbar({
  layoutRef,
  t,
  navigationCollapsed,
  setNavigationCollapsed,
  path,
  fallbackLabel,
  file,
  layout,
  toggleLayout,
  openFile,
  basic,
  restoring,
  confirmRestore,
}: Pick<
  ReturnType<typeof useChangesPane>,
  | 'layoutRef'
  | 't'
  | 'navigationCollapsed'
  | 'setNavigationCollapsed'
  | 'path'
  | 'file'
  | 'layout'
  | 'toggleLayout'
  | 'openFile'
  | 'restoring'
  | 'confirmRestore'
> & {
  fallbackLabel: string
  basic: boolean
}) {
  return (
    <div className="source-detail-bar source-preview-bar" ref={layoutRef}>
      <SourceAction
        label={t(navigationCollapsed ? 'source.showChangedFiles' : 'source.hideChangedFiles')}
        pressed={!navigationCollapsed}
        onPress={() => setNavigationCollapsed((value) => !value)}
      >
        {navigationCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </SourceAction>
      <div className="source-preview-identity">
        <SourceFilePath path={path ?? fallbackLabel} />
        {file && (
          <span className="diff-stats">
            <span className="positive">+{file.additions ?? 0}</span>
            <span className="negative">−{file.deletions ?? 0}</span>
          </span>
        )}
      </div>
      <span className="source-preview-inline-actions">
        <SourceAction
          label={layout === 'split' ? t('source.unified') : t('source.split')}
          pressed={layout === 'split'}
          onPress={toggleLayout}
        >
          {layout === 'split' ? <Columns2 /> : <Rows3 />}
        </SourceAction>
        <span className="source-preview-file-actions">
          {path && (
            <SourceAction label={t('source.openFile')} onPress={openFile}>
              <FileSymlink />
            </SourceAction>
          )}
          {!basic && file && file.code !== '?' && (
            <SourceAction
              label={t('source.restore')}
              isDisabled={restoring}
              onPress={confirmRestore}
            >
              <Undo2 />
            </SourceAction>
          )}
        </span>
      </span>
      <Dropdown>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="source-action source-preview-overflow"
          aria-label={t('source.fileActions')}
        >
          <Ellipsis />
        </Button>
        <Dropdown.Popover placement="bottom end" className="action-popover" offset={6}>
          <Dropdown.Menu
            aria-label={t('source.fileActions')}
            onAction={(key) => {
              if (key === 'layout') toggleLayout()
              else if (key === 'open') openFile()
              else if (key === 'restore') confirmRestore()
            }}
          >
            <Dropdown.Item
              id="layout"
              className="menu-row"
              textValue={layout === 'split' ? t('source.unified') : t('source.split')}
            >
              {layout === 'split' ? <Rows3 /> : <Columns2 />}
              {layout === 'split' ? t('source.unified') : t('source.split')}
            </Dropdown.Item>
            {path && (
              <Dropdown.Item id="open" className="menu-row" textValue={t('source.openFile')}>
                <FileSymlink />
                {t('source.openFile')}
              </Dropdown.Item>
            )}
            {!basic && file && file.code !== '?' && (
              <Dropdown.Item
                id="restore"
                className="menu-row source-discard-action"
                textValue={t('source.restore')}
                isDisabled={restoring}
              >
                <Undo2 />
                {t('source.restore')}
              </Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  )
}
