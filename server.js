// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Folder na wiadomości (będzie tworzony automatycznie)
const MSG_DIR = path.join(__dirname, "wiadomosci");

// Middleware: obsługa formularzy (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: false }));

// Serwowanie statycznych plików (Twoje HTML/CSS/IMG)
app.use(express.static(__dirname));

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
