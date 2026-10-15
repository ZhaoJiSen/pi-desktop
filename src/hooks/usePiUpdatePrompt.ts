import { useEffect, useRef, useState } from 'react'
import { isDesktop, useWorkspace } from '../store/workspace'
import {
  checkPiUpdate,
  claimPiUpdatePrompt,
  suppressPiUpdatePrompt,
  type PiUpdate,
} from '../lib/piUpdates'

export function usePiUpdatePrompt(ready: boolean, onboardingOpen: boolean, blocked: boolean) {
  const executable = useWorkspace((state) => state.piExecutable)
  const running = useWorkspace((state) => state.runningSessionId)
  const busyRuns = useWorkspace((state) => state.piBusyRuns)
  const connection = useWorkspace((state) => state.connection)
  const updating = useWorkspace((state) => state.piUpdating)
  const [guideSeen, setGuideSeen] = useState(onboardingOpen)
  const [candidate, setCandidate] = useState<{ path: string; update: PiUpdate } | null>(null)
  const [opened, setOpened] = useState(false)
  const claimed = useRef(false)
  useEffect(() => {
    if (!onboardingOpen) return
    void suppressPiUpdatePrompt()
      .catch(() => {})
      .finally(() => {
        setGuideSeen(true)
        setCandidate(null)
        setOpened(false)
      })
  }, [onboardingOpen])
  useEffect(() => {
    claimed.current = false
    if (!isDesktop || !ready || onboardingOpen || guideSeen) return
    let cancelled = false
    void checkPiUpdate(executable)
      .then((update) => {
        if (!cancelled) {
          setOpened(false)
          setCandidate(update?.hasUpdate ? { path: executable, update } : null)
        }
      })
      .catch(() => {
        if (!cancelled) setCandidate(null)
      })
    return () => {
      cancelled = true
    }
  }, [ready, onboardingOpen, executable, guideSeen])
  useEffect(() => {
    if (
      !candidate ||
      candidate.path !== executable ||
      !ready ||
      onboardingOpen ||
      blocked ||
      running ||
      busyRuns.length ||
      connection === 'connecting' ||
      updating
    )
      return
    let cancelled = false
    let checking = false
    const otherDialog = () =>
      [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].some(
        (element) => !element.closest('[data-pi-update-dialog]'),
      )
    const show = async () => {
      if (cancelled || checking || otherDialog()) return
      if (claimed.current) {
        setOpened(true)
        return
      }
      checking = true
      try {
        const allowed = await claimPiUpdatePrompt(executable)
        if (allowed && useWorkspace.getState().piExecutable === executable && !guideSeen) {
          claimed.current = true
          if (!cancelled && !otherDialog()) setOpened(true)
        } else if (!cancelled && !claimed.current) setCandidate(null)
      } catch {
        /* Background tasks or requests may still be settling. */
      } finally {
        checking = false
      }
    }
    const observer = new MutationObserver(() => {
      void show()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role'],
    })
    // Give the ready screen and the final session synchronization a chance to settle.
    const timer = setTimeout(() => {
      void show()
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [
    candidate,
    executable,
    ready,
    onboardingOpen,
    blocked,
    running,
    busyRuns,
    connection,
    updating,
    guideSeen,
  ])
  return {
    update:
      ready && !onboardingOpen && !guideSeen && opened && candidate?.path === executable
        ? candidate.update
        : null,
    dismiss: () => {
      setOpened(false)
      setCandidate(null)
    },
  }
}
