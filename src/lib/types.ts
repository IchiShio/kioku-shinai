export interface WordFormat {
  type: string;
  difficulty: number; // 1=easy, 2=medium, 3=hard
  instruction: string;
  sentence?: string;
  hint?: string;
  choices: string[];
  correct: number;
  /** Which explanation section to show for this format */
  explanationFocus: "etymology" | "cognitive" | "gap" | "hook" | "cognates";
}

export interface EtymologyPart {
  part: string;
  meaning: string;
  lang: string;
}

export interface WordData {
  word: string;
  phonetic: string;
  level: "beginner" | "intermediate";
  /** Visual etymology breakdown */
  parts: EtymologyPart[];
  formats: WordFormat[];
  examples: string[];
  etymology: {
    fact: string;
    source: string;
    cognates: string[];
    /** One-line summary for correct answer */
    oneliner: string;
  };
  cognitive: {
    fact: string;
    source: string;
    label: string;
    oneliner: string;
  };
  gap: string;
  gapOneliner: string;
  hook: {
    text: string;
    label: string;
    contradicts_etymology: boolean;
  };
}
