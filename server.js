// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

// Folder na wiadomości (będzie tworzony automatycznie)
const MSG_DIR = path.join(__dirname, "wiadomosci");
const PRIV_VIDEO_DIR = path.join(__dirname, "video_priv");

// TODO: ZMIEŃ TE DANE PRZED UŻYCIEM POZA LOKALNYM ŚRODOWISKIEM
const PRIV_LOGIN_USER = "martino";
const PRIV_LOGIN_PASS = "zmien-to-haslo";
const PRIV_COOKIE_NAME = "priv_video_session";
const PRIV_UI_COOKIE_NAME = "priv_video_ui";
const PRIV_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;
const PRIV_COOKIE_VALUE = crypto
    .createHash("sha256")
    .update(`${PRIV_LOGIN_USER}:${PRIV_LOGIN_PASS}`)
    .digest("hex");

// Middleware: obsługa formularzy (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: false }));

function ensureDirExists(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeName(str) {
    return String(str || "")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9ąĄćĆęĘłŁńŃóÓśŚżŻźŹ_\-]/g, "");
}

function getDateStamp() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}${mi}` };
}

function getNextNumber(dirPath) {
    const files = fs.readdirSync(dirPath);
    let maxNum = 0;

    for (const f of files) {
        const m = f.match(/^(\d{3})_/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
        }
    }
    return String(maxNum + 1).padStart(3, "0");
}

function parseCookies(cookieHeader) {
    const out = {};
    if (!cookieHeader) return out;

    for (const part of cookieHeader.split(";")) {
        const [rawKey, ...rest] = part.trim().split("=");
        if (!rawKey) continue;
        out[rawKey] = decodeURIComponent(rest.join("=") || "");
    }
    return out;
}

function safeEqual(a, b) {
    const ba = Buffer.from(String(a), "utf8");
    const bb = Buffer.from(String(b), "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
}

function isPrivAuthenticated(req) {
    const cookies = parseCookies(req.headers.cookie || "");
    return safeEqual(cookies[PRIV_COOKIE_NAME] || "", PRIV_COOKIE_VALUE);
}

function setPrivAuthCookie(res) {
    const authCookie = `${PRIV_COOKIE_NAME}=${encodeURIComponent(
        PRIV_COOKIE_VALUE
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PRIV_COOKIE_MAX_AGE_SECONDS}`;
    const uiCookie = `${PRIV_UI_COOKIE_NAME}=1; Path=/; SameSite=Lax; Max-Age=${PRIV_COOKIE_MAX_AGE_SECONDS}`;
    res.setHeader("Set-Cookie", [authCookie, uiCookie]);
}

function clearPrivAuthCookie(res) {
    const authCookie = `${PRIV_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
    const uiCookie = `${PRIV_UI_COOKIE_NAME}=; Path=/; SameSite=Lax; Max-Age=0`;
    res.setHeader("Set-Cookie", [authCookie, uiCookie]);
}

app.use((req, res, next) => {
    const cookies = parseCookies(req.headers.cookie || "");
    if (isPrivAuthenticated(req) && cookies[PRIV_UI_COOKIE_NAME] !== "1") {
        res.append(
            "Set-Cookie",
            `${PRIV_UI_COOKIE_NAME}=1; Path=/; SameSite=Lax; Max-Age=${PRIV_COOKIE_MAX_AGE_SECONDS}`
        );
    }
    next();
});

function renderPrivLoginPage(errorMessage = "") {
    const errorBlock = errorMessage
        ? `<p style="color:#ff8b8b;">${errorMessage}</p>`
        : "";

    return `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="/style.css">
    <title>Priv Video - Logowanie</title>
</head>
<body>
    <header class="topbar">
        <div class="header-center">
            <img src="/images/Wscieklosc_ikona.png" alt="Logo Wściekłość" class="logo-header">
            <div class="logo-title">Moja Pierwsza Strona HTML</div>
        </div>

        <nav class="menu">
            <a href="/index.html">
                <i class="fa-solid fa-house"></i> Home
            </a>
            <a href="/Start.html">
                <i class="fa-solid fa-play"></i> Start
            </a>
            <a href="/Galeria.html">
                <i class="fa-solid fa-image"></i> Galeria
            </a>
            <a href="/Video.html">
                <i class="fa-solid fa-video"></i> Video
            </a>
            <a href="/PrivVideo.html">
                <i class="fa-solid fa-lock"></i> Priv Video
            </a>
            <a href="/kontakt.html">
                <i class="fa-solid fa-user"></i> Kontakt
            </a>
        </nav>
        <script>
            (function () {
                const current = window.location.pathname.split('/').pop() || 'index.html';
                document.querySelectorAll('.menu a').forEach(link => {
                    if (link.getAttribute('href') === '/' + current) {
                        link.classList.add('active');
                    }
                });
            })();
        </script>
    </header>

    <main>
        <h1>Priv Video - logowanie</h1>
        <p>Zaloguj się, aby uzyskać dostęp do prywatnej sekcji.</p>
        ${errorBlock}
        <form method="post" action="/priv-login">
            <p>
                <label for="username">Login:</label><br>
                <input id="username" name="username" type="text" required autocomplete="username">
            </p>
            <p>
                <label for="password">Hasło:</label><br>
                <input id="password" name="password" type="password" required autocomplete="current-password">
            </p>
            <p>
                <button type="submit">Zaloguj</button>
            </p>
        </form>
    </main>

    <footer class="stopka">
        <p>&copy; 2025 Martino / Kael'Nahar · Strona tworzona razem z Lyr Enai.</p>
    </footer>
</body>
</html>`;
}

function requirePrivAuth(req, res, next) {
    if (!isPrivAuthenticated(req)) {
        res.status(401).type("html").send(renderPrivLoginPage());
        return;
    }
    next();
}

app.get("/PrivVideo.html", (req, res) => {
    if (!isPrivAuthenticated(req)) {
        res.status(401).type("html").send(renderPrivLoginPage());
        return;
    }
    res.sendFile(path.join(__dirname, "PrivVideo.html"));
});

app.post("/priv-login", (req, res) => {
    const username = req.body.username || "";
    const password = req.body.password || "";
    const validUser = safeEqual(username, PRIV_LOGIN_USER);
    const validPass = safeEqual(password, PRIV_LOGIN_PASS);

    if (!validUser || !validPass) {
        res.status(401).type("html").send(renderPrivLoginPage("Błędny login lub hasło."));
        return;
    }

    setPrivAuthCookie(res);
    res.redirect("/PrivVideo.html");
});

app.post("/priv-logout", (req, res) => {
    clearPrivAuthCookie(res);
    res.redirect("/PrivVideo.html");
});

app.get("/video_priv/*splat", requirePrivAuth, (req, res) => {
    const parts = Array.isArray(req.params.splat) ? req.params.splat : [req.params.splat];
    const requested = parts.join("/");
    const targetPath = path.resolve(PRIV_VIDEO_DIR, requested);
    const rootPath = path.resolve(PRIV_VIDEO_DIR) + path.sep;

    if (!targetPath.startsWith(rootPath)) {
        res.status(403).send("Brak dostępu.");
        return;
    }

    fs.stat(targetPath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.status(404).send("Nie znaleziono pliku.");
            return;
        }
        res.sendFile(targetPath);
    });
});

// Serwowanie statycznych plików (Twoje HTML/CSS/IMG)
app.use(express.static(__dirname));

// Endpoint do zapisu formularza
app.post("/send", (req, res) => {
    ensureDirExists(MSG_DIR);

    const name = req.body.name || "";
    const email = req.body.email || "";
    const message = req.body.message || "";

    const safeName = sanitizeName(name) || "Anon";
    const { date, time } = getDateStamp();
    const num = getNextNumber(MSG_DIR);

    const filename = `${num}_${date}_${time}_${safeName}.txt`;
    const filepath = path.join(MSG_DIR, filename);

    const content =
        `NR: ${num}
DATA: ${date} ${time}
IMIĘ: ${name}
EMAIL: ${email}

WIADOMOŚĆ:
${message}
`;

    fs.writeFileSync(filepath, content, { encoding: "utf8", mode: 0o600 });
    fs.chmodSync(filepath, 0o600);

    // wracamy na stronę z parametrem OK (żebyś mógł pokazać komunikat)
    res.redirect(`/kontakt.html?ok=1&file=${encodeURIComponent(filename)}`);
});

app.listen(PORT, () => {
    console.log(`Serwer działa: http://127.0.0.1:${PORT}`);
});
