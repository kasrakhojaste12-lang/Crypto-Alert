// Branded HTML emails (RTL, dark, emerald accent to match the app). sendEmail
// sends multipart: plain-text fallback + html. Table layout + inline styles for
// email-client compatibility; a text wordmark instead of an image so nothing
// depends on remote-image loading being enabled.

export function passwordResetEmail(link: string): { subject: string; text: string; html: string } {
  const subject = 'بازنشانی رمز عبور الرت کی · Alert Key password reset'

  const text =
    `برای تعیین رمز عبور جدید حساب الرت کی خود این لینک را باز کنید (اعتبار: ۳۰ دقیقه):\n${link}\n` +
    `اگر این درخواست از شما نبوده، این ایمیل را نادیده بگیرید.\n\n` +
    `Alert Key password reset — this link expires in 30 minutes:\n${link}`

  const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>بازنشانی رمز عبور</title>
</head>
<body style="margin:0;padding:0;background:#0b1120;font-family:Tahoma,Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0b1120;">لینک بازنشانی رمز عبور الرت کی — تا ۳۰ دقیقه معتبر است.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 32px 6px;text-align:center;">
<img src="https://alertkey.ir/logo-email.png" alt="الرت کی" width="113" height="72" style="width:113px;height:72px;display:inline-block;border:0;outline:none;text-decoration:none;">
<div style="color:#64748b;font-size:11px;letter-spacing:2px;margin-top:10px;">ALERT KEY</div>
</td></tr>
<tr><td style="padding:14px 32px 0;text-align:center;">
<h1 style="margin:0;color:#f1f5f9;font-size:20px;font-weight:bold;">بازنشانی رمز عبور</h1>
</td></tr>
<tr><td style="padding:14px 32px 4px;color:#94a3b8;font-size:14px;line-height:1.9;text-align:right;">
سلام،<br>
درخواست بازنشانی رمز عبور برای حساب شما ثبت شد. برای تعیین رمز جدید روی دکمهٔ زیر بزنید. این لینک تا <b style="color:#e2e8f0;">۳۰ دقیقه</b> معتبر است.
</td></tr>
<tr><td style="padding:20px 32px 6px;text-align:center;">
<a href="${link}" style="display:inline-block;background:#10b981;color:#04120c;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 36px;border-radius:12px;">تعیین رمز عبور جدید</a>
</td></tr>
<tr><td style="padding:10px 32px 4px;color:#64748b;font-size:12px;line-height:1.8;text-align:center;">
اگر دکمه کار نکرد، این نشانی را در مرورگر باز کنید:<br>
<a href="${link}" style="color:#34d399;word-break:break-all;direction:ltr;display:inline-block;">${link}</a>
</td></tr>
<tr><td style="padding:14px 32px;"><div style="height:1px;background:#1f2937;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
<tr><td style="padding:0 32px 26px;color:#64748b;font-size:12px;line-height:1.8;text-align:right;">
اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید؛ رمز عبور شما تغییری نمی‌کند.<br>
<span style="color:#475569;">If you didn't request this, you can safely ignore this email — your password won't change.</span>
</td></tr>
</table>
<div style="color:#475569;font-size:11px;margin-top:16px;">© الرت کی · <a href="https://alertkey.ir" style="color:#475569;text-decoration:none;">alertkey.ir</a></div>
</td></tr>
</table>
</body>
</html>`

  return { subject, text, html }
}
