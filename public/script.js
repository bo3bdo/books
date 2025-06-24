// المتغيرات العامة
let currentView = 'grid';
let currentBookId = null;
let books = [];

// تحميل البيانات عند بدء التطبيق
document.addEventListener('DOMContentLoaded', function() {
    loadBooks();
    setupEventListeners();
    setupPasswordStrengthIndicator();
});

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // رفع الملفات بالسحب والإفلات
    const uploadArea = document.querySelector('.file-upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
    }    // نموذج الرفع
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }

    // نموذج العلامة المائية
    const watermarkForm = document.getElementById('watermarkForm');
    if (watermarkForm) {
        watermarkForm.addEventListener('submit', handleWatermark);
    }

    // شريط تمرير الشفافية
    const opacitySlider = document.getElementById('watermarkOpacity');
    if (opacitySlider) {
        opacitySlider.addEventListener('input', function() {
            document.getElementById('opacityValue').textContent = this.value;
        });
    }
}

// عرض الصفحة الرئيسية
function showHome() {
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('uploadPage').style.display = 'none';
    
    // تحديث الروابط النشطة
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector('.nav-link[onclick="showHome()"]').classList.add('active');
    
    loadBooks();
}

// عرض صفحة الرفع
function showUpload() {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('uploadPage').style.display = 'block';
    
    // تحديث الروابط النشطة
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector('.nav-link[onclick="showUpload()"]').classList.add('active');
}

// تحميل الكتب من الخادم
async function loadBooks() {
    try {
        showLoading();
        const response = await fetch('/api/books');
        books = await response.json();
        console.log('Loaded books:', books);
        // طباعة معلومات الحماية للكتاب الأول
        if (books.length > 0) {
            console.log('First book protection info:', {
                id: books[0].id,
                title: books[0].title,
                is_protected: books[0].is_protected,
                protection_type: books[0].protection_type
            });
        }
        displayBooks(books);
        updateStats(books);
    } catch (error) {
        console.error('Error loading books:', error);
        showAlert('حدث خطأ في تحميل الكتب', 'danger');
    }
}

// عرض الكتب
function displayBooks(booksToShow) {
    const container = document.getElementById('booksContainer');
    
    if (booksToShow.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book-open"></i>
                <h4>لا توجد كتب في المكتبة</h4>
                <p>ابدأ بإضافة كتب جديدة إلى مكتبتك</p>
                <button class="btn btn-primary" onclick="showUpload()">
                    <i class="fas fa-plus"></i> إضافة كتاب
                </button>
            </div>
        `;
        return;
    }    const booksHTML = booksToShow.map(book => `
        <div class="book-card">
            <div class="book-icon">
                <i class="fas fa-file-pdf"></i>
                <div class="book-pages">${book.pages || 0} صفحة</div>
            </div>
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-author">بقلم: ${book.author}</div>
                <div class="book-description">${book.description || 'لا يوجد وصف'}</div>
                <div class="book-meta">
                    <span class="book-date">${formatDate(book.upload_date)}</span>
                    <span class="book-size">${formatFileSize(book.file_size)}</span>
                </div>
                <div class="book-actions">
                    <button class="btn btn-sm btn-primary" onclick="showBookDetails(${book.id})" title="تفاصيل">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <a class="btn btn-sm btn-success" href="/view/${book.id}" target="_blank" title="عرض مستقل">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                    <a class="btn btn-sm btn-secondary" href="/api/download/${book.id}" target="_blank" title="تحميل">
                        <i class="fas fa-download"></i>
                    </a>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = booksHTML;
}

// تحديث الإحصائيات
function updateStats(books) {
    const totalBooks = books.length;
    const totalSize = books.reduce((sum, book) => sum + (book.file_size || 0), 0);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const recentBooks = books.filter(book => {
        const bookDate = new Date(book.upload_date);
        return bookDate.getMonth() === currentMonth && bookDate.getFullYear() === currentYear;
    }).length;

    document.getElementById('totalBooks').textContent = totalBooks;
    document.getElementById('totalSize').textContent = formatFileSize(totalSize);
    document.getElementById('recentBooks').textContent = recentBooks;
}

// البحث في الكتب
function handleSearch(event) {
    if (event.key === 'Enter') {
        searchBooks();
    }
}

async function searchBooks() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        displayBooks(books);
        return;
    }

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const searchResults = await response.json();
        displayBooks(searchResults);
    } catch (error) {
        console.error('خطأ في البحث:', error);
        showAlert('حدث خطأ أثناء البحث', 'danger');
    }
}

// تغيير عرض الكتب
function setView(view) {
    currentView = view;
    const container = document.getElementById('booksContainer');
    const gridBtn = document.getElementById('gridViewBtn');
    const listBtn = document.getElementById('listViewBtn');

    if (view === 'grid') {
        container.className = 'books-grid';
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    } else {
        container.className = 'books-list';
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
    }
}

// عرض تفاصيل الكتاب
function showBookDetails(bookId) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;    currentBookId = bookId;    // تحديث محتوى المودال
    document.getElementById('bookModalTitle').textContent = book.title;
    document.getElementById('bookAuthor').textContent = book.author;
    document.getElementById('bookDescription').textContent = book.description || 'لا يوجد وصف';
    document.getElementById('bookPages').textContent = `${book.pages || 0} صفحة`;
    document.getElementById('bookSize').textContent = formatFileSize(book.file_size);
    document.getElementById('bookDate').textContent = formatDate(book.upload_date);

    // تحديث روابط التحميل والعرض
    const downloadUrl = `/api/download/${bookId}`;
    document.getElementById('downloadBtn').href = downloadUrl;
    document.getElementById('viewBtn').href = downloadUrl;
    document.getElementById('pdfViewer').src = downloadUrl;

    // عرض المودال
    new bootstrap.Modal(document.getElementById('bookModal')).show();
}

// حذف الكتاب
async function deleteBook() {
    if (!currentBookId) return;

    if (!confirm('هل أنت متأكد من حذف هذا الكتاب؟')) {
        return;
    }

    try {
        const response = await fetch(`/api/books/${currentBookId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showAlert('تم حذف الكتاب بنجاح', 'success');
            bootstrap.Modal.getInstance(document.getElementById('bookModal')).hide();
            loadBooks();
        } else {
            showAlert('حدث خطأ أثناء حذف الكتاب', 'danger');
        }
    } catch (error) {
        console.error('خطأ في حذف الكتاب:', error);
        showAlert('حدث خطأ أثناء حذف الكتاب', 'danger');
    }
}

// معالجة رفع الملفات
async function handleUpload(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        // تغيير زر الإرسال
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';
        submitBtn.disabled = true;

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showAlert('تم رفع الكتاب بنجاح!', 'success');
            event.target.reset();
            updateFileName();
            showHome();
        } else {
            showAlert(result.error || 'حدث خطأ أثناء رفع الكتاب', 'danger');
        }
    } catch (error) {
        console.error('خطأ في رفع الملف:', error);
        showAlert('حدث خطأ أثناء رفع الملف', 'danger');
    } finally {
        // إعادة تعيين زر الإرسال
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// تحديث اسم الملف المختار
function updateFileName() {
    const fileInput = document.getElementById('pdfFile');
    const fileInfo = document.getElementById('fileInfo');

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileInfo.innerHTML = `
            <i class="fas fa-file-pdf"></i>
            ${file.name} (${formatFileSize(file.size)})
        `;
        fileInfo.style.display = 'block';
    } else {
        fileInfo.style.display = 'none';
    }
}

// معالجة السحب والإفلات
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'application/pdf') {
            document.getElementById('pdfFile').files = files;
            updateFileName();
        } else {
            showAlert('يجب أن يكون الملف من نوع PDF', 'danger');
        }
    }
}

// عرض رسائل التنبيه
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    
    const alertHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" id="${alertId}">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    alertContainer.insertAdjacentHTML('beforeend', alertHTML);
    
    // إزالة التنبيه تلقائياً بعد 5 ثوان
    setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }
    }, 5000);
}

// عرض حالة التحميل
function showLoading() {
    const container = document.getElementById('booksContainer');
    container.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner"></i>
            <p>جاري تحميل الكتب...</p>
        </div>
    `;
}

// تنسيق حجم الملف
function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// تنسيق التاريخ
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return date.toLocaleDateString('ar-SA', options);
}

// عرض مودال الحماية
function showProtectionModal() {
    new bootstrap.Modal(document.getElementById('protectionModal')).show();
}

// عرض مودال العلامة المائية
function showWatermarkModal() {
    new bootstrap.Modal(document.getElementById('watermarkModal')).show();
}

// معالجة حماية PDF - نسخة محسنة مثل Stirling-PDF
async function handleProtection(event) {
    event.preventDefault();
    
    if (!currentBookId) return;

    const userPassword = document.getElementById('protectionPassword').value;
    const ownerPassword = document.getElementById('ownerPassword').value;
    const encryptionLevel = document.getElementById('encryptionLevel').value;
    
    if (!userPassword && !ownerPassword) {
        showAlert('يجب إدخال كلمة مرور المستخدم أو المالك على الأقل', 'danger');
        return;
    }

    const permissions = {
        printing: document.getElementById('allowPrinting').checked,
        copying: document.getElementById('allowCopying').checked,
        modifying: document.getElementById('allowModifying').checked,
        annotating: document.getElementById('allowAnnotating').checked,
        fillingForms: document.getElementById('allowFillingForms').checked,
        contentAccessibility: document.getElementById('allowContentAccessibility').checked,
        documentAssembly: document.getElementById('allowDocumentAssembly').checked
    };

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء النسخة المشفرة...';
        submitBtn.disabled = true;

        const response = await fetch(`/api/protect/${currentBookId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                userPassword, 
                ownerPassword, 
                encryptionLevel,
                permissions 
            })
        });

        if (response.ok) {
            // تحميل الملف المشفر مباشرة
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // إنشاء رابط تحميل مؤقت
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `encrypted_book_${currentBookId}_${Date.now()}.pdf`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // تنظيف URL المؤقت
            window.URL.revokeObjectURL(url);
            
            showAlert('تم إنشاء النسخة المشفرة وتحميلها بنجاح! 🎉', 'success');
            bootstrap.Modal.getInstance(document.getElementById('protectionModal')).hide();
            
            // إعادة تعيين النموذج
            event.target.reset();
            
        } else {
            const result = await response.json();
            showAlert(result.error || 'حدث خطأ أثناء إنشاء النسخة المشفرة', 'danger');
        }
    } catch (error) {
        console.error('خطأ في إنشاء النسخة المشفرة:', error);
        showAlert('حدث خطأ أثناء إنشاء النسخة المشفرة', 'danger');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// معالجة إزالة الحماية
async function handleUnprotection(event) {
    event.preventDefault();
    
    if (!currentBookId) return;

    const password = document.getElementById('unprotectionPassword').value;

    if (!password) {
        showAlert('يجب إدخال كلمة المرور', 'danger');
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إزالة الحماية...';
        submitBtn.disabled = true;

        const response = await fetch(`/api/unprotect/${currentBookId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        const result = await response.json();

        if (result.success) {
            showAlert('تم إزالة الحماية بنجاح!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('protectionModal')).hide();
            loadBooks();
        } else {
            showAlert(result.error || 'حدث خطأ أثناء إزالة الحماية', 'danger');
        }
    } catch (error) {
        console.error('خطأ في إزالة الحماية:', error);
        showAlert('حدث خطأ أثناء إزالة الحماية', 'danger');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// معالجة إضافة العلامة المائية
async function handleWatermark(event) {
    event.preventDefault();
    
    if (!currentBookId) return;

    const text = document.getElementById('watermarkText').value;
    const fontSize = parseInt(document.getElementById('watermarkSize').value);
    const opacity = parseFloat(document.getElementById('watermarkOpacity').value);
    const color = document.getElementById('watermarkColor').value;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إضافة العلامة...';
        submitBtn.disabled = true;

        const response = await fetch(`/api/watermark/${currentBookId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text, fontSize, opacity, color })
        });

        const result = await response.json();

        if (result.success) {
            showAlert('تم إضافة العلامة المائية بنجاح!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('watermarkModal')).hide();
            loadBooks();
        } else {
            showAlert(result.error || 'حدث خطأ أثناء إضافة العلامة المائية', 'danger');
        }
    } catch (error) {
        console.error('خطأ في إضافة العلامة المائية:', error);
        showAlert('حدث خطأ أثناء إضافة العلامة المائية', 'danger');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// فحص قوة كلمة المرور
function checkPasswordStrength(password) {
    let strength = 0;
    let feedback = [];

    if (password.length >= 8) {
        strength += 1;
    } else {
        feedback.push('يجب أن تكون كلمة المرور 8 أحرف على الأقل');
    }

    if (/[a-z]/.test(password)) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;

    if (strength < 2) {
        return { level: 'weak', text: 'ضعيفة', class: 'strength-weak', feedback };
    } else if (strength < 4) {
        return { level: 'medium', text: 'متوسطة', class: 'strength-medium', feedback };
    } else {
        return { level: 'strong', text: 'قوية', class: 'strength-strong', feedback };
    }
}

// إضافة مؤشر قوة كلمة المرور
function setupPasswordStrengthIndicator() {
    const userPasswordInput = document.getElementById('protectionPassword');
    const ownerPasswordInput = document.getElementById('ownerPassword');
    
    if (userPasswordInput) {
        userPasswordInput.addEventListener('input', function() {
            const strength = checkPasswordStrength(this.value);
            let strengthIndicator = this.parentNode.querySelector('.password-strength');
            
            if (!strengthIndicator) {
                strengthIndicator = document.createElement('div');
                strengthIndicator.className = 'password-strength';
                this.parentNode.appendChild(strengthIndicator);
            }
            
            strengthIndicator.innerHTML = this.value ? 
                `<span class="${strength.class}">قوة كلمة المرور: ${strength.text}</span>` : '';
        });
    }
}

// فتح العارض المستقل
function openFullViewer() {
    if (currentBookId) {
        window.open(`/view/${currentBookId}`, '_blank');
    }
}
