<div align="center">

# 🌐 NetCheck (amiro-GeoPing)

**یک ابزار حرفه‌ای برای تست شبکه و پینگ واقعی از سرور‌های ایران و جهان**
*A professional Network Diagnostic tool using real-world Iranian and global probes.*

[![Live Demo](https://img.shields.io/badge/Live_Demo-amiro--geo--ping.vercel.app-success?style=for-the-badge&logo=vercel)](https://amiro-geo-ping.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<br />

[مشاهده دموی زنده (Live Demo)](https://pingo.amirsec.xyz) • [گزارش باگ (Report Bug)](https://github.com/iamirama/amiro-GeoPing/issues) • [درخواست ویژگی (Request Feature)](https://github.com/iamirama/amiro-GeoPing/issues)

</div>

---

## 📖 درباره پروژه (About The Project)

> [!NOTE]  
> **فارسی:** 
> «شبکه‌سنج (NetCheck)» یک ابزار متن‌باز و پیشرفته است که با استفاده از API عمومی [Globalping](https://globalping.io)، تست‌های واقعی شبکه مثل Ping، TCP، UDP، DNS و HTTP/HTTPS را از سرور‌های واقعی در ایران و سراسر جهان انجام می‌دهد. این ابزار به صورت اختصاصی برای بررسی وضعیت دسترسی به سرویس‌ها از داخل ایران و تشخیص فیلترینگ یا اختلالات شبکه طراحی شده است. تمام نتایج بر پایه داده‌های واقعی هستند و هیچ داده جعلی یا شبیه‌سازی‌شده‌ای وجود ندارد.

> [!TIP]
> **English:**
> **NetCheck** is an open-source, advanced network diagnostic tool powered by the public [Globalping API](https://globalping.io). It performs real-world network tests including Ping, TCP, UDP, DNS, and HTTP/HTTPS from actual probes located in Iran and worldwide. It is specifically designed to check service accessibility from within Iran and to detect filtering or network anomalies. All results are based on real measurements—no mock or simulated data.

---

## ✨ ویژگی‌های کلیدی (Features)

- 🇮🇷 **تمرکز بر سرور‌های ایران (Iran-First):** انتخاب هوشمندانه سرور‌های ایرانی برای تست دسترسی‌پذیری واقعی.
- 🚀 **تست‌های متنوع شبکه (Diverse Network Tests):** پشتیبانی از تست‌های Ping (ICMP)، TCP (Traceroute)، UDP، DNS (با قابلیت انتخاب Resolver) و HTTP/HTTPS.
- 🎨 **رابط کاربری مدرن (Modern UI):** طراحی واکنش‌گرا (Responsive)، راست‌چین (RTL) و پشتیبانی کامل از حالت تاریک/روشن (Dark/Light Mode).
- ⚡ **تخصیص پویای سرور‌ها (Dynamic Probe Allocation):** امکان انتخاب خودکار تمام سرور‌های یک کشور یا شهر با یک کلیک.
- 📊 **جزئیات دقیق متریک‌ها (Detailed Metrics):** نمایش دقیق تأخیر (Latency)، درصد از دست رفتن بسته‌ها (Packet Loss)، وضعیت TLS، هدرهای HTTP و تعداد گام‌های مسیر (Hops).
- 🔒 **امنیت بالا (High Security):** استفاده از توکن API برای افزایش Rate Limit و امنیت بیشتر در درخواست‌ها.

---

## 🛠️ تکنولوژی‌های استفاده شده (Tech Stack)

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **API:** [Globalping REST API](https://globalping.io/docs/api.globalping.io)
- **Deployment:** [Vercel](https://vercel.com/)

---

## 🚀 اجرای پروژه در محیط لوکال (Getting Started)

برای اجرای این پروژه روی سیستم خودتان، مراحل زیر را دنبال کنید:

**۱. کلون کردن مخزن (Clone the repository):**
```bash
git clone https://github.com/iamirama/amiro-GeoPing.git
cd amiro-GeoPing
```

**۲. نصب وابستگی‌ها (Install dependencies):**
*(ما از `bun` استفاده می‌کنیم، اما `npm` یا `yarn` هم کار می‌کنند)*
```bash
bun install
```

**۳. تنظیم متغیرهای محیطی (Environment Variables):**
یک فایل `.env.local` در ریشه پروژه بسازید و توکن Globalping خود را اضافه کنید:
```env
GLOBALPING_API_TOKEN=your_globalping_token_here
```

**۴. اجرای پروژه (Run the development server):**
```bash
bun run dev
```
حالا مرورگر خود را باز کرده و به آدرس `http://localhost:3000` بروید.

---

## 👨‍💻 توسعه‌دهنده (Developer)

<div align="center">
  <b>Amirhoseini</b><br />
  <i>Full-Stack Developer</i><br /><br />
  <a href="https://github.com/iamirama">GitHub Profile</a>
</div>

---

## 📄 لایسنس (License)

این پروژه تحت لایسنس **MIT** منتشر شده است. برای اطلاعات بیشتر فایل [LICENSE](LICENSE) را مشاهده کنید.

*Distributed under the MIT License. See `LICENSE` for more information.*
