# KelasKita

Portal kuis static untuk GitHub Pages. Tidak memakai Node. Firebase Web SDK dimuat dari CDN.

## Setup Firebase

1. Aktifkan **Authentication > Email/Password**.
2. Buat akun admin.
3. Buat dokumen `users/{UID_ADMIN}`:

```json
{"role":"admin","active":true}
```

4. Pasang isi `firestore.rules` di Firestore Rules.
5. Buat koleksi `quizzes` dan subkoleksi `quizzes/{quizId}/questions`.
6. Pastikan kuis siswa memiliki field boolean `published: true`. Draft dengan `published: false` hanya dapat dibaca admin.

Query beranda sudah memakai filter `where('published', '==', true)`. Filter ini wajib karena Firestore Rules bukan filter data otomatis.

Contoh dokumen kuis:

```json
{
  "title": "Matematika Dasar",
  "subject": "Matematika",
  "description": "Operasi bilangan",
  "targetClass": "IX A",
  "published": true,
  "showScore": true,
  "duration": 30,
  "totalQuestions": 1,
  "createdAt": "server timestamp"
}
```

Contoh dokumen soal:

```json
{
  "text": "Berapakah 2 + 2?",
  "type": "single",
  "options": [
    {"id":"a","text":"3","points":0,"isCorrect":false},
    {"id":"b","text":"4","points":10,"isCorrect":true}
  ]
}
```

## Deploy

Upload `index.html`, `css/`, `js/`, dan `firestore.rules` ke repository GitHub Pages. Config Firebase Web aman tampil di browser; service-account key dan password admin tidak boleh di-upload.

## Batasan tanpa backend

Firebase client + Firestore Rules cocok untuk portal static, tetapi tidak dapat memberi validasi server kompleks seperti transaction reservasi retake, hitung nilai rahasia, atau proteksi kunci jawaban. Untuk keamanan penuh, perlu Cloud Functions/Cloud Run. Jangan menaruh `FIREBASE_PRIVATE_KEY` di GitHub Pages.
