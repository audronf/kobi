const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

const booksDir = path.join(__dirname, 'books');
const tempDir = path.join(__dirname, 'temp');

[booksDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

app.use('/books', express.static(booksDir, {
    index: false,
    setHeaders: (res, _) => {

        res.setHeader('Content-Type', 'application/epub+zip');
        res.setHeader('Cache-Control', 'no-cache');

        console.log('>>> DOWNLOAD REQUESTED');
        console.log('   URL:', res.req.url);
        console.log('   User-Agent:', res.req.headers['user-agent'] || 'unknown');
        console.log('   IP:', res.req.ip || res.req.connection.remoteAddress);
        console.log('   Content-Type:', res.getHeader('Content-Type'));
        if (res.req.headers.range) {
            console.log('   Range request:', res.req.headers.range);
        }
        console.log('-----------------------------------');
    }
}));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/\.epub$/i, '');
        const kepubName = `${originalName}_${timestamp}.kepub.epub`;
        cb(null, kepubName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (path.extname(file.originalname).toLowerCase() === '.epub') {
            cb(null, true);
        } else {
            cb(new Error('Only EPUB ebooks are supported!'));
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});

function getBooks() {
    const files = fs.readdirSync(booksDir);
    const kepubFiles = files.filter(file => 
        file.toLowerCase().endsWith('.kepub.epub') || 
        file.toLowerCase().endsWith('.kepub') || 
        file.toLowerCase().endsWith('.epub')
    );

    const booksWithInfo = kepubFiles.map(file => {
        const filePath = path.join(booksDir, file);
        const stats = fs.statSync(filePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

        return {
            name: file,
            size: `${sizeInMB} MB`,
            sizeBytes: stats.size,
            dateAdded: stats.mtime
        };
    });

    booksWithInfo.sort((a, b) => b.dateAdded - a.dateAdded);
    return booksWithInfo;
}

function generateBooksHTML(books) {
    if (books.length === 0) {
        return '<p class="empty-message">No hay libros disponibles en el catálogo.</p>';
    }

    let html = '';
    books.forEach(book => {
        if (book.sizeBytes === 0) {
            return;
        }
        
        const title = book.name
            .replace('.kepub', '')
            .replace('.epub', '')
            .replace(/_/g, ' ')
            .replace(/\d{13}$/g, '');
        
        const escapedTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        html += `<div class="book-item">
                   <div class="book-title">${escapedTitle}</div>
                   <div class="book-info">Tamaño: ${book.size}</div>
                   <a href="/books/${encodeURIComponent(book.name)}" class="download-btn">Descargar</a>
                 </div>`;
    });
    
    return html;
}

app.get('/', (req, res) => {
    const books = getBooks();
    const booksHTML = generateBooksHTML(books);
    
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kobi</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
        }

        .navbar {
            background-color: #333;
            overflow: hidden;
            position: fixed;
            top: 0;
            width: 100%;
            z-index: 1000;
        }

        .navbar a {
            float: left;
            display: block;
            color: #f2f2f2;
            text-align: center;
            padding: 14px 20px;
            text-decoration: none;
            font-size: 17px;
        }

        .navbar a:hover {
            background-color: #ddd;
            color: black;
        }

        .navbar a.active {
            background-color: #4CAF50;
            color: white;
        }

        .container {
            margin-top: 60px;
            padding: 20px;
            max-width: 1200px;
            margin-left: auto;
            margin-right: auto;
        }

        h1 {
            color: #333;
            margin-bottom: 20px;
        }

        .book-grid {
            display: block;
        }

        .book-item {
            background: white;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .book-title {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
        }

        .book-info {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
        }

        .download-btn {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            text-decoration: none;
            display: inline-block;
        }

        .download-btn:hover {
            background-color: #45a049;
        }

        .refresh-btn {
            background-color: #2196F3;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-bottom: 15px;
            text-decoration: none;
            display: inline-block;
        }

        .refresh-btn:hover {
            background-color: #0b7dda;
        }

        .empty-message {
            text-align: center;
            color: #666;
            padding: 40px 20px;
        }

        .upload-link {
            background-color: #FF9800;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            text-decoration: none;
            display: inline-block;
            margin-left: 10px;
        }

        .upload-link:hover {
            background-color: #F57C00;
        }
    </style>
</head>
<body>
    <div class="navbar">
        <a href="/" class="active">Library</a>
        <a href="/upload">Upload book</a>
    </div>

    <div class="container">
        <h1>Library</h1>
        <a href="/" class="refresh-btn">Refresh</a>
        <div class="book-grid">
            ${booksHTML}
        </div>
    </div>
</body>
</html>`;
    
    res.send(html);
});

app.get('/upload', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Upload book</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
        }

        .navbar {
            background-color: #333;
            overflow: hidden;
            position: fixed;
            top: 0;
            width: 100%;
            z-index: 1000;
        }

        .navbar a {
            float: left;
            display: block;
            color: #f2f2f2;
            text-align: center;
            padding: 14px 20px;
            text-decoration: none;
            font-size: 17px;
        }

        .navbar a:hover {
            background-color: #ddd;
            color: black;
        }

        .navbar a.active {
            background-color: #4CAF50;
            color: white;
        }

        .container {
            margin-top: 60px;
            padding: 20px;
            max-width: 1200px;
            margin-left: auto;
            margin-right: auto;
        }

        h1 {
            color: #333;
            margin-bottom: 20px;
        }

        .upload-section {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .file-input-wrapper {
            margin: 20px 0;
        }

        input[type="file"] {
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            width: 100%;
            max-width: 400px;
        }

        .upload-btn {
            background-color: #4CAF50;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 10px;
        }

        .upload-btn:hover {
            background-color: #45a049;
        }
    </style>
</head>
<body>
    <div class="navbar">
        <a href="/">Catálogo</a>
        <a href="/upload" class="active">Upload</a>
    </div>

    <div class="container">
        <h1>Upload EPUB ebook</h1>
        <div class="upload-section">
            <form action="/api/upload" method="POST" enctype="multipart/form-data">
                <p>Select an EPUB file to upload</p>
                <div class="file-input-wrapper">
                    <input type="file" name="epub" accept="application/epub+zip,.epub" required>
                </div>
                <button type="submit" class="upload-btn">Upload</button>
            </form>
        </div>
    </div>
</body>
</html>`;
    
    res.send(html);
});

app.get('/api/books', (req, res) => {
    const books = getBooks();
    res.json(books);
});

app.post('/api/upload', upload.single('epub'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file selected');
    }

    const sourcePath = req.file.path;
    const destPath = path.join(booksDir, req.file.filename);

    fs.rename(sourcePath, destPath, (err) => {
        if (err) {
            console.error('Error saving file:', err);
            return res.status(500).send('Error saving file');
        }
        
        console.log('Saved file:', destPath);
        
        res.redirect('/');
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).send('File size is too large');
        }
        return res.status(400).send(err.message);
    } else if (err) {
        return res.status(400).send(err.message);
    }
    next();
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});