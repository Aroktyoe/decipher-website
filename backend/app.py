import eventlet
eventlet.monkey_patch()
from flask import Flask, request, jsonify, redirect, session, render_template, Blueprint, make_response
from flask_session import Session
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, decode_token
from flask_jwt_extended.exceptions import NoAuthorizationError
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
from requests_oauthlib import OAuth2Session
from dotenv import load_dotenv
from flask import send_from_directory
from threading import Thread
from datetime import timedelta
import sqlite3, os, secrets
import smtplib
from email.mime.text import MIMEText
import re
import requests
import time
from urllib.parse import urlparse
from flask_jwt_extended import set_access_cookies, unset_jwt_cookies
from flask import make_response
import random
from flask_socketio import SocketIO, emit
from uuid import uuid4
from redis import Redis
from threading import Lock
from collections import deque




load_dotenv(dotenv_path="/var/www/my-site/backend/.env")
print("DISCORD_BOT_TOKEN loaded:", os.getenv("DISCORD_BOT_TOKEN")[:12])

DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1361997548155437217/WBTvwZPiOdCDAnrQIiIKmtWmPUY0wn2VUTsZpCvUBkU07MdiOKimC8NI7YzxPYRNd0yE"

def load_banned_words():
    words = set()
    for filename in ["bad-words.txt", "list_raw.txt"]:
        if os.path.exists(filename):
            with open(filename, "r", encoding="utf-8") as f:
                for line in f:
                    word = line.strip().lower()
                    if word:
                        words.add(word)
    return words

BANNED_USERNAMES = load_banned_words()
ADMIN_DISCORD_IDS = os.getenv("ADMIN_DISCORD_IDS", "").split(",")


app = Flask(__name__, template_folder="templates")

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per minute"],
    storage_uri="redis://localhost:6379"
)
limiter.init_app(app)
app.config['SESSION_TYPE'] = 'filesystem'
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=30)
app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
app.config["JWT_COOKIE_SECURE"] = True  # Only send over HTTPS
app.config["JWT_COOKIE_HTTPONLY"] = True  # Prevent JS access
app.config["JWT_COOKIE_SAMESITE"] = "Lax"
Session(app)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"  # for development only

jwt = JWTManager(app)

@app.route("/send-to-discord", methods=["POST"])
def send_to_discord():
    data = request.get_json(force=True, silent=True) or {}
    msg = data.get("content")
    if msg:
        r = requests.post(DISCORD_WEBHOOK, json={"content": msg})
        return {"status": r.status_code}, r.status_code
    return {"error": "No message"}, 400


def is_safe_redirect_url(url):
    parsed = urlparse(url)
    return parsed.scheme == '' and parsed.netloc == ''


def is_valid_email(email):
    email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return re.match(email_regex, email)

# Function to validate password strength
def is_valid_password(password):
    # Password must have at least one number, one letter, and be at least 8 characters long
    return len(password) >= 8 and \
           any(char.isdigit() for char in password) and \
           any(char.isalpha() for char in password)

def is_admin(user_id):
    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        return row and row[0] == 1


@app.route("/admin/edit-username", methods=["POST"])
@jwt_required()
def admin_edit_username():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify(msg="Unauthorized"), 403

    data = request.json
    target_id = data.get("user_id")
    new_username = data.get("username").strip()

    if any(bad in new_username.lower() for bad in BANNED_USERNAMES):
        return jsonify(msg="Username contains banned words"), 400

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET username = ? WHERE id = ?", (new_username, target_id))
        conn.commit()
    return jsonify(msg="Username updated")

@app.route("/admin/delete-user", methods=["POST"])
@jwt_required()
def admin_delete_user():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify(msg="Unauthorized"), 403

    data = request.json
    target_id = data.get("user_id")

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("DELETE FROM users WHERE id = ?", (target_id,))
        conn.commit()
    return jsonify(msg="User deleted")


@app.route("/admin/users", methods=["GET"])
@jwt_required()
def list_users():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify(msg="Unauthorized"), 403

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT id, username, email FROM users")
        users = [{"id": row[0], "username": row[1], "email": row[2]} for row in c.fetchall()]
    return jsonify(users)


@app.route("/admin-dashboard")
def admin_dashboard_direct():
    return send_from_directory('/var/www/my-site', 'admin-dashboard.html')

@app.route("/discord/check-auth")
@jwt_required()
def check_discord_auth():
    user_id = get_jwt_identity()

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT discord_id FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()

    if not row or not row[0]:
        return jsonify(matched=False)

    discord_token = session.get("discord_token")
    if not discord_token:
        return jsonify(matched=False)

    discord = OAuth2Session(
        client_id=os.getenv("DISCORD_CLIENT_ID"),
        token=discord_token
    )

    try:
        user_info = discord.get("https://discord.com/api/users/@me").json()
    except Exception as e:
        app.logger.error("Error calling Discord API: %s", e)
        return jsonify(matched=False)
    
    logged_in_discord_id = user_info.get("id")
    matched = str(row[0]) == str(logged_in_discord_id)
    return jsonify(matched=matched)

@app.route("/logout", methods=["POST"])
def logout():
    resp = jsonify(msg="Logged out")
    unset_jwt_cookies(resp)
    return resp

@app.route("/admin")
@jwt_required()
def admin():
    return redirect("/admin-dashboard")


@app.route("/set-username", methods=["POST"])
@jwt_required()
@limiter.limit("5 per minute")
def set_username():
    user_id = get_jwt_identity()
    data = request.json
    new_username = data.get("username", "").strip().lower()

    if not new_username:
        return jsonify(msg="Username cannot be empty"), 400
    if len(new_username) < 3 or len(new_username) > 20:
        return jsonify(msg="Username must be between 3 and 20 characters"), 400
    if not re.match(r'^[a-zA-Z0-9_.-]+$', new_username):
        return jsonify(msg="Username contains invalid characters"), 400
    def contains_banned_word(username):
        uname = username.lower()
        for word in BANNED_USERNAMES:
            if word in uname and len(word) >= 3:
                if uname.count(word) == 1 and len(uname) - len(word) > 2:
                    continue
                return True
        return False

    if contains_banned_word(new_username):
        return jsonify(msg="Username contains banned words"), 400


    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE username = ?", (new_username,))
        if c.fetchone():
            return jsonify(msg="Username already taken"), 409

        c.execute("UPDATE users SET username = ? WHERE id = ?", (new_username, user_id))
        conn.commit()
        return jsonify(msg="Username set successfully"), 200

@app.route("/connect-discord", methods=["POST"])
@jwt_required()
def connect_discord():
    user_id = get_jwt_identity()
    data = request.json
    discord_id = str(data.get("discord_id", "")).strip()

    if not discord_id.isdigit():
        return jsonify(msg="Invalid Discord ID"), 400

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET discord_id = ? WHERE id = ?", (discord_id, user_id))
        conn.commit()

    return jsonify(msg="Discord account linked!"), 200


@app.route("/user-progress", methods=["GET"])
@jwt_required()
def user_progress():
    user_id = get_jwt_identity()
    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM puzzle_progress WHERE user_id = ? AND completed = ?", (user_id, True))
        completed_puzzles = c.fetchone()[0]
        c.execute("SELECT COUNT(DISTINCT puzzle_name) FROM puzzle_progress WHERE puzzle_name != 'practice'")
        total_puzzles = c.fetchone()[0]
        return jsonify(completed=completed_puzzles, total=total_puzzles), 200


@app.route("/leaderboard-page")
def leaderboard_page():
    return render_template("leaderboard-page.html")


@app.route("/leaderboard")
def leaderboard():
    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("""
            SELECT u.username, l.completed_puzzles
            FROM leaderboard l
            JOIN users u ON l.user_id = u.id
            ORDER BY l.completed_puzzles DESC
        """)
        data = c.fetchall()
        leaderboard = [{"username": row[0], "completed_puzzles": row[1]} for row in data]
    return jsonify({"leaderboard": leaderboard})

@app.route("/submit-puzzle", methods=["POST"])
@jwt_required()
@limiter.limit("10 per minute")
def submit_puzzle():
    try:
        user_id = get_jwt_identity()
        data = request.json

        correct_answers = {
            "heart": "congratulations on completing the heart puzzle dm aroktyoe with a picture of a valentine teddy bear to receive the heart award",
            "xor": [
                "Hello friends, I think that you'll do great solving this challenge, to start off I'll be giving you this very long sentence, hopefully it will do you good. Have fun and good luck!",
                "There are two kinds of people in this world, those who finish what they start, and",
                "Okay, this one might be hard.",
                "Smoking kills you, maybe you should wear a normal jacket instead.",
                "The weather for tomorrow is looking promising.",
                "You either piss in the sink, or sink in the piss."
            ],
            "3k": "Congratulations! You've completed the 3K Puzzle! If you were the first to complete the puzzle the following Discord link will be working, if not, well done anyways! Message Aroktyoe with this text to receive the 3K Award. https://discord.gg/e6dMCZcrkB",
            "4k": "CONGRATULATIONS YOU HAVE COMPLETED THE 4K PUZZLE IF YOURE THE FIRST TO COMPLETE THE PUZZLE THIS DISCORD INVITE WILL WORK AND YOU ARE THE WINNER OF THE 4K HUNT HTTPSDISCORDGGXYEA3HAS57 OTHERWISE DM AROKTYOE WITH THIS MESSAGE TO RECEIVE THE 4K AWARD",
            "blocker": "You have won, send a picture of Dirk Blocker to Aroktyoe to obtain the priceless Blocker Award.",
            "goodside": ["https://www.youtube.com/watch?v=7YhqAfCEh2E", "https://www.youtube.com/watch?v=kwCMU22ZBN8"],
            "xmas2020": "gingerbread",
            "cryptogram": [
                "It could've been worse.",
                "Take me on a roadtrip.",
                "I hate meatballs.",
                "Don't stop me now.",
                "Shower? I dont shower.",
                "Who could've known."
            ],
            "1k": "Congratulations you've won The DECIPHER 1K Puzzle, this invite link is limited to 1 person only, so if it is not working the puzzle has already been solved. Though you will get a little role reward if you DM Aroktyoe with this message! https://discord.gg/e4AD4bvYFD",
            "cipherstack": "You completed the Cipher Stack Puzzle, DM Aroktyoe#1000 with this message to recieve the Cipher Stack Award role in DECIPHER.",
            "rip": "May you rest in peace, Superman.",
            "practice": "jesusnut",
            "number_sequence": "kingkong",
            "sourcers": "Congratulations for solving the Sourcer's Puzzle. Send a picture of John B. Goodenough to Aroktyoe, and you'll recieve the Sourcer's Award!",
            "xmas2022": "You've solved the DECIPHER Christmas Puzzle 2022. If you haven't already, give the 2021 puzzle a go while you're at it! Anyways, message Aroktyoe with your very own Christmas haiku to get the Christmas 2022 Award role.",
            "afk": "YOUVE COMPLETED THE AFK PUZZLE SEND AROKTYOE A PICTURE OF A KEYBOARD TO RECEIVE THE AFK AWARD",
            "2k": """Congratulations you've completed the 2K Hunt! DM Aroktyoe with a screenshot of this webpage to receive the "2K Award" in the DECIPHER Discord Server Thanks for playing! We hope you enjoyed the puzzles!""",
            "vigenere": [
                "30 minus 10 equals to 20.",
                "Congratulations, you did it!",
                "I'll be here 'til 5, no more, no less.",
                "Person 1: I like pizza. Person 2: Me too!",
                "Tell 'em I'm sorry!",
                "How'd you like challenge 1-5?"
            ],
            "p1": "Thankyou for supporting the community! Hope you enjoyed this mini puzzle"
        }

        valid_puzzles = set(correct_answers.keys())
        puzzle_name = data.get("puzzleName")
        correct = correct_answers.get(puzzle_name)
        answer = data.get("answer")
        if puzzle_name not in valid_puzzles:
            return jsonify(msg="Invalid puzzle name."), 400
        if not answer or (isinstance(answer, list) and not all(answer)):
            return jsonify(msg="Answer cannot be empty."), 400
        def normalize(text):
            return re.sub(r'[^a-z0-9]', '', text.lower())

        if isinstance(answer, list):
            normalized_answer_list = [normalize(a) for a in answer]
        else:
            normalized_answer_list = [normalize(answer)]


        print(f"Received puzzle: {puzzle_name}, Answer: {answer}")

        # Normalize answer (ignore case, spaces, punctuation)

        if isinstance(correct, list):
            correct_normalized = [normalize(ans) for ans in correct]
            if sorted(normalized_answer_list) != sorted(correct_normalized):
                return jsonify(msg="Incorrect answer. Try again."), 400
        elif isinstance(correct, str):
            if normalize(correct) != normalized_answer_list[0]:
                return jsonify(msg="Incorrect answer. Try again."), 400
        if puzzle_name == "practice":
            return jsonify(msg="Puzzle solved (no leaderboard points for practice puzzle)."), 200

        # Mark puzzle as completed for the user
        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()

            c.execute("SELECT completed FROM puzzle_progress WHERE user_id = ? AND puzzle_name = ?", (user_id, puzzle_name))
            if c.fetchone():
                 return jsonify(msg="You've already completed this puzzle."), 400

            # Insert into puzzle_progress to mark completion
            c.execute("INSERT OR REPLACE INTO puzzle_progress (user_id, puzzle_name, completed) VALUES (?, ?, ?)", 
                      (user_id, puzzle_name, True))
            
            # Calculate total completed puzzles
            # Only update leaderboard if puzzle isn't "practice"
            if puzzle_name != "practice":
                c.execute("SELECT COUNT(*) FROM puzzle_progress WHERE user_id = ? AND completed = 1 AND puzzle_name != 'practice'", (user_id,))
                completed_puzzles = c.fetchone()[0]
                c.execute("INSERT OR REPLACE INTO leaderboard (user_id, completed_puzzles) VALUES (?, ?)", 
                          (user_id, completed_puzzles))

            c.execute("SELECT username FROM users WHERE id = ?", (user_id,))
            username_row = c.fetchone()
            if username_row:
              announce_to_discord(username_row[0], puzzle_name)

            conn.commit()
        c.execute("SELECT discord_id FROM users WHERE id = ?", (user_id,))
        discord_row = c.fetchone()
        if discord_row and discord_row[0]:
            with open("trigger_sync.flag", "w") as f:
                f.write("1")

        return jsonify(msg="Puzzle solved! Leaderboard will be updated within 5 minutes"), 200

    except Exception as e:
        return jsonify(msg=f"Error occurred: {str(e)}"), 500
    

@app.route("/casino/balance")
@jwt_required()
def casino_balance():
    user_id = get_jwt_identity()
    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT balance, last_claim FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
    if row:
        return jsonify(balance=row[0], last_claim=row[1])
    return jsonify(msg="User not found"), 404


@app.route("/casino/claim", methods=["POST"])
@jwt_required()
def claim_daily():
    user_id = get_jwt_identity()
    now = time.time()

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()

        # Get user data
        c.execute("SELECT balance, last_claim, discord_id FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row:
            return jsonify(msg="User not found"), 404

        balance, last_claim, discord_id = row

        # Get completed puzzle count
        c.execute("SELECT COUNT(*) FROM puzzle_progress WHERE user_id = ? AND completed = 1", (user_id,))
        puzzle_bonus = c.fetchone()[0] * 2000  # 2k per completed puzzle

        # Check if user has Patreon Supporter role
        has_patreon = False
        if discord_id:
            bot_token = os.getenv("DISCORD_BOT_TOKEN")
            guild_id = os.getenv("DISCORD_GUILD_ID")
            headers = {"Authorization": f"Bot {bot_token}", "User-Agent": "Bot (decipher, 1.0)"}
            url = f"https://discord.com/api/v10/guilds/{guild_id}/members/{discord_id}"
            res = requests.get(url, headers=headers)
            if res.ok:
                roles = res.json().get("roles", [])
                has_patreon = "1004792236552241203" in roles

        cooldown = 21600 if has_patreon else 43200  # 6h for patreon, 12h otherwise

        if not last_claim or now - last_claim >= cooldown:
            reward = 10000 + puzzle_bonus
            new_balance = balance + reward
            c.execute("UPDATE users SET balance = ?, last_claim = ? WHERE id = ?", (new_balance, now, user_id))
            conn.commit()
            socketio.emit('update_balance', room=str(user_id))
            socketio.emit('update_leaderboard')
            return jsonify(success=True, balance=new_balance, bonus=reward)

        wait = max(0, int(cooldown - (now - last_claim)))
        socketio.emit('update_balance', room=str(user_id))
        socketio.emit('update_leaderboard')
        return jsonify(success=False, wait=wait)



@app.route("/casino/play/slots", methods=["POST"])
@jwt_required()
def play_slots():
    user_id = get_jwt_identity()
    data = request.get_json()
    bet = int(data.get("bet", 0))

    if bet <= 0:
        return jsonify(message="Invalid bet.")

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row or row[0] < bet:
            return jsonify(message="Not enough balance.")

        from random import choice

        # Reels with weighted symbol distribution
        reels = [
            ['🍒'] * 6 + ['🍋'] * 5 + ['🍉'] * 4 + ['⭐'] * 3 + ['🔔'] * 2,
            ['🍒'] * 6 + ['🍋'] * 5 + ['🍉'] * 4 + ['⭐'] * 3 + ['🔔'] * 2,
            ['🍒'] * 6 + ['🍋'] * 5 + ['🍉'] * 4 + ['⭐'] * 3 + ['🔔'] * 2
        ]

        result = [choice(reel) for reel in reels]

        paytable = {
            ('🍒', '🍒', '🍒'): bet * 8,
            ('🍋', '🍋', '🍋'): bet * 15,
            ('🍉', '🍉', '🍉'): bet * 25,
            ('⭐', '⭐', '⭐'): bet * 50,
            ('🔔', '🔔', '🔔'): bet * 100,
        }

        if tuple(result) in paytable:
            payout = paytable[tuple(result)]
        else:
            payout = -bet

        new_balance = row[0] + payout
        c.execute("UPDATE users SET balance = ? WHERE id = ?", (new_balance, user_id))
        conn.commit()

    msg = f"You won! {' '.join(result)} (+${payout})" if payout > 0 else f"You lost. {' '.join(result)} (-${bet})"
    return jsonify(message=msg)

@app.route("/out/nvpn")
def go_nordvpn():
    return redirect("https://go.nordvpn.net/aff_c?offer_id=15&aff_id=121895")

@app.route("/4k/cookie/claim-pong", methods=["POST"])
def claim_pong_cookie():
    resp = make_response({"success": True})
    resp.set_cookie("pong_access", "https://decipher.wiki/4k/pong/pingpong_notdonkeykong", max_age=60*60*24*30, httponly=True, samesite="Lax")
    return resp

bets = {}  # {user_id: {"red": bet_amount, ...}}
roulette_history = deque(maxlen=15)
thread_lock = Lock()
bg_thread = None
next_spin_time = time.time() + 14

def spin_roulette():
    global next_spin_time
    while True:
        next_spin_time = time.time() + 14
        eventlet.sleep(14)
        rand = random.uniform(0, 1)
        if rand < 0.028:       # ~2.6% chance for green (1/37 roulette)
            result = "green"
        elif rand < 0.514:     # next ~48.7% for red
            result = "red"
        else:                  # remaining ~48.7% for black
            result = "black"
        winners = []

        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            for user_id, user_bets in bets.items():
                if result in user_bets:
                    amount = user_bets[result]
                    multiplier = 35 if result == "green" else 2
                    payout = amount * multiplier
                    total_return = payout  # payout already includes the bet because multiplier >1
                    c.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (total_return, user_id))
                    winners.append({"user": user_id, "color": result, "amount": total_return})
            conn.commit()

        roulette_history.append(result)
        socketio.emit("roulette_result", {"result": result, "history": list(roulette_history), "winners": winners})
        bets.clear()


@app.route("/casino/roulette/bet", methods=["POST"])
@jwt_required()
def place_bet():
    user_id = get_jwt_identity()
    data = request.get_json()
    color = data.get("color")
    amount = int(data.get("amount", 0))

    if color not in ["red", "black", "green"] or amount <= 0:
        return jsonify({"msg": "Invalid bet."}), 400

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row or row[0] < amount:
            return jsonify({"msg": "Insufficient balance."}), 400

        # ✅ Deduct balance once
        c.execute("UPDATE users SET balance = balance - ? WHERE id = ?", (amount, user_id))
        conn.commit()

    if user_id not in bets:
        bets[user_id] = {}

    if color in bets[user_id]:
        return jsonify({"msg": f"You already bet on {color}."}), 400

    bets[user_id][color] = amount  # One bet per color
    socketio.emit('update_bets', namespace='/')
    return jsonify({"msg": f"Bet placed on {color}."})


@app.route("/casino/roulette/remove", methods=["POST"])
@jwt_required()
def remove_bet():
    user_id = get_jwt_identity()
    data = request.get_json()
    color = data.get("color")

    if user_id not in bets or color not in bets[user_id]:
        return jsonify({"msg": "No bet to remove."}), 400

    amount = bets[user_id].pop(color)

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (amount, user_id))
        conn.commit()

    socketio.emit('update_bets', namespace='/')
    return jsonify({"msg": f"Bet removed from {color}."})

@app.route("/casino/roulette/status")
@jwt_required()
def get_status():
    user_id = get_jwt_identity()
    user_bets = bets.get(user_id, {})
    
    # Create a list of all bets
    all_bets = []
    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        for uid, user_bet_colors in bets.items():
            c.execute("SELECT username FROM users WHERE id = ?", (uid,))
            username_row = c.fetchone()
            username = username_row[0] if username_row else f"User {uid}"
            for color, amount in user_bet_colors.items():
                all_bets.append({
                    "username": username,
                    "color": color,
                    "amount": amount
                })

    return jsonify({
        "history": list(roulette_history),
        "your_bets": user_bets,
        "all_bets": all_bets
    })



@socketio.on("connect")
def connected():
    emit("roulette_result", {"history": list(roulette_history)})


coinflips = []

@app.route("/casino/coinflip/list")
@jwt_required()
def coinflip_list():
    return jsonify([
        {
            "id": f["flip_id"],
            "creator": f["creator_name"],
            "amount": f["amount"],
            "choice": f["choice"]
        }
        for f in coinflips if not f["resolved"]
    ])


@app.route("/casino/coinflip/create", methods=["POST"])
@jwt_required()
def coinflip_create():
    user_id = get_jwt_identity()
    data = request.json
    amount = int(data.get("amount", 0))
    choice = data.get("choice")

    if amount <= 0 or choice not in ("heads", "tails"):
        return jsonify(msg="Invalid input"), 400

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT username, balance FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row or row[1] < amount:
            return jsonify(msg="Not enough balance"), 400
        c.execute("UPDATE users SET balance = balance - ? WHERE id = ?", (amount, user_id))
        conn.commit()

    flip_id = str(uuid4())
    coinflips.append({
        'flip_id': flip_id,
        'creator_id': user_id,
        'creator_name': row[0],
        'choice': choice,
        'amount': amount,
        'status': 'open',
        'resolved': False
    })

    print("Emitting update_open_flips")
    socketio.emit('update_open_flips')
    socketio.emit('update_balance', room=str(get_jwt_identity()))
    return jsonify({'status': 'ok', 'flip_id': flip_id})

@app.route("/casino/coinflip/remove", methods=["POST"])
@jwt_required()
def coinflip_remove():
    user_id = get_jwt_identity()
    data = request.json
    flip_id = data.get("flip_id")

    # Find the coinflip by ID
    flip = next((f for f in coinflips if f["flip_id"] == flip_id), None)
    if not flip:
        return jsonify(msg="Coinflip not found"), 400

    # Ensure the user is the creator of the coinflip
    if flip["creator_id"] != user_id:
        return jsonify(msg="You are not the creator of this coinflip"), 400

    # Mark the coinflip as removed
    flip["status"] = "removed"
    flip["resolved"] = True

    # Optionally, you could refund the creator's bet
    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (flip["amount"], user_id))
        conn.commit()

    # Emit updates to clients
    socketio.emit('update_open_flips')
    socketio.emit('update_leaderboard')

    return jsonify({'status': 'ok'})


@app.route("/casino/coinflip/join", methods=["POST"])
@jwt_required()
def coinflip_join():
    user_id = get_jwt_identity()
    flip_id = request.json.get("id")

    flip = next((f for f in coinflips if f["flip_id"] == flip_id and not f["resolved"]), None)
    if not flip:
        return jsonify(msg="Invalid or resolved"), 400

    if flip["creator_id"] == user_id:
        return jsonify(msg="Can't join your own"), 400

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT username, balance FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row or row[1] < flip["amount"]:
            return jsonify(msg="Not enough balance"), 400

        joining_username = row[0]
        c.execute("UPDATE users SET balance = balance - ? WHERE id = ?", (flip["amount"], user_id))

        result = "heads" if random.randint(1, 2) == 1 else "tails"
        creator_wins = result == flip["choice"]
        winner_id = flip["creator_id"] if creator_wins else user_id
        payout = flip["amount"] * 2
        c.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (payout, winner_id))
        c.execute("SELECT username FROM users WHERE id = ?", (winner_id,))
        winner_name = c.fetchone()[0]
        conn.commit()

    flip["status"] = "done"
    flip["resolved"] = True
    flip["result"] = result
    flip["winner"] = winner_id


    socketio.emit('coinflip_result', {
        'flip_id': flip["flip_id"],
        'result': result,
        'winner': winner_name
    }, room=str(user_id))

    socketio.emit('coinflip_result', {
        'flip_id': flip["flip_id"],
        'result': result,
        'winner': winner_name
    }, room=str(flip["creator_id"]))

    socketio.emit('update_open_flips')

    eventlet.sleep(3.5)

    socketio.emit('update_leaderboard')
    socketio.emit('update_balance', room=str(user_id))
    socketio.emit('update_balance', room=str(flip["creator_id"]))


    return jsonify({'status': 'ok'})

games = {}  # temporary store, keyed by user id

def deal_card():
    return random.choice(["A"] + [str(i) for i in range(2, 11)] + ["J", "Q", "K"])

def is_soft_17(cards):
    return calculate_total(cards) == 17 and "A" in cards

def calculate_total(cards):
    total = 0
    aces = 0
    for card in cards:
        if card in ["J", "Q", "K"]:
            total += 10
        elif card == "A":
            aces += 1
            total += 11
        else:
            total += int(card)
    while total > 21 and aces:
        total -= 10
        aces -= 1
    return total


@app.route("/casino/play/blackjack/start", methods=["POST"])
@jwt_required()
def blackjack_start():
    user_id = get_jwt_identity()
    bet = int(request.json.get("bet", 0))

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT balance FROM users WHERE id=?", (user_id,))
        row = c.fetchone()
        if not row or row[0] < bet:
            return jsonify(message="Not enough balance.", game_over=True)

        c.execute("UPDATE users SET balance=balance-? WHERE id=?", (bet, user_id))

    cards = [deal_card(), deal_card()]
    dealer = [deal_card(), deal_card()]
    player_total = calculate_total(cards)

    if player_total == 21:
        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            c.execute("UPDATE users SET balance=balance+? WHERE id=?", (bet + 1.5 * bet, user_id))
            conn.commit()
        games[user_id] = {
            "hands": [cards],
            "dealer": dealer,
            "active": 0,
            "bet": bet,
            "split": False,
            "doubled": False,
            "game_over": True,
            "payouts": [1.5 * bet],
            "dealer_total": calculate_total(dealer)
        }
        socketio.emit('update_balance', room=str(user_id))
        socketio.emit('update_leaderboard')
        return jsonify({
            "player_cards": cards,
            "dealer_cards": dealer,
            "player_total": 21,
            "dealer_total": calculate_total(dealer),
            "message": "Blackjack! You win 3:2.",
            "game_over": True,
            "can_split": False,
            "can_double": False,
            "payout": 1.5 * bet
        })

    games[user_id] = {
        "hands": [[cards[0], cards[1]]],
        "dealer": dealer,
        "active": 0,
        "bet": bet,
        "split": False,
        "doubled": False,
        "game_over": False
    }

    return jsonify({
        "player_cards": cards,
        "dealer_cards": [dealer[0], "?"],
        "player_total": calculate_total(cards),
        "dealer_total": calculate_total([dealer[0]]),
        "message": "Game started. Hit, stand, double, or split?",
        "game_over": False,
        "can_split": cards[0] == cards[1],
        "can_double": True
    })

@app.route("/casino/play/blackjack/action", methods=["POST"])
@jwt_required()
def blackjack_action():
    user_id = get_jwt_identity()
    action = request.json.get("action")
    game = games.get(user_id)
    if not game or game["game_over"]:
        return jsonify(message="No active game.", game_over=True)

    hand = game["hands"][game["active"]]

    if action == "hit":
        hand.append(deal_card())
        total = calculate_total(hand)
        if total > 21:
            message = f"Bust on hand {game['active']+1}!"
            next_hand(game)
            return show_game(user_id, message)
        return show_game(user_id, "Hit or stand?")

    elif action == "stand":
        next_hand(game)
        return show_game(user_id, "Standing.")

    elif action == "double":
        if game["doubled"]:
            return jsonify(message="Already doubled.", game_over=False)
        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            c.execute("SELECT balance FROM users WHERE id=?", (user_id,))
            row = c.fetchone()
            if not row or row[0] < game["bet"]:
                return jsonify(message="Not enough to double.", game_over=False)
            c.execute("UPDATE users SET balance=balance-? WHERE id=?", (game["bet"], user_id))
        game["bet"] *= 2
        hand.append(deal_card())
        game["doubled"] = True
        next_hand(game)
        return show_game(user_id, "Doubled down.")

    elif action == "split":
        if len(game["hands"]) > 1 or hand[0] != hand[1]:
            return jsonify(message="Can't split.", game_over=False)
        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            c.execute("SELECT balance FROM users WHERE id=?", (user_id,))
            row = c.fetchone()
            if not row or row[0] < game["bet"]:
                return jsonify(message="Not enough to split.", game_over=False)
            c.execute("UPDATE users SET balance=balance-? WHERE id=?", (game["bet"], user_id))

        game["hands"] = [[hand[0], deal_card()], [hand[1], deal_card()]]
        game["split"] = True
        game["active"] = 0
        return show_game(user_id, "Split! Now playing hand 1.")

    else:
        return jsonify(message="Invalid action.", game_over=False)


def next_hand(game):
    if game["active"] + 1 < len(game["hands"]):
        game["active"] += 1
    else:
        game["game_over"] = True
        settle_game(game)

def settle_game(game):
    while calculate_total(game["dealer"]) < 17 or is_soft_17(game["dealer"]):
        game["dealer"].append(deal_card())
    game["dealer_total"] = calculate_total(game["dealer"])

    payouts = []
    for hand in game["hands"]:
        total = calculate_total(hand)
        if total > 21:
            payouts.append(0)
        elif game["dealer_total"] > 21 or total > game["dealer_total"]:
            payouts.append(game["bet"])
        elif total == game["dealer_total"]:
            payouts.append(0.5 * game["bet"])
        else:
            payouts.append(0)
    game["payouts"] = payouts

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        total_win = sum(payouts)
        if total_win:
            c.execute("UPDATE users SET balance=balance+? WHERE id=?", (total_win + game["bet"] * len(payouts), get_jwt_identity()))

    socketio.emit('update_balance', room=str(get_jwt_identity()))
    socketio.emit('update_leaderboard')


def show_game(user_id, msg):
    game = games[user_id]
    hand = game["hands"][game["active"]]
    return jsonify({
        "player_cards": hand,
        "dealer_cards": [game["dealer"][0], "?"] if not game["game_over"] else game["dealer"],
        "player_total": calculate_total(hand),
        "dealer_total": calculate_total(game["dealer"] if game["game_over"] else [game["dealer"][0]]),
        "message": msg if not game["game_over"] else final_message(game),
        "game_over": game["game_over"],
        "payout": sum(game["payouts"]) if game["game_over"] else 0
    })

def final_message(game):
    messages = []
    for i, p in enumerate(game["payouts"]):
        if p == 0:
            messages.append(f"Hand {i+1}: Lost.")
        elif p == game["bet"]:
            messages.append(f"Hand {i+1}: Won ${p * 2}.")
        else:
            messages.append(f"Hand {i+1}: Push.")
    return " ".join(messages)


@app.route("/casino/leaderboard")
@jwt_required()
def casino_leaderboard():
    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT id, username, balance FROM users ORDER BY balance DESC LIMIT 10")
        results = []
        for row in c.fetchall():
            uid, username, balance = row
            results.append({
                "username": username if username else f"User {uid}",
                "balance": balance
            })
    return jsonify(results)

holdem_tables = {}

SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]

def create_deck():
    return [r + s for s in SUITS for r in RANKS]

def shuffle_deck(deck):
    random.shuffle(deck)

# ---------------- CREATE TABLE ----------------
@app.route("/holdem/create-table", methods=["POST"])
@jwt_required()
def create_table():
    user_id = get_jwt_identity()
    data = request.get_json()
    table_type = data.get("type")
    buy_in = int(data.get("buy_in", 0))

    if table_type not in ["casual", "buyin"]:
        return jsonify(msg="Invalid table type"), 400

    if table_type == "buyin" and buy_in <= 0:
        return jsonify(msg="Buy-in must be greater than 0"), 400

    if table_type == "buyin":
        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            c.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
            row = c.fetchone()
            if not row or row[0] < buy_in:
                return jsonify(msg="Insufficient balance"), 400
            c.execute("UPDATE users SET balance = balance - ? WHERE id = ?", (buy_in, user_id))
            conn.commit()

    table_id = str(uuid4())
    holdem_tables[table_id] = {
        "creator_id": user_id,
        "table_type": table_type,
        "buy_in": buy_in,
        "players": {
            user_id: {
                "cards": [],
                "chips": buy_in if table_type == "buyin" else 10000,
                "folded": False,
                "current_bet": 0
            }
        },
        "deck": [],
        "community_cards": [],
        "pot": 0,
        "current_turn": user_id,
        "started": False,
        "stage": "waiting"
    }

    return jsonify(table_id=table_id)

# ---------------- JOIN TABLE ----------------
@app.route("/holdem/join-table", methods=["POST"])
@jwt_required()
def join_table():
    user_id = get_jwt_identity()
    data = request.get_json()
    table_id = data.get("table_id")
    table = holdem_tables.get(table_id)

    if not table:
        return jsonify(msg="Table not found"), 404
    if table["started"]:
        return jsonify(msg="Game already started"), 400
    if user_id in table["players"]:
        return jsonify(msg="Already joined"), 400

    if table["table_type"] == "buyin":
        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            c.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
            row = c.fetchone()
            if not row or row[0] < table["buy_in"]:
                return jsonify(msg="Insufficient balance"), 400
            c.execute("UPDATE users SET balance = balance - ? WHERE id = ?", (table["buy_in"], user_id))
            conn.commit()

    table["players"][user_id] = {
        "cards": [],
        "chips": table["buy_in"] if table["table_type"] == "buyin" else 10000,
        "folded": False,
        "current_bet": 0
    }

    return jsonify(msg="Joined table")

# ---------------- START GAME ----------------
@app.route("/casino/play/poker/start", methods=["POST"])
@jwt_required()
def start_holdem():
    user_id = get_jwt_identity()
    data = request.get_json()
    table_id = data.get("table_id")

    table = holdem_tables.get(table_id)
    if not table or table["started"]:
        return jsonify(msg="Invalid table or already started"), 400

    if user_id != table["creator_id"]:
        return jsonify(msg="Only creator can start the table"), 403

    table["deck"] = create_deck()
    shuffle_deck(table["deck"])

    for pid in table["players"]:
        table["players"][pid]["cards"] = [table["deck"].pop(), table["deck"].pop()]
        table["players"][pid]["folded"] = False
        table["players"][pid]["current_bet"] = 0

    table["community_cards"] = []
    table["pot"] = 0
    table["started"] = True
    table["stage"] = "preflop"
    player_ids = list(table["players"].keys())
    table["current_turn"] = player_ids[0]  # first player to act

    return jsonify(msg="Game started", table_state=export_table(table, user_id))

# ---------------- PLAYER ACTION ----------------
@app.route("/casino/play/poker/action", methods=["POST"])
@jwt_required()
def holdem_action():
    user_id = get_jwt_identity()
    data = request.get_json()
    table_id = data.get("table_id")
    action = data.get("action")
    bet_amount = int(data.get("bet_amount", 0))

    table = holdem_tables.get(table_id)
    if not table or not table["started"]:
        return jsonify(msg="Invalid table or not started"), 400

    if user_id != table["current_turn"]:
        return jsonify(msg="Not your turn"), 400

    player = table["players"].get(user_id)
    if not player or player["folded"]:
        return jsonify(msg="Player invalid or folded"), 400

    if action == "fold":
        player["folded"] = True

    elif action == "check":
        # Must have matched the highest bet
        pass

    elif action == "call":
        max_bet = max(p["current_bet"] for p in table["players"].values())
        to_call = max_bet - player["current_bet"]
        if to_call > player["chips"]:
            to_call = player["chips"]
        player["chips"] -= to_call
        player["current_bet"] += to_call
        table["pot"] += to_call

    elif action == "bet":
        if bet_amount <= 0 or bet_amount > player["chips"]:
            return jsonify(msg="Invalid bet amount"), 400
        player["chips"] -= bet_amount
        player["current_bet"] += bet_amount
        table["pot"] += bet_amount

    else:
        return jsonify(msg="Invalid action"), 400

    # Advance turn
    alive_players = [pid for pid, p in table["players"].items() if not p["folded"]]
    if len(alive_players) <= 1:
        # Someone won by folding
        winner_id = alive_players[0]
        table["players"][winner_id]["chips"] += table["pot"]
        table["pot"] = 0
        table["started"] = False
        table["stage"] = "ended"
    else:
        advance_stage_if_needed(table)

    next_turn(table)

    return jsonify(msg="Action complete", table_state=export_table(table, user_id))

# ---------------- HELPER FUNCTIONS ----------------
def advance_stage_if_needed(table):
    if all(p["current_bet"] == max(p2["current_bet"] for p2 in table["players"].values()) or p["folded"] for p in table["players"].values()):
        if table["stage"] == "preflop":
            for _ in range(3):
                table["community_cards"].append(table["deck"].pop())
            table["stage"] = "flop"
            reset_bets(table)
        elif table["stage"] == "flop":
            table["community_cards"].append(table["deck"].pop())
            table["stage"] = "turn"
            reset_bets(table)
        elif table["stage"] == "turn":
            table["community_cards"].append(table["deck"].pop())
            table["stage"] = "river"
            reset_bets(table)
        elif table["stage"] == "river":
            table["stage"] = "showdown"
            table["started"] = False

def reset_bets(table):
    for p in table["players"].values():
        p["current_bet"] = 0

def next_turn(table):
    player_ids = list(table["players"].keys())
    idx = player_ids.index(table["current_turn"])
    for _ in range(len(player_ids)):
        idx = (idx + 1) % len(player_ids)
        next_player = table["players"][player_ids[idx]]
        if not next_player["folded"]:
            table["current_turn"] = player_ids[idx]
            break

def export_table(table, requesting_user):
    return {
        "players": [
            {
                "user_id": pid,
                "chips": p["chips"],
                "cards": p["cards"] if pid == requesting_user else ["🂠", "🂠"],
                "folded": p["folded"]
            } for pid, p in table["players"].items()
        ],
        "community_cards": table["community_cards"],
        "pot": table["pot"],
        "stage": table["stage"],
        "your_turn": table["current_turn"] == requesting_user
    }



@app.errorhandler(NoAuthorizationError)
def handle_missing_token(e):
   return jsonify(msg="You have to be logged in to submit an answer"), 401


@socketio.on('connect')
def handle_connect():
    token = request.cookies.get("access_token_cookie")
    if token:
        try:
            user_id = decode_token(token)["sub"]
            from flask_socketio import join_room
            join_room(str(user_id))
            print(f"✅ Socket joined room: {user_id}")
        except Exception as e:
            print("❌ Failed to join room on connect:", e)

    emit("roulette_result", {
        "history": list(roulette_history),
        "next_spin_in": max(0, int(next_spin_time - time.time()))
    })

@app.route("/delete-account", methods=["DELETE"])
@jwt_required()
@limiter.limit("5 per hour")
def delete_account():
    user_id = get_jwt_identity()
    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    return jsonify(msg="Account deleted"), 200


def send_reset_email(to_email, token):
    body = f"Click here to reset your password:\nhttps://decipher.wiki/reset-password.html?token={token}"
    msg = MIMEText(body)
    msg["Subject"] = "Reset Your Password"
    msg["From"] = os.getenv("EMAIL_USER")
    msg["To"] = to_email

    with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
        smtp.starttls()
        smtp.login(os.getenv("EMAIL_USER"), os.getenv("EMAIL_PASS"))
        smtp.send_message(msg)

@app.route("/me", methods=["GET"])
@jwt_required()
def me():
    try:
        user_id = get_jwt_identity()
        print("✅ JWT user ID:", user_id)

        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            c.execute("SELECT username, email, discord_name, discord_avatar FROM users WHERE id = ?", (user_id,))
            user = c.fetchone()
            print("✅ DB user:", user)

            c.execute("SELECT puzzle_name FROM puzzle_progress WHERE user_id = ? AND completed = 1", (user_id,))
            completed = [row[0] for row in c.fetchall()]

            if user:
                return jsonify(
                    username=user[0],
                    email=user[1],
                    discord_name=user[2],
                    discord_avatar=user[3],
                    completed_puzzles=completed
                )
            return jsonify(msg="User not found"), 404
    except Exception as e:
        print("❌ /me error:", e)
        return jsonify(msg="JWT or DB error"), 500



def init_db():
    if not os.path.exists("db.sqlite3"):
        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                password TEXT,
                reset_token TEXT,
                email_confirmed BOOLEAN DEFAULT 0,
                email_token TEXT
                balance INTEGER DEFAULT 0,
                last_claim REAL DEFAULT 0
            )''')
            c.execute('''CREATE TABLE IF NOT EXISTS puzzle_progress (
                user_id INTEGER,
                puzzle_name TEXT,
                completed BOOLEAN,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )''')
            c.execute('''CREATE TABLE IF NOT EXISTS leaderboard (
                user_id INTEGER,
                completed_puzzles INTEGER,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )''')
            conn.commit()

init_db()


@app.route("/register", methods=["POST"])
@limiter.limit("5 per hour")
def register():
    data = request.json
    username = data["username"].strip()
    email = data["email"].lower().strip()
    password = data["password"]

    if not is_valid_email(email):
        return jsonify(msg="Invalid email format"), 400
    if not is_valid_password(password):
        return jsonify(msg="Password must be at least 8 characters long, contain both letters and numbers"), 400
    if len(username) < 3 or len(username) > 20:
        return jsonify(msg="Username must be between 3 and 20 characters"), 400
    if not re.match(r'^[a-zA-Z0-9_.-]+$', username):
        return jsonify(msg="Username contains invalid characters"), 400
    def contains_banned_word(username):
        uname = username.lower()
        for word in BANNED_USERNAMES:
            if word in uname and len(word) >= 3:
                if uname.count(word) == 1 and len(uname) - len(word) > 2:
                    continue
                return True
        return False

# inside register route
    if contains_banned_word(username):
        return jsonify(msg="Username contains banned words"), 400


    try:
        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            c.execute("SELECT id FROM users WHERE lower(username) = ?", (username,))
            if c.fetchone():
                return jsonify(msg="Username already exists"), 409

            c.execute("SELECT id FROM users WHERE email = ?", (email,))
            if c.fetchone():
                return jsonify(msg="Email already registered"), 409

            hashed_password = generate_password_hash(password)
            token = secrets.token_urlsafe(32)

            c.execute("""
                INSERT INTO users (username, email, password, email_token, email_confirmed, balance, last_claim)
                VALUES (?, ?, ?, ?, 0, 10000, ?)
            """, (username, email, hashed_password, token, time.time()))
            conn.commit()

            send_email_confirmation(email, token)
            return jsonify(msg="Confirmation email sent. Please verify to complete registration."), 200

    except sqlite3.Error as e:
        return jsonify(msg=f"Error: {e}"), 500

def send_email_confirmation(to_email, token):
    link = f"https://decipher.wiki/confirm-email.html?token={token}"
    body = f"Click the link to confirm your email and activate your account:\n{link}"
    msg = MIMEText(body)
    msg["Subject"] = "Confirm Your Email"
    msg["From"] = os.getenv("EMAIL_USER")
    msg["To"] = to_email

    with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
        smtp.starttls()
        smtp.login(os.getenv("EMAIL_USER"), os.getenv("EMAIL_PASS"))
        smtp.send_message(msg)

@app.route("/confirm-email", methods=["POST"])
@limiter.limit("5 per hour")
def confirm_email():
    token = request.json.get("token")
    if not token:
        return jsonify(msg="Missing token"), 400

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE email_token = ?", (token,))
        row = c.fetchone()
        if not row:
            return jsonify(msg="Invalid or expired token"), 400

        user_id = row[0]
        c.execute("UPDATE users SET email_confirmed = 1, email_token = NULL WHERE id = ?", (user_id,))
        conn.commit()

    jwt_token = create_access_token(identity=str(user_id))
    resp = jsonify(msg="Email confirmed!")
    set_access_cookies(resp, jwt_token)
    return resp


@app.route("/discord/connect")
@jwt_required()
def discord_connect():
  user_id = get_jwt_identity()
  session["user_id"] = user_id
  raw_redirect = request.args.get("redirect", "/")
  redirect_to = raw_redirect if is_safe_redirect_url(raw_redirect) else "/"
  session["user_id"] = get_jwt_identity()
  session["redirect_after"] = redirect_to

  discord = OAuth2Session(
      client_id=os.getenv("DISCORD_CLIENT_ID"),
      redirect_uri=os.getenv("DISCORD_REDIRECT_URI"),
      scope=["identify"]
  )
  auth_url, state = discord.authorization_url("https://discord.com/oauth2/authorize")
  session["discord_oauth_state"] = state
  return redirect(auth_url)



@app.route("/discord/callback")
def discord_callback():
    user_id = session.get("user_id")
    if not user_id:
        return "Missing user session", 401

    discord = OAuth2Session(
        client_id=os.getenv("DISCORD_CLIENT_ID"),
        state=session.get("discord_oauth_state"),
        redirect_uri=os.getenv("DISCORD_REDIRECT_URI")
    )

    discord_token = discord.fetch_token(
    "https://discord.com/api/oauth2/token",
    client_secret=os.getenv("DISCORD_CLIENT_SECRET"),
    authorization_response=request.url
    )

    session["discord_token"] = discord_token

    user_info = discord.get("https://discord.com/api/users/@me").json()
    discord_id = user_info["id"]
    discord_name = user_info.get("global_name") or user_info.get("username")
    discord_avatar = f"https://cdn.discordapp.com/avatars/{discord_id}/{user_info['avatar']}.png"

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("""
            UPDATE users 
            SET discord_id = ?, discord_name = ?, discord_avatar = ? 
            WHERE id = ?
        """, (discord_id, discord_name, discord_avatar, user_id))
        conn.commit()

    # ✅ Use the saved redirect
    redirect_to = session.pop("redirect_after", "/")
    return redirect(redirect_to)


@app.route("/discord/roles", methods=["GET"])
@jwt_required()
def get_discord_roles():
    user_id = get_jwt_identity()

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT discord_id FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row or not row[0]:
            return jsonify(msg="Discord not connected"), 400

        discord_id = row[0]

    with open("trigger_sync.flag", "w") as f:
        f.write("1")

    bot_token = os.getenv("DISCORD_BOT_TOKEN")
    guild_id = os.getenv("DISCORD_GUILD_ID")

    if not bot_token or not guild_id:
        return jsonify(msg="Missing token or guild ID"), 500

    headers = {
        "Authorization": f"Bot {bot_token}",
        "User-Agent": "DiscordBot (https://decipher.wiki, 1.0)"
    }

    url = f"https://discord.com/api/v10/guilds/{guild_id}/members/{discord_id}"
    res = requests.get(url, headers=headers)

    if res.status_code != 200:
        print("❌ Discord API call failed")
        print("URL:", url)
        print("Response:", res.status_code, res.text)
        return jsonify(msg=res.text), 400

    open("/var/www/my-site/backend/trigger_sync.flag", "w").write("1")

    data = res.json()
    return jsonify(roles=data.get("roles", []))

DISCORD_ANNOUNCE_CHANNEL = "645341027053600771"
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")

def announce_to_discord(username, puzzle_name):
    url = f"https://discord.com/api/v10/channels/{DISCORD_ANNOUNCE_CHANNEL}/messages"
    headers = {
        "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
        "Content-Type": "application/json"
    }
    json = {
        "content": f"🎉 **{username}** just solved **{puzzle_name}**!"
    }
    try:
        requests.post(url, headers=headers, json=json)
    except Exception as e:
        print("Failed to announce to Discord:", e)

@app.route("/sync-discord", methods=["POST"])
@jwt_required()
def sync_discord():
    user_id = get_jwt_identity()
    data = request.json
    discord_id = data.get("discord_id")

    if not discord_id:
        return jsonify(msg="Missing Discord ID"), 400

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET discord_id = ? WHERE id = ?", (discord_id, user_id))
        conn.commit()

    with open("trigger_sync.flag", "w") as f:
        f.write("1")

    # Notify the bot (via file, db flag, or webhook later)
    return jsonify(msg="Discord ID saved. Sync will run shortly."), 200

@app.route('/symbols')
def symbols_redirect():
    return redirect('/symbols-list', code=301)

@app.route("/get-roles", methods=["POST"])
def get_roles():
    data = request.json
    discord_id = data.get("discord_id")
    if not discord_id:
        return jsonify({"error": "Missing Discord ID"}), 400

    bot_token = os.getenv("DISCORD_BOT_TOKEN")
    guild_id = os.getenv("DISCORD_GUILD_ID")
    url = f"https://discord.com/api/v10/guilds/{guild_id}/members/{discord_id}"
    headers = {
        "Authorization": f"Bot {bot_token}",
        "User-Agent": "DiscordBot (https://decipher.wiki, 1.0)"
    }

    res = requests.get(url, headers=headers)
    if res.status_code != 200:
        return jsonify({"error": "Failed to fetch member", "status": res.status_code}), res.status_code

    data = res.json()
    return jsonify({"roles": data.get("roles", [])})



@app.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.json
    identifier = data["identifier"].lower().strip()
    password = data["password"]

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("""
            SELECT id, password, email_confirmed FROM users
            WHERE username = ? OR email = ?
        """, (identifier, identifier))
        user = c.fetchone()

        if not user or not check_password_hash(user[1], password):
            return jsonify(msg="Invalid credentials"), 401

        if not user[2]:
            return jsonify(msg="Email not confirmed. Please check your inbox.", user_id=user[0]), 403


        token = create_access_token(identity=str(user[0]))
        resp = make_response(redirect("/account.html"))
        set_access_cookies(resp, token)
        return resp

@app.route("/resend-verification", methods=["POST"])
@limiter.limit("5 per hour")
def resend_verification():
    user_id = request.json.get("user_id")
    now = int(time.time())

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT email, email_confirmed, last_verification_sent FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if not row:
            return jsonify(msg="User not found"), 404

        email, confirmed, last_sent = row
        if confirmed:
            return jsonify(msg="Email already confirmed"), 400

        if last_sent and now - last_sent < 10:
            return jsonify(msg="Please wait before resending."), 429

        # ✅ generate + save new token
        token = secrets.token_urlsafe(32)
        c.execute("UPDATE users SET email_token = ?, last_verification_sent = ? WHERE id = ?", (token, now, user_id))
        conn.commit()

    # ✅ send new email
    confirm_link = f"https://decipher.wiki/confirm-email.html?token={token}"
    msg = MIMEText(f"Click here to verify your email:\n{confirm_link}")
    msg["Subject"] = "Confirm Your Email"
    msg["From"] = os.getenv("EMAIL_USER")
    msg["To"] = email

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
            smtp.starttls()
            smtp.login(os.getenv("EMAIL_USER"), os.getenv("EMAIL_PASS"))
            smtp.send_message(msg)

        return jsonify(msg="Verification email resent."), 200

    except Exception as e:
        print("Error sending email:", e)
        return jsonify(msg="Failed to send verification email."), 500


@app.route("/change-password", methods=["POST"])
@limiter.limit("5 per hour")
@jwt_required()
def change_password():
    data = request.json
    user_id = get_jwt_identity()
    current_password = data.get("currentPassword")
    new_password = data.get("newPassword")

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT password FROM users WHERE id = ?", (user_id,))
        user = c.fetchone()
        if not user or not check_password_hash(user[0], current_password):
            return jsonify(msg="Current password is incorrect"), 400

        new_password_hash = generate_password_hash(new_password)
        c.execute("UPDATE users SET password = ? WHERE id = ?", (new_password_hash, user_id))
        conn.commit()
        return jsonify(msg="Password updated successfully"), 200

@app.route("/forgot-password", methods=["POST"])
@limiter.limit("5 per hour")
def forgot_password():
    try:
        data = request.json
        print("Incoming data:", data)

        email = data.get("email").lower().strip()
        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            c.execute("SELECT id FROM users WHERE email = ?", (email,))
            user = c.fetchone()
            if not user:
                return jsonify(msg="Email not found"), 404

            reset_token = secrets.token_urlsafe(32)
            c.execute("UPDATE users SET reset_token = ? WHERE email = ?", (reset_token, email))
            conn.commit()

            send_reset_email(email, reset_token)
            return jsonify(msg="Password reset link sent to your email"), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("ERROR in /forgot-password:", e)
        return jsonify(msg="Internal server error"), 500

@app.route("/reset-password", methods=["POST"])
@limiter.limit("5 per hour")
def reset_password():
    data = request.json
    reset_token = data.get("token")
    new_password = data.get("newPassword")

    if not is_valid_password(new_password):
        return jsonify(msg="Password must be at least 8 characters long and contain both letters and numbers"), 400

    with sqlite3.connect("db.sqlite3") as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE reset_token = ?", (reset_token,))
        user = c.fetchone()
        if not user:
            return jsonify(msg="Invalid or expired reset token"), 400

        new_password_hash = generate_password_hash(new_password)
        c.execute("UPDATE users SET password = ?, reset_token = NULL WHERE id = ?", (new_password_hash, user[0]))
        conn.commit()
        return jsonify(msg="Password reset successfully"), 200


@app.route("/protected", methods=["GET"])
@jwt_required()
def protected():
    user_id = get_jwt_identity()
    return jsonify(msg=f"Hello user {user_id}"), 200

@app.route("/google/login")
def google_login():
    google = OAuth2Session(
        GOOGLE_CLIENT_ID,
        redirect_uri=REDIRECT_URI,
        scope=["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"]
    )
    auth_url, state = google.authorization_url(
        "https://accounts.google.com/o/oauth2/v2/auth",
        access_type="offline",
        prompt="select_account"
    )
    session["oauth_state"] = state
    return redirect(auth_url)


@app.route("/google/callback")
def google_callback():
    try:
        google = OAuth2Session(GOOGLE_CLIENT_ID, state=session.get("oauth_state"), redirect_uri=REDIRECT_URI)
        token = google.fetch_token(
            "https://oauth2.googleapis.com/token",
            client_secret=GOOGLE_CLIENT_SECRET,
            authorization_response=request.url
        )

        user_info = google.get("https://www.googleapis.com/oauth2/v2/userinfo").json()
        email = user_info.get("email", "").lower().strip()
        username = email.split("@")[0]

        with sqlite3.connect("db.sqlite3") as conn:
            c = conn.cursor()
            c.execute("SELECT id FROM users WHERE email = ?", (email,))
            user = c.fetchone()
            if not user:
                c.execute("INSERT INTO users (username, email, password) VALUES (?, ?, '')", (username, email))
                conn.commit()
                user_id = c.lastrowid
            else:
                user_id = user[0]

        token = create_access_token(identity=str(user_id))
        resp = make_response(redirect("/account.html"))  # or token-bridge page
        set_access_cookies(resp, token)
        return resp
    
    except Exception as e:
        return f"<h1>Google Login Failed</h1><p>{str(e)}</p>"


@app.route("/")
def home():
    return app.send_static_file("index.html")

@app.route("/debug", methods=["POST"])
def debug():
    return jsonify(msg="POST reached debug"), 200

if __name__ == "__main__":
    with thread_lock:
        if bg_thread is None:
            bg_thread = socketio.start_background_task(spin_roulette)
    socketio.run(app, host="0.0.0.0", port=5050)