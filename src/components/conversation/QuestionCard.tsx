import { Button, Card } from '@heroui/react'
import { ArrowUp, Check, Circle, MessageCircleQuestion } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef } from 'react'
import { useT } from '../../lib/i18n'
import { useQuestions, type ChatQuestion } from './QuestionContext'

const MotionCard = motion.create(Card)

// The ask-user-question plugin reserves this row for verbatim custom replies.
// Match only its sentinel (including the RPC option number), not generic "Other" choices.
function isCustomAnswer(option: string) {
  return /^(?:\d+\.\s*)?Type something\.?$/i.test(option.trim())
}

export function QuestionCard({
  question,
  queued = false,
}: {
  question: ChatQuestion
  queued?: boolean
}) {
  const { request, status, sending, error } = question
  const { respond, updateDraft, focusRequest } = useQuestions()
  const card = useRef<HTMLDivElement>(null)
  const value = question.value ?? request.prefill ?? ''
  const selected = question.selected
  const title = useId()
  const input = useRef<HTMLTextAreaElement>(null)
  const t = useT()
  const reduced = useReducedMotion()
  const pending = status === 'pending'
  const disabled = sending || queued
  const select = request.method === 'select'
  const confirm = request.method === 'confirm'
  const option = request.options?.[selected ?? -1] || ''
  const custom = select && isCustomAnswer(option)
  const ready = confirm || (select && !custom ? selected !== undefined : Boolean(value.trim()))
  const answer = select && !custom ? option : value
  useEffect(() => {
    if (custom && pending && !disabled) input.current?.focus()
  }, [custom, pending, disabled])
  useEffect(() => {
    if (focusRequest?.key === question.key) {
      card.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
      card.current?.focus({ preventScroll: true })
    }
  }, [focusRequest, question.key])
  return (
    <MotionCard
      variant="transparent"
      className="chat-question"
      ref={card}
      tabIndex={-1}
      role="region"
      aria-labelledby={title}
      data-status={status}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Card.Header className="chat-question-heading">
        <MessageCircleQuestion aria-hidden="true" />
        <div>
          <Card.Title id={title}>{request.title}</Card.Title>
          <span className={pending && !queued ? 'chat-question-status-sr' : 'chat-question-status'}>
            {t(
              pending
                ? queued
                  ? 'question.queued'
                  : 'question.waiting'
                : status === 'answered'
                  ? 'question.answered'
                  : status === 'expired'
                    ? 'question.expired'
                    : status === 'unavailable'
                      ? 'question.unavailable'
                      : 'question.skipped',
            )}
          </span>
        </div>
      </Card.Header>
      <Card.Content className="chat-question-content">
        {request.message && <p className="chat-question-message">{request.message}</p>}
        {pending ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (ready && !disabled)
                void respond(
                  question,
                  confirm ? { confirmed: true } : { value: answer },
                  confirm ? t('question.confirmed') : answer,
                )
            }}
          >
            {select ? (
              <div className="chat-question-options" role="group" aria-labelledby={title}>
                {request.options?.map((option, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="chat-question-option"
                    aria-pressed={selected === index}
                    aria-controls={isCustomAnswer(option) && custom ? `${title}-custom` : undefined}
                    aria-expanded={isCustomAnswer(option) ? custom : undefined}
                    isDisabled={disabled}
                    onPress={() => updateDraft(question.key, { selected: index })}
                  >
                    <span className="chat-question-choice" aria-hidden="true">
                      {selected === index ? (
                        <motion.span
                          initial={reduced ? false : { scale: 0.65 }}
                          animate={{ scale: 1 }}
                        >
                          <Check />
                        </motion.span>
                      ) : (
                        <Circle />
                      )}
                    </span>
                    <span>{isCustomAnswer(option) ? t('question.customAnswer') : option}</span>
                  </Button>
                ))}
                {custom && (
                  <motion.div
                    className="chat-question-custom"
                    initial={reduced ? false : { opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.14 }}
                  >
                    <textarea
                      ref={input}
                      id={`${title}-custom`}
                      className="chat-question-input"
                      aria-label={t('question.customAnswer')}
                      placeholder={t('question.placeholder')}
                      value={value}
                      rows={2}
                      disabled={disabled}
                      onChange={(event) => updateDraft(question.key, { value: event.target.value })}
                    />
                  </motion.div>
                )}
              </div>
            ) : (
              !confirm && (
                <textarea
                  className="chat-question-input"
                  aria-labelledby={title}
                  placeholder={request.placeholder || t('question.placeholder')}
                  value={value}
                  rows={request.method === 'editor' ? 5 : 2}
                  disabled={disabled}
                  onChange={(event) => updateDraft(question.key, { value: event.target.value })}
                />
              )
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <Card.Footer className="chat-question-actions">
              <Button
                size="sm"
                variant="ghost"
                isDisabled={disabled}
                onPress={() =>
                  void respond(question, confirm ? { confirmed: false } : { cancelled: true })
                }
              >
                {t(confirm ? 'question.decline' : 'question.skip')}
              </Button>
              <Button
                size="sm"
                className="chat-question-submit"
                type="submit"
                isPending={sending}
                isDisabled={disabled || !ready}
              >
                {t(confirm ? 'question.confirm' : 'question.submit')}
                <ArrowUp aria-hidden="true" />
              </Button>
            </Card.Footer>
          </form>
        ) : (
          <motion.p
            className="chat-question-answer"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            role="status"
          >
            {status === 'answered' && <Check aria-hidden="true" />}
            {question.answer ||
              t(
                status === 'expired'
                  ? 'question.expiredHelp'
                  : status === 'unavailable'
                    ? 'question.unavailableHelp'
                    : 'question.skipped',
              )}
          </motion.p>
        )}
      </Card.Content>
    </MotionCard>
  )
}

/** Recovery and utility pages still need to answer Pi during initialization. */
export function PendingQuestions() {
  const { questions } = useQuestions()
  const first = questions.find((item) => item.status === 'pending')
  return first ? (
    <div className="question-recovery">
      <QuestionCard key={first.key} question={first} />
    </div>
  ) : null
}
