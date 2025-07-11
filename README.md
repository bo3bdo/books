# مكتبة الكتب PDF 📚

تطبيق ويب حديث لإدارة وتنظيم مكتبة الكتب بصيغة PDF باستخدام Node.js و Express.

## الميزات الرئيسية ✨

- **رفع الكتب**: رفع ملفات PDF بسهولة مع إمكانية السحب والإفلات
- **عرض الكتب**: عرض شبكي وقائمة للكتب مع معاينة جميلة
- **البحث المتقدم**: البحث في عناوين الكتب والمؤلفين والأوصاف
- **معاينة PDF**: عرض الكتب مباشرة في المتصفح
- **إحصائيات المكتبة**: عرض إحصائيات شاملة عن المكتبة
- **إضافة كلمة مرور للكتب**: حماية ملفات PDF باستخدام qpdf
- **واجهة عربية**: تصميم حديث وجميل يدعم اللغة العربية
- **تجاوبية**: تعمل على جميع الأجهزة (هاتف، تابلت، كمبيوتر)

## متطلبات التشغيل 🛠️

- Node.js (الإصدار 14 أو أحدث)
- npm (مدير الحزم)

## التثبيت والتشغيل 🚀

### 1. تثبيت المتطلبات
```bash
npm install
```

### 2. تشغيل التطبيق
```bash
npm start
```

أو للتطوير مع إعادة التشغيل التلقائي:
```bash
npm run dev
```

### 3. فتح التطبيق
افتح المتصفح وانتقل إلى:
```
http://localhost:3000
```

## كيفية الاستخدام 📖

### رفع كتاب جديد
1. اضغط على "رفع كتاب" في شريط التنقل
2. املأ معلومات الكتاب (العنوان، المؤلف، الوصف)
3. اختر ملف PDF أو اسحبه إلى المنطقة المخصصة
4. اضغط "رفع الكتاب"

### البحث في المكتبة
- استخدم مربع البحث في الصفحة الرئيسية
- يمكنك البحث في العناوين والمؤلفين والأوصاف
- اضغط Enter أو زر البحث

### عرض تفاصيل الكتاب
- اضغط على أي كتاب لعرض تفاصيله
- يمكنك معاينة الكتاب أو تحميله أو حذفه

### تغيير طريقة العرض
- استخدم أزرار التحكم لتغيير العرض بين الشبكة والقائمة

## هيكل المشروع 📁

```
pdf-books-library/
├── server.js              # الخادم الرئيسي
├── package.json           # إعدادات المشروع والمتطلبات
├── library.db             # قاعدة البيانات (تُنشأ تلقائياً)
├── uploads/               # مجلد ملفات PDF (يُنشأ تلقائياً)
└── public/                # الملفات العامة
    ├── index.html         # الصفحة الرئيسية
    ├── styles.css         # تنسيقات CSS
    └── script.js          # أكواد JavaScript
```

## التقنيات المستخدمة 💻

### الخادم (Backend)
- **Node.js**: بيئة تشغيل JavaScript
- **Express.js**: إطار عمل الويب
- **SQLite3**: قاعدة البيانات
- **Multer**: رفع الملفات
- **PDF-Parse**: استخراج معلومات PDF

### العميل (Frontend)
- **HTML5**: هيكل الصفحات
- **CSS3**: التنسيقات والتصميم
- **JavaScript**: التفاعل والديناميكية
- **Bootstrap 5**: إطار عمل CSS
- **Font Awesome**: الأيقونات

## API Endpoints 🔌

- `GET /` - الصفحة الرئيسية
- `GET /api/books` - جلب جميع الكتب
- `GET /api/search?q=query` - البحث في الكتب
- `POST /api/upload` - رفع كتاب جديد
- `GET /api/download/:id` - تحميل/عرض كتاب
- `DELETE /api/books/:id` - حذف كتاب
- `POST /api/encrypt/:id` - إضافة كلمة مرور للكتاب

## الحماية والأمان 🔒

- تحقق من نوع الملفات (PDF فقط)
- تحديد حد أقصى لحجم الملف (50MB)
- تنظيف أسماء الملفات
- حماية من رفع ملفات خبيثة
- إمكانية تشفير الكتب بكلمة مرور

## التخصيص والتطوير 🔧

### إضافة ميزات جديدة
يمكنك بسهولة إضافة ميزات جديدة مثل:
- تصنيف الكتب
- تقييم الكتب
- مشاركة الكتب
- نسخ احتياطية

### تغيير التصميم
- عدل ملف `public/styles.css` لتغيير المظهر
- استخدم متغيرات CSS للألوان والخطوط
- جميع التنسيقات تدعم RTL (العربية)

## استكشاف الأخطاء 🐛

### مشاكل شائعة وحلولها

1. **خطأ في تثبيت المتطلبات**
   ```bash
   npm cache clean --force
   npm install
   ```

2. **مشكلة في قاعدة البيانات**
   ```bash
   # احذف ملف قاعدة البيانات وأعد تشغيل التطبيق
   rm library.db
   npm start
   ```

3. **مشكلة في رفع الملفات**
   - تأكد من وجود مساحة كافية على القرص
   - تحقق من أن الملف بصيغة PDF صالحة

## المساهمة 🤝

نرحب بالمساهمات! يمكنك:
- إضافة ميزات جديدة
- إصلاح الأخطاء
- تحسين التصميم
- ترجمة واجهة المستخدم

## الترخيص 📄

هذا المشروع مرخص تحت رخصة MIT - راجع ملف LICENSE للتفاصيل.

## الدعم والمساعدة 💬

إذا واجهت أي مشاكل أو لديك اقتراحات، لا تتردد في:
- فتح issue في GitHub
- إرسال pull request
- التواصل معنا

---

**تم تطوير هذا المشروع بـ ❤️ للمجتمع العربي**
