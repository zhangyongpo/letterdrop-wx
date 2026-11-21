#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
【已弃用，仅留档】用 en-US-AriaNeural 生成 A~Z 字母发音 mp3。

背景：2026-11-21 曾尝试用 TTS 统一字母/单词音色，做过三版试听：
  1) 直接丢字母 —— 被 TTS 当普通词读，且降调明显（像中文四声）。
  2) 谐音词（ay/bee/...）—— A 被读成 /aɪ/（= I），读音错误。
  3) 网上真人录音（SoundDino）—— 平调、读音标准，但授权需自行确认。
最终决策（用户拍板）：**以上全部弃用，沿用原有 `assets/audio/` 字母音**。
旧素材已备份到 `assets/audio_backup_legacy/`，如需回滚从该目录 cp 回去即可。

本脚本保留仅供研究，请不要直接 --apply 覆盖现有正式素材。
脚本当前采用谐音词方案（LETTER_NAMES），该方案读音有误，不应投入使用。

编码参数与 gen_words_audio.py 一致：MPEG-1 Layer3, 44100Hz, mono, 64kbps。
edge-tts 原生输出是低采样率 MPEG-2 mp3，必须经 ffmpeg 重编码。

用法（仅为留档，不建议执行）：
  python tools/gen_letter_audio.py              # 生成到预览目录
  python tools/gen_letter_audio.py --force      # 强制重新生成
  python tools/gen_letter_audio.py --apply      # 覆盖 assets/audio/ 与 dist（勿用）
"""
import argparse
import asyncio
import os
import subprocess
import sys
import tempfile

import edge_tts
import imageio_ffmpeg

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PREVIEW_DIR = os.path.join(ROOT, "assets", "audio_preview")
LIVE_DIR = os.path.join(ROOT, "assets", "audio")
DIST_DIR = os.path.join(ROOT, "dist", "wx", "assets", "audio")

VOICE = "en-US-AriaNeural"
RATE = "+0%"
VOLUME = "+0%"
LETTERS = [chr(c) for c in range(ord("A"), ord("Z") + 1)]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# 标准美式字母名的谐音词。直接把单个字母交给 TTS 会被当成普通词处理
# （如 A 读成冠词 /ə/），读不出标准的字母名 /eɪ/。用谐音词可稳定得到
# 教科书式的字母读音：A=/eɪ/, R=/ɑːr/, W=/ˈdʌbəljuː/, Z=/ziː/（美式）。
# edge-tts 不支持注入 <say-as interpret-as="characters">（服务端拒绝），故此为上策。
LETTER_NAMES = {
    "A": "ay", "B": "bee", "C": "see", "D": "dee", "E": "ee", "F": "eff",
    "G": "gee", "H": "aitch", "I": "eye", "J": "jay", "K": "kay", "L": "ell",
    "M": "em", "N": "en", "O": "oh", "P": "pee", "Q": "cue", "R": "ar",
    "S": "ess", "T": "tee", "U": "you", "V": "vee", "W": "double-u",
    "X": "ex", "Y": "why", "Z": "zee",
}


def tmp_path():
    fd, p = tempfile.mkstemp(prefix="ldletter_", suffix=".mp3")
    os.close(fd)  # Windows 上必须关闭句柄，edge-tts 才能写入
    return p


async def gen_one(ch, out_path, sem):
    """TTS 生成 -> ffmpeg 重编码，失败自动重试 3 次。"""
    async with sem:
        last_err = None
        for attempt in range(3):
            tmp = tmp_path()
            try:
                # 用字母名谐音词朗读，得到标准美式字母名（而非被当普通词误读）
                tts_text = LETTER_NAMES[ch]
                await edge_tts.Communicate(tts_text, VOICE, rate=RATE, volume=VOLUME).save(tmp)
                # edge-tts 尾部静音约 0.9s（旧版仅 0.23s），裁剪后再补 0.15s，
                # 避免游戏里读完字母还空等。时长从 ~1.42s 降到 ~0.93s。
                trim = ("silenceremove=stop_periods=1:stop_duration=0.25:"
                        "stop_threshold=-38dB,apad=pad_dur=0.15")
                cmd = [
                    FFMPEG, "-y", "-i", tmp, "-af", trim,
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
                return ch, size
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
        raise RuntimeError("%s: %s" % (ch, last_err))


async def generate(out_dir, force, concurrency):
    os.makedirs(out_dir, exist_ok=True)
    todo = [
        ch for ch in LETTERS
        if force or not os.path.isfile(os.path.join(out_dir, ch + ".mp3"))
    ]
    print("输出目录: %s" % out_dir, flush=True)
    print("共 %d 个字母，需生成 %d，跳过 %d"
          % (len(LETTERS), len(todo), len(LETTERS) - len(todo)), flush=True)
    if not todo:
        return []

    sem = asyncio.Semaphore(concurrency)
    tasks = [
        asyncio.create_task(gen_one(ch, os.path.join(out_dir, ch + ".mp3"), sem))
        for ch in todo
    ]
    fails, sizes = [], []
    for i, fut in enumerate(asyncio.as_completed(tasks), 1):
        try:
            ch, size = await fut
            sizes.append(size)
            print("  %s: %d B" % (ch, size), flush=True)
        except Exception as e:  # noqa: BLE001
            fails.append(str(e))
        if i % 10 == 0 or i == len(tasks):
            print("进度 %d/%d，失败 %d" % (i, len(tasks), len(fails)), flush=True)
    if sizes:
        print("新增 %.1f KB，平均 %d B/字母"
              % (sum(sizes) / 1024, sum(sizes) // len(sizes)), flush=True)
    return fails


def apply_to_live():
    """把预览目录的 26 个字母音覆盖到 assets/audio/ 和 dist/wx/assets/audio/。"""
    missing = [ch for ch in LETTERS if not os.path.isfile(os.path.join(PREVIEW_DIR, ch + ".mp3"))]
    if missing:
        print("预览目录缺少: %s，请先生成" % ",".join(missing), file=sys.stderr)
        sys.exit(1)
    for d in (LIVE_DIR, DIST_DIR):
        os.makedirs(d, exist_ok=True)
        for ch in LETTERS:
            src = os.path.join(PREVIEW_DIR, ch + ".mp3")
            dst = os.path.join(d, ch + ".mp3")
            with open(src, "rb") as fsrc, open(dst, "wb") as fdst:
                fdst.write(fsrc.read())
        print("已同步 %d 个字母音 -> %s" % (len(LETTERS), d), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="强制重新生成（覆盖已存在）")
    ap.add_argument("--concurrency", type=int, default=5, help="并发数，默认 5")
    ap.add_argument("--apply", action="store_true", help="生成后覆盖 assets/audio/ 与 dist 副本")
    args = ap.parse_args()

    fails = asyncio.run(generate(PREVIEW_DIR, args.force, args.concurrency))
    if fails:
        print("\n失败 %d 个（可原样重跑补生成）:" % len(fails), file=sys.stderr)
        for f in fails[:30]:
            print("  - %s" % f, file=sys.stderr)
        sys.exit(1)
    print("\n生成完成，共 %d 个" % len(LETTERS), flush=True)

    if args.apply:
        apply_to_live()


if __name__ == "__main__":
    main()
