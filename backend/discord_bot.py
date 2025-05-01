import discord
import sqlite3
import os
from dotenv import load_dotenv
import asyncio
from discord.ext import commands
from discord import app_commands
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import matplotlib.pyplot as plt
import aiohttp
import io
import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim
from PIL import ImageSequence
from moviepy import VideoFileClip
import zipfile
from scipy.signal import spectrogram
from pydub import AudioSegment
import matplotlib.patches as patches
from collections import Counter
from scipy.signal import stft
import string
import traceback
import librosa

# Load environment variables
load_dotenv()
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID"))

DB_PATH = "/var/www/my-site/backend/db.sqlite3"

ROLE_TO_PUZZLE = {
    "4K Award": "4k",
    "3K Award": "3k",
    "2K Award": "2k",
    "1K Award": "1k",
    "Sequence Award": "number_sequence",
    "Christmas 2022 Award": "xmas2022",
    "Christmas 2020 Award": "xmas2020",
    "Good Side Award": "goodside",
    "Superman Award": "rip",
    "Blocker Award": "blocker",
    "Sourcer's Award": "sourcers",
    "Cipher Stack Award": "cipherstack",
    "Vigenère Award": "vigenere",
    "Cryptogram Award": "cryptogram",
    "AFK Award": "afk",
    "Heart Award": "heart",
    "XOR Award": "xor",
    "Premium One Award": "p1"
}

def normalize_symbol(img):
    img = img.astype(np.float32)
    mean = np.mean(img)
    std = np.std(img) if np.std(img) != 0 else 1
    return (img - mean) / std

def is_inside(inner, outer):
    ix, iy, iw, ih = inner
    ox, oy, ow, oh = outer
    return (
        ix >= ox and iy >= oy and
        ix + iw <= ox + ow and
        iy + ih <= oy + oh
    )

def transcribe_symbols_from_image(image: Image.Image):
    image_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)

    bg_color = int(np.bincount(gray.flatten()).argmax())
    contrast = cv2.absdiff(gray, bg_color)
    _, binary = cv2.threshold(contrast, 30, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    dilated = cv2.dilate(cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel), kernel)

    _, _, stats, _ = cv2.connectedComponentsWithStats(dilated)

    # Step 1: Collect candidate boxes
    candidates = []
    for i in range(1, stats.shape[0]):
        x, y, w, h, area = stats[i]
        if 100 < area < 5000:
            candidates.append((x, y, w, h))

    # Step 2: Remove nested boxes
    filtered = []
    for box in candidates:
        if not any(is_inside(box, other) and box != other for other in candidates):
            filtered.append(box)

    # Step 3: Extract + normalize
    positions, vectors = [], []
    for x, y, w, h in filtered:
        crop = gray[y:y+h, x:x+w]
        resized = cv2.resize(crop, (40, 40), interpolation=cv2.INTER_AREA)
        vectors.append(normalize_symbol(resized))
        positions.append((x, y, w, h))

    # Step 4: Group similar symbols
    labels, refs = [], []
    for vec in vectors:
        for j, ref in enumerate(refs):
            if ssim(vec, ref, data_range=2.0) > threshold:
                labels.append(chr(ord('A') + j))
                break
        else:
            refs.append(vec)
            labels.append(chr(ord('A') + len(refs) - 1))

    # Step 5: Group into rows + sort LTR
    boxes = list(zip(positions, labels))
    boxes.sort(key=lambda b: (b[0][1] + b[0][3] // 2))  # vertical center sort
    rows = []
    for box in boxes:
        (x, y, w, h), label = box
        cy = y + h // 2
        for row in rows:
            rcy = row[0][0][1] + row[0][0][3] // 2
            if abs(cy - rcy) < 40:
                row.append(box)
                break
        else:
            rows.append([box])
    rows.sort(key=lambda r: r[0][0][1])
    final = [b for row in rows for b in sorted(row, key=lambda b: b[0][0])]

    # Step 6: Draw & return
    for (x, y, w, h), label in final:
        cv2.rectangle(image_cv, (x, y), (x+w, y+h), (0, 0, 255), 2)
        cv2.putText(image_cv, label, (x, y-3), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

    transcribed = ''.join(label for _, label in final)
    final_img = Image.fromarray(cv2.cvtColor(image_cv, cv2.COLOR_BGR2RGB))
    output = io.BytesIO()
    final_img.save(output, format="PNG")
    output.seek(0)
    return transcribed, output


def better_enhance(image: Image.Image) -> Image.Image:
    img_np = np.array(image.convert("RGB"))

    # LAB space brightness boost
    lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.equalizeHist(l)
    lab = cv2.merge((l, a, b))
    img_np = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

    # Gamma correction
    gamma = 1.2
    inv_gamma = 1.0 / gamma
    table = np.array([(i / 255.0) ** inv_gamma * 255 for i in range(256)]).astype("uint8")
    img_np = cv2.LUT(img_np, table)

    # Sharpen
    blur = cv2.GaussianBlur(img_np, (0, 0), 3)
    img_np = cv2.addWeighted(img_np, 1.5, blur, -0.5, 0)

    return Image.fromarray(img_np)


async def enhance_image_from_url(url):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    print("❌ Failed to fetch image:", resp.status)
                    return None
                data = await resp.read()
                image = Image.open(io.BytesIO(data)).convert("RGB")

        image = better_enhance(image)  # your enhancement function
        output = io.BytesIO()
        image.save(output, format="PNG")
        output.seek(0)
        return output

    except Exception as e:
        print("❌ Error during enhancement:", e)
        return None

intents = discord.Intents.default()
intents.members = True

client = commands.Bot(command_prefix="!", intents=intents)

@client.event
async def on_ready():
    print(f"✅ Logged in as {client.user}")
    await client.wait_until_ready()

    # Sync to your main server instantly
    dev_guild = discord.Object(id=GUILD_ID)
    await client.tree.sync(guild=dev_guild)
    print("⚡ Synced to dev guild for fast testing.")

    # Sync globally in the background (takes up to 1 hour to appear)
    await client.tree.sync()
    print("🌍 Global commands synced.")

    asyncio.create_task(periodic_sync())
    await sync_members()

@client.tree.command(name="sync_commands", description="Force re-sync commands")
async def resync(interaction: discord.Interaction):
    await client.tree.sync()
    await interaction.response.send_message("🔁 Slash commands re-synced!", ephemeral=True)


@client.tree.command(name="hello", description="Replies with hello!")
async def hello(interaction: discord.Interaction):
    await interaction.response.send_message("Hello!")

@client.tree.command(name="progress", description="View puzzle progress for a user")
@app_commands.describe(user="The user to view progress for")
async def progress(interaction: discord.Interaction, user: discord.Member):
    try:
        discord_id = str(user.id)
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("SELECT id FROM users WHERE discord_id = ?", (discord_id,))
            row = c.fetchone()
            if not row:
                await interaction.response.send_message(f"❌ `{user.display_name}` is not linked to a DECIPHER account.", ephemeral=True)
                return
            user_id = row[0]

            # Fetch all puzzles they solved
            c.execute("SELECT puzzle_name FROM puzzle_progress WHERE user_id = ? AND completed = 1", (user_id,))
            solved = {row[0] for row in c.fetchall()}

            # List of all puzzles
            all_puzzles = [
                "1k", "2k", "3k", "4k", "blocker", "cipherstack", "goodside", "heart",
                "number_sequence", "rip", "sourcers", "vigenere", "xmas2020", "xmas2022", "xor",
                "afk", "cryptogram", "p1"
            ]

            unsolved = [p for p in all_puzzles if p not in solved]
            solved_list = [p for p in all_puzzles if p in solved]

            total = len(all_puzzles)
            count_solved = len(solved_list)

            # Build message
            msg = f"🧩 **Progress for <@{user.id}>:**\n"
            msg += f"**{count_solved}/{total} puzzles solved**\n\n"

            if unsolved:
                msg += "**❌ Unsolved puzzles:**\n"
                msg += ', '.join(unsolved) + "\n\n"
            else:
                msg += "✅ **All puzzles solved!**\n\n"

            if solved_list:
                msg += "**✅ Solved puzzles:**\n"
                msg += ', '.join(solved_list)

        await interaction.response.send_message(content=msg, allowed_mentions=discord.AllowedMentions.none())
    except Exception as e:
        print("❌ Error in /progress:", e)
        await interaction.response.send_message("⚠️ Failed to fetch progress.", ephemeral=True)

@client.tree.command(name="spectrogram", description="Generate a spectrogram from an audio file")
@app_commands.describe(file="Upload an audio file")
async def spectrogram_command(interaction: discord.Interaction, file: discord.Attachment):
    await interaction.response.defer()
    try:
        import librosa
        import librosa.display

        content = await file.read()
        audio = AudioSegment.from_file(io.BytesIO(content))
        samples = np.array(audio.get_array_of_samples()).astype(np.float32)
        if audio.channels == 2:
            samples = samples.reshape((-1, 2)).mean(axis=1)

        sr = audio.frame_rate
        n_fft = 4096  # sharper window
        hop_length = n_fft // 4

        S = librosa.feature.melspectrogram(
            y=samples, sr=sr, n_fft=n_fft, hop_length=hop_length,
            n_mels=512, fmin=0, fmax=sr/2
        )
        S_dB = librosa.power_to_db(S, ref=np.max)

        max_bin = np.max(np.where(np.max(S_dB, axis=1) > -80))  # -80 dB cutoff
        max_freq = (max_bin / S.shape[0]) * (sr / 2)
        max_freq = max(5000, max_freq)

        plt.figure(figsize=(12, 5))
        librosa.display.specshow(S_dB, sr=sr, hop_length=hop_length,
                                 x_axis='time', y_axis='mel', fmin=0, fmax=sr/2, cmap='magma')
        plt.ylim(0, max_freq)
        plt.colorbar(format='%+2.0f dB')
        plt.title('Mel-Scaled Spectrogram')
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=200)  # sharpen
        buf.seek(0)
        plt.close()

        await interaction.followup.send("📈 Spectrogram generated:", file=discord.File(buf, filename="spectrogram.png"))
    except Exception as e:
        await interaction.followup.send(f"❌ Failed to generate spectrogram: {e}")

@client.tree.context_menu(name="Spectrogram from Audio")
async def spectrogram_menu(interaction: discord.Interaction, message: discord.Message):
    await interaction.response.defer()
    try:
        import librosa
        import librosa.display

        if not message.attachments:
            await interaction.followup.send("⚠️ No audio file found in that message.", ephemeral=True)
            return
        attachment = message.attachments[0]
        content = await attachment.read()
        audio = AudioSegment.from_file(io.BytesIO(content))
        samples = np.array(audio.get_array_of_samples()).astype(np.float32)
        if audio.channels == 2:
            samples = samples.reshape((-1, 2)).mean(axis=1)

        sr = audio.frame_rate
        n_fft = 4096
        hop_length = n_fft // 4

        S = librosa.feature.melspectrogram(
            y=samples, sr=sr, n_fft=n_fft, hop_length=hop_length,
            n_mels=512, fmin=0, fmax=sr/2
        )
        S_dB = librosa.power_to_db(S, ref=np.max)

        max_bin = np.max(np.where(np.max(S_dB, axis=1) > -80))
        max_freq = (max_bin / S.shape[0]) * (sr / 2)
        max_freq = max(5000, max_freq)

        plt.figure(figsize=(12, 5))
        librosa.display.specshow(S_dB, sr=sr, hop_length=hop_length,
                                 x_axis='time', y_axis='mel', fmin=0, fmax=sr/2, cmap='magma')
        plt.ylim(0, max_freq)
        plt.colorbar(format='%+2.0f dB')
        plt.title('Mel-Scaled Spectrogram')
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=200)
        buf.seek(0)
        plt.close()

        await interaction.followup.send(file=discord.File(buf, filename="spectrogram.png"))
    except Exception as e:
        await interaction.followup.send(f"❌ Failed to generate spectrogram: {e}", ephemeral=True)


@client.tree.command(name="keyboard-heatmap", description="Show a heatmap of key usage on a QWERTY keyboard.")
@app_commands.describe(text="Text to analyze")
async def keyboard_heatmap(interaction: discord.Interaction, text: str):

    await interaction.response.defer()

    # Clean and count letters
    clean = ''.join(c for c in text.upper() if c in string.ascii_uppercase)
    total = len(clean)
    counts = Counter(clean)

    # QWERTY layout
    layout = [
        "QWERTYUIOP",
        "ASDFGHJKL",
        "ZXCVBNM"
    ]

    fig, ax = plt.subplots(figsize=(10, 4))
    ax.set_facecolor("#fdf1de")
    ax.axis('off')

    # Max frequency for scaling
    max_freq = max((counts[l] / total * 100 for l in counts), default=0)

    # Draw keyboard
    for row_idx, row in enumerate(layout):
        for col_idx, key in enumerate(row):
            freq = counts.get(key, 0) / total * 100 if total else 0
            intensity = freq / max_freq if max_freq else 0
            color = (1.0, 1.0 - intensity, 1.0 - intensity)  # light red fade
            ax.add_patch(plt.Rectangle(
                (col_idx + 0.5 * row_idx, -row_idx), 1, 1,
                edgecolor='black', facecolor=color
            ))
            ax.text(col_idx + 0.5 * row_idx + 0.5, -row_idx + 0.5, key, ha='center', va='center', fontsize=14)

    ax.set_xlim(-1, len(layout[0]) + 2)
    ax.set_ylim(-3.5, 1)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
    buf.seek(0)
    plt.close()

    await interaction.followup.send("🎹 Keyboard heatmap:", file=discord.File(buf, filename="keyboard_heatmap.png"))


@client.tree.command(name="frequency-analysis", description="Show letter frequency analysis compared to English average")
@app_commands.describe(text="Text to analyze")
async def frequency_analysis(interaction: discord.Interaction, text: str):
    await interaction.response.defer()
    try:
        EN_FREQ = {
            'A': 8.17, 'B': 1.49, 'C': 2.78, 'D': 4.25, 'E': 12.70, 'F': 2.23,
            'G': 2.02, 'H': 6.09, 'I': 6.97, 'J': 0.15, 'K': 0.77, 'L': 4.03,
            'M': 2.41, 'N': 6.75, 'O': 7.51, 'P': 1.93, 'Q': 0.10, 'R': 5.99,
            'S': 6.33, 'T': 9.06, 'U': 2.76, 'V': 0.98, 'W': 2.36, 'X': 0.15,
            'Y': 1.97, 'Z': 0.07
        }

        clean = ''.join(c for c in text.upper() if c in string.ascii_uppercase)
        total = len(clean)
        counts = Counter(clean)

        data = [(ltr, (counts[ltr] / total * 100 if total else 0), EN_FREQ[ltr]) for ltr in EN_FREQ]
        data.sort(key=lambda x: -x[1])

        letters = [d[0] for d in data]
        calculated = [d[1] for d in data]
        expected = [d[2] for d in data]

        fig, ax = plt.subplots(figsize=(8, len(data) * 0.35))
        ax.set_facecolor("#fdf1de")
        y = np.arange(len(data))

        ax.barh(y, expected, color='red', height=0.4, label='% Expected')
        ax.barh(y, calculated, color='black', height=0.2, label='% Calculated')

        ax.set_yticks(y)
        ax.set_yticklabels(letters, fontsize=10)
        ax.invert_yaxis()
        ax.set_title('Letter Frequency Analysis', fontsize=14, weight='bold')
        ax.legend(loc='lower right', fontsize=9)

        max_val = max(max(calculated), max(expected))
        ax.set_xlim(0, max_val + 12)

        for i, (c, e) in enumerate(zip(calculated, expected)):
            ax.text(max_val + 1, i + 0.1, f"{c:.1f}%", fontsize=8, color='black', ha='left')
            ax.text(max_val + 6, i + 0.1, f"{e:.1f}%", fontsize=8, color='red', ha='left')

        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
        buf.seek(0)
        plt.close()

        await interaction.followup.send("📊 Frequency analysis chart:", file=discord.File(buf, filename="frequency_analysis.png"))
    except Exception as e:
        await interaction.followup.send(f"❌ Error: {e}")

@client.tree.command(name="stripwhitespace", description="Remove all whitespace from the input text.")
@app_commands.describe(text="Text to clean")
async def stripwhitespace(interaction: discord.Interaction, text: str):
    cleaned = ''.join(text.split())
    await interaction.response.send_message(f"🧹 Cleaned text:\n```\n{cleaned}\n```")


type_choices = [
    app_commands.Choice(name="jpg", value="jpg"),
    app_commands.Choice(name="png", value="png"),
    app_commands.Choice(name="svg", value="svg"),
    app_commands.Choice(name="tiff", value="tiff"),
    app_commands.Choice(name="bmp", value="bmp"),
    app_commands.Choice(name="ico", value="ico"),
    app_commands.Choice(name="mp4", value="mp4"),
    app_commands.Choice(name="mp3", value="mp3"),
]

@client.tree.command(name="convert", description="Convert media between types (image/audio)")
@app_commands.describe(
    file="Upload a media file",
    from_type="Original file format",
    to_type="Target file format"
)
@app_commands.choices(from_type=type_choices, to_type=type_choices)
async def convert(interaction: discord.Interaction, file: discord.Attachment, from_type: app_commands.Choice[str], to_type: app_commands.Choice[str]):
    await interaction.response.defer()
    try:
        content = await file.read()
        ext_in = from_type.value
        ext_out = to_type.value

        if ext_in == "jpeg":
            ext_in = "jpg"
        if ext_out == "jpeg":
            ext_out = "jpg"

        temp_input = f"temp_input.{ext_in}"
        temp_output = f"output.{ext_out}"

        with open(temp_input, "wb") as f:
            f.write(content)

        if ext_in == "mp4" and ext_out == "mp3":
            clip = VideoFileClip(temp_input)
            clip.audio.write_audiofile(temp_output)
        else:
            im = Image.open(temp_input)
            im.save(temp_output)

        await interaction.followup.send("✅ Converted file:", file=discord.File(temp_output))
    except Exception as e:
        await interaction.followup.send(f"❌ Conversion failed: {e}")
    finally:
        for f in [temp_input, temp_output]:
            if os.path.exists(f):
                os.remove(f)

@client.tree.command(name="gif-to-frames", description="Extract frames from a GIF")
@app_commands.describe(file="Upload a GIF file")
async def gif_to_frames(interaction: discord.Interaction, file: discord.Attachment):
    await interaction.response.defer()
    try:
        content = await file.read()
        gif = Image.open(io.BytesIO(content))
        frames = []
        for i, frame in enumerate(ImageSequence.Iterator(gif)):
            buf = io.BytesIO()
            frame.convert("RGB").save(buf, format="PNG")
            buf.seek(0)
            frames.append((f"frame_{i}.png", buf.read()))

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zipf:
            for name, data in frames:
                zipf.writestr(name, data)
        zip_buffer.seek(0)
        await interaction.followup.send("🖼️ Extracted GIF frames:", file=discord.File(zip_buffer, filename="frames.zip"))
    except Exception as e:
        await interaction.followup.send(f"❌ Failed to extract GIF frames: {e}")

@client.tree.context_menu(name="Convert Media")
async def convert_menu(interaction: discord.Interaction, message: discord.Message):
    await interaction.response.send_message("Use `/convert` with upload and format options.", ephemeral=True)

@client.tree.context_menu(name="GIF to Frames")
async def gif_menu(interaction: discord.Interaction, message: discord.Message):
    await interaction.response.send_message("Use `/gif-to-frames` with a GIF upload.", ephemeral=True)


@client.tree.command(name="force-sync", description="Manually trigger role sync")
async def force_sync(interaction: discord.Interaction):
    try:
        await interaction.response.send_message("🔄 Syncing roles now...", ephemeral=True)
        await sync_members()
        await interaction.followup.send("✅ Done syncing!")
    except Exception as e:
        print("❌ Error in /force-sync:", e)
        traceback.print_exc()
        await interaction.followup.send("⚠️ Sync failed.")

@client.tree.command(name="text-transcription", description="Transcribe text into letter groups (n-grams)")
@app_commands.describe(text="Text to transcribe", ngram="N-gram size (e.g. 1, 2, 3...)")
async def text_transcription(interaction: discord.Interaction, text: str, ngram: int):
    clean_text = ''.join(c for c in text if c.isalnum())
    if len(clean_text) % ngram != 0:
        await interaction.response.send_message(f"❌ Text length is not divisible by {ngram}.", ephemeral=True)
        return

    # Assign letters
    ngrams = [clean_text[i:i+ngram] for i in range(0, len(clean_text), ngram)]
    seen = {}
    current_char = ord('A')
    result_map = []

    for group in ngrams:
        if group not in seen:
            seen[group] = chr(current_char)
            current_char += 1
        result_map.append(seen[group])

    # Rebuild result with spacing and punctuation
    rebuilt = []
    idx = 0
    buffer = ''
    for c in text:
        if c.isalnum():
            buffer += c
            if len(buffer) == ngram:
                rebuilt.append(seen[buffer])
                buffer = ''
        elif c in ' .!?':
            rebuilt.append(c)

    final = ''.join(rebuilt)
    await interaction.response.send_message(f"🔠 Transcription: `{final}`")

@client.tree.command(name="balance", description="Check casino balance for a user.")
@app_commands.describe(user="The user to check balance for")
async def balance(interaction: discord.Interaction, user: discord.Member):
    try:
        discord_id = str(user.id)
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("SELECT balance FROM users WHERE discord_id = ?", (discord_id,))
            row = c.fetchone()
            if not row:
                await interaction.response.send_message(
                    f"❌ `{user.display_name}` has not linked their account.")
                return
            balance = row[0]

        await interaction.response.send_message(
            f"💰 **{user.display_name}** has **${balance:,}**.")
    except Exception as e:
        print("❌ Error in /balance:", e)
        await interaction.response.send_message("⚠️ Failed to fetch balance.")


@client.tree.command(name="donate", description="Send casino money to another user")
@app_commands.describe(user="User to donate to", amount="Amount to send")
async def donate(interaction: discord.Interaction, user: discord.Member, amount: int):
    if amount <= 0:
        await interaction.response.send_message("❌ Amount must be greater than 0.", ephemeral=True)
        return

    try:
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()

            # Fetch sender
            c.execute("SELECT id, balance FROM users WHERE discord_id = ?", (str(interaction.user.id),))
            sender = c.fetchone()
            if not sender:
                await interaction.response.send_message("❌ You have not linked your account.", ephemeral=True)
                return
            sender_id, sender_balance = sender

            # Fetch receiver
            c.execute("SELECT id FROM users WHERE discord_id = ?", (str(user.id),))
            receiver = c.fetchone()
            if not receiver:
                await interaction.response.send_message(f"❌ {user.display_name} has not linked their account.", ephemeral=True)
                return
            receiver_id = receiver[0]

            if sender_balance < amount:
                await interaction.response.send_message("❌ Insufficient balance.", ephemeral=True)
                return

            # Perform transfer
            c.execute("UPDATE users SET balance = balance - ? WHERE id = ?", (amount, sender_id))
            c.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (amount, receiver_id))
            conn.commit()

        await interaction.response.send_message(f"✅ You sent **${amount:,}** to **{user.display_name}**!")
    except Exception as e:
        print("❌ Error in /donate:", e)
        await interaction.response.send_message("⚠️ Failed to donate.", ephemeral=True)


@client.tree.command(name="casino-leaderboard", description="Show top 10 players by casino balance")
async def casino_leaderboard(interaction: discord.Interaction):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("""
                SELECT username, balance 
                FROM users 
                ORDER BY balance DESC 
                LIMIT 10
            """)
            rows = c.fetchall()

        msg = "**🎰 Casino Leaderboard Top 10:**\n"
        for i, (username, balance) in enumerate(rows, 1):
            username_display = username or f"User {i}"
            balance_display = f"{balance:,}"
            msg += f"{i}. **{username_display}** — ${balance_display}\n"
        msg += "\n[Play now](https://decipher.wiki/casino)"

        await interaction.response.send_message(msg)
    except Exception as e:
        print("❌ Error in /casino-leaderboard:", e)
        await interaction.response.send_message("⚠️ Failed to fetch casino leaderboard.", ephemeral=True)


@client.tree.command(name="leaderboard", description="Show top 10 puzzlers")
async def leaderboard(interaction: discord.Interaction):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("""
                SELECT u.username, l.completed_puzzles
                FROM leaderboard l
                JOIN users u ON l.user_id = u.id
                ORDER BY l.completed_puzzles DESC
                LIMIT 10
            """)
            rows = c.fetchall()

        msg = "**🏅 Leaderboard Top 10:**\n"
        for i, row in enumerate(rows, 1):
            msg += f"{i}. **{row[0]}** — {row[1]} puzzles\n"
        msg += "[Full leaderboard here](https://decipher.wiki/leaderboard-page)"

        await interaction.response.send_message(msg)
    except Exception as e:
        print("❌ Error in /leaderboard:", e)
        await interaction.response.send_message("⚠️ Failed to fetch leaderboard.", ephemeral=True)

@client.tree.command(name="enhance", description="Enhance an image to reveal text")
@app_commands.describe(image="Image to enhance")
async def enhance(interaction: discord.Interaction, image: discord.Attachment):
    await interaction.response.defer()
    result = await enhance_image_from_url(image.url)
    if not result:
        await interaction.followup.send("❌ Failed to enhance image.", ephemeral=True)
        return
    await interaction.followup.send("✨ Enhanced image:", file=discord.File(result, filename="enhanced.png"))

@client.tree.context_menu(name="Enhance Image")
async def enhance_context(interaction: discord.Interaction, message: discord.Message):
    await interaction.response.defer()
    if not message.attachments:
        await interaction.followup.send("⚠️ No image found in that message.", ephemeral=True)
        return
    result = await enhance_image_from_url(message.attachments[0].url)
    if not result:
        await interaction.followup.send("❌ Failed to enhance image.")
        return
    await interaction.followup.send(f"✨ Enhanced image from {message.author.display_name}:", file=discord.File(result, filename="enhanced.png"))

@client.tree.command(name="transcribe", description="Transcribe symbols from an image")
@app_commands.describe(image="Image to transcribe", accuracy="Match accuracy (1–100, default 85)")
async def transcribe(interaction: discord.Interaction, image: discord.Attachment, accuracy: int = 85):
    await interaction.response.defer()
    if not (1 <= accuracy <= 100):
        await interaction.followup.send("❌ Accuracy must be between 1 and 100.", ephemeral=True)
        return
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(image.url) as resp:
                if resp.status != 200:
                    await interaction.followup.send("❌ Could not fetch the image.")
                    return
                data = await resp.read()
        pil_image = Image.open(io.BytesIO(data)).convert("RGB")
        threshold = accuracy / 100

        def custom_transcribe(img, threshold):
            image_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)
            bg_color = int(np.bincount(gray.flatten()).argmax())
            contrast = cv2.absdiff(gray, bg_color)
            _, binary = cv2.threshold(contrast, 30, 255, cv2.THRESH_BINARY)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
            dilated = cv2.dilate(cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel), kernel)
            _, _, stats, _ = cv2.connectedComponentsWithStats(dilated)

            def normalize(img): return (img.astype(np.float32) - np.mean(img)) / (np.std(img) or 1)
            def inside(a, b): return a[0] >= b[0] and a[1] >= b[1] and a[0]+a[2] <= b[0]+b[2] and a[1]+a[3] <= b[1]+b[3]

            boxes = [(x, y, w, h) for x, y, w, h, area in stats[1:] if 100 < area < 5000]
            boxes = [b for b in boxes if not any(inside(b, o) and b != o for o in boxes)]

            vectors, positions = [], []
            for x, y, w, h in boxes:
                crop = gray[y:y+h, x:x+w]
                resized = cv2.resize(crop, (40, 40), interpolation=cv2.INTER_AREA)
                vectors.append(normalize(resized))
                positions.append((x, y, w, h))

            labels, refs = [], []
            for vec in vectors:
                for j, ref in enumerate(refs):
                    if ssim(vec, ref, data_range=2.0) > threshold:
                        labels.append(chr(ord('A') + j))
                        break
                else:
                    refs.append(vec)
                    labels.append(chr(ord('A') + len(refs) - 1))

            final = sorted(zip(positions, labels), key=lambda b: (b[0][1] + b[0][3]//2, b[0][0]))
            for (x, y, w, h), label in final:
                cv2.rectangle(image_cv, (x, y), (x+w, y+h), (0, 0, 255), 2)
                cv2.putText(image_cv, label, (x, y-3), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

            result_text = ''.join(label for _, label in final)
            out_img = Image.fromarray(cv2.cvtColor(image_cv, cv2.COLOR_BGR2RGB))
            buf = io.BytesIO()
            out_img.save(buf, format="PNG")
            buf.seek(0)
            return result_text, buf

        transcription, image_output = custom_transcribe(pil_image, threshold)
        await interaction.followup.send(f"🔠 Transcribed: `{transcription}`", file=discord.File(image_output, filename="transcribed.png"))
    except Exception as e:
        print("❌ Error in /transcribe:", e)
        await interaction.followup.send("⚠️ Failed to transcribe image.")


@client.tree.context_menu(name="Transcribe Symbols")
async def transcribe_context(interaction: discord.Interaction, message: discord.Message):
    await interaction.response.defer()
    if not message.attachments:
        await interaction.followup.send("⚠️ No image found in that message.", ephemeral=True)
        return
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(message.attachments[0].url) as resp:
                if resp.status != 200:
                    await interaction.followup.send("❌ Failed to fetch image.")
                    return
                data = await resp.read()
        pil_image = Image.open(io.BytesIO(data)).convert("RGB")
        threshold = 0.85

        def custom_transcribe(img, threshold):
            image_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            gray = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)
            bg_color = int(np.bincount(gray.flatten()).argmax())
            contrast = cv2.absdiff(gray, bg_color)
            _, binary = cv2.threshold(contrast, 30, 255, cv2.THRESH_BINARY)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
            dilated = cv2.dilate(cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel), kernel)
            _, _, stats, _ = cv2.connectedComponentsWithStats(dilated)

            def normalize(img): return (img.astype(np.float32) - np.mean(img)) / (np.std(img) or 1)
            def inside(a, b): return a[0] >= b[0] and a[1] >= b[1] and a[0]+a[2] <= b[0]+b[2] and a[1]+a[3] <= b[1]+b[3]

            boxes = [(x, y, w, h) for x, y, w, h, area in stats[1:] if 100 < area < 5000]
            boxes = [b for b in boxes if not any(inside(b, o) and b != o for o in boxes)]

            vectors, positions = [], []
            for x, y, w, h in boxes:
                crop = gray[y:y+h, x:x+w]
                resized = cv2.resize(crop, (40, 40), interpolation=cv2.INTER_AREA)
                vectors.append(normalize(resized))
                positions.append((x, y, w, h))

            labels, refs = [], []
            for vec in vectors:
                for j, ref in enumerate(refs):
                    if ssim(vec, ref, data_range=2.0) > threshold:
                        labels.append(chr(ord('A') + j))
                        break
                else:
                    refs.append(vec)
                    labels.append(chr(ord('A') + len(refs) - 1))

            final = sorted(zip(positions, labels), key=lambda b: (b[0][1] + b[0][3]//2, b[0][0]))
            for (x, y, w, h), label in final:
                cv2.rectangle(image_cv, (x, y), (x+w, y+h), (0, 0, 255), 2)
                cv2.putText(image_cv, label, (x, y-3), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

            result_text = ''.join(label for _, label in final)
            out_img = Image.fromarray(cv2.cvtColor(image_cv, cv2.COLOR_BGR2RGB))
            buf = io.BytesIO()
            out_img.save(buf, format="PNG")
            buf.seek(0)
            return result_text, buf

        transcription, image_output = custom_transcribe(pil_image, threshold)
        await interaction.followup.send(f"🔠 Transcribed: `{transcription}`", file=discord.File(image_output, filename="transcribed.png"))
    except Exception as e:
        print("❌ Error in context transcription:", e)
        await interaction.followup.send("⚠️ Failed to transcribe image.")


async def sync_members():
    guild = client.get_guild(GUILD_ID)
    if guild is None:
        print("Guild not found; check the GUILD_ID.")
        return

    await guild.chunk()
    members = guild.members
    print(f"Syncing {len(members)} members...")

    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute("SELECT user_id, puzzle_name FROM puzzle_progress WHERE completed = 1")
        progress = c.fetchall()

        user_puzzles = {}
        for user_id, puzzle in progress:
            user_puzzles.setdefault(user_id, set()).add(puzzle)

        c.execute("SELECT id, discord_id FROM users WHERE discord_id IS NOT NULL")
        users_with_discord = c.fetchall()
        discord_id_to_user_id = {discord_id: user_id for user_id, discord_id in users_with_discord}

        role_map = {v: k for k, v in ROLE_TO_PUZZLE.items() if v is not None}

        for member in members:
            user_id = discord_id_to_user_id.get(str(member.id))
            if not user_id:
                continue

            completed_puzzles = user_puzzles.get(user_id, set()).copy()

            # ✅ Add puzzles based on Discord roles too
            for role in member.roles:
                if role.name in ROLE_TO_PUZZLE:
                    puzzle = ROLE_TO_PUZZLE[role.name]
                    if puzzle:
                        completed_puzzles.add(puzzle)
                        # Save to DB if not already recorded
                        c.execute("""
                            INSERT OR IGNORE INTO puzzle_progress (user_id, puzzle_name, completed)
                            VALUES (?, ?, 1)
                        """, (user_id, puzzle))
            c.execute("""
                SELECT COUNT(*) FROM puzzle_progress
                WHERE user_id = ? AND completed = 1 AND puzzle_name != 'practice'
            """, (user_id,))
            completed_count = c.fetchone()[0]
            c.execute("""
                INSERT OR REPLACE INTO leaderboard (user_id, completed_puzzles)
                VALUES (?, ?)
            """, (user_id, completed_count))
            
            conn.commit()
            roles_needed = {role_map[p] for p in completed_puzzles if p in role_map}

            normal_puzzles = [v for v in ROLE_TO_PUZZLE.values() if v and  v != "p1" and v != "p2" and v != "p3" and v != "2k"]
            has_all_non2k = all(p in completed_puzzles for p in normal_puzzles)
            if has_all_non2k:
                roles_needed.add("100% Award")
                if "2k" in completed_puzzles:
                    roles_needed.add("101% Award")
                    roles_needed.add("Underground Council")
            if completed_puzzles:
                roles_needed.add("Ranked Member")

            current_roles = {r.name for r in member.roles}
            roles_to_add = roles_needed - current_roles

            for role_name in roles_to_add:
                discord_role = discord.utils.get(guild.roles, name=role_name)
                if discord_role:
                    try:
                        await member.add_roles(discord_role, reason="Puzzle solved on website")
                        print(f"✅ Added '{role_name}' to {member.display_name}")
                    except Exception as e:
                        print(f"❌ Failed to add '{role_name}' to {member.display_name}: {e}")

    print("🔄 Role sync completed.")


async def periodic_sync():
    await client.wait_until_ready()
    while not client.is_closed():
        try:
            if os.path.exists("trigger_sync.flag"):
                print("📣 Detected sync flag, syncing now...")
                await sync_members()
                os.remove("trigger_sync.flag")
        except Exception as e:
            print("❌ Error in periodic sync:", e)
        await asyncio.sleep(5)

async def start_bot():
    await client.start(TOKEN)

if __name__ == "__main__":
    try:
        print("⚡ Launching bot...")
        asyncio.run(start_bot())
    except Exception as e:
        print("❌ Bot crashed with error:", e)
