"use client";

import { useState, useCallback, useRef } from "react";
import type { WordData } from "@/lib/types";

type Level = "beginner" | "intermediate";
type Phase = "select" | "quiz" | "feedback" | "complete";

// ── Adaptive Queue ──
interface QI { wordIdx: number; fmtIdx: number; difficulty: number }

function buildQueue(words: WordData[]): QI[] {
  return words.map((w, wi) => {
    const s = w.formats.map((f, i) => ({ i, d: f.difficulty })).sort((a, b) => a.d - b.d);
    return { wordIdx: wi, fmtIdx: s[0].i, difficulty: s[0].d };
  });
}

function nextFmt(w: WordData, cur: number, ok: boolean): number | null {
  const d = w.formats[cur]?.difficulty;
  if (d == null) return null;
  if (ok) {
    const h = w.formats.map((f, i) => ({ i, d: f.difficulty })).filter(f => f.d > d).sort((a, b) => a.d - b.d);
    return h.length > 0 ? h[Math.min(1, h.length - 1)].i : null;
  }
  const e = w.formats.map((f, i) => ({ i, d: f.difficulty })).filter(f => f.i !== cur && f.d <= d).sort((a, b) => b.d - a.d);
  return e.length > 0 ? e[0].i : null;
}

// ── Feedback ──
interface FD { understanding: number | null; comparison: number | null; volume: number | null; best: boolean[] }
const Q_UNDERSTAND = ["まだよくわからない", "少し理解できた", "かなり理解できた", "完全に腑に落ちた"];
const Q_COMPARE = ["覚えにくい", "変わらない", "やや覚えやすい", "はるかに覚えやすい"];
const Q_VOLUME = ["多すぎる", "ちょうどいい", "もっと欲しい"];
const Q_FEATURES = ["語源の分解", "認知言語学", "和訳のズレ", "記憶フック", "音声", "出題の多様さ"];

// ══════════════════════════════════
// COMPONENTS
// ══════════════════════════════════

function EtymBlocks({ parts }: { parts: WordData["parts"] }) {
  const bg = ["bg-accent-soft text-accent", "bg-gold-soft text-gold", "bg-correct-soft text-correct"];
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {parts.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-text2 text-lg font-light">+</span>}
          <div className={`rounded-xl px-4 py-2.5 text-center ${bg[i % bg.length]}`}>
            <div className="text-lg font-black">{p.part}</div>
            <div className="text-[11px] font-medium mt-0.5">{p.meaning}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AudioBtn({ path, label, play }: { path: string; label: string; play: (p: string) => void }) {
  return (
    <button onClick={() => play(path)} className="flex items-center gap-3 p-3 rounded-xl bg-surface2 hover:bg-surface3 transition-colors w-full text-left min-h-[48px]">
      <div className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
        <span className="text-accent text-xs">▶</span>
      </div>
      <span className="text-ink font-medium text-[15px] leading-snug">{label}</span>
    </button>
  );
}

function choiceCls(i: number, correct: number, ans: number | null) {
  const base = "text-left p-4 rounded-2xl text-[17px] font-bold transition-all duration-200 border-2 min-h-[52px] flex items-center";
  if (ans === null) return `${base} bg-surface border-border hover:border-accent/40 cursor-pointer active:scale-[0.98]`;
  if (i === correct) return `${base} bg-correct-soft border-correct text-correct font-bold`;
  if (i === ans) return `${base} bg-wrong-soft border-wrong text-wrong`;
  return `${base} bg-surface border-border opacity-30`;
}

// ══════════════════════════════════
// FORMAT LAYOUTS
// ══════════════════════════════════

interface FP { word: WordData; fmt: WordData["formats"][0]; ans: number | null; onAns: (i: number) => void; play: (p: string) => void }

function PlayBtn({ word, play }: { word: string; play: (p: string) => void }) {
  return (
    <button
      onClick={() => play(`/audio/${word}/word.mp3`)}
      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-soft hover:bg-accent/20 transition-colors ml-2 align-middle"
      aria-label="発音を聞く"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    </button>
  );
}

/** 英→日選択 */
function L1({ word, fmt, ans, onAns, play }: FP) {
  return (
    <>
      <div className="text-center py-6">
        <div className="flex items-center justify-center">
          <span className="text-[42px] font-black text-ink tracking-tight">{word.word}</span>
          <PlayBtn word={word.word} play={play} />
        </div>
        <div className="text-base text-text2 mt-1">{word.phonetic}</div>
        <p className="text-xl text-ink font-bold mt-5">{fmt.instruction}</p>
      </div>
      <div className="space-y-2.5">
        {fmt.choices.map((c, i) => (
          <button key={i} onClick={() => onAns(i)} disabled={ans !== null} className={choiceCls(i, fmt.correct, ans)}>{c}</button>
        ))}
      </div>
    </>
  );
}

/** 穴埋め — 単語名は非表示（答えがバレるため） */
function L2({ word, fmt, ans, onAns, play }: FP) {
  const [a, b] = (fmt.sentence || "").split("______");
  const filled = ans !== null ? fmt.choices[ans] : null;
  const ok = ans === fmt.correct;
  return (
    <>
      <div className="py-6 text-center">
        <p className="text-xl leading-relaxed text-ink font-medium px-2">
          {a}
          <span className={`inline-block min-w-[100px] border-b-3 mx-1 pb-0.5 font-black ${filled ? ok ? "border-correct text-correct" : "border-wrong text-wrong" : "border-accent"}`}>
            {filled || "\u00A0"}
          </span>
          {b}
        </p>
        {fmt.hint && <p className="text-lg text-ink mt-4">{fmt.hint}</p>}
      </div>
      <div className="space-y-2.5">
        {fmt.choices.map((c, i) => {
          const base = "rounded-2xl py-4 px-4 text-center text-[17px] font-black border-2 transition-all min-h-[52px]";
          let cls: string;
          if (ans === null) cls = `${base} bg-surface border-border hover:border-accent/40 cursor-pointer`;
          else if (i === fmt.correct) cls = `${base} bg-correct-soft border-correct text-correct`;
          else if (i === ans) cls = `${base} bg-wrong-soft border-wrong text-wrong`;
          else cls = `${base} bg-surface border-border opacity-20`;
          return <button key={i} onClick={() => onAns(i)} disabled={ans !== null} className={cls}>{c}</button>;
        })}
      </div>
    </>
  );
}

/** 語源クイズ */
function L3({ word, fmt, ans, onAns, play }: FP) {
  return (
    <>
      <div className="text-center py-6">
        <div className="flex items-center justify-center mb-4">
          <span className="text-3xl font-black text-ink">{word.word}</span>
          <PlayBtn word={word.word} play={play} />
        </div>
        <div className="flex items-center justify-center gap-2 mb-3">
          {ans !== null ? (
            <EtymBlocks parts={word.parts} />
          ) : (
            word.parts.map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-text2 text-lg">+</span>}
                <div className="w-18 h-18 rounded-xl border-3 border-dashed border-accent/30 bg-accent-soft flex items-center justify-center">
                  <span className="text-2xl text-accent/40 font-black">?</span>
                </div>
              </div>
            ))
          )}
        </div>
        <p className="text-xl text-ink font-bold mt-4">{fmt.instruction}</p>
      </div>
      <div className="space-y-2.5">
        {fmt.choices.map((c, i) => (
          <button key={i} onClick={() => onAns(i)} disabled={ans !== null} className={choiceCls(i, fmt.correct, ans)}>{c}</button>
        ))}
      </div>
    </>
  );
}

/** コロケーション */
function L4({ word, fmt, ans, onAns, play }: FP) {
  return (
    <>
      <div className="text-center py-6">
        <p className="text-xl text-ink font-bold mb-4">{fmt.instruction}</p>
        <div className="flex items-center justify-center">
          <span className="text-4xl font-black text-accent">{word.word}</span>
          <PlayBtn word={word.word} play={play} />
        </div>
        <div className="text-xl text-text2 mt-3 font-light">+ ???</div>
      </div>
      <div className="space-y-2.5">
        {fmt.choices.map((c, i) => (
          <button key={i} onClick={() => onAns(i)} disabled={ans !== null} className={choiceCls(i, fmt.correct, ans)}>{c}</button>
        ))}
      </div>
    </>
  );
}

/** 例文推測 */
function L5({ word, fmt, ans, onAns, play }: FP) {
  const m = fmt.instruction.match(/"([^"]+)"/);
  const quote = m ? m[1] : "";
  const q = fmt.instruction.replace(/"[^"]+"/, "").replace(/^[\s—-]+/, "");
  return (
    <>
      <div className="my-5">
        <div className="border-l-4 border-gold bg-gold-soft rounded-r-2xl px-5 py-5">
          <p className="text-xl leading-relaxed font-serif italic text-ink">
            &ldquo;{quote}&rdquo;
          </p>
        </div>
        <p className="text-xl text-ink font-bold mt-5 px-1">{q}</p>
      </div>
      <div className="space-y-2.5">
        {fmt.choices.map((c, i) => (
          <button key={i} onClick={() => onAns(i)} disabled={ans !== null} className={choiceCls(i, fmt.correct, ans)}>{c}</button>
        ))}
      </div>
    </>
  );
}

// ══════════════════════════════════
// FEEDBACK
// ══════════════════════════════════

function Feedback({ onDone }: { onDone: (d: FD) => void }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<FD>({ understanding: null, comparison: null, volume: null, best: Array(6).fill(false) });
  const ok = (step === 0 && d.understanding !== null) || (step === 1 && d.comparison !== null) || (step === 2 && d.volume !== null) || (step === 3 && d.best.some(Boolean));

  function SelectQ({ items, value, onChange }: { items: string[]; value: number | null; onChange: (v: number) => void }) {
    return (
      <div className="space-y-2.5">
        {items.map((label, i) => (
          <button key={i} onClick={() => onChange(i)}
            className={`w-full text-left p-4 rounded-2xl text-[17px] font-bold border-2 transition-all min-h-[52px] ${value === i ? "bg-accent-soft border-accent text-accent" : "bg-surface border-border hover:border-accent/30"}`}>
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-24 animate-fade-up">
      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[0, 1, 2, 3].map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? "bg-accent" : "bg-border"}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="animate-slide-right">
          <h2 className="text-2xl font-black text-ink mb-6">
            語源の解説で、単語を<br />「理解できた」と感じましたか？
          </h2>
          <SelectQ items={Q_UNDERSTAND} value={d.understanding} onChange={v => setD({ ...d, understanding: v })} />
        </div>
      )}
      {step === 1 && (
        <div className="animate-slide-right">
          <h2 className="text-2xl font-black text-ink mb-6">
            従来の単語帳と比べて<br />覚えやすさはどうですか？
          </h2>
          <SelectQ items={Q_COMPARE} value={d.comparison} onChange={v => setD({ ...d, comparison: v })} />
        </div>
      )}
      {step === 2 && (
        <div className="animate-slide-right">
          <h2 className="text-2xl font-black text-ink mb-6">
            解説の量はどうですか？
          </h2>
          <SelectQ items={Q_VOLUME} value={d.volume} onChange={v => setD({ ...d, volume: v })} />
        </div>
      )}
      {step === 3 && (
        <div className="animate-slide-right">
          <h2 className="text-2xl font-black text-ink mb-2">
            一番良かった要素は？
          </h2>
          <p className="text-base text-text2 mb-5">複数選択OK</p>
          <div className="grid grid-cols-2 gap-2.5">
            {Q_FEATURES.map((label, i) => (
              <button key={i} onClick={() => { const b = [...d.best]; b[i] = !b[i]; setD({ ...d, best: b }); }}
                className={`p-4 rounded-2xl text-[17px] font-black text-center border-2 transition-all min-h-[52px] ${d.best[i] ? "bg-accent-soft border-accent text-accent" : "bg-surface border-border hover:border-accent/30"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticky bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border">
        <button onClick={() => step < 3 ? setStep(step + 1) : onDone(d)} disabled={!ok}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all max-w-md mx-auto block ${ok ? "bg-accent text-white hover:bg-accent2" : "bg-surface2 text-text2 cursor-not-allowed"}`}>
          {step < 3 ? "次へ" : "送信する"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════
// MAIN
// ══════════════════════════════════

export default function TrialApp({ words }: { words: Record<string, WordData[]> }) {
  const [phase, setPhase] = useState<Phase>("select");
  const [level, setLevel] = useState<Level>("beginner");
  const [queue, setQueue] = useState<QI[]>([]);
  const [qi, setQi] = useState(0);
  const [ans, setAns] = useState<number | null>(null);
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
    setAns(null);
    setCorrect(0);
    setTotal(0);
    setShowMore(false);
  }, [words]);

  const answer = useCallback((i: number) => {
    if (ans !== null || !cf) return;
    setAns(i);
    setTotal(t => t + 1);
    if (i === cf.correct) setCorrect(c => c + 1);
    setShowMore(false);
    setTimeout(() => expRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
  }, [ans, cf]);

  const next = useCallback(() => {
    if (!cw || !cf || !cur) return;
    const ok = ans === cf.correct;
    const nf = nextFmt(cw, cur.fmtIdx, ok);
    const nq = [...queue];
    if (nf !== null) {
      nq.splice(Math.min(ok ? qi + 2 : qi + 1, nq.length), 0,
        { wordIdx: cur.wordIdx, fmtIdx: nf, difficulty: cw.formats[nf].difficulty });
    }
    if (qi + 1 >= nq.length) { setPhase("feedback"); return; }
    setQueue(nq);
    setQi(qi + 1);
    setAns(null);
    setShowMore(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [queue, qi, cw, cf, cur, ans]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const play = useCallback((p: string) => {
    if (audioRef.current) { audioRef.current.pause(); }
    const a = new Audio(p);
    audioRef.current = a;
    a.play().catch(() => {});
  }, []);

  const handleFeedback = useCallback((data: FD) => {
    const payload = { ...data, level, correct, total, ts: Date.now() };
    // localStorage backup
    const e = JSON.parse(localStorage.getItem("kioku_feedback") || "[]");
    e.push(payload);
    localStorage.setItem("kioku_feedback", JSON.stringify(e));
    // Send to GAS (fire-and-forget)
    const url = process.env.NEXT_PUBLIC_FEEDBACK_URL;
    if (url) {
      fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
    setPhase("complete");
  }, [level, correct, total]);

  // ── Select ──
  if (phase === "select") {
    return (
      <div className="max-w-md mx-auto px-5 pt-14 animate-fade-up">
        <h2 className="text-3xl font-black text-ink mb-8 text-center">レベルを選択</h2>
        <div className="space-y-3">
          <button onClick={() => start("beginner")}
            className="w-full bg-surface border-2 border-border text-left p-5 rounded-2xl hover:border-accent/40 transition-all">
            <div className="text-xl font-black text-ink mb-1">初心者</div>
            <p className="text-base text-text2">知ってるつもりの単語を「本当に」理解する</p>
          </button>
          <button onClick={() => start("intermediate")}
            className="w-full bg-surface border-2 border-border text-left p-5 rounded-2xl hover:border-accent/40 transition-all">
            <div className="text-xl font-black text-ink mb-1">中級者</div>
            <p className="text-base text-text2">丸暗記した単語を、使える知識に変える</p>
          </button>
        </div>
      </div>
    );
  }

  // ── Feedback ──
  if (phase === "feedback") return <Feedback onDone={handleFeedback} />;

  // ── Complete ──
  if (phase === "complete") {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="max-w-md mx-auto px-5 pt-16 text-center animate-fade-up">
        <div className="text-6xl font-black text-accent mb-4">{pct}%</div>
        <h2 className="text-2xl font-black text-ink mb-4">体験完了</h2>
        <p className="text-lg text-ink mb-2">{correct}/{total} 問正解 ・ {ws.length}語を学習</p>
        <p className="text-base text-text2 mb-10">
          フィードバックありがとうございました。<br />語源から理解した単語は、もう忘れません。
        </p>
        <button onClick={() => setPhase("select")}
          className="bg-accent text-white font-bold text-lg py-4 px-10 rounded-full hover:bg-accent2 transition-colors">
          もう一度体験する
        </button>
      </div>
    );
  }

  // ── Quiz ──
  if (!cw || !cf || !cur) return null;
  const isOk = ans === cf.correct;
  const ft = cf.type;

  return (
    <div className="w-full max-w-xl mx-auto px-4 pt-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-ink">{qi + 1}</span>
          <span className="text-sm text-text2">/ {queue.length}</span>
        </div>
        <span className="text-xs text-text2 bg-surface2 px-2.5 py-1 rounded-full font-medium">
          {ft}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-surface2 rounded-full mb-4">
        <div className="h-1 bg-accent rounded-full transition-all duration-500" style={{ width: `${((qi + 1) / queue.length) * 100}%` }} />
      </div>

      {/* Format layout */}
      <div key={`${qi}-${cur.fmtIdx}`} className="animate-fade-up">
        {ft === "英→日選択" && <L1 word={cw} fmt={cf} ans={ans} onAns={answer} play={play} />}
        {ft === "穴埋め" && <L2 word={cw} fmt={cf} ans={ans} onAns={answer} play={play} />}
        {ft === "語源クイズ" && <L3 word={cw} fmt={cf} ans={ans} onAns={answer} play={play} />}
        {ft === "コロケーション" && <L4 word={cw} fmt={cf} ans={ans} onAns={answer} play={play} />}
        {ft === "例文意味推測" && <L5 word={cw} fmt={cf} ans={ans} onAns={answer} play={play} />}
      </div>

      {/* Explanation */}
      {ans !== null && (
        <div ref={expRef} className="mt-5 animate-fade-up">
          <div className="bg-surface border-2 border-border rounded-2xl p-5">
            {/* Result */}
            <div className={`text-xl font-black mb-4 ${isOk ? "text-correct" : "text-wrong"}`}>
              {isOk ? "正解！" : "不正解"}
              <span className="text-sm font-medium text-text2 ml-2">
                {isOk ? "→ 次はより難しい形式で" : "→ 別の角度からもう一度"}
              </span>
            </div>

            {/* Etymology blocks */}
            <div className="mb-4"><EtymBlocks parts={cw.parts} /></div>

            {/* ── Correct ── */}
            {isOk && (
              <div className="space-y-4">
                <p className="text-lg text-ink font-bold text-center leading-relaxed">
                  {cf.explanationFocus === "etymology" && cw.etymology.oneliner}
                  {cf.explanationFocus === "cognitive" && cw.cognitive.oneliner}
                  {cf.explanationFocus === "gap" && cw.gapOneliner}
                  {cf.explanationFocus === "cognates" && cw.etymology.oneliner}
                  {cf.explanationFocus === "hook" && cw.hook.text}
                </p>
                <div className="border-t border-border pt-4">
                  {(cf.explanationFocus === "etymology" || cf.explanationFocus === "cognates") && (
                    <><div className="text-sm font-black text-gold mb-1.5">和訳のズレ</div><p className="text-[16px] leading-relaxed text-ink">{cw.gap}</p></>
                  )}
                  {cf.explanationFocus === "gap" && (
                    <><div className="text-sm font-black text-gold mb-1.5">認知言語学</div><p className="text-[16px] leading-relaxed text-ink">{cw.cognitive.fact}</p></>
                  )}
                  {cf.explanationFocus === "cognitive" && (
                    <div className="bg-gold-soft rounded-xl p-4">
                      <div className="text-sm font-black text-gold mb-1.5">{cw.hook.label}</div>
                      <p className="text-[16px] leading-relaxed text-ink">{cw.hook.text}</p>
                    </div>
                  )}
                  {cf.explanationFocus === "hook" && (
                    <><div className="text-sm font-black text-gold mb-1.5">語源</div><p className="text-[16px] leading-relaxed text-ink">{cw.etymology.fact}</p></>
                  )}
                </div>
                <div className="space-y-2">
                  {cw.examples.slice(0, 2).map((ex, i) => (
                    <AudioBtn key={i} path={`/audio/${cw.word}/example_${i}.mp3`} label={ex} play={play} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Wrong ── */}
            {!isOk && (
              <div className="space-y-4">
                {cf.explanationFocus === "etymology" && (
                  <div><div className="text-sm font-black text-accent mb-1.5">語源</div><p className="text-[16px] leading-relaxed">{cw.etymology.fact}</p></div>
                )}
                {cf.explanationFocus === "cognitive" && (
                  <div><div className="text-sm font-black text-accent mb-1.5">認知言語学</div><p className="text-[16px] leading-relaxed">{cw.cognitive.fact}</p><p className="text-xs text-text2 mt-1">{cw.cognitive.source}</p></div>
                )}
                {cf.explanationFocus === "gap" && (
                  <div><div className="text-sm font-black text-accent mb-1.5">和訳のズレ</div><p className="text-[16px] leading-relaxed">{cw.gap}</p></div>
                )}
                {cf.explanationFocus === "cognates" && (
                  <div>
                    <div className="text-sm font-black text-accent mb-2">同じ根を持つ単語</div>
                    <div className="flex flex-wrap gap-2">{cw.etymology.cognates.map((c, i) => (
                      <span key={i} className="bg-surface2 px-3 py-1.5 rounded-lg text-sm font-medium">{c}</span>
                    ))}</div>
                  </div>
                )}
                {cf.explanationFocus === "hook" && (
                  <div className="bg-gold-soft rounded-xl p-4">
                    <div className="text-sm font-black text-gold mb-1.5">{cw.hook.label}</div>
                    <p className="text-[16px] leading-relaxed">{cw.hook.text}</p>
                  </div>
                )}

                <div className="space-y-2">
                  {cw.examples.slice(0, 2).map((ex, i) => (
                    <AudioBtn key={i} path={`/audio/${cw.word}/example_${i}.mp3`} label={ex} play={play} />
                  ))}
                </div>

                <button onClick={() => setShowMore(!showMore)} className="text-sm text-text2 hover:text-accent transition-colors w-full text-center py-1">
                  {showMore ? "▲ 閉じる" : "▼ もっと詳しく"}
                </button>

                {showMore && (
                  <div className="border-t border-border pt-4 space-y-4 animate-fade-up">
                    {cf.explanationFocus !== "etymology" && (
                      <div><div className="text-sm font-black text-accent mb-1.5">語源</div><p className="text-[16px] leading-relaxed">{cw.etymology.fact}</p></div>
                    )}
                    {cf.explanationFocus !== "cognitive" && (
                      <div><div className="text-sm font-black text-accent mb-1.5">認知言語学</div><p className="text-[16px] leading-relaxed">{cw.cognitive.fact}</p></div>
                    )}
                    {cf.explanationFocus !== "gap" && (
                      <div><div className="text-sm font-black text-accent mb-1.5">和訳のズレ</div><p className="text-[16px] leading-relaxed">{cw.gap}</p></div>
                    )}
                    {cf.explanationFocus !== "hook" && (
                      <div className="bg-gold-soft rounded-xl p-4">
                        <div className="text-sm font-black text-gold mb-1.5">{cw.hook.label}</div>
                        <p className="text-[16px] leading-relaxed">{cw.hook.text}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky next button */}
          <div className="sticky bottom-0 pt-3 pb-2 bg-background/95 backdrop-blur-sm">
            <button onClick={next}
              className="w-full bg-accent text-white font-bold text-lg py-4 rounded-2xl hover:bg-accent2 transition-all active:scale-[0.98]">
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
