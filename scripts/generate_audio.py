#!/usr/bin/env python3
"""
記憶しない英単語 — Edge TTS 音声生成スクリプト

単語データ（JSON）を読み込み、単語本体と全例文のMP3を生成する。
英米豪 × 男女 = 6声をラウンドロビンで均等に割り当て。

使い方:
  python3 scripts/generate_audio.py                    # 全単語
  python3 scripts/generate_audio.py --word company     # 特定の単語のみ
  python3 scripts/generate_audio.py --voices           # 音声一覧を表示
"""

import asyncio
import json
import sys
import os
import argparse
from pathlib import Path

# edge-tts import
try:
    import edge_tts
except ImportError:
    print("edge-tts が未インストールです。")
    print("pip install edge-tts --break-system-packages")
    sys.exit(1)

# ── 6 voices: US/GB/AU × Male/Female ──
VOICES = [
    {"id": "en-US-ChristopherNeural", "region": "US", "gender": "Male"},
    {"id": "en-US-JennyNeural",       "region": "US", "gender": "Female"},
    {"id": "en-GB-RyanNeural",        "region": "GB", "gender": "Male"},
    {"id": "en-GB-SoniaNeural",       "region": "GB", "gender": "Female"},
    {"id": "en-AU-WilliamMultilingualNeural", "region": "AU", "gender": "Male"},
    {"id": "en-AU-NatashaNeural",     "region": "AU", "gender": "Female"},
]

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data"
AUDIO_DIR = PROJECT_ROOT / "public" / "audio"


async def generate_mp3(text: str, voice_id: str, output_path: Path):
    """Generate MP3 from text using Edge TTS."""
    communicate = edge_tts.Communicate(text, voice_id)
    await communicate.save(str(output_path))


async def process_word(word_data: dict, voice_index: int) -> int:
    """Process a single word: generate audio for word + all examples."""
    word = word_data["word"]
    word_dir = AUDIO_DIR / word
    word_dir.mkdir(parents=True, exist_ok=True)

    tasks = []

    # 1. Word pronunciation
    voice = VOICES[voice_index % len(VOICES)]
    word_file = word_dir / "word.mp3"
    if not word_file.exists():
        tasks.append(("word", generate_mp3(word, voice["id"], word_file), voice))
    voice_index += 1

    # 2. Example sentences from all question formats
    for fmt_idx, fmt in enumerate(word_data.get("formats", [])):
        # Sentences in choices or sentence field
        sentences = []
        if "sentence" in fmt:
            # Extract clean text from HTML sentence
            import re
            clean = re.sub(r"<[^>]+>", word, fmt["sentence"])
            clean = re.sub(r"&nbsp;", "", clean)
            sentences.append(("sentence", clean))

        # Correct answer as example
        if "choices" in fmt and "correct" in fmt:
            correct_text = fmt["choices"][fmt["correct"]]
            if len(correct_text.split()) > 3:  # Only full sentences
                sentences.append(("choice", correct_text))

        for sent_idx, (sent_type, text) in enumerate(sentences):
            voice = VOICES[voice_index % len(VOICES)]
            filename = f"fmt{fmt_idx}_{sent_type}_{sent_idx}.mp3"
            filepath = word_dir / filename
            if not filepath.exists():
                tasks.append((filename, generate_mp3(text, voice["id"], filepath), voice))
            voice_index += 1

    # 3. Example sentences from etymology section
    for ex_idx, example in enumerate(word_data.get("examples", [])):
        voice = VOICES[voice_index % len(VOICES)]
        filepath = word_dir / f"example_{ex_idx}.mp3"
        if not filepath.exists():
            tasks.append((f"example_{ex_idx}", generate_mp3(example, voice["id"], filepath), voice))
        voice_index += 1

    # Execute all tasks
    for name, task, voice in tasks:
        try:
            await task
            print(f"  {word}/{name} -> {voice['id']} ({voice['region']}/{voice['gender']})")
        except Exception as e:
            print(f"  ERROR {word}/{name}: {e}")

    return voice_index


async def main():
    parser = argparse.ArgumentParser(description="Edge TTS audio generator for 記憶しない英単語")
    parser.add_argument("--word", help="Generate audio for specific word only")
    parser.add_argument("--voices", action="store_true", help="List available voices")
    parser.add_argument("--force", action="store_true", help="Regenerate existing files")
    args = parser.parse_args()

    if args.voices:
        print("Available voices:")
        for v in VOICES:
            print(f"  {v['id']:40s} {v['region']}/{v['gender']}")
        return

    # Find all word JSON files
    word_files = sorted(DATA_DIR.glob("*.json"))
    if not word_files:
        print(f"No word data found in {DATA_DIR}")
        print("Run generate_words.py first.")
        return

    if args.word:
        word_files = [f for f in word_files if f.stem == args.word]
        if not word_files:
            print(f"Word '{args.word}' not found in {DATA_DIR}")
            return

    if args.force:
        import shutil
        for wf in word_files:
            d = AUDIO_DIR / wf.stem
            if d.exists():
                shutil.rmtree(d)

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    voice_index = 0  # Round-robin counter across all words
    total = len(word_files)

    for i, wf in enumerate(word_files):
        with open(wf) as f:
            word_data = json.load(f)
        print(f"[{i+1}/{total}] {word_data['word']}")
        voice_index = await process_word(word_data, voice_index)

    # Print voice distribution
    print("\n--- Voice distribution ---")
    counts = {}
    for audio_file in AUDIO_DIR.rglob("*.mp3"):
        # We can't easily track this without metadata, so just count files
        pass
    print(f"Total audio files: {len(list(AUDIO_DIR.rglob('*.mp3')))}")
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
