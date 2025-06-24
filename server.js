const express = require('express');
const fileUpload = require('express-fileupload');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد الوسطاء (Middleware)
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
    createParentPath: true,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
}));

// إنشاء مجلد للكتب إذا لم يكن موجوداً
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log('Uploads directory created');
} else {
    console.log('Uploads directory already exists');
}

// إنشاء قاعدة البيانات
const db = new sqlite3.Database('library.db');

// إنشاء جدول الكتب
db.run(`
    CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT,
        description TEXT,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        pages INTEGER,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Error creating database table:', err.message);
    } else {
        console.log('Database table initialized successfully');
    }
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API للحصول على جميع الكتب
app.get('/api/books', (req, res) => {
    console.log('GET /api/books - Fetching all books');
    db.all('SELECT * FROM books ORDER BY upload_date DESC', (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(`Found ${rows.length} books in library`);
        res.json(rows);
    });
});

// API للبحث في الكتب
app.get('/api/search', (req, res) => {
    const query = req.query.q;
    if (!query) {
        res.status(400).json({ error: 'يجب إدخال كلمة للبحث' });
        return;
    }
    
    const sql = `
        SELECT * FROM books 
        WHERE title LIKE ? OR author LIKE ? OR description LIKE ?
        ORDER BY upload_date DESC
    `;
    const searchTerm = `%${query}%`;
    
    db.all(sql, [searchTerm, searchTerm, searchTerm], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// API لرفع كتاب جديد
app.post('/api/upload', async (req, res) => {
    console.log('POST /api/upload - New book upload request');
    try {
        if (!req.files || !req.files.pdfFile) {
            console.log('Upload failed: No PDF file provided');
            return res.status(400).json({ error: 'يجب اختيار ملف PDF' });
        }

        const pdfFile = req.files.pdfFile;
        const { title, author, description } = req.body;        // التحقق من نوع الملف
        if (!pdfFile.name.toLowerCase().endsWith('.pdf')) {
            console.log('Upload failed: File is not PDF format');
            return res.status(400).json({ error: 'يجب أن يكون الملف من نوع PDF' });
        }

        console.log(`Uploading PDF: ${pdfFile.name} (${(pdfFile.size / 1024 / 1024).toFixed(2)} MB)`);

        // إنشاء اسم ملف فريد
        const timestamp = Date.now();
        const filename = `${timestamp}_${pdfFile.name}`;
        const filepath = path.join(uploadsDir, filename);

        // حفظ الملف
        await pdfFile.mv(filepath);        // استخراج عدد الصفحات من PDF
        let pageCount = 0;
        try {
            const dataBuffer = fs.readFileSync(filepath);
            const pdfData = await pdfParse(dataBuffer);
            pageCount = pdfData.numpages;
        } catch (pdfError) {
            console.log('Error reading PDF:', pdfError.message);
        }        // حفظ معلومات الكتاب في قاعدة البيانات
        const sql = `
            INSERT INTO books (title, author, description, filename, file_path, file_size, pages)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [
            title || 'بدون عنوان',
            author || 'مؤلف غير معروف',
            description || '',
            filename,
            filepath,
            pdfFile.size,
            pageCount
        ], function(err) {
            if (err) {
                console.error('Database insert error:', err.message);
                res.status(500).json({ error: err.message });
                return;
            }
            console.log(`Book uploaded successfully with ID: ${this.lastID}`);
            res.json({ 
                success: true, 
                message: 'تم رفع الكتاب بنجاح',
                bookId: this.lastID 
            });
        });} catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء رفع الملف' });
    }
});

// API لتحميل/عرض ملف PDF
app.get('/api/download/:id', (req, res) => {
    const bookId = req.params.id;
    
    console.log(`Download request for book ${bookId}`);
    
    db.get('SELECT * FROM books WHERE id = ?', [bookId], async (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(404).json({ error: 'الكتاب غير موجود' });
            return;
        }
        
        const filepath = row.file_path;
        if (!fs.existsSync(filepath)) {
            res.status(404).json({ error: 'ملف الكتاب غير موجود' });
            return;
        }
        
        console.log(`Serving PDF file: ${row.filename}`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${row.filename}"`);
        res.sendFile(filepath);
    });
});

// API لإضافة علامة مائية
app.post('/api/watermark/:id', async (req, res) => {
    try {
        const bookId = req.params.id;
        const { text, fontSize, opacity, color } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'يجب إدخال نص العلامة المائية' });
        }

        // جلب معلومات الكتاب
        db.get('SELECT * FROM books WHERE id = ?', [bookId], async (err, book) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!book) {
                return res.status(404).json({ error: 'الكتاب غير موجود' });
            }

            if (!fs.existsSync(book.file_path)) {
                return res.status(404).json({ error: 'ملف الكتاب غير موجود' });
            }

            try {
                // قراءة ملف PDF
                const existingPdfBytes = fs.readFileSync(book.file_path);
                const pdfDoc = await PDFDocument.load(existingPdfBytes);
                
                // إعداد الخط
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                const pages = pdfDoc.getPages();

                // إضافة علامة مائية لكل صفحة
                pages.forEach(page => {
                    const { width, height } = page.getSize();
                    
                    page.drawText(text, {
                        x: width / 2 - (text.length * (fontSize || 30)) / 4,
                        y: height / 2,
                        size: fontSize || 30,
                        font: font,
                        color: rgb(
                            parseInt(color?.substring(1, 3) || 'cc', 16) / 255,
                            parseInt(color?.substring(3, 5) || 'cc', 16) / 255,
                            parseInt(color?.substring(5, 7) || 'cc', 16) / 255
                        ),
                        opacity: opacity || 0.5,
                        rotate: {
                            type: 'degrees',
                            angle: 45
                        }
                    });
                });

                // حفظ الملف مع العلامة المائية
                const pdfBytes = await pdfDoc.save();
                fs.writeFileSync(book.file_path, pdfBytes);

                res.json({ 
                    success: true, 
                    message: 'تم إضافة العلامة المائية بنجاح' 
                });

            } catch (pdfError) {
                console.error('خطأ في إضافة العلامة المائية:', pdfError);
                res.status(500).json({ error: 'حدث خطأ أثناء إضافة العلامة المائية' });
            }
        });

    } catch (error) {
        console.error('خطأ في إضافة العلامة المائية:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة العلامة المائية' });
    }
});

// API لحذف كتاب
app.delete('/api/books/:id', (req, res) => {
    const bookId = req.params.id;
    
    db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(404).json({ error: 'الكتاب غير موجود' });
            return;
        }
        
        // حذف الملف من النظام
        if (fs.existsSync(row.file_path)) {
            fs.unlinkSync(row.file_path);
        }
        
        // حذف السجل من قاعدة البيانات
        db.run('DELETE FROM books WHERE id = ?', [bookId], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, message: 'تم حذف الكتاب بنجاح' });
        });
    });
});

// صفحة عرض PDF مستقلة
app.get('/view/:id', (req, res) => {
    const bookId = req.params.id;
    
    db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, book) => {
        if (err) {
            return res.status(500).send('خطأ في قاعدة البيانات');
        }
        
        if (!book) {
            return res.status(404).send('الكتاب غير موجود');
        }
        
        // إرسال صفحة عرض PDF
        res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
    });
});

// API للحصول على معلومات كتاب محدد
app.get('/api/book/:id', (req, res) => {
    const bookId = req.params.id;
    
    db.get('SELECT * FROM books WHERE id = ?', [bookId], (err, book) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!book) {
            return res.status(404).json({ error: 'الكتاب غير موجود' });
        }
        
        res.json(book);
    });
});

// دالة للتحقق من توفر QPDF (للاستخدام المستقبلي)
// بدء الخادم
app.listen(PORT, () => {
    console.log(`🚀 PDF Books Library is running on port ${PORT}`);
    console.log(`📚 Access the library at: http://localhost:${PORT}`);
});

// إغلاق قاعدة البيانات عند إيقاف التطبيق
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});
