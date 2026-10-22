# Nội dung và bản nộp

Các PDF hiện có được giữ làm bản nộp duy nhất:

- [Executive report](../deliverables/executive-report.pdf)
- [Slide](../deliverables/slides.pdf)
- [Yêu cầu bài final](../deliverables/project-description.pdf)

Tài liệu làm việc viết tiếng Việt theo yêu cầu người dùng; không dịch lại UI hoặc các PDF đã xuất. Lần dọn repo chỉ đổi tên/nơi lưu, không sửa nội dung hoặc số liệu PDF.

## Nguồn để giải thích bài

| Nội dung | Nguồn |
|---|---|
| Bối cảnh FPT/Bình Dương, phản ánh nghiệp vụ | `PROBLEM.md`, thông tin nội bộ người dùng cung cấp |
| Quy trình demo, quyền, approval, mock transport | `SYSTEM.md`, SQL/source hiện hành |
| Dữ liệu synthetic, split, tuning, calibration, SHAP | `DATA_ML.md`, `../data/output/train_finetune/results/RESULTS.md` |
| Kết quả model và biểu đồ | `../data/output/train_finetune/results/` |
| Kiểm tra thực tế | `evidence/`, các bộ tests trong module |
| Deploy và tiếp tục dự án | `DEPLOYMENT.md`, `IMPLEMENTATION.md` |

## Các điểm cần trình bày rõ

- Giá trị chính là chuyển prediction thành công việc chăm sóc có người phụ trách và kiểm soát bởi nhân viên.
- Model demo LightGBM tuned, 127 features; validation AUC 0,9483, test exploratory AUC 0,9467. Không gọi đó là accuracy của FPT hoặc bằng chứng giữ chân thành công.
- Lịch prediction ngày 1/11/21; horizon một tháng lịch, nhãn Unknown khi chưa đủ kỳ. Đóng case không đồng nghĩa retained.
- SHAP là model attribution, không phải nguyên nhân churn đã xác nhận. Risk drivers cần được xác minh bằng hội thoại/nghiệp vụ.
- Zalo/support transport là mock. Gate contact hiện đã bỏ trong demo; không mô tả như hệ thống production có enforce consent/khung giờ.
- ROI, doanh thu giữ lại và lợi ích nhân sự là giả định kịch bản, không phải tác động đã đo. Giữ nguồn/công thức/đơn vị và không suy causal uplift từ score.

## Kiểm trước nộp và demo

1. Mở các PDF, kiểm tên thành viên, số liệu tài chính và claims so với nguồn gốc; việc dọn repo không thay bước đối soát này.
2. Xác nhận link GitHub hiển thị README/PDF/model/kết quả mong muốn sau khi commit/push; source local không tự xuất hiện trên GitHub.
3. Hoàn thiện Kaggle URL/license; chưa phân phối lại CSV gốc khi thiếu xác nhận.
4. Diễn tập bằng browser đúng role: case → Request AI → review → Send → portal reply → ticket/follow-up. Lên ngân sách n8n trước khi thực hiện.
5. Giữ riêng credentials; không ghi mật khẩu/token vào repo, ảnh hoặc video.

Chưa nghiệm thu browser E2E/mobile/keyboard/concurrency hoặc xác minh deployment sau lần dọn repo. Các kiểm tra local và giới hạn cập nhật trong `IMPLEMENTATION.md`.
