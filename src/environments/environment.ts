export const environment = {
  supabase: {
    url: 'https://ymbijtwxnfxqeyjlvwxe.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYmlqdHd4bmZ4cWV5amx2d3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNDY1MDEsImV4cCI6MjEwMTgyMjUwMX0.1yHxv0FpaN4lFc35m7zU5nFZEmdosUKzJqKPFyXqEDo',
  },
  /**
   * OCR اختياري: إن تُرك cloudEndpoint فارغاً (الوضع الافتراضي) يُستخدم دائماً محرّك OCR
   * المحلي (Tesseract.js، محمَّل عند الحاجة فقط). لو رغبت لاحقاً في محرّك سحابي أدق مع
   * الخط اليدوي، ضع رابط endpoint يقبل POST { image: base64 } ويرجع { text: string } —
   * سيُستخدم تلقائياً فقط عندما يكون الجهاز متصلاً بالإنترنت، مع سقوط تلقائي للمحلي عند
   * أي فشل (لا مفتاح API ولا سرّ يُكتب هنا مباشرة — استخدم متغيّر بيئة عبر عملية البناء).
   */
  ocr: {
    cloudEndpoint: '',
  },
};
