import json
import mimetypes
import os
import secrets
import sqlite3
import sys
import traceback
import uuid
from datetime import datetime, timezone
from hashlib import pbkdf2_hmac
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("JM_DB_PATH", str(ROOT / "justmarket.db"))).expanduser()
STATIC_FILES = {
    "/": ROOT / "index.html",
    "/index.html": ROOT / "index.html",
    "/styles.css": ROOT / "styles.css",
    "/app.js": ROOT / "app.js",
}
MAX_IMAGES = 4
MAX_IMAGE_LENGTH = 2_500_000
ALLOWED_CATEGORIES = {
    "Mobiles",
    "Vehicles",
    "Property",
    "Electronics & Appliances",
    "Furniture",
    "Fashion & Beauty",
    "Books, Sports & Hobbies",
    "Jobs",
    "Services",
    "Pets",
}
ALLOWED_CONDITIONS = {"New", "Used", "Refurbished"}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                role TEXT NOT NULL CHECK(role IN ('company', 'customer')),
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                location TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS listings (
                id TEXT PRIMARY KEY,
                seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                condition TEXT NOT NULL,
                price REAL NOT NULL,
                location TEXT NOT NULL,
                description TEXT NOT NULL,
                images_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS favorites (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                PRIMARY KEY(user_id, listing_id)
            );

            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
                buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(listing_id, buyer_id, seller_id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS listings_created_at_idx ON listings(created_at DESC);
            CREATE INDEX IF NOT EXISTS listings_seller_id_idx ON listings(seller_id);
            CREATE INDEX IF NOT EXISTS favorites_listing_id_idx ON favorites(listing_id);
            CREATE INDEX IF NOT EXISTS chats_updated_at_idx ON chats(updated_at DESC);
            CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages(chat_id, created_at ASC);
            """
        )


def hash_password(password, salt_hex=None):
    salt = bytes.fromhex(salt_hex) if salt_hex else os.urandom(16)
    digest = pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return salt.hex(), digest.hex()


def verify_password(password, salt_hex, digest_hex):
    _, candidate = hash_password(password, salt_hex)
    return secrets.compare_digest(candidate, digest_hex)


def parse_json(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError("Invalid JSON body.") from error


def auth_token(handler):
    header = handler.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header.split(" ", 1)[1].strip() or None


def get_current_user(handler, conn):
    token = auth_token(handler)
    if not token:
        return None

    return conn.execute(
        """
        SELECT users.*
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
        """,
        (token,),
    ).fetchone()


def public_user(row):
    return {
        "id": row["id"],
        "role": row["role"],
        "name": row["name"],
        "location": row["location"],
    }


def current_user_payload(row):
    if not row:
        return None
    payload = public_user(row)
    payload["email"] = row["email"]
    return payload


def listing_payload(row):
    return {
        "id": row["id"],
        "sellerId": row["seller_id"],
        "title": row["title"],
        "category": row["category"],
        "condition": row["condition"],
        "price": row["price"],
        "location": row["location"],
        "description": row["description"],
        "images": json.loads(row["images_json"] or "[]"),
        "createdAt": row["created_at"],
    }


def normalize_text(value, label, max_length):
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{label} is required.")
    if len(text) > max_length:
        raise ValueError(f"{label} is too long.")
    return text


def chat_payload(conn, row):
    messages = conn.execute(
        """
        SELECT id, sender_id, text, created_at
        FROM messages
        WHERE chat_id = ?
        ORDER BY created_at ASC
        """,
        (row["id"],),
    ).fetchall()

    return {
        "id": row["id"],
        "listingId": row["listing_id"],
        "buyerId": row["buyer_id"],
        "sellerId": row["seller_id"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "messages": [
            {
                "id": message["id"],
                "senderId": message["sender_id"],
                "text": message["text"],
                "createdAt": message["created_at"],
            }
            for message in messages
        ],
    }


def bootstrap_payload(conn, user):
    users = conn.execute(
        """
        SELECT DISTINCT users.*
        FROM users
        LEFT JOIN listings ON listings.seller_id = users.id
        LEFT JOIN chats ON chats.buyer_id = users.id OR chats.seller_id = users.id
        WHERE listings.id IS NOT NULL
           OR chats.id IS NOT NULL
           OR users.id = ?
        ORDER BY users.created_at DESC
        """,
        (user["id"],) if user else ("",),
    ).fetchall()

    listings = conn.execute(
        """
        SELECT *
        FROM listings
        ORDER BY created_at DESC
        """
    ).fetchall()
    seller_count = conn.execute("SELECT COUNT(DISTINCT seller_id) AS count FROM listings").fetchone()["count"]
    chat_count = conn.execute("SELECT COUNT(*) AS count FROM chats").fetchone()["count"]

    favorite_ids = []
    chats = []

    if user:
        favorite_ids = [
            row["listing_id"]
            for row in conn.execute(
                "SELECT listing_id FROM favorites WHERE user_id = ?",
                (user["id"],),
            ).fetchall()
        ]

        chats = [
            chat_payload(conn, row)
            for row in conn.execute(
                """
                SELECT *
                FROM chats
                WHERE buyer_id = ? OR seller_id = ?
                ORDER BY updated_at DESC
                """,
                (user["id"], user["id"]),
            ).fetchall()
        ]

    return {
        "currentUser": current_user_payload(user),
        "users": [public_user(row) for row in users],
        "listings": [listing_payload(row) for row in listings],
        "favoriteIds": favorite_ids,
        "chats": chats,
        "marketStats": {
            "listingCount": len(listings),
            "sellerCount": seller_count,
            "chatCount": chat_count,
        },
    }


def validate_listing_images(images):
    if not isinstance(images, list):
        return []
    cleaned = [image for image in images if isinstance(image, str) and image.startswith("data:image/")]
    cleaned = cleaned[:MAX_IMAGES]
    for image in cleaned:
        if len(image) > MAX_IMAGE_LENGTH:
            raise ValueError("One of the images is too large.")
    return cleaned


def validate_email(email):
    normalized = str(email or "").strip().lower()
    if not normalized or "@" not in normalized or "." not in normalized.split("@")[-1]:
        raise ValueError("Enter a valid email address.")
    if len(normalized) > 254:
        raise ValueError("Email is too long.")
    return normalized


def json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def no_content(handler):
    handler.send_response(HTTPStatus.NO_CONTENT)
    handler.end_headers()


def error_response(handler, status, message):
    json_response(handler, status, {"error": message})


class Handler(BaseHTTPRequestHandler):
    server_version = "JustMarketHTTP/1.0"

    def log_message(self, format, *args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/bootstrap":
            self.handle_bootstrap()
            return
        if parsed.path == "/health":
            self.handle_health()
            return

        file_path = STATIC_FILES.get(parsed.path)
        if not file_path or not file_path.exists():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content = file_path.read_bytes()
        mime_type, _ = mimetypes.guess_type(str(file_path))
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{mime_type or 'application/octet-stream'}; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        parsed = urlparse(self.path)

        routes = {
            "/api/register": self.handle_register,
            "/api/login": self.handle_login,
            "/api/logout": self.handle_logout,
            "/api/listings": self.handle_create_listing,
            "/api/favorites/toggle": self.handle_toggle_favorite,
            "/api/chats/open": self.handle_open_chat,
        }

        if parsed.path.startswith("/api/chats/") and parsed.path.endswith("/messages"):
            self.handle_send_message(parsed.path)
            return

        handler = routes.get(parsed.path)
        if not handler:
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        handler()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/listings/"):
            self.handle_delete_listing(parsed.path)
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def handle_bootstrap(self):
        with db() as conn:
            user = get_current_user(self, conn)
            json_response(self, HTTPStatus.OK, bootstrap_payload(conn, user))

    def handle_health(self):
        try:
            with db() as conn:
                conn.execute("SELECT 1").fetchone()
            json_response(
                self,
                HTTPStatus.OK,
                {
                    "status": "ok",
                    "database": str(DB_PATH),
                },
            )
        except Exception:
            traceback.print_exc()
            error_response(self, HTTPStatus.SERVICE_UNAVAILABLE, "Health check failed.")

    def handle_register(self):
        try:
            payload = parse_json(self)
            role = str(payload.get("role", "")).strip()
            name = normalize_text(payload.get("name", ""), "Name", 120)
            email = validate_email(payload.get("email", ""))
            password = str(payload.get("password", ""))
            location = normalize_text(payload.get("location", ""), "Location", 120)

            if role not in {"company", "customer"}:
                raise ValueError("Choose a valid account type.")
            if len(password) < 6:
                raise ValueError("Password must be at least 6 characters.")

            user_id = str(uuid.uuid4())
            salt, password_hash = hash_password(password)
            token = secrets.token_urlsafe(32)
            created_at = now_iso()

            with db() as conn:
                conn.execute(
                    """
                    INSERT INTO users (id, role, name, email, password_hash, password_salt, location, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, role, name, email, password_hash, salt, location, created_at),
                )
                conn.execute(
                    "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
                    (token, user_id, created_at),
                )
                user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

            json_response(
                self,
                HTTPStatus.CREATED,
                {
                    "token": token,
                    "user": current_user_payload(user),
                },
            )
        except sqlite3.IntegrityError:
            error_response(self, HTTPStatus.CONFLICT, "That email is already registered.")
        except ValueError as error:
            error_response(self, HTTPStatus.BAD_REQUEST, str(error))
        except Exception:
            traceback.print_exc()
            error_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, "Could not register account.")

    def handle_login(self):
        try:
            payload = parse_json(self)
            email = validate_email(payload.get("email", ""))
            password = str(payload.get("password", ""))

            if not email or not password:
                raise ValueError("Email and password are required.")

            with db() as conn:
                user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
                if not user or not verify_password(password, user["password_salt"], user["password_hash"]):
                    error_response(self, HTTPStatus.UNAUTHORIZED, "Invalid email or password.")
                    return

                token = secrets.token_urlsafe(32)
                conn.execute(
                    "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
                    (token, user["id"], now_iso()),
                )

            json_response(
                self,
                HTTPStatus.OK,
                {
                    "token": token,
                    "user": current_user_payload(user),
                },
            )
        except ValueError as error:
            error_response(self, HTTPStatus.BAD_REQUEST, str(error))
        except Exception:
            traceback.print_exc()
            error_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, "Could not log in.")

    def handle_logout(self):
        token = auth_token(self)
        if not token:
            no_content(self)
            return

        with db() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        no_content(self)

    def handle_create_listing(self):
        try:
            payload = parse_json(self)
            with db() as conn:
                user = get_current_user(self, conn)
                if not user:
                    error_response(self, HTTPStatus.UNAUTHORIZED, "Log in first to post a listing.")
                    return

                title = normalize_text(payload.get("title", ""), "Title", 140)
                category = normalize_text(payload.get("category", ""), "Category", 80)
                condition = normalize_text(payload.get("condition", ""), "Condition", 40)
                location = normalize_text(payload.get("location", ""), "Location", 120)
                description = normalize_text(payload.get("description", ""), "Description", 3000)
                price = float(payload.get("price", 0) or 0)
                images = validate_listing_images(payload.get("images", []))

                if category not in ALLOWED_CATEGORIES:
                    raise ValueError("Choose a valid category.")
                if condition not in ALLOWED_CONDITIONS:
                    raise ValueError("Choose a valid condition.")
                if price <= 0:
                    raise ValueError("Price must be greater than zero.")

                listing_id = str(uuid.uuid4())
                created_at = now_iso()
                conn.execute(
                    """
                    INSERT INTO listings (
                        id, seller_id, title, category, condition, price, location, description, images_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        listing_id,
                        user["id"],
                        title,
                        category,
                        condition,
                        price,
                        location,
                        description,
                        json.dumps(images),
                        created_at,
                    ),
                )
                listing = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()

            json_response(self, HTTPStatus.CREATED, {"listing": listing_payload(listing)})
        except ValueError as error:
            error_response(self, HTTPStatus.BAD_REQUEST, str(error))
        except Exception:
            traceback.print_exc()
            error_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, "Could not create listing.")

    def handle_delete_listing(self, path):
        listing_id = path.rsplit("/", 1)[-1]
        with db() as conn:
            user = get_current_user(self, conn)
            if not user:
                error_response(self, HTTPStatus.UNAUTHORIZED, "Log in first.")
                return

            listing = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
            if not listing:
                error_response(self, HTTPStatus.NOT_FOUND, "Listing not found.")
                return
            if listing["seller_id"] != user["id"]:
                error_response(self, HTTPStatus.FORBIDDEN, "You can only delete your own listings.")
                return

            conn.execute("DELETE FROM listings WHERE id = ?", (listing_id,))

        no_content(self)

    def handle_toggle_favorite(self):
        try:
            payload = parse_json(self)
            listing_id = str(payload.get("listingId", "")).strip()

            with db() as conn:
                user = get_current_user(self, conn)
                if not user:
                    error_response(self, HTTPStatus.UNAUTHORIZED, "Log in to save ads.")
                    return

                listing = conn.execute("SELECT id FROM listings WHERE id = ?", (listing_id,)).fetchone()
                if not listing:
                    error_response(self, HTTPStatus.NOT_FOUND, "Listing not found.")
                    return

                favorite = conn.execute(
                    "SELECT 1 FROM favorites WHERE user_id = ? AND listing_id = ?",
                    (user["id"], listing_id),
                ).fetchone()

                saved = False
                if favorite:
                    conn.execute(
                        "DELETE FROM favorites WHERE user_id = ? AND listing_id = ?",
                        (user["id"], listing_id),
                    )
                else:
                    conn.execute(
                        "INSERT INTO favorites (user_id, listing_id, created_at) VALUES (?, ?, ?)",
                        (user["id"], listing_id, now_iso()),
                    )
                    saved = True

                favorite_ids = [
                    row["listing_id"]
                    for row in conn.execute(
                        "SELECT listing_id FROM favorites WHERE user_id = ?",
                        (user["id"],),
                    ).fetchall()
                ]

            json_response(self, HTTPStatus.OK, {"saved": saved, "favoriteIds": favorite_ids})
        except Exception:
            traceback.print_exc()
            error_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, "Could not update favorites.")

    def handle_open_chat(self):
        try:
            payload = parse_json(self)
            listing_id = str(payload.get("listingId", "")).strip()

            with db() as conn:
                user = get_current_user(self, conn)
                if not user:
                    error_response(self, HTTPStatus.UNAUTHORIZED, "Log in to open a chat.")
                    return

                listing = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
                if not listing:
                    error_response(self, HTTPStatus.NOT_FOUND, "Listing not found.")
                    return
                if listing["seller_id"] == user["id"]:
                    error_response(self, HTTPStatus.BAD_REQUEST, "This is your own listing.")
                    return

                buyer_id = user["id"]
                seller_id = listing["seller_id"]
                existing = conn.execute(
                    """
                    SELECT *
                    FROM chats
                    WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?
                    """,
                    (listing_id, buyer_id, seller_id),
                ).fetchone()

                if existing:
                    chat_id = existing["id"]
                else:
                    chat_id = str(uuid.uuid4())
                    timestamp = now_iso()
                    conn.execute(
                        """
                        INSERT INTO chats (id, listing_id, buyer_id, seller_id, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (chat_id, listing_id, buyer_id, seller_id, timestamp, timestamp),
                    )

            json_response(self, HTTPStatus.OK, {"chatId": chat_id})
        except Exception:
            traceback.print_exc()
            error_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, "Could not open chat.")

    def handle_send_message(self, path):
        try:
            chat_id = path.split("/")[3]
            payload = parse_json(self)
            text = str(payload.get("text", "")).strip()
            if not text:
                raise ValueError("Message text is required.")

            with db() as conn:
                user = get_current_user(self, conn)
                if not user:
                    error_response(self, HTTPStatus.UNAUTHORIZED, "Log in to send a message.")
                    return

                chat = conn.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
                if not chat:
                    error_response(self, HTTPStatus.NOT_FOUND, "Chat not found.")
                    return
                if user["id"] not in {chat["buyer_id"], chat["seller_id"]}:
                    error_response(self, HTTPStatus.FORBIDDEN, "You are not part of this chat.")
                    return

                timestamp = now_iso()
                conn.execute(
                    """
                    INSERT INTO messages (id, chat_id, sender_id, text, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (str(uuid.uuid4()), chat_id, user["id"], text, timestamp),
                )
                conn.execute("UPDATE chats SET updated_at = ? WHERE id = ?", (timestamp, chat_id))

            no_content(self)
        except ValueError as error:
            error_response(self, HTTPStatus.BAD_REQUEST, str(error))
        except Exception:
            traceback.print_exc()
            error_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, "Could not send message.")


def main():
    init_db()
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"JustMarket server listening on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
