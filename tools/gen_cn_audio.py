#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
按年级分包批量生成「中文释义」发音 mp3（edge-tts 在线 TTS + ffmpeg 重编码）。

与 gen_words_audio.py 的区别：
  - 声音：zh-CN-XiaoxiaoNeural（中文女声），文本来自 data 词表的 cn 字段（已做 TTS 清洗）；
  - 文件名：与英文发音完全同 slug，放在 subpackages/<grade>/audio/cn/ 下；
  - 体积：44100Hz 单声道 48kbps（MPEG-1 Layer3，iOS/安卓均兼容），
    并裁掉首尾静音。中文释义都很短，不裁静音会明显推高总包（微信总包上限 30 MiB）。
  - 清单：data/cn_audio.js，按年级记录已生成的 slug，供 utils/audio.js 查表。

数据源：node tools/dump_cn_audio_words.js 输出的 JSON（单一数据源，不在此维护词表）。
输出：  subpackages/<grade>/audio/cn/<slug>.mp3
清单：  data/cn_audio.js -> { CN_AUDIO: { grade: [slug, ...] } }

用法：
  python tools/gen_cn_audio.py --probe 24        # 只生成 24 个样本到临时目录，估算体积，不写清单
  python tools/gen_cn_audio.py                   # 全部 944 条，跳过已存在（可断点续跑）
  python tools/gen_cn_audio.py --grades g3 g4    # 只处理指定年级
  python tools/gen_cn_audio.py --force           # 强制重新生成全部
  python tools/gen_cn_audio.py --concurrency 8   # 调整并发（默认 6）
  python tools/gen_cn_audio.py --manifest-only   # 只按现有 mp3 重建清单
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
DUMP = os.path.join(ROOT, "tools", "dump_cn_audio_words.js")
MANIFEST = os.path.join(ROOT, "data", "cn_audio.js")
ALL_GRADES = ["g3", "g3b", "g4", "g4b", "g5", "g6"]

VOICE = "zh-CN-XiaoxiaoNeural"
RATE = "+0%"
VOLUME = "+0%"
BITRATE = 48                          # kbps；44100Hz 下清晰度与体积的平衡点（实测总包仍远低于上限）
SILENCE_FILTER = (
    "silenceremove=start_periods=1:start_duration=0.05:start_threshold=-50dB:"
    "stop_periods=1:stop_duration=0.15:stop_threshold=-50dB"
)

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def audio_dir(grade, root=ROOT):
    return os.path.join(root, "subpackages", grade, "audio", "cn")


def load_words():
    """调用 Node 读取 JS 词表，返回 {grade: {slug: 中文 TTS 文本}}"""
    out = subprocess.check_output(["node", DUMP], cwd=ROOT)
    return json.loads(out.decode("utf-8"))


def tmp_path():
    fd, p = tempfile.mkstemp(prefix="ldcn_", suffix=".mp3")
    os.close(fd)  # Windows 上必须先关闭句柄，edge-tts 才能写入
    return p


async def gen_one(grade, slug, text, root, force, sem):
    out_path = os.path.join(audio_dir(grade, root), slug + ".mp3")
    if not force and os.path.isfile(out_path):
        return slug, os.path.getsize(out_path), True

    async with sem:
        last_err = None
        for attempt in range(3):
            tmp = tmp_path()
            try:
                await edge_tts.Communicate(text, VOICE, rate=RATE, volume=VOLUME).save(tmp)
                cmd = [
                    FFMPEG, "-y", "-i", tmp,
                    "-af", SILENCE_FILTER,
                    "-ar", "44100", "-ac", "1", "-b:a", str(BITRATE) + "k",
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
                if size < 500:
                    raise RuntimeError("文件异常过小: %d B" % size)
                return slug, size, False
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
        raise RuntimeError("%s/%s: %s" % (grade, slug, last_err))


async def process_all(tasks, root, force, concurrency):
    for g in ALL_GRADES:
        os.makedirs(audio_dir(g, root), exist_ok=True)
    sem = asyncio.Semaphore(concurrency)
    coros = [gen_one(g, slug, text, root, force, sem) for g, slug, text in tasks]
    fails, sizes, skipped = [], [], 0
    for i, fut in enumerate(asyncio.as_completed(
            [asyncio.create_task(c) for c in coros]), 1):
        try:
            _, size, was_skipped = await fut
            if was_skipped:
                skipped += 1
            else:
                sizes.append(size)
        except Exception as e:  # noqa: BLE001
            fails.append(str(e))
        if i % 50 == 0 or i == len(coros):
            print("进度 %d/%d，失败 %d" % (i, len(coros), len(fails)), flush=True)
    if sizes:
        print("新增 %.2f MiB，平均 %d B/条（跳过已存在 %d）"
              % (sum(sizes) / 1048576, sum(sizes) // len(sizes), skipped), flush=True)
    return fails


def write_manifest():
    data = {}
    for g in ALL_GRADES:
        d = audio_dir(g)
        files = sorted(f[:-4] for f in os.listdir(d) if f.endswith(".mp3")) if os.path.isdir(d) else []
        data[g] = files
    body = json.dumps(data, ensure_ascii=False, indent=2)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        fh.write("// 自动生成，请勿手动修改。\n")
        fh.write("// 按年级记录中文释义发音文件名（slug，与英文发音同名，位于 audio/cn/）。\n")
        fh.write("// 清单未包含或分包未加载时，听写模式的中文发音自动跳过，只播英文。\n")
        fh.write("module.exports = {\n  CN_AUDIO: " + body + "\n};\n")
    print("清单已写入 %s（%s）"
          % (MANIFEST, "，".join("%s=%d" % (g, len(data[g])) for g in ALL_GRADES)), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--grades", nargs="*", choices=ALL_GRADES, help="仅处理指定年级")
    ap.add_argument("--force", action="store_true", help="强制重新生成（覆盖已有文件）")
    ap.add_argument("--concurrency", type=int, default=6, help="并发数，默认 6")
    ap.add_argument("--manifest-only", action="store_true", help="只按现有 mp3 重建清单")
    ap.add_argument("--probe", type=int, metavar="N",
                    help="只生成前 N 条样本到临时目录，估算体积；不写清单、不进项目目录")
    args = ap.parse_args()

    if args.manifest_only:
        write_manifest()
        return

    words = load_words()
    grades = args.grades or ALL_GRADES
    tasks = [
        (g, slug, text)
        for g in grades
        for slug, text in sorted(words.get(g, {}).items())
    ]
    total_all = 944  # 词表全量，用于样本估算（实际以词表统计为准）
    if args.probe:
        tasks = tasks[:args.probe]
        root = tempfile.mkdtemp(prefix="ldcn_probe_")
        print("[probe] 生成 %d 条样本到 %s" % (len(tasks), root), flush=True)
    else:
        root = ROOT

    print("共 %d 条，声音 %s，%dHz/%dkbps + 裁静音"
          % (len(tasks), VOICE, 44100, BITRATE), flush=True)
    fails = asyncio.run(process_all(tasks, root, args.force, args.concurrency))

    if args.probe:
        files = []
        for g in ALL_GRADES:
            d = audio_dir(g, root)
            if os.path.isdir(d):
                files += [os.path.join(d, f) for f in os.listdir(d) if f.endswith(".mp3")]
        if files:
            avg = sum(os.path.getsize(f) for f in files) / len(files)
            print("[probe] 平均 %.0f B/条 -> 全量 %d 条约 %.2f MiB"
                  % (avg, total_all, avg * total_all / 1048576), flush=True)
            # 基线 = 现有主包 + 全部英文音频，动态读取，避免硬编码过时
            en_bytes = 0
            for g in ALL_GRADES:
                wd = os.path.join(ROOT, "subpackages", g, "audio", "words")
                if os.path.isdir(wd):
                    en_bytes += sum(
                        os.path.getsize(os.path.join(wd, f))
                        for f in os.listdir(wd) if f.endswith(".mp3")
                    )
            base = 1.03 + en_bytes / 1048576  # 主包约 1.03 MiB + 英文音频
            print("[probe] 预计总包 %.2f MiB（基线 %.2f MiB + 中文音频 %.2f MiB，微信上限 30 MiB）"
                  % (base + avg * total_all / 1048576, base,
                     avg * total_all / 1048576), flush=True)
        print("[probe] 样本目录保留供抽查：" + root, flush=True)
        return

    write_manifest()
    print("\n完成。失败 %d 个" % len(fails), flush=True)
    if fails:
        print("失败列表（可原样重跑本脚本补生成）：", flush=True)
        for f in fails[:50]:
            print("  -", f, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
