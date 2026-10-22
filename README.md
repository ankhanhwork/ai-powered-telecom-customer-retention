# AI-Powered Telecom Customer Retention

Đồ án Advanced Business Analytics: chuyển dự báo khách hàng có nguy cơ rời mạng thành quy trình chăm sóc có người phụ trách, AI hỗ trợ và nhân viên duyệt nội dung trước khi gửi.

Bối cảnh doanh nghiệp là FPT Telecom, địa bàn thí điểm đề xuất là Bình Dương. Dữ liệu ML là dữ liệu mô phỏng từ một nguồn public; các kênh gửi và bàn giao hỗ trợ trong demo dùng transport mock.

## Bản nộp

- [Báo cáo executive](deliverables/executive-report.pdf)
- [Slide thuyết trình](deliverables/slides.pdf)
- [Yêu cầu bài final](deliverables/project-description.pdf)

## Sản phẩm

- **Agent:** xem hàng chờ, trao đổi với khách, đọc risk drivers, yêu cầu AI soạn nội dung/call script/ticket, duyệt tin và ghi chú chăm sóc.
- **Supervisor:** Dashboard, phân công thủ công hoặc theo Round-robin/Weighted, xem tải công việc và các case cần chú ý.
- **Customer portal:** hội thoại mock theo đúng phạm vi khách hàng; không thấy điểm churn, SHAP, bản nháp hoặc ghi chú nội bộ.
- **ML:** 127 features, LightGBM/CatBoost, Optuna, calibration và SHAP theo 6 nhóm tín hiệu. Model được chọn là LightGBM tuned.

| Kết quả model được chọn | Giá trị |
|---|---:|
| Validation ROC AUC | 0,9483 |
| Test ROC AUC (exploratory) | 0,9467 |
| Số trials mỗi họ model | 30 |
| Latest batch: số khách / số alerts >500 | 2.705 / 207 |

Đây là benchmark synthetic, không phải độ chính xác thực tế tại FPT hoặc bằng chứng tác động giữ chân khách hàng. Quy trình và số liệu đầy đủ ở [Data/ML](docs/DATA_ML.md) và [kết quả](data/output/train_finetune/results/RESULTS.md).

## Cấu trúc

```text
data/
  original/                   CSV Kaggle gốc và data dictionary, lưu local
  synthetic/generation/       Code và config tạo dữ liệu
  synthetic/dataset/          Một bộ dữ liệu hiện hành, lưu local
  output/preprocess/          Features, labels và split, lưu local
  output/train_finetune/      Models, trials, metrics và biểu đồ
  output/predict/             Features inference và prediction
  output/shap/                SHAP và context chăm sóc
ml/
  preprocess/                 Tạo feature, tách tập và purge
  train_finetune/             Tune, fit, calibration và đánh giá
  predict/                    Nạp model và dự báo
  shap/                       Giải thích và xuất biểu đồ
  tests/                      Kiểm thử ML
website/app/                  React/Vite, giao diện demo
website/mockups/              Brief và mockup tham chiếu
supabase/                     Migrations, setup, scripts và tests
n8n/                          Workflow exports, FAQ và validators
docs/                         Phạm vi, kiến trúc, phương pháp và kiểm chứng
deliverables/                 Các PDF bản nộp
```

## Chạy website local

Yêu cầu Node.js 24. Từ thư mục repo:

```powershell
npm ci --prefix website/app
Copy-Item website/app/.env.example website/app/.env.local
# Điền publishable key cho demo backend vào .env.local.
npm run dev --prefix website/app
```

Tài khoản demo được cung cấp riêng. Biến frontend chỉ chứa URL và publishable key; không đưa secret/service-role key hoặc mật khẩu vào Git. Web cần backend Supabase và các webhook AI được cấu hình; clone repo không tự tạo các dịch vụ cloud. [Hướng dẫn deploy](docs/DEPLOYMENT.md).

## Chạy ML và kiểm tra

Yêu cầu Python 3.13; tạo môi trường và cài `ml/requirements.txt`. Chạy từ root repo:

```powershell
python -m ml.predict.predict --output tmp/predictions.csv
python -m unittest discover -s ml/tests -v
npm ci --prefix supabase/tests
npm test --prefix supabase/tests
npm test --prefix website/app
npm run build --prefix website/app
node --test n8n/tests/validator.test.mjs n8n/tests/ticket-validator.test.mjs
```

Model, features inference và kết quả hiện hành được chia sẻ trong repo. Dữ liệu Kaggle gốc và các bảng synthetic/preprocess lớn được giữ local; [ML README](ml/README.md) mô tả cách tạo khi cần. Audit generator không được đưa vào model hoặc AI context. Chưa xác nhận URL/license Kaggle nên không phân phối lại CSV nguồn.

## Tài liệu

- [Bài toán và bối cảnh](docs/PROBLEM.md)
- [Thiết kế và contract hệ thống](docs/SYSTEM.md)
- [Dữ liệu và phương pháp ML](docs/DATA_ML.md)
- [Nội dung và giới hạn bản nộp](docs/REPORT.md)
- [n8n và quota demo](n8n/README.md)
- [Tiến độ, kiểm tra và tiếp tục dự án](docs/IMPLEMENTATION.md)

Tài liệu làm việc bằng tiếng Việt; giao diện và nội dung demo hiện có giữ nguyên tiếng Anh. Repo chỉ duy trì bộ hiện hành, không lưu thêm bản cũ trong thư mục làm việc. Các định danh đã liên kết với database và migrations đã áp dụng được giữ nguyên để tương thích.
