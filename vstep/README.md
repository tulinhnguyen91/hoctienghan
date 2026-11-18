# Học VSTEP B2 mỗi ngày 🐷

Sổ học VSTEP B2 theo từng ngày, tông xanh dương và có heo con làm linh vật. Mỗi bài gồm từ vựng có phiên âm và câu ví dụ, flashcard, 8 dạng luyện từ, ngữ pháp, bài tập kèm đọc hiểu kiểu đề VSTEP, 1 đề Viết (Task 1 hoặc Task 2) có đồng hồ và đếm từ, 1 đề Nói (Part 1/2/3) có ghi lại lời nói.

Mở web: https://tulinhnguyen91.github.io/hoctienghan/vstep/

## Cách học mỗi ngày
1. Mở bài của hôm nay, đọc **Từ vựng** và lướt **Flashcard**.
2. Vào **Luyện từ**, rồi **Ngữ pháp** (có bài đọc hiểu), **Viết** và **Nói**.
3. Vào **Nộp bài**, bấm **Copy kết quả** và dán vào chat với Claude để được chấm (bài viết và bài nói được chấm theo tiêu chí VSTEP).

Tiến độ được lưu trên trình duyệt của máy đang dùng, dưới khóa `vs.*`, nên không đụng đến web tiếng Hàn.

## Dữ liệu
- `data/plan.json`: lộ trình 30 ngày (19/11–18/12/2026), mỗi ngày có chủ đề, 3 mẫu ngữ pháp và trọng tâm kỹ năng. Các ngày 7, 14, 21 và 30 là ngày ôn tập.
- `data/bai-N.json`: một bài học.
  - `words`: `[từ tiếng Anh, "/IPA/ · loại từ", nghĩa, câu ví dụ, nghĩa câu ví dụ]`
  - `patterns`: mẫu ngữ pháp
  - `exercises`: bài tập, gồm các dạng `choice`, `fill`, `order`, `translate`, `vi`, `read`
  - `writing`, `speaking`: đề Viết và đề Nói
  - `corner`: góc học mỗi ngày (câu nói, phát âm, cụm từ, lỗi hay gặp, mẹo thi, đề nhật ký)
- `data/index.json`: danh sách các bài đã có.
- Kiểm tra dữ liệu: `python3 vstep/tools/check.py vstep/data`
