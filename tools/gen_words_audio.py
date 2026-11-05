#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用 edge-tts（微软在线 TTS）为英语单词生成真实发音 mp3，并尽量压缩。

输出：assets/audio/words/<word>.mp3  （小写、去空格命名）
格式：audio-16khz-32kbitrate-mp3  （16kHz 单声道，约 32kbps，体积最小且清晰）

用法：
  python3 tools/gen_words_audio.py            # 仅生成 Welcome unit
  python3 tools/gen_words_audio.py --all       # 生成全部单元（含去重）
  python3 tools/gen_words_audio.py --words cat dog   # 自定义单词
"""
import argparse
import asyncio
import os
import shutil
import subprocess
import sys
import tempfile

import edge_tts
import imageio_ffmpeg


def get_ffmpeg():
    p = shutil.which("ffmpeg")
    if p:
        return p
    try:
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


VOICE = "en-US-AriaNeural"   # 清晰美式女声，适合儿童跟读
RATE = "+0%"                 # 可改 "-10%" 稍慢
VOLUME = "+0%"

# Welcome unit 单词（外研剑桥 Join In 三上）
WELCOME = [
    "let", "begin", "join", "in", "English", "be", "easy", "come", "and",
    "you", "ready", "kid", "yes", "OK", "listen", "sing", "speak", "act",
    "draw", "look", "guess", "write", "think", "read", "colour", "play",
    "hello", "mime",
]

# 其余单元（--all 时合并去重）
OTHER = {
    "u1": ["speak","draw","look","guess","write","think","read","colour","play",
           "hello","what","your","name","go","we","all","love","clever","bird",
           "him","good","morning","this","nice","to","meet","happy","birthday",
           "afternoon","Ms","how","today","too","fine","children","cut","my","hi",
           "goodbye"],
    "u2": ["colourful","world","red","pink","yellow","green","orange","black",
           "brown","blue","white","purple","the","rainbow","it","start","necklace",
           "for","mum","old","can","paint","only","me","thank","dear","at",
           "butterfly","lovely","little","favourite","no","yes","that","right"],
    "u3": ["number","fun","tiger","jump","do","ten","nine","eight","seven","six",
           "five","four","three","two","one","duck","show","about","dad","please",
           "hurry","up","wrong","see","many","get","out","have","help","great",
           "late","safe","call","people"],
    "u4": ["school","thing","pencil","case","pen","eraser","schoolbag","ruler",
           "book","home","where","picture","on","wall","paper","open","take","rope"],
    "u5": ["classroom","blackboard","door","window","desk","chair","floor","ball",
           "behind","front","of","beside","under","now","class","wow","next","keep",
           "with","over","clean","sweep","put","tomorrow","they"],
}


def norm(w):
    return w.strip().lower()


async def gen_one(text, out_path):
    """TTS 生成后，用 ffmpeg 重编码为 16kHz 单声道 32kbps mp3 以尽量压缩。"""
    ffmpeg = get_ffmpeg()
    if not ffmpeg:
        # 无 ffmpeg 时退化为直接使用 edge-tts 默认输出
        comm = edge_tts.Communicate(text, VOICE, rate=RATE, volume=VOLUME)
        await comm.save(out_path)
        return
    tmp = out_path + ".raw.mp3"
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, volume=VOLUME)
    await comm.save(tmp)
    cmd = [
        ffmpeg, "-y", "-i", tmp,
        "-ar", "16000", "-ac", "1", "-b:a", "32k",
        "-codec:a", "libmp3lame", out_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL)
    try:
        os.remove(tmp)
    except OSError:
        pass


def write_manifest(out_dir):
    """汇总 words 目录下所有 mp3（已生成单词），写入 data/word_audio.js，
    供 audio.js 优先播放真实发音而非逐字母拼读。多次运行会自动合并累计。"""
    files = [f[:-4] for f in os.listdir(out_dir) if f.endswith(".mp3")]
    files = sorted(set(files))
    repo_data = os.path.abspath(os.path.join(out_dir, "..", "..", "..", "data"))
    os.makedirs(repo_data, exist_ok=True)
    path = os.path.join(repo_data, "word_audio.js")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("// 自动生成，请勿手动修改。\n")
        fh.write("// 记录已生成真实发音（edge-tts）的单词（小写文件名）。audio.js 优先播放这些 mp3，\n")
        fh.write("// 清单未包含的单词自动回退为逐字母拼读（announceWord）。\n")
        fh.write("module.exports = { WORD_AUDIO: " + repr(files) + " };\n")
    print("清单已写入", path, "(" + str(len(files)) + " 词)")


async def main(words):
    out_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "audio", "words")
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)

    words = sorted({norm(w) for w in words})
    print(f"待生成 {len(words)} 个单词 -> {out_dir}")
    ok, fail = [], []
    for w in words:
        path = os.path.join(out_dir, w + ".mp3")
        try:
            await gen_one(w, path)
            size = os.path.getsize(path)
            ok.append((w, size))
            print(f"  ✓ {w:10s} {size:6d} B")
        except Exception as e:
            fail.append((w, str(e)))
            print(f"  ✗ {w:10s} {e}")

    print(f"\n完成：成功 {len(ok)}，失败 {len(fail)}")
    total = sum(s for _, s in ok)
    print(f"总大小：{total} B ({total/1024:.1f} KB)，平均 {total//max(len(ok),1)} B/词")
    write_manifest(out_dir)
    if fail:
        print("失败列表：", fail)
        sys.exit(1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="生成全部单元（去重）")
    ap.add_argument("--words", nargs="*", help="自定义单词列表")
    args = ap.parse_args()

    if args.words:
        words = args.words
    elif args.all:
        words = list(WELCOME)
        for v in OTHER.values():
            words += v
    else:
        words = WELCOME

    asyncio.run(main(words))
