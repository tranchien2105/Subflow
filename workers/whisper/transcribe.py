
import argparse
import json
import sys
import time
from pathlib import Path

from faster_whisper import WhisperModel


def transcribe_audio(audio_path: str, model_size: str = "tiny") -> dict:
    path = Path(audio_path)

    if not path.is_file():
        raise FileNotFoundError(f"Audio file not found: {path}")

    file_size = path.stat().st_size

    print(f"[Whisper diagnostics] Audio path: {path}", file=sys.stderr)
    print(f"[Whisper diagnostics] Audio size: {file_size} bytes", file=sys.stderr)

    if file_size == 0:
        raise ValueError("Audio file is empty.")

    print(f"Loading Whisper model: {model_size}", file=sys.stderr)
    started_at = time.perf_counter()

    model = WhisperModel(
        model_size,
        device="cpu",
        compute_type="int8",
        cpu_threads=4,
    )

    print("Transcribing audio...", file=sys.stderr)

    segments, info = model.transcribe(
        str(path),
        language="ja",
        task="transcribe",
        beam_size=1,
        vad_filter=False,
    )

    print(
        f"[Whisper diagnostics] language={info.language}, "
        f"language_probability={info.language_probability}, "
        f"duration={info.duration}",
        file=sys.stderr,
    )

    results = []

    for segment in segments:
        results.append(
            {
                "startMs": round(segment.start * 1000),
                "endMs": round(segment.end * 1000),
                "originalText": segment.text.strip(),
            }
        )

    print(
        f"[Whisper diagnostics] segments_count={len(results)}",
        file=sys.stderr,
    )

    if results:
        print(
            f"[Whisper diagnostics] first_segment={json.dumps(results[0], ensure_ascii=False)}",
            file=sys.stderr,
        )
        print(
            f"[Whisper diagnostics] last_segment={json.dumps(results[-1], ensure_ascii=False)}",
            file=sys.stderr,
        )

    return {
        "language": info.language,
        "languageProbability": round(info.language_probability, 4),
        "durationSeconds": round(info.duration, 3),
        "processingSeconds": round(time.perf_counter() - started_at, 3),
        "segments": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transcribe Japanese audio using faster-whisper."
    )
    parser.add_argument("audio", help="Path to an audio file")
    parser.add_argument(
        "--model",
        default="tiny",
        choices=["tiny", "base", "small"],
        help="Whisper model size (default: tiny)",
    )
    parser.add_argument(
        "--output",
        help="Optional JSON output file",
    )

    args = parser.parse_args()

    try:
        result = transcribe_audio(args.audio, args.model)
    except Exception as error:
        print(f"Transcription failed: {error}", file=sys.stderr)
        sys.exit(1)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
        output_path.write_text(output + "\n", encoding="utf-8")
        print(f"Saved transcription to {output_path}", file=sys.stderr)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
