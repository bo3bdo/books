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
        is_protected BOOLEAN DEFAULT 0,
        protection_type TEXT,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Error creating database table:', err.message);
    } else {
        console.log('Database table initialized successfully');
        
        // إضافة الأعمدة الجديدة إذا لم تكن موجودة
        db.run(`ALTER TABLE books ADD COLUMN is_protected BOOLEAN DEFAULT 0`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding is_protected column:', err.message);
            } else {
                console.log('is_protected column ready');
            }
        });
        
        db.run(`ALTER TABLE books ADD COLUMN protection_type TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding protection_type column:', err.message);
            } else {
                console.log('protection_type column ready');
            }
        });
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
        // طباعة معلومات الحماية للكتاب الأول للتأكد
        if (rows.length > 0) {
            console.log('First book protection status:', {
                id: rows[0].id,
                title: rows[0].title,
                is_protected: rows[0].is_protected,
                protection_type: rows[0].protection_type
            });
        }
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
        }// حفظ معلومات الكتاب في قاعدة البيانات
        const sql = `
            INSERT INTO books (title, author, description, filename, file_path, file_size, pages, is_protected, protection_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [
            title || 'بدون عنوان',
            author || 'مؤلف غير معروف',
            description || '',
            filename,
            filepath,
            pdfFile.size,
            pageCount,
            0,
            null        ], function(err) {
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
    const password = req.query.password;
    
    console.log(`Download request for book ${bookId}, password provided: ${password ? 'Yes' : 'No'}`);
    
    db.get('SELECT * FROM books WHERE id = ?', [bookId], async (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(404).json({ error: 'الكتاب غير موجود' });
            return;
        }
        
        // التحقق من الحماية
        if (row.is_protected && row.protection_type === 'password') {
            console.log('Book is protected, checking password...');
            if (!password) {
                // إرجاع صفحة طلب كلمة المرور
                res.status(401).send(`
                    <!DOCTYPE html>
                    <html dir="rtl" lang="ar">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>كتاب محمي</title>
                        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                        <style>
                            body { font-family: 'Cairo', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                            .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                            .password-card { background: white; border-radius: 15px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="password-card text-center">
                                <i class="fas fa-shield-alt text-warning mb-3" style="font-size: 3rem;"></i>
                                <h3 class="mb-3">كتاب محمي</h3>
                                <p class="mb-4">هذا الكتاب محمي بكلمة مرور. يرجى إدخال كلمة المرور للوصول إليه.</p>
                                <form onsubmit="checkPassword(event)">
                                    <div class="mb-3">
                                        <input type="password" class="form-control" id="password" placeholder="كلمة المرور" required>
                                    </div>
                                    <button type="submit" class="btn btn-primary">فتح الكتاب</button>
                                    <a href="/" class="btn btn-secondary ms-2">العودة للمكتبة</a>
                                </form>
                            </div>
                        </div>
                        <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
                        <script>
                            function checkPassword(event) {
                                event.preventDefault();
                                const password = document.getElementById('password').value;
                                window.location.href = '/api/download/${bookId}?password=' + encodeURIComponent(password);
                            }
                        </script>
                    </body>
                    </html>
                `);
                return;
            }
            
            // التحقق من كلمة المرور عن طريق محاولة فتح الملف
            try {
                const dataBuffer = fs.readFileSync(row.file_path);
                const { PDFDocument } = require('pdf-lib');
                await PDFDocument.load(dataBuffer, { password: password });
                console.log('Password correct, allowing access');
            } catch (pdfError) {
                console.log('Password incorrect or PDF error:', pdfError.message);
                res.status(401).send(`
                    <!DOCTYPE html>
                    <html dir="rtl" lang="ar">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>كلمة مرور خاطئة</title>
                        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                        <style>
                            body { font-family: 'Cairo', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                            .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                            .error-card { background: white; border-radius: 15px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="error-card text-center">
                                <i class="fas fa-times-circle text-danger mb-3" style="font-size: 3rem;"></i>
                                <h3 class="mb-3">كلمة مرور خاطئة</h3>
                                <p class="mb-4">كلمة المرور التي أدخلتها غير صحيحة. يرجى المحاولة مرة أخرى.</p>
                                <button onclick="history.back()" class="btn btn-primary">المحاولة مرة أخرى</button>
                                <a href="/" class="btn btn-secondary ms-2">العودة للمكتبة</a>
                            </div>
                        </div>
                        <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
                    </body>
                    </html>
                `);
                return;
            }
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

// API لحماية PDF بكلمة مرور - نسخة محسنة مثل Stirling-PDF
app.post('/api/protect/:id', async (req, res) => {
    try {
        const bookId = req.params.id;
        const { 
            userPassword, 
            ownerPassword, 
            encryptionLevel,
            permissions 
        } = req.body;

        console.log('Protection request:', {
            bookId,
            hasUserPassword: !!userPassword,
            hasOwnerPassword: !!ownerPassword,
            encryptionLevel,
            permissions
        });

        if (!userPassword && !ownerPassword) {
            return res.status(400).json({ error: 'يجب إدخال كلمة مرور المستخدم أو المالك على الأقل' });
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
                // قراءة ملف PDF الأصلي
                const existingPdfBytes = fs.readFileSync(book.file_path);
                const pdfDoc = await PDFDocument.load(existingPdfBytes);

                // إعداد خيارات التشفير المتقدمة
                const saveOptions = {};
                
                // إضافة كلمات المرور
                if (userPassword) {
                    saveOptions.userPassword = userPassword;
                }
                if (ownerPassword) {
                    saveOptions.ownerPassword = ownerPassword;
                } else if (userPassword) {
                    saveOptions.ownerPassword = userPassword + '_owner_auto';
                }

                // إعداد الصلاحيات المفصلة
                saveOptions.permissions = {
                    printing: permissions?.printing !== false ? 'highResolution' : 'none',
                    modifying: permissions?.modifying !== false,
                    copying: permissions?.copying !== false,
                    annotating: permissions?.annotating !== false,
                    fillingForms: permissions?.fillingForms !== false,
                    contentAccessibility: permissions?.contentAccessibility !== false,
                    documentAssembly: permissions?.documentAssembly !== false
                };

                // تطبيق مستوى التشفير (محاكاة للـ encryption levels)
                if (encryptionLevel) {
                    // pdf-lib لا يدعم تحديد مستوى التشفير مباشرة
                    // لكن يمكننا حفظ هذه المعلومات في قاعدة البيانات
                    console.log(`Using encryption level: ${encryptionLevel} bit`);
                }

                // إنشاء اسم ملف للنسخة المشفرة
                const timestamp = Date.now();
                const originalName = book.filename.replace('.pdf', '');
                const encryptedFilename = `${originalName}_encrypted_${timestamp}.pdf`;
                const encryptedFilePath = path.join(uploadsDir, 'encrypted', encryptedFilename);
                
                // إنشاء مجلد للملفات المشفرة
                const encryptedDir = path.join(uploadsDir, 'encrypted');
                if (!fs.existsSync(encryptedDir)) {
                    fs.mkdirSync(encryptedDir, { recursive: true });
                }

                // حفظ النسخة المشفرة
                const encryptedPdfBytes = await pdfDoc.save(saveOptions);
                fs.writeFileSync(encryptedFilePath, encryptedPdfBytes);

                // إرسال الملف المشفر للمستخدم
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${encryptedFilename}"`);
                res.setHeader('Content-Length', encryptedPdfBytes.length);
                
                // إرسال الملف
                res.send(Buffer.from(encryptedPdfBytes));

                // حذف الملف المؤقت بعد 5 ثوانِ (للأمان)
                setTimeout(() => {
                    if (fs.existsSync(encryptedFilePath)) {
                        fs.unlinkSync(encryptedFilePath);
                        console.log(`Temporary encrypted file deleted: ${encryptedFilename}`);
                    }
                }, 5000);

                console.log(`Encrypted PDF generated successfully: ${encryptedFilename}`);

            } catch (pdfError) {
                console.error('خطأ في حماية PDF:', pdfError);
                res.status(500).json({ error: 'حدث خطأ أثناء حماية الملف: ' + pdfError.message });
            }
        });

    } catch (error) {
        console.error('خطأ في حماية الكتاب:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حماية الكتاب' });
    }
});

// API لإزالة الحماية من PDF
app.post('/api/unprotect/:id', async (req, res) => {
    try {
        const bookId = req.params.id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'يجب إدخال كلمة المرور' });
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
                // قراءة ملف PDF المحمي
                const existingPdfBytes = fs.readFileSync(book.file_path);
                const pdfDoc = await PDFDocument.load(existingPdfBytes, { 
                    password: password 
                });

                // حفظ PDF بدون حماية
                const pdfBytes = await pdfDoc.save();
                fs.writeFileSync(book.file_path, pdfBytes);

                // تحديث قاعدة البيانات
                db.run('UPDATE books SET is_protected = 0, protection_type = NULL WHERE id = ?', 
                    [bookId], (err) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({ 
                        success: true, 
                        message: 'تم إزالة الحماية من الكتاب بنجاح' 
                    });
                });

            } catch (pdfError) {
                console.error('خطأ في إزالة حماية PDF:', pdfError);
                if (pdfError.message.includes('password')) {
                    res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
                } else {
                    res.status(500).json({ error: 'حدث خطأ أثناء إزالة الحماية' });
                }
            }
        });

    } catch (error) {
        console.error('خطأ في إزالة حماية الكتاب:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إزالة حماية الكتاب' });
    }
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

// دالة للتحقق من توفر QPDF (للاستخدام المستقبلي)
function checkQPDFAvailability() {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
        exec('qpdf --version', (error) => {
            if (error) {
                console.log('QPDF not available, using pdf-lib for encryption');
                resolve(false);
            } else {
                console.log('QPDF is available for advanced encryption');
                resolve(true);
            }
        });
    });
}

// دالة محسنة لتشفير PDF باستخدام QPDF (إذا كان متوفراً)
async function encryptPDFWithQPDF(inputPath, outputPath, options) {
    const { exec } = require('child_process');
    const { userPassword, ownerPassword, encryptionLevel, permissions } = options;
    
    let command = `qpdf --encrypt "${userPassword}" "${ownerPassword}" ${encryptionLevel}`;
    
    // إضافة الصلاحيات
    if (permissions) {
        if (!permissions.printing) command += ' --print=none';
        if (!permissions.modifying) command += ' --modify=none';
        if (!permissions.copying) command += ' --extract=n';
        if (!permissions.annotating) command += ' --annotate=n';
        if (!permissions.fillingForms) command += ' --form=n';
        if (!permissions.contentAccessibility) command += ' --accessibility=n';
        if (!permissions.documentAssembly) command += ' --assemble=n';
    }
    
    command += ` -- "${inputPath}" "${outputPath}"`;
    
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ success: true, output: stdout });
            }
        });
    });
}

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
