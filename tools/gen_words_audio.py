#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
按年级分包批量生成单词/短语发音 mp3（edge-tts 在线 TTS + ffmpeg 重编码）。

数据源：node tools/dump_audio_words.js 输出的 JSON，来自 data/words.js、
        data/words_g456.js、data/book_index.js（单一数据源，无需在此维护词表）。
输出：  subpackages/<grade>/audio/words/<slug>.mp3
        文件名 slug = 小写、空格转下划线（连字符保留），见 data/book_index.js。
格式：  MPEG-1 Layer3，44100Hz 单声道 64kbps（iOS/安卓均兼容；
        edge-tts 原生的低采样率 MPEG-2 mp3 在 iOS 上会拒播，必须重编码）。
清单：  data/word_audio.js，按年级记录已生成的音频文件名。

用法：
  python tools/gen_words_audio.py                       # 全部册次，跳过已存在文件（可断点续跑）
  python tools/gen_words_audio.py --grades g4 g5        # 只处理指定年级
  python tools/gen_words_audio.py --force               # 强制重新生成全部
  python tools/gen_words_audio.py --concurrency 8       # 调整并发（默认 5）
  python tools/gen_words_audio.py --manifest-only       # 只按现有 mp3 重建清单
"""
import argparse
import asyncio
import json
import os
import subprocess
import sys
import tempfile

import edge_tts
import imageio_ffmpeg

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DUMP = os.path.join(ROOT, "tools", "dump_audio_words.js")
MANIFEST = os.path.join(ROOT, "data", "word_audio.js")
ALL_GRADES = ["g3", "g3b", "g4", "g4b", "g5", "g6"]

VOICE = "en-US-AriaNeural"   # 清晰美式女声，适合儿童跟读
RATE = "+0%"
VOLUME = "+0%"

# 特殊发音覆盖：缩写/字母词直接交给 TTS 容易被误读
PRON_OVERRIDE = {
    "ms": "Miss",        # Ms 与 Miss 同音 /mɪz/
    "mrs": "Miss",
    "mr": "Mister",      # Mr 直接交给 TTS 容易读成字母名 M-R
    "pe": "P E",         # 体育课缩写，念字母名
    "tv": "T V",
    "ok": "okay",
}

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def audio_dir(grade):
    return os.path.join(ROOT, "subpackages", grade, "audio", "words")


def load_words():
    """调用 Node 读取 JS 词表，返回 {grade: {slug: 原文}}"""
    out = subprocess.check_output(["node", DUMP], cwd=ROOT)
    return json.loads(out.decode("utf-8"))


def tmp_path():
    fd, p = tempfile.mkstemp(prefix="ldtts_", suffix=".mp3")
    os.close(fd)  # Windows 上必须先关闭句柄，edge-tts 才能写入
    return p


async def gen_one(slug, text, out_path, sem):
    """TTS 生成 -> ffmpeg 重编码为 44100Hz/64k mp3，失败自动重试 3 次。"""
    async with sem:
        last_err = None
        for attempt in range(3):
            tmp = tmp_path()
            try:
                tts_text = PRON_OVERRIDE.get(slug, text)
                await edge_tts.Communicate(tts_text, VOICE, rate=RATE, volume=VOLUME).save(tmp)
                cmd = [
                    FFMPEG, "-y", "-i", tmp,
                    "-ar", "44100", "-ac", "1", "-b:a", "64k",
                    "-codec:a", "libmp3lame", out_path,
                ]
                r = await asyncio.to_thread(
                    subprocess.run, cmd,
                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                )
                if r.returncode != 0:
                    tail = (r.stderr or b"")[-200:].decode("utf-8", "ignore")
                    raise RuntimeError("ffmpeg 失败: " + tail)
                size = os.path.getsize(out_path)
                if size < 1000:
                    raise RuntimeError("文件异常过小: %d B" % size)
                return slug, size
            except Exception as e:  # noqa: BLE001 - 批量任务需吞掉单次异常并重试
                last_err = e
                if os.path.exists(out_path):
                    try:
                        os.remove(out_path)
                    except OSError:
                        pass
                if attempt < 2:
                    await asyncio.sleep(1.0 + attempt * 1.5)
            finally:
                try:
                    os.remove(tmp)
                except OSError:
                    pass
        raise RuntimeError("%s: %s" % (slug, last_err))


async def process_grade(grade, mapping, force, concurrency):
    d = audio_dir(grade)
    os.makedirs(d, exist_ok=True)
    todo = [
        (slug, text) for slug, text in sorted(mapping.items())
        if force or not os.path.isfile(os.path.join(d, slug + ".mp3"))
    ]
    print("[%s] 共 %d 词，需生成 %d，跳过已存在 %d"
          % (grade, len(mapping), len(todo), len(mapping) - len(todo)), flush=True)
    if not todo:
        return []

    sem = asyncio.Semaphore(concurrency)
    tasks = [
        asyncio.create_task(gen_one(slug, text, os.path.join(d, slug + ".mp3"), sem))
        for slug, text in todo
    ]
    fails, sizes = [], []
    for i, fut in enumerate(asyncio.as_completed(tasks), 1):
        try:
            _, size = await fut
            sizes.append(size)
        except Exception as e:  # noqa: BLE001
            fails.append(str(e))
        if i % 25 == 0 or i == len(tasks):
            print("[%s] 进度 %d/%d，失败 %d" % (grade, i, len(tasks), len(fails)), flush=True)
    if sizes:
        print("[%s] 新增 %.1f KB，平均 %d B/词"
              % (grade, sum(sizes) / 1024, sum(sizes) // len(sizes)), flush=True)
    return fails


def write_manifest():
    """按各分包目录实际存在的 mp3 重建 data/word_audio.js。"""
    data = {}
    for g in ALL_GRADES:
        d = audio_dir(g)
        files = sorted(f[:-4] for f in os.listdir(d) if f.endswith(".mp3")) if os.path.isdir(d) else []
        data[g] = files
    body = json.dumps(data, ensure_ascii=False, indent=2)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        fh.write("// 自动生成，请勿手动修改。\n")
        fh.write("// 按年级记录已生成真实发音的音频文件名（slug）。audio.js 优先播放分包内 mp3，\n")
        fh.write("// 清单未包含或分包未加载时自动回退为逐字母拼读（announceWord）。\n")
        fh.write("module.exports = {\n  WORD_AUDIO: " + body + "\n};\n")
    print("清单已写入 %s（%s）"
          % (MANIFEST, "，".join("%s=%d" % (g, len(data[g])) for g in ALL_GRADES)), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--grades", nargs="*", choices=ALL_GRADES, help="仅处理指定年级")
    ap.add_argument("--force", action="store_true", help="强制重新生成（覆盖已有文件）")
    ap.add_argument("--concurrency", type=int, default=5, help="并发数，默认 5")
    ap.add_argument("--manifest-only", action="store_true", help="只按现有 mp3 重建清单")
    args = ap.parse_args()

    if args.manifest_only:
        write_manifest()
        return

    words = load_words()
    grades = args.grades or ALL_GRADES
    all_fails = []
    for g in grades:
        all_fails += asyncio.run(process_grade(g, words.get(g, {}), args.force, args.concurrency))

    write_manifest()
    print("\n完成。失败 %d 个" % len(all_fails), flush=True)
    if all_fails:
        print("失败列表（可原样重跑本脚本补生成）：", flush=True)
        for f in all_fails[:50]:
            print("  -", f, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
