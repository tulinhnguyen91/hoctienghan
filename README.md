# Học tiếng Hàn mỗi ngày

Sổ học tiếng Hàn theo từng ngày: từ vựng có câu ví dụ, flashcard, ngữ pháp và nhiều dạng bài tập (trắc nghiệm, nghe, viết, ghép cặp, điền, sắp xếp câu, dịch Việt ↔ Hàn, đặt câu).

Mở web: https://tulinhnguyen91.github.io/hoctienghan/

## Cách học mỗi ngày
1. Mở bài mới nhất, đọc **Từ vựng** và lướt **Flashcard**.
2. Vào **Luyện từ** làm vài dạng bài, rồi **Ngữ pháp** và **Đặt câu**.
3. Vào **Nộp bài**, bấm **Copy kết quả** và dán vào chat với Claude để được chấm.

Tiến độ và từ hay sai được lưu ngay trên trình duyệt của máy đang dùng.

## Thêm bài mới
- Tạo `data/bai-N.json` (cùng cấu trúc với các bài có sẵn): `words` là danh sách `[tiếng Hàn, phiên âm, nghĩa, câu ví dụ, nghĩa câu ví dụ]`, `patterns` là các mẫu ngữ pháp, `exercises` là bài tập (`choice`, `fill`, `order`, `translate`, `vi`).
- Thêm một dòng vào `data/index.json`.
