"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { WordData } from "@/lib/types";

type Level = "beginner" | "intermediate";
type Phase = "select" | "quiz" | "feedback" | "complete";

// ── Adaptive Queue ──
interface QueueItem {
  wordIdx: number;
  fmtIdx: number;
  difficulty: number;
}

function buildQueue(words: WordData[]): QueueItem[] {
  const q: QueueItem[] = [];
  for (let w = 0; w < words.length; w++) {
    const sorted = words[w].formats
      .map((f, i) => ({ i, d: f.difficulty }))
      .sort((a, b) => a.d - b.d);
    if (sorted[0]) q.push({ wordIdx: w, fmtIdx: sorted[0].i, difficulty: sorted[0].d });
  }
  return q;
}

function nextFormat(word: WordData, cur: number, correct: boolean): number | null {
  const d = word.formats[cur]?.difficulty;
  if (d == null) return null;
  if (correct) {
    const harder = word.formats
      .map((f, i) => ({ i, d: f.difficulty }))
      .filter((f) => f.d > d)
      .sort((a, b) => a.d - b.d);
    return harder.length > 0 ? harder[Math.min(1, harder.length - 1)].i : null;
  }
  const easier = word.formats
    .map((f, i) => ({ i, d: f.difficulty }))
    .filter((f) => f.i !== cur && f.d <= d)
    .sort((a, b) => b.d - a.d);
  return easier.length > 0 ? easier[0].i : null;
}

// ── Feedback Data ──
interface FeedbackData {
  understanding: number | null;   // 0-3
  comparison: number | null;      // 0-3
  volume: number | null;          // 0-2
  bestFeatures: boolean[];        // 6 toggles
}

const UNDERSTANDING = ["まだよくわからない", "少し理解できた", "かなり理解できた", "完全に腑に落ちた"];
const COMPARISON = ["覚えにくい", "変わらない", "やや覚えやすい", "はるかに覚えやすい"];
const VOLUME = ["多すぎる", "ちょうどいい", "もっと欲しい"];
const FEATURES = ["語源の分解", "認知言語学", "和訳のズレ", "記憶フック", "音声", "出題形式の多様さ"];

// ══════════════════════════════════
// MICRO COMPONENTS
// ══════════════════════════════════

function ProgressRing({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative w-11 h-11 flex items-center justify-center">
      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={r} fill="none"
          stroke="var(--accent)" strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-accent2">{current}</span>
    </div>
  );
}

function DiffDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1" title={["", "基本", "応用", "実践"][level]}>
      {[1, 2, 3].map((d) => (
        <div
          key={d}
          className={`w-1.5 h-1.5 rounded-full transition-all ${
            d <= level ? "bg-accent2 scale-110" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

function EtymBlocks({ parts }: { parts: WordData["parts"] }) {
  const styles = [
    "from-accent/30 to-accent/10 border-accent/40 text-accent2",
    "from-gold/30 to-gold/10 border-gold/40 text-gold",
    "from-correct/30 to-correct/10 border-correct/40 text-correct",
  ];
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap animate-scale-in">
      {parts.map((p, i) => (
        <div key={i} className="flex items-center gap-3">
          {i > 0 && <span className="text-text2 text-xl font-light">+</span>}
          <div className={`bg-gradient-to-b border rounded-xl px-5 py-3 text-center ${styles[i % styles.length]}`}>
            <div className="text-xl font-bold tracking-wide">{p.part}</div>
            <div className="text-[10px] opacity-70 mt-0.5">{p.meaning}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AudioBtn({ path, label, play }: { path: string; label: string; play: (p: string) => void }) {
  return (
    <button
      onClick={() => play(path)}
      className="flex items-center gap-2.5 p-3 rounded-xl bg-surface2/80 hover:bg-accent/10 transition-all text-xs text-left w-full group"
    >
      <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/25 transition-colors">
        <span className="text-accent2 text-[10px]">▶</span>
      </div>
      <span className="truncate text-text2 group-hover:text-foreground transition-colors">{label}</span>
    </button>
  );
}

// ══════════════════════════════════
// FORMAT LAYOUTS (each visually unique)
// ══════════════════════════════════

interface FmtProps {
  word: WordData;
  fmt: WordData["formats"][0];
  answered: number | null;
  onAnswer: (i: number) => void;
  onPlay: (p: string) => void;
}

function choiceCls(i: number, correct: number, answered: number | null) {
  const base = "text-left p-4 rounded-xl text-sm transition-all duration-200";
  if (answered === null)
    return `${base} bg-surface2 border border-border hover:border-accent/60 hover:bg-accent/5 cursor-pointer active:scale-[0.98]`;
  if (i === correct) return `${base} bg-correct/10 border border-correct`;
  if (i === answered) return `${base} bg-wrong/10 border border-wrong`;
  return `${base} bg-surface2 border border-border opacity-25`;
}

/** 英→日選択: Hero word with gradient glow */
function FmtMeaning({ word, fmt, answered, onAnswer, onPlay }: FmtProps) {
  return (
    <>
      <div className="relative bg-surface rounded-3xl p-10 mb-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/8 via-transparent to-transparent" />
        <div className="relative">
          <button
            onClick={() => onPlay(`/audio/${word.word}/word.mp3`)}
            className="text-5xl font-bold tracking-wide hover:text-accent2 transition-colors cursor-pointer animate-float"
          >
            {word.word}
          </button>
          <div className="text-sm text-text2 mt-2 mb-6">{word.phonetic}</div>
          <p className="text-sm text-text2">{fmt.instruction}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {fmt.choices.map((c, i) => (
          <button key={i} onClick={() => onAnswer(i)} disabled={answered !== null} className={choiceCls(i, fmt.correct, answered)}>
            {c}
          </button>
        ))}
      </div>
    </>
  );
}

/** 穴埋め: Sentence with glowing blank + pill grid */
function FmtFill({ word, fmt, answered, onAnswer, onPlay }: FmtProps) {
  const parts = (fmt.sentence || "").split("______");
  const filled = answered !== null ? fmt.choices[answered] : null;
  const ok = answered === fmt.correct;
  return (
    <>
      <div className="bg-surface rounded-3xl p-8 mb-6">
        <button
          onClick={() => onPlay(`/audio/${word.word}/word.mp3`)}
          className="block mx-auto text-xl font-bold text-text2 hover:text-accent2 transition-colors cursor-pointer mb-8"
        >
          {word.word}
        </button>
        <p className="text-xl leading-relaxed text-center">
          {parts[0]}
          <span
            className={`inline-block min-w-[100px] mx-1 pb-0.5 font-bold border-b-2 transition-all ${
              filled
                ? ok ? "border-correct text-correct" : "border-wrong text-wrong"
                : "border-accent/50 animate-pulse-glow"
            }`}
          >
            {filled || "\u00A0"}
          </span>
          {parts[1]}
        </p>
        {fmt.hint && <p className="text-xs text-text2 text-center mt-5">{fmt.hint}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {fmt.choices.map((c, i) => {
          const base = "rounded-xl py-3 px-4 text-center text-sm font-medium transition-all border";
          let cls: string;
          if (answered === null) cls = `${base} bg-surface2 border-border hover:border-accent/60 cursor-pointer active:scale-[0.97]`;
          else if (i === fmt.correct) cls = `${base} bg-correct/10 border-correct text-correct`;
          else if (i === answered) cls = `${base} bg-wrong/10 border-wrong text-wrong`;
          else cls = `${base} bg-surface2 border-border opacity-20`;
          return (
            <button key={i} onClick={() => onAnswer(i)} disabled={answered !== null} className={cls}>
              {c}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** 語源クイズ: Mystery blocks reveal animation */
function FmtEtym({ word, fmt, answered, onAnswer }: Omit<FmtProps, "onPlay">) {
  const revealed = answered !== null;
  return (
    <>
      <div className="bg-surface rounded-3xl p-8 mb-6 text-center">
        <div className="text-3xl font-bold mb-2">{word.word}</div>
        <div className="text-xs text-text2 mb-6">この単語の語源は？</div>
        {/* Mystery / Revealed blocks */}
        <div className="flex items-center justify-center gap-3 my-4">
          {revealed ? (
            <EtymBlocks parts={word.parts} />
          ) : (
            word.parts.map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                {i > 0 && <span className="text-text2 text-xl font-light">+</span>}
                <div className="rounded-xl border-2 border-dashed border-accent/30 bg-accent/5 w-20 h-20 flex items-center justify-center animate-pulse-glow">
                  <span className="text-2xl text-accent/40">?</span>
                </div>
              </div>
            ))
          )}
        </div>
        <p className="text-sm text-text2 mt-6">{fmt.instruction}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {fmt.choices.map((c, i) => (
          <button key={i} onClick={() => onAnswer(i)} disabled={answered !== null} className={choiceCls(i, fmt.correct, answered)}>
            {c}
          </button>
        ))}
      </div>
    </>
  );
}

/** コロケーション: Centered word with orbiting connections */
function FmtColoc({ word, fmt, answered, onAnswer, onPlay }: FmtProps) {
  return (
    <>
      <div className="bg-surface rounded-3xl p-8 mb-6 text-center">
        <p className="text-xs text-text2 mb-5">{fmt.instruction}</p>
        <div className="relative inline-block">
          <div className="absolute inset-0 rounded-full bg-accent/10 blur-xl scale-150" />
          <button
            onClick={() => onPlay(`/audio/${word.word}/word.mp3`)}
            className="relative text-3xl font-bold text-accent2 hover:text-accent transition-colors cursor-pointer px-6 py-3"
          >
            {word.word}
          </button>
        </div>
        <div className="text-text2 text-lg mt-3">+ ?</div>
      </div>
      <div className="flex flex-col gap-2.5">
        {fmt.choices.map((c, i) => (
          <button key={i} onClick={() => onAnswer(i)} disabled={answered !== null} className={choiceCls(i, fmt.correct, answered)}>
            {c}
          </button>
        ))}
      </div>
    </>
  );
}

/** 例文意味推測: Editorial quote card */
function FmtReading({ word, fmt, answered, onAnswer }: Omit<FmtProps, "onPlay">) {
  const m = fmt.instruction.match(/"([^"]+)"/);
  const quote = m ? m[1] : "";
  const q = fmt.instruction.replace(/"[^"]+"/, "").replace(/^[\s—-]+/, "");
  return (
    <>
      <div className="bg-surface rounded-3xl overflow-hidden mb-6">
        <div className="px-8 py-8 border-l-4 border-gold bg-gradient-to-r from-gold/8 to-transparent">
          <div className="text-gold/60 text-3xl leading-none mb-2">&ldquo;</div>
          <p className="text-lg leading-relaxed font-serif italic text-foreground/90">
            {quote}
          </p>
          <div className="text-gold/60 text-3xl leading-none text-right mt-2">&rdquo;</div>
        </div>
        <div className="px-8 py-5 bg-surface2/50">
          <p className="text-sm text-text2">{q}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {fmt.choices.map((c, i) => (
          <button key={i} onClick={() => onAnswer(i)} disabled={answered !== null} className={choiceCls(i, fmt.correct, answered)}>
            {c}
          </button>
        ))}
      </div>
    </>
  );
}

// ══════════════════════════════════
// FEEDBACK SCREEN
// ══════════════════════════════════

function FeedbackScreen({
  onComplete,
}: {
  onComplete: (data: FeedbackData) => void;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FeedbackData>({
    understanding: null,
    comparison: null,
    volume: null,
    bestFeatures: [false, false, false, false, false, false],
  });

  const canNext =
    (step === 0 && data.understanding !== null) ||
    (step === 1 && data.comparison !== null) ||
    (step === 2 && data.volume !== null) ||
    (step === 3 && data.bestFeatures.some(Boolean));

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else onComplete(data);
  };

  return (
    <div className="max-w-md mx-auto px-6 pt-12 animate-fade-up">
      {/* Progress */}
      <div className="flex gap-1.5 mb-10">
        {[0, 1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${
              s <= step ? "bg-accent" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* Q1: Understanding */}
      {step === 0 && (
        <div className="animate-slide-right">
          <h2 className="text-lg font-bold mb-2">語源の解説で、</h2>
          <h2 className="text-lg font-bold mb-8">
            単語を<span className="text-accent2">「理解できた」</span>と感じましたか？
          </h2>
          <div className="flex flex-col gap-2.5">
            {UNDERSTANDING.map((label, i) => (
              <button
                key={i}
                onClick={() => setData({ ...data, understanding: i })}
                className={`p-4 rounded-xl text-sm text-left transition-all border ${
                  data.understanding === i
                    ? "bg-accent/15 border-accent text-accent2"
                    : "bg-surface2 border-border hover:border-accent/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Q2: Comparison */}
      {step === 1 && (
        <div className="animate-slide-right">
          <h2 className="text-lg font-bold mb-2">従来の単語帳と比べて、</h2>
          <h2 className="text-lg font-bold mb-8">
            <span className="text-accent2">覚えやすさ</span>はどうですか？
          </h2>
          <div className="flex flex-col gap-2.5">
            {COMPARISON.map((label, i) => (
              <button
                key={i}
                onClick={() => setData({ ...data, comparison: i })}
                className={`p-4 rounded-xl text-sm text-left transition-all border ${
                  data.comparison === i
                    ? "bg-accent/15 border-accent text-accent2"
                    : "bg-surface2 border-border hover:border-accent/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Q3: Volume */}
      {step === 2 && (
        <div className="animate-slide-right">
          <h2 className="text-lg font-bold mb-8">
            解説の<span className="text-accent2">量</span>はどうですか？
          </h2>
          <div className="flex flex-col gap-2.5">
            {VOLUME.map((label, i) => (
              <button
                key={i}
                onClick={() => setData({ ...data, volume: i })}
                className={`p-4 rounded-xl text-sm text-left transition-all border ${
                  data.volume === i
                    ? "bg-accent/15 border-accent text-accent2"
                    : "bg-surface2 border-border hover:border-accent/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Q4: Best features (multi-select) */}
      {step === 3 && (
        <div className="animate-slide-right">
          <h2 className="text-lg font-bold mb-2">一番良かった要素は？</h2>
          <p className="text-sm text-text2 mb-6">複数選択OK</p>
          <div className="grid grid-cols-2 gap-2.5">
            {FEATURES.map((label, i) => (
              <button
                key={i}
                onClick={() => {
                  const f = [...data.bestFeatures];
                  f[i] = !f[i];
                  setData({ ...data, bestFeatures: f });
                }}
                className={`p-4 rounded-xl text-sm text-center transition-all border ${
                  data.bestFeatures[i]
                    ? "bg-accent/15 border-accent text-accent2"
                    : "bg-surface2 border-border hover:border-accent/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={!canNext}
        className={`w-full mt-8 py-4 rounded-xl font-bold text-sm transition-all ${
          canNext
            ? "bg-accent text-white hover:bg-accent2"
            : "bg-surface2 text-text2 cursor-not-allowed"
        }`}
      >
        {step < 3 ? "次へ" : "送信する"}
      </button>
    </div>
  );
}

// ══════════════════════════════════
// MAIN APP
// ══════════════════════════════════

interface Props {
  words: Record<string, WordData[]>;
}

export default function TrialApp({ words }: Props) {
  const [phase, setPhase] = useState<Phase>("select");
  const [level, setLevel] = useState<Level>("beginner");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [qi, setQi] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const expRef = useRef<HTMLDivElement>(null);

  const ws = words[level] || [];
  const cur = queue[qi];
  const cw = cur ? ws[cur.wordIdx] : null;
  const cf = cw ? cw.formats[cur.fmtIdx] : null;

  const start = useCallback((lv: Level) => {
    setLevel(lv);
    setQueue(buildQueue(words[lv] || []));
    setQi(0);
    setPhase("quiz");
    setAnswered(null);
    setCorrect(0);
    setTotal(0);
    setShowMore(false);
  }, [words]);

  const answer = useCallback((i: number) => {
    if (answered !== null || !cf) return;
    setAnswered(i);
    setTotal((t) => t + 1);
    if (i === cf.correct) setCorrect((c) => c + 1);
    setShowMore(false);
    setTimeout(() => expRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
  }, [answered, cf]);

  const next = useCallback(() => {
    if (!cw || !cf || !cur) return;
    const ok = answered === cf.correct;
    const nf = nextFormat(cw, cur.fmtIdx, ok);
    const nq = [...queue];
    if (nf !== null) {
      const ins = ok ? qi + 2 : qi + 1;
      nq.splice(Math.min(ins, nq.length), 0, {
        wordIdx: cur.wordIdx, fmtIdx: nf, difficulty: cw.formats[nf].difficulty,
      });
    }
    const ni = qi + 1;
    if (ni >= nq.length) {
      setPhase("feedback");
      return;
    }
    setQueue(nq);
    setQi(ni);
    setAnswered(null);
    setShowMore(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [queue, qi, cw, cf, cur, answered]);

  const play = useCallback((p: string) => {
    new Audio(p).play().catch(() => {});
  }, []);

  const handleFeedback = useCallback((data: FeedbackData) => {
    // Save to localStorage for now (will send to server later)
    const existing = JSON.parse(localStorage.getItem("kioku_feedback") || "[]");
    existing.push({ ...data, level, correct, total, timestamp: Date.now() });
    localStorage.setItem("kioku_feedback", JSON.stringify(existing));
    setPhase("complete");
  }, [level, correct, total]);

  // ── Level Select ──
  if (phase === "select") {
    return (
      <div className="flex flex-col items-center pt-20 px-6 max-w-md mx-auto animate-fade-up">
        <div className="text-xs tracking-[0.2em] text-text2 uppercase mb-2">Choose your level</div>
        <h2 className="text-2xl font-bold mb-10">レベルを選択</h2>
        <div className="w-full space-y-3">
          <button
            onClick={() => start("beginner")}
            className="w-full bg-surface border border-border text-left p-6 rounded-2xl hover:border-accent/60 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold">初心者</span>
              <DiffDots level={1} />
            </div>
            <p className="text-sm text-text2 group-hover:text-foreground/70 transition-colors">
              知ってるつもりの単語を「本当に」理解する
            </p>
          </button>
          <button
            onClick={() => start("intermediate")}
            className="w-full bg-surface border border-border text-left p-6 rounded-2xl hover:border-accent/60 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold">中級者</span>
              <DiffDots level={2} />
            </div>
            <p className="text-sm text-text2 group-hover:text-foreground/70 transition-colors">
              丸暗記で覚えた単語を、使える知識に変える
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ── Feedback ──
  if (phase === "feedback") {
    return <FeedbackScreen onComplete={handleFeedback} />;
  }

  // ── Complete ──
  if (phase === "complete") {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="flex flex-col items-center pt-16 px-6 max-w-md mx-auto text-center animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-accent/15 flex items-center justify-center mb-6">
          <span className="text-3xl font-bold text-accent2">{pct}%</span>
        </div>
        <h2 className="text-2xl font-bold mb-3">体験完了</h2>
        <p className="text-sm text-text2 leading-relaxed mb-2">
          {correct}/{total} 問正解 ・ {ws.length}語を学習
        </p>
        <p className="text-sm text-text2 leading-relaxed mb-10">
          フィードバックありがとうございました。
          <br />
          語源から理解した単語は、もう忘れません。
        </p>
        <button
          onClick={() => setPhase("select")}
          className="bg-accent text-white font-semibold py-4 px-10 rounded-full hover:bg-accent2 transition-all"
        >
          もう一度体験する
        </button>
      </div>
    );
  }

  // ── Quiz ──
  if (!cw || !cf || !cur) return null;
  const isOk = answered === cf.correct;
  const ftype = cf.type;

  return (
    <div className="w-full max-w-xl mx-auto px-5 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <ProgressRing current={qi + 1} total={queue.length} />
        <div className="flex items-center gap-3">
          <DiffDots level={cur.difficulty} />
          <span className="text-[10px] text-text2 bg-surface2 px-2.5 py-1 rounded-full">
            {ftype}
          </span>
        </div>
      </div>

      {/* Format-specific layout */}
      <div className="animate-fade-up" key={`${qi}-${cur.fmtIdx}`}>
        {ftype === "英→日選択" && <FmtMeaning word={cw} fmt={cf} answered={answered} onAnswer={answer} onPlay={play} />}
        {ftype === "穴埋め" && <FmtFill word={cw} fmt={cf} answered={answered} onAnswer={answer} onPlay={play} />}
        {ftype === "語源クイズ" && <FmtEtym word={cw} fmt={cf} answered={answered} onAnswer={answer} />}
        {ftype === "コロケーション" && <FmtColoc word={cw} fmt={cf} answered={answered} onAnswer={answer} onPlay={play} />}
        {ftype === "例文意味推測" && <FmtReading word={cw} fmt={cf} answered={answered} onAnswer={answer} />}
      </div>

      {/* ── Explanation ── */}
      {answered !== null && (
        <div ref={expRef} className="mt-5 animate-fade-up">
          <div className="bg-surface rounded-3xl p-6">
            {/* Result */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold ${
                isOk ? "bg-correct/15 text-correct" : "bg-wrong/15 text-wrong"
              }`}>
                {isOk ? "○" : "×"}
              </div>
              <div>
                <span className={`text-sm font-bold ${isOk ? "text-correct" : "text-wrong"}`}>
                  {isOk ? "正解！" : "不正解"}
                </span>
                <span className="text-[10px] text-text2 ml-2">
                  {isOk ? "→ 次はより難しい形式で" : "→ 別の角度からもう一度"}
                </span>
              </div>
            </div>

            {/* Etymology visual (always) */}
            <div className="mb-5">
              <EtymBlocks parts={cw.parts} />
            </div>

            {/* ── Correct: focused + second insight + audio ── */}
            {isOk && (
              <div className="space-y-4">
                {/* Primary insight */}
                <p className="text-center text-sm leading-relaxed text-accent2">
                  {cf.explanationFocus === "etymology" && cw.etymology.oneliner}
                  {cf.explanationFocus === "cognitive" && cw.cognitive.oneliner}
                  {cf.explanationFocus === "gap" && cw.gapOneliner}
                  {cf.explanationFocus === "cognates" && cw.etymology.oneliner}
                  {cf.explanationFocus === "hook" && cw.hook.text}
                </p>

                {/* Second insight */}
                <div className="border-t border-border pt-4">
                  {(cf.explanationFocus === "etymology" || cf.explanationFocus === "cognates") && (
                    <>
                      <div className="text-[10px] font-bold tracking-widest text-gold uppercase mb-1.5">和訳のズレ</div>
                      <p className="text-sm leading-relaxed">{cw.gap}</p>
                    </>
                  )}
                  {cf.explanationFocus === "gap" && (
                    <>
                      <div className="text-[10px] font-bold tracking-widest text-gold uppercase mb-1.5">認知言語学</div>
                      <p className="text-sm leading-relaxed">{cw.cognitive.fact}</p>
                      <p className="text-[10px] text-text2 mt-1">{cw.cognitive.source}</p>
                    </>
                  )}
                  {cf.explanationFocus === "cognitive" && (
                    <div className="bg-gold/5 border-l-2 border-gold pl-3 py-2 rounded-r-lg">
                      <div className="text-[10px] font-bold text-gold mb-1">{cw.hook.label}</div>
                      <p className="text-sm leading-relaxed">{cw.hook.text}</p>
                    </div>
                  )}
                  {cf.explanationFocus === "hook" && (
                    <>
                      <div className="text-[10px] font-bold tracking-widest text-gold uppercase mb-1.5">語源</div>
                      <p className="text-sm leading-relaxed">{cw.etymology.fact}</p>
                    </>
                  )}
                </div>

                {/* Audio examples */}
                <div className="space-y-1.5">
                  {cw.examples.slice(0, 2).map((ex, i) => (
                    <AudioBtn key={i} path={`/audio/${cw.word}/example_${i}.mp3`} label={ex} play={play} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Wrong: focused section + expand ── */}
            {!isOk && (
              <div className="space-y-4">
                {cf.explanationFocus === "etymology" && (
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-accent2 uppercase mb-1.5">語源</div>
                    <p className="text-sm leading-loose">{cw.etymology.fact}</p>
                  </div>
                )}
                {cf.explanationFocus === "cognitive" && (
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-accent2 uppercase mb-1.5">認知言語学</div>
                    <p className="text-sm leading-loose">{cw.cognitive.fact}</p>
                    <p className="text-[10px] text-text2 mt-1">{cw.cognitive.source}</p>
                  </div>
                )}
                {cf.explanationFocus === "gap" && (
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-accent2 uppercase mb-1.5">和訳のズレ</div>
                    <p className="text-sm leading-loose">{cw.gap}</p>
                  </div>
                )}
                {cf.explanationFocus === "cognates" && (
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-accent2 uppercase mb-1.5">同じ根を持つ単語</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {cw.etymology.cognates.map((c, i) => (
                        <span key={i} className="bg-surface2 border border-border px-3 py-1.5 rounded-lg text-xs">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {cf.explanationFocus === "hook" && (
                  <div className="bg-gold/5 border-l-2 border-gold pl-3 pr-3 py-3 rounded-r-lg">
                    <div className="text-[10px] font-bold text-gold mb-1">{cw.hook.label}</div>
                    <p className="text-sm leading-loose">{cw.hook.text}</p>
                  </div>
                )}

                {/* Audio */}
                <div className="space-y-1.5">
                  {cw.examples.slice(0, 2).map((ex, i) => (
                    <AudioBtn key={i} path={`/audio/${cw.word}/example_${i}.mp3`} label={ex} play={play} />
                  ))}
                </div>

                {/* Expand */}
                <button
                  onClick={() => setShowMore(!showMore)}
                  className="text-[10px] text-text2 hover:text-accent2 transition-colors w-full text-center pt-2"
                >
                  {showMore ? "▲ 閉じる" : "▼ もっと詳しく"}
                </button>

                {showMore && (
                  <div className="pt-3 border-t border-border space-y-4 animate-fade-up">
                    {cf.explanationFocus !== "etymology" && (
                      <div>
                        <div className="text-[10px] font-bold tracking-widest text-accent2 uppercase mb-1">語源</div>
                        <p className="text-sm leading-loose">{cw.etymology.fact}</p>
                      </div>
                    )}
                    {cf.explanationFocus !== "cognitive" && (
                      <div>
                        <div className="text-[10px] font-bold tracking-widest text-accent2 uppercase mb-1">認知言語学</div>
                        <p className="text-sm leading-loose">{cw.cognitive.fact}</p>
                      </div>
                    )}
                    {cf.explanationFocus !== "gap" && (
                      <div>
                        <div className="text-[10px] font-bold tracking-widest text-accent2 uppercase mb-1">和訳のズレ</div>
                        <p className="text-sm leading-loose">{cw.gap}</p>
                      </div>
                    )}
                    {cf.explanationFocus !== "hook" && (
                      <div className="bg-gold/5 border-l-2 border-gold pl-3 pr-3 py-2 rounded-r-lg">
                        <div className="text-[10px] font-bold text-gold mb-1">{cw.hook.label}</div>
                        <p className="text-sm leading-loose">{cw.hook.text}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={next}
            className="w-full mt-4 bg-accent text-white font-semibold py-4 rounded-2xl hover:bg-accent2 transition-all active:scale-[0.98]"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
