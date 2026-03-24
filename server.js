require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

// ============================================================
// 1. HELPER GENERATOR ASET (DARI KODEMU)
// ============================================================

// --- HELPER 2: FOTO RANDOM ---
const getRandomLocal = (gender) => {
    try {
        let genderFolder = (gender === 'L') ? 'L' : 'P'; 
        let dirPath = path.join(__dirname, 'assets', 'faces', genderFolder);
        
        if (!fs.existsSync(dirPath) && gender !== 'L') {
            dirPath = path.join(__dirname, 'assets', 'faces', 'W');
        }
        if (!fs.existsSync(dirPath)) return null;

        const files = fs.readdirSync(dirPath).filter(file => ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase()));
        if (files.length === 0) return null;

        const randomFile = files[Math.floor(Math.random() * files.length)];
        const fullPath = path.join(dirPath, randomFile);
        const fileBuffer = fs.readFileSync(fullPath);
        const ext = path.extname(randomFile).toLowerCase() === '.png' ? 'png' : 'jpeg';
        
        return `data:image/${ext};base64,${fileBuffer.toString('base64')}`;
    } catch (error) { return null; }
};

const generateBarcodeSvg = (code) => {
    let bars = '';
    let x = 10;
    for(let i=0; i<55; i++) {
        const w = [1, 2, 3][Math.floor(Math.random() * 3)];
        const space = [1, 2][Math.floor(Math.random() * 2)];
        bars += `<rect x="${x}" y="0" width="${w}" height="40" fill="#1a237e"/>`;
        x += w + space;
    }
    return `<g>${bars}<text x="${x/2 + 5}" y="55" font-family="Consolas, monospace" font-size="12" text-anchor="middle" letter-spacing="2">${code}</text></g>`;
};

const generateQRCodeSvg = () => {
    const size = 25; 
    const blockSize = 3; 
    let content = `<rect width="${size * blockSize}" height="${size * blockSize}" fill="white"/>`;
    
    const marker = (bx, by) => {
        let m = `<rect x="${bx*blockSize}" y="${by*blockSize}" width="${7*blockSize}" height="${7*blockSize}" fill="black"/>`;
        m += `<rect x="${(bx+1)*blockSize}" y="${(by+1)*blockSize}" width="${5*blockSize}" height="${5*blockSize}" fill="white"/>`;
        m += `<rect x="${(bx+2)*blockSize}" y="${(by+2)*blockSize}" width="${3*blockSize}" height="${3*blockSize}" fill="black"/>`;
        return m;
    };

    for(let y=0; y<size; y++){
        for(let x=0; x<size; x++){
            if ((x<8 && y<8) || (x>size-9 && y<8) || (x<8 && y>size-9)) continue;
            if(Math.random() > 0.5) {
                content += `<rect x="${x*blockSize}" y="${y*blockSize}" width="${blockSize}" height="${blockSize}" fill="black"/>`;
            }
        }
    }
    return `<g>${content}${marker(0,0)}${marker(size-7,0)}${marker(0,size-7)}</g>`;
};

// --- HELPER 1: LOGO LOKAL (DENGAN DEFAULT) ---
const getLocalLogoBase64 = (uniName) => {
    // Arahkan ke folder public/assets/logos
    const logoDir = path.join(__dirname, 'public', 'assets', 'logos');
    const lower = uniName.toLowerCase();
    
    // 1. Tentukan nama file target berdasarkan nama kampus
    let filename = 'logo-default.png'; // Default awal jika tidak ada match

    if (lower.includes('indonesia') || lower.includes('ui')) filename = 'logo-ui.png';
    else if (lower.includes('gadjah') || lower.includes('ugm')) filename = 'logo-ugm.png';
    else if (lower.includes('brawijaya') || lower.includes('ub')) filename = 'logo-ub.png';
    else if (lower.includes('padjadjaran') || lower.includes('unpad')) filename = 'logo-unpad.png';
    else if (lower.includes('teknologi') || lower.includes('itb') || lower.includes('its')) filename = 'logo-itb.png';
    else if (lower.includes('diponegoro') || lower.includes('undip')) filename = 'logo-undip.png';
    else if (lower.includes('sebelas') || lower.includes('uns')) filename = 'logo-uns.png';
    else if (lower.includes('bogor') || lower.includes('ipb')) filename = 'logo-ipb.png';
    else if (lower.includes('airlangga') || lower.includes('unair')) filename = 'logo-unair.png';
    
    // 2. Cek apakah file spesifik tersebut BENAR-BENAR ADA?
    let targetPath = path.join(logoDir, filename);

    if (!fs.existsSync(targetPath)) {
        // Jika file spesifik (misal logo-ui.png) tidak ditemukan,
        // GANTI target menjadi logo-default.png
        // console.log(`⚠️ Logo ${filename} tidak ditemukan, switch ke default.`);
        targetPath = path.join(logoDir, 'default.png');
    }

    // 3. Baca file (Entah itu file spesifik atau file default)
    if (fs.existsSync(targetPath)) {
        try {
            const fileBuffer = fs.readFileSync(targetPath);
            const ext = path.extname(targetPath).replace('.', '').toLowerCase();
            const mimeType = ext === 'png' ? 'png' : 'jpeg';
            
            return `data:image/${mimeType};base64,${fileBuffer.toString('base64')}`;
        } catch (e) {
            console.error("Gagal membaca file logo:", e);
        }
    }

    // 4. FALLBACK TERAKHIR (JIKA LOGO-DEFAULT.PNG JUGA HILANG)
    // Return gambar transparan 1x1 pixel agar kode tidak error
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
};

// ============================================================
// 2. LOAD DATABASE
// ============================================================
let KAMPUS_DB = [];
let STUDENTS_DB = [];

try {
    const kampusPath = path.join(__dirname, 'database_kampus_lengkap.json');
    if (fs.existsSync(kampusPath)) {
        KAMPUS_DB = JSON.parse(fs.readFileSync(kampusPath, 'utf8'));
        console.log(`✅ Database Kampus: ${KAMPUS_DB.length} data.`);
    }
} catch (e) { console.error("⚠️ Gagal load database kampus."); }

try {
    const studentPath = path.join(__dirname, 'students_updated.json');
    if (fs.existsSync(studentPath)) {
        STUDENTS_DB = JSON.parse(fs.readFileSync(studentPath, 'utf8'));
        console.log(`✅ Database Students: ${STUDENTS_DB.length} data.`);
    }
} catch (e) { console.error("⚠️ Gagal load database student."); }

// ============================================================
// 3. HELPER LOGIC LAINNYA
// ============================================================

function loadDatabases() {
    try {
        let dbFile = fs.existsSync(path.join(__dirname, 'database_kampus_final.json')) 
            ? 'database_kampus_final.json' 
            : 'database_kampus_lengkap.json';
        
        if (fs.existsSync(path.join(__dirname, dbFile))) {
            KAMPUS_DB = JSON.parse(fs.readFileSync(path.join(__dirname, dbFile), 'utf8'));
            console.log(`✅ [DB] Kampus Loaded: ${KAMPUS_DB.length} entri`);
        }
    } catch (e) { console.error("⚠️ [DB] Gagal load database kampus"); }

    try {
        if (fs.existsSync(path.join(__dirname, 'students_updated.json'))) {
            STUDENTS_DB = JSON.parse(fs.readFileSync(path.join(__dirname, 'students_updated.json'), 'utf8'));
            console.log(`✅ [DB] Students Loaded: ${STUDENTS_DB.length} entri`);
        }
    } catch (e) { console.error("⚠️ [DB] Gagal load database student"); }
}

loadDatabases();

// --- FUNGSI AMBIL FOTO RANDOM DARI FOLDER ---
function getRandomAssetPhoto() {
    const dirPath = path.join(__dirname, 'public', 'assets', 'photos');
    
    // Cek folder ada atau tidak
    if (!fs.existsSync(dirPath)) {
        console.error("❌ Folder public/assets/photos tidak ditemukan!");
        return null;
    }

    try {
        // Ambil semua file jpg/png/jpeg
        const files = fs.readdirSync(dirPath).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
        });

        if (files.length === 0) return null;

        // Pilih 1 acak
        const randomFile = files[Math.floor(Math.random() * files.length)];
        const imgPath = path.join(dirPath, randomFile);
        const imgBuffer = fs.readFileSync(imgPath);
        
        // Return sebagai Base64
        return `data:image/${path.extname(randomFile).replace('.','')};base64,${imgBuffer.toString('base64')}`;
    } catch (e) {
        console.error("Error baca foto random:", e);
        return null;
    }
}

function getCampusInfo(campusName) {
    const defaultInfo = { 
        name: campusName || 'UNIVERSITAS',
        address: 'Jl. Pendidikan No. 1, Indonesia', 
        city: 'Indonesia',
        rector: 'Prof. Dr. Rektor, M.Si.'
    };
    if (!campusName || KAMPUS_DB.length === 0) return defaultInfo;
    
    const found = KAMPUS_DB.find(k => k.name.toLowerCase().includes(campusName.toLowerCase()));
    if (found) {
        const addr = found.billing.address || "Kampus Pusat";
        const city = found.billing.city || "";
        const prov = found.billing.province || "";
        return {
            name: found.name,
            address: `${addr}, ${city}, ${prov}`,
            city: city,
            rector: 'Prof. Dr. Akademisi, M.Kom.' 
        };
    }
    return defaultInfo;
}

function getRandomStudent() {
    if (STUDENTS_DB.length === 0) return null;
    return STUDENTS_DB[Math.floor(Math.random() * STUDENTS_DB.length)];
}

function generateStamp(uniName, logoBase64)  {
    const inkColor = "rgba(25, 25, 112, 0.85)"; 
    return `
    <g transform="rotate(-12)">
        <circle cx="50" cy="50" r="46" stroke="${inkColor}" stroke-width="3" fill="none"/>
        <circle cx="50" cy="50" r="34" stroke="${inkColor}" stroke-width="1" fill="none"/>
        <image href="${logoBase64}" x="22" y="22" width="56" height="56" opacity="0.25" preserveAspectRatio="xMidYMid meet" />
        <path id="curveTop" d="M 14,50 A 36,36 0 1,1 86,50" fill="none"/>
        <text font-family="Arial" font-size="8" font-weight="bold" fill="${inkColor}" letter-spacing="0.5">
            <textPath href="#curveTop" startOffset="50%" text-anchor="middle">${uniName.toUpperCase().substring(0, 30)}</textPath>
        </text>
        <rect x="18" y="42" width="64" height="16" fill="white" opacity="0.6"/>
        <text x="50" y="54" font-family="Arial Black" font-size="10" font-weight="bold" fill="${inkColor}" text-anchor="middle">OFFICIAL</text>
    </g>`;
};

function generateSignature() {
    return `<path d="M10,50 Q40,10 70,60 T130,40 T160,30" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/>`;
};

// --- SVG TEMPLATE (FINAL) ---
const SVG_TEMPLATE = `
<svg width="1011" height="638" viewBox="0 0 1011 638" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <pattern id="guilloche" width="50" height="50" patternUnits="userSpaceOnUse">
             <path d="M0 50 Q 25 0 50 50 T 100 5    0" stroke="#f0f4f8" stroke-width="1.5" fill="none"/>
        </pattern>
        <clipPath id="photoClip">
            <rect x="70" y="200" width="240" height="320" rx="8" ry="8"/>
        </clipPath>
        <filter id="shadow">
            <feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
    </defs>

    <rect width="100%" height="100%" rx="24" ry="24" fill="#ffffff"/>
    <rect width="100%" height="100%" rx="24" ry="24" fill="url(#guilloche)"/>
    
    <path d="M 0 160 L 1011 160" stroke="#1a237e" stroke-width="6" />
    <path d="M 0 168 L 1011 168" stroke="#fbc02d" stroke-width="3" />

    <g transform="translate(0, 25)">
        <image href="{{LOGO_BASE64}}" x="50" y="10" height="120" width="120" preserveAspectRatio="xMidYMid meet"/>
        
        <text x="550" y="40" font-family="Arial" font-size="22" text-anchor="middle" fill="#555" letter-spacing="4">REPUBLIK INDONESIA</text>
        <text x="550" y="90" font-family="Arial Black, Arial" font-weight="900" font-size="44" text-anchor="middle" fill="#1a237e">
            {{UNI_NAME}}
        </text>
        
        <text x="550" y="115" font-family="Arial" font-size="16" text-anchor="middle" fill="#666">
            {{ADDRESS}}
        </text>
    </g>

    <text x="550" y="210" font-family="Arial" font-weight="bold" font-size="28" text-anchor="middle" fill="#1a237e" letter-spacing="2">KARTU TANDA MAHASISWA</text>

    <rect x="65" y="195" width="250" height="330" rx="8" ry="8" fill="#e0e0e0" stroke="#ccc" stroke-width="1"/>
    <image href="{{PHOTO_BASE64}}" x="70" y="200" width="240" height="320" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>

    <g transform="translate(360, 240)" font-family="Arial, sans-serif" font-size="26" fill="#333">
        <g font-weight="normal" fill="#555">
            <text x="0" y="0">Nama Lengkap</text>
            <text x="0" y="45">NIM</text>
            <text x="0" y="90">Fakultas</text>
            <text x="0" y="135">Program Studi</text>
            <text x="0" y="180">Jenjang</text>
            <text x="0" y="225">Tahun Akademik</text>
            <text x="0" y="270">Berlaku Hingga</text>
        </g>

        <g transform="translate(220, 0)">
            <text y="0">:</text><text y="45">:</text><text y="90">:</text><text y="135">:</text>
            <text y="180">:</text><text y="225">:</text><text y="270">:</text>
        </g>

        <g transform="translate(240, 0)">
            <text y="0" font-weight="bold" fill="#000">{{NAME}}</text>
            <text y="45" font-family="Consolas, monospace" letter-spacing="1">{{NIM}}</text>
            <text y="90">{{FACULTY}}</text>
            <text y="135">{{MAJOR}}</text>
            <text y="180">{{JENJANG}}</text>
            <text y="225">{{YEAR}}</text>
            <text y="270" fill="#d32f2f" font-weight="bold">{{VALID_UNTIL}}</text>
        </g>
    </g>
    
    <rect x="800" y="550" width="180" height="40" rx="20" ry="20" fill="#e8f5e9" stroke="#4caf50" stroke-width="2"/>
    <text x="890" y="577" font-family="Arial" font-weight="bold" font-size="16" text-anchor="middle" fill="#2e7d32">MAHASISWA AKTIF</text>

    <g transform="translate(360, 545)">
        {{BARCODE_SVG}}
    </g>

    <g transform="translate(150, 540)">
    {{QR_SVG}}
    <text x="37" y="90" font-family="Arial" font-size="10" text-anchor="middle" fill="#777">SCAN ME</text>
     </g>

    <g transform="translate(700, 480)">
        <g transform="translate(0, 10)">{{STAMP_SVG}}</g>
        <g transform="translate(40, 20) rotate(-5)">{{SIGNATURE_SVG}}</g>

        <text x="80" y="120" font-family="Arial" font-size="18" font-weight="bold" text-anchor="middle" text-decoration="underline">
            {{RECTOR_NAME}}
        </text>
        <text x="80" y="140" font-family="Arial" font-size="14" text-anchor="middle" fill="#555">Rektor</text>
    </g>
</svg>
`;

// ============================================================
// 4. API ENDPOINTS
// ============================================================

app.get('/kampus-list', (req, res) => {
    if (KAMPUS_DB.length === 0) return res.status(500).json([]);
    res.json(KAMPUS_DB.map(k => k.name).sort());
});

app.get('/random-student', (req, res) => {
    const { university } = req.query;
    
    if (university && STUDENTS_DB.length > 0) {
        const filtered = STUDENTS_DB.filter(s => 
            s.university && s.university.toLowerCase().includes(university.toLowerCase())
        );
        if (filtered.length > 0) {
            const student = filtered[Math.floor(Math.random() * filtered.length)];
            return res.json(student);
        }
    }
    
    const student = getRandomStudent();
    if (student) res.json(student);
    else res.status(404).json({ error: "Kosong" });
});

app.post('/generate', upload.single('photo'), async (req, res) => {
    try {
        const { name, nim, faculty, major, university, year, jenjang, gender, useAI } = req.body;
        
        let photoBase64 = '';
        if (useAI === 'true') {
            photoBase64 = getRandomAssetPhoto(gender);
            if (!photoBase64) photoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; 
        } else if (req.file) {
            photoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        } else {
            photoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        }

        const logoBase64 = getLocalLogoBase64(university);
        const validUntil = parseInt(year || 2024) + 4;
        const info = getCampusInfo(university);

        const barcodeSvg = generateBarcodeSvg(nim || '0000000000');
        const qrSvg = generateQRCodeSvg();
        const signatureSvg = generateSignature();

        const stampSvg = generateStamp(university || 'UNIV', logoBase64);

        let finalSvg = SVG_TEMPLATE
            .replace('{{UNI_NAME}}', (university || 'UNIVERSITAS').toUpperCase())
            .replace('{{ADDRESS}}', info.address)
            .replace('{{PHOTO_BASE64}}', photoBase64)
            .replace('{{LOGO_BASE64}}', logoBase64) // <--- JANGAN LUPA INI
            .replace('{{NAME}}', (name || 'MAHASISWA').toUpperCase())
            .replace('{{NIM}}', nim || '000000')
            .replace('{{FACULTY}}', (faculty || '-').toUpperCase())
            .replace('{{MAJOR}}', (major || '-').toUpperCase())
            .replace('{{JENJANG}}', (jenjang || 'S1').toUpperCase())
            .replace('{{YEAR}}', year || '2024')
            .replace('{{VALID_UNTIL}}', validUntil)
            .replace('{{BARCODE_SVG}}', barcodeSvg)
            .replace('{{QR_SVG}}', qrSvg)
            .replace('{{STAMP_SVG}}', stampSvg)
            .replace('{{SIGNATURE_SVG}}', signatureSvg)
            .replace('{{RECTOR_NAME}}', info.rector);

        res.json({ svg: finalSvg });

    } catch (error) {
        console.error("Critical Error:", error);
        res.status(500).json({ error: error.message });
    }
});


app.listen(port, () => {
    console.log(`Server jalan di http://localhost:${port}`);
});