// The Wonder Pocket question panel: one question at a time, no timer, accessible controls for
// every interaction type, optional hint and read-aloud, and feedback that stays until Continue.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Question } from '../../content/schema.ts';
import { evaluate, shuffled, type Answer, type Evaluation } from '../../learning/engine.ts';
import { Diagram, formula } from './Diagram.tsx';
import { Pip } from './Characters.tsx';

export interface PanelResult {
  question: Question;
  correct: boolean;
  hinted: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  questions: Question[];
  narration: boolean;
  onAnswer(r: PanelResult): void;
  onDone(results: PanelResult[]): void;
  /** Optional close for explorer mode. */
  onExit?(): void;
  seed: number;
  modal?: boolean;
}

function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    /* narration is optional */
  }
}

export function QuestionPanel(p: Props) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<PanelResult[]>([]);
  const q = p.questions[index];
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  // Trap focus inside the modal panel.
  useEffect(() => {
    if (!p.modal) return;
    const el = panelRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, summary, [tabindex="0"], h2[tabindex]')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [p.modal]);

  if (!q) return null;
  const body = (
    <div class="qpanel panel" ref={panelRef} role={p.modal ? 'dialog' : 'region'} aria-modal={p.modal ? 'true' : undefined} aria-labelledby="q-title">
      <div class="qpanel-head">
        <Pip size={48} />
        <div>
          <div class="qpanel-kicker">{p.title}</div>
          {p.subtitle && <div class="qpanel-sub">{p.subtitle}</div>}
        </div>
        <span class="chip" aria-label={`Question ${index + 1} of ${p.questions.length}`}>{index + 1} / {p.questions.length}</span>
        {p.onExit && (
          <button class="btn ghost small" onClick={p.onExit}>Close</button>
        )}
      </div>
      <QuestionView
        key={q.id}
        q={q}
        seed={p.seed + index}
        headingRef={headingRef}
        narration={p.narration}
        onAnswered={(r) => {
          p.onAnswer(r);
          setResults((rs) => [...rs, r]);
        }}
        onContinue={() => {
          if (index + 1 < p.questions.length) setIndex(index + 1);
          else p.onDone(results);
        }}
        last={index + 1 >= p.questions.length}
      />
    </div>
  );
  return p.modal ? <div class="modal-backdrop question-backdrop">{body}</div> : body;
}

interface ViewProps {
  q: Question;
  seed: number;
  narration: boolean;
  headingRef: preact.RefObject<HTMLHeadingElement>;
  onAnswered(r: PanelResult): void;
  onContinue(): void;
  last: boolean;
}

function QuestionView({ q, seed, narration, headingRef, onAnswered, onContinue, last }: ViewProps) {
  const [hinted, setHinted] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [result, setResult] = useState<Evaluation | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const choiceOrder = useMemo(() => ('choices' in q ? shuffled(q.choices, seed) : []), [q.id]);
  const itemOrder = useMemo(() => (q.type === 'order' || q.type === 'classify' ? shuffled(q.items, seed + 3) : []), [q.id]);
  const rightOrder = useMemo(() => (q.type === 'match' ? shuffled(q.right, seed + 5) : []), [q.id]);

  // Order questions start with the shuffled order as the current answer.
  useEffect(() => {
    if (q.type === 'order') setAnswer({ type: 'order', order: itemOrder.map((i) => i.id) });
    if (q.type === 'classify') setAnswer({ type: 'classify', bins: {} });
    if (q.type === 'match') setAnswer({ type: 'match', pairs: {} });
    if (q.type === 'multi') setAnswer({ type: 'multi', choices: [] });
  }, [q.id]);

  useEffect(() => {
    if (narration) {
      const choices = 'choices' in q ? ` Choices: ${choiceOrder.map((c, i) => `${String.fromCharCode(65 + i)}, ${c.text}`).join('. ')}` : '';
      speak(q.accessiblePrompt + choices);
    }
  }, [q.id, narration]);

  const answered = result !== null;

  const ready = (() => {
    if (!answer) return false;
    switch (answer.type) {
      case 'single':
        return !!answer.choice;
      case 'multi':
        return answer.choices.length > 0;
      case 'order':
        return true;
      case 'classify':
        return q.type === 'classify' && q.items.every((i) => answer.bins[i.id]);
      case 'match':
        return q.type === 'match' && q.left.every((i) => answer.pairs[i.id]);
      case 'numeric':
        return Number.isFinite(answer.value);
    }
  })();

  const submit = () => {
    if (!answer || answered) return;
    const ev = evaluate(q, answer);
    setResult(ev);
    onAnswered({ question: q, correct: ev.correct, hinted });
    setTimeout(() => feedbackRef.current?.focus(), 30);
    if (narration) speak((ev.correct ? 'Correct. ' : 'Not quite. ') + q.explanation);
  };

  return (
    <div class="qview">
      <h2 id="q-title" tabIndex={-1} ref={headingRef} class="q-prompt">
        {formula(q.prompt)}
      </h2>
      <p class="visually-hidden">{q.accessiblePrompt}</p>
      {(q.units || q.conditions) && (
        <p class="q-conditions">
          {q.conditions && <span>Conditions: {q.conditions}. </span>}
          {q.units && <span>Units: {q.units}.</span>}
        </p>
      )}
      {q.diagram && <Diagram d={q.diagram} />}

      {(q.type === 'single' || q.type === 'multi') && (
        <fieldset class="choices" disabled={answered}>
          <legend class="visually-hidden">{q.type === 'multi' ? 'Select all that apply' : 'Choose one answer'}</legend>
          {choiceOrder.map((c, i) => {
            const checked = answer?.type === 'single' ? answer.choice === c.id : answer?.type === 'multi' ? answer.choices.includes(c.id) : false;
            const isKey = q.type === 'single' ? q.answer === c.id : q.answer.includes(c.id);
            const cls = answered ? (isKey ? 'choice key' : checked ? 'choice wrong' : 'choice') : checked ? 'choice selected' : 'choice';
            return (
              <label class={cls}>
                <input
                  type={q.type === 'multi' ? 'checkbox' : 'radio'}
                  name={`q-${q.id}`}
                  checked={checked}
                  onChange={() => {
                    if (q.type === 'single') setAnswer({ type: 'single', choice: c.id });
                    else {
                      const cur = answer?.type === 'multi' ? answer.choices : [];
                      setAnswer({ type: 'multi', choices: cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id] });
                    }
                  }}
                />
                <span class="choice-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                <span class="choice-text">{formula(c.text)}</span>
                {answered && (isKey || checked) && <span class="choice-why">{isKey ? '✓ ' : ''}{formula(c.rationale)}</span>}
              </label>
            );
          })}
        </fieldset>
      )}

      {q.type === 'order' && answer?.type === 'order' && (
        <div class="order-list" role="group" aria-label={`Put in order from ${q.ends[0]} to ${q.ends[1]}`}>
          <div class="order-end">{q.ends[0]}</div>
          <ol>
            {answer.order.map((id, i) => {
              const it = q.items.find((x) => x.id === id)!;
              const ok = result?.parts[q.answer[i]] && q.answer[i] === id;
              const move = (dir: -1 | 1) => {
                const o = [...answer.order];
                const j = i + dir;
                if (j < 0 || j >= o.length) return;
                [o[i], o[j]] = [o[j], o[i]];
                setAnswer({ type: 'order', order: o });
              };
              return (
                <li class={answered ? (ok ? 'order-item key' : 'order-item wrong') : 'order-item'}>
                  <span class="order-pos">{i + 1}</span>
                  <span class="order-text">{formula(it.text)}</span>
                  {!answered && (
                    <span class="order-btns">
                      <button class="icon-btn" aria-label={`Move "${it.text}" earlier`} disabled={i === 0} onClick={() => move(-1)}>▲</button>
                      <button class="icon-btn" aria-label={`Move "${it.text}" later`} disabled={i === answer.order.length - 1} onClick={() => move(1)}>▼</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <div class="order-end">{q.ends[1]}</div>
          {answered && !result!.correct && (
            <div class="order-answer">
              <strong>One correct order:</strong>
              <ol>{q.answer.map((id) => { const it = q.items.find((x) => x.id === id)!; return <li>{formula(it.text)} <small>— {formula(it.rationale)}</small></li>; })}</ol>
            </div>
          )}
        </div>
      )}

      {q.type === 'classify' && answer?.type === 'classify' && (
        <div class="classify" role="group" aria-label="Sort each item into a group">
          {itemOrder.map((it) => (
            <div class={answered ? (result!.parts[it.id] ? 'cls-row key' : 'cls-row wrong') : 'cls-row'}>
              <span class="cls-text" id={`cls-${it.id}`}>{formula(it.text)}</span>
              <span class="cls-bins" role="radiogroup" aria-labelledby={`cls-${it.id}`}>
                {q.bins.map((b, bi) => {
                  // One tab stop per row (the chosen bin, or the first); arrows move and choose.
                  const chosen = answer.bins[it.id];
                  const tabbable = chosen ? chosen === b.id : bi === 0;
                  return (
                    <button
                      role="radio"
                      aria-checked={chosen === b.id}
                      tabIndex={tabbable ? 0 : -1}
                      class={chosen === b.id ? 'bin on' : 'bin'}
                      disabled={answered}
                      onClick={() => setAnswer({ type: 'classify', bins: { ...answer.bins, [it.id]: b.id } })}
                      onKeyDown={(e) => {
                        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                        if (!step) return;
                        e.preventDefault();
                        const next = q.bins[(bi + step + q.bins.length) % q.bins.length];
                        setAnswer({ type: 'classify', bins: { ...answer.bins, [it.id]: next.id } });
                        const el = (e.currentTarget as HTMLElement).parentElement?.children[(bi + step + q.bins.length) % q.bins.length] as HTMLElement | undefined;
                        el?.focus();
                      }}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </span>
              {answered && (
                <span class="choice-why">
                  {result!.parts[it.id] ? '✓ ' : `→ ${q.bins.find((b) => b.id === q.answer[it.id])?.label}: `}
                  {formula(it.rationale)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {q.type === 'match' && answer?.type === 'match' && (
        <div class="match" role="group" aria-label="Match each item">
          {q.left.map((it) => (
            <label class={answered ? (result!.parts[it.id] ? 'match-row key' : 'match-row wrong') : 'match-row'}>
              <span class="match-left">{formula(it.text)}</span>
              <select
                disabled={answered}
                value={answer.pairs[it.id] ?? ''}
                onChange={(e) => setAnswer({ type: 'match', pairs: { ...answer.pairs, [it.id]: (e.target as HTMLSelectElement).value } })}
              >
                <option value="">Choose a match…</option>
                {rightOrder.map((r) => <option value={r.id}>{formula(r.text)}</option>)}
              </select>
              {answered && (
                <span class="choice-why">
                  {result!.parts[it.id] ? '✓ ' : `→ ${formula(q.right.find((r) => r.id === q.answer[it.id])?.text ?? '')}: `}
                  {formula(it.rationale)}
                </span>
              )}
            </label>
          ))}
        </div>
      )}

      {q.type === 'numeric' && (
        <label class="numeric field">
          <span>Your answer {q.unit && <>({q.unit})</>}</span>
          <input
            type="text"
            inputMode="decimal"
            disabled={answered}
            onInput={(e) => setAnswer({ type: 'numeric', value: parseFloat((e.target as HTMLInputElement).value.replace(',', '.')) })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          {answered && <span class="choice-why">Answer: {q.answer} {q.unit}. {q.workedSolution}</span>}
        </label>
      )}

      {!answered && (
        <div class="q-actions">
          {!hinted ? (
            <button class="btn ghost small" onClick={() => setHinted(true)}>Show a hint</button>
          ) : (
            <p class="q-hint" role="note"><strong>Hint:</strong> {formula(q.hint)}</p>
          )}
          <button class="btn" disabled={!ready} onClick={submit}>Check answer</button>
        </div>
      )}

      {answered && (
        <div class={result!.correct ? 'feedback good' : 'feedback gentle'} tabIndex={-1} ref={feedbackRef} role="status" aria-live="polite">
          <h3>{result!.correct ? (hinted ? 'Nice work — and the hint helped!' : 'Discovery made!') : 'Good thinking — here is the key idea'}</h3>
          <p>{formula(q.explanation)}</p>
          {!result!.correct && <p class="q-later">Pip will bring this idea back later in a different way.</p>}
          <button class="btn" onClick={onContinue}>{last ? 'Continue' : 'Next question'}</button>
        </div>
      )}
    </div>
  );
}
