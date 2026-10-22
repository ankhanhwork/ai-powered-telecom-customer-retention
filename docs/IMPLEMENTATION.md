# Triển khai và tiếp tục dự án

Cập nhật 22/10/2026. Giữ trạng thái hiện hành, không duy trì nhật ký các phiên cũ.

## Tiếp tục từ đây

**Đã hoàn tất dọn repo local:** giữ một bộ dữ liệu/model hiện hành, xóa sáu `.chart-data-*`, `evaluation_private`, bộ cũ và files tạm; bỏ suffix phiên bản khỏi đường dẫn. Code ML chia preprocess/train_finetune/predict/shap, generator ở `data/synthetic/generation/`, kết quả ở `data/output/`, scripts Supabase và workflows n8n có thư mục riêng. README/tài liệu nguồn đã rút gọn bằng tiếng Việt; ba PDF bản nộp đổi tên ngắn và được bỏ ignore để đưa vào lần commit kế tiếp. Model chọn chỉ giữ một bản champion, ba ứng viên khác là đối chiếu cùng lần train.

**Đã kiểm:** 44 ML tests; 72 DB checks (37 workspace +7 rolling +8 ticket +9 assignment +7 Dashboard +4 inline delivery); 35 UI tests; 9 n8n validators; production build; generator DEV Dashboard và label-free import 5 khách chạy local. Đối chiếu 101 file lúc di chuyển, kiểm lại hashes dữ liệu/model/inference/SHAP sau tests; inference 5.533 dòng khớp xác suất đã lưu. Setup dựng lại từ 21 migrations, giữ nguyên source migration; tests phản ánh contact gate đã bỏ và inline mock delivery. Các tests/CLI chạy từ cấu trúc mới; explicit `--explain --output` không ghi đè summary/approval canonical. Link Markdown đã kiểm không hỏng; không thấy secret theo mẫu quét và không có file chia sẻ trên 50 MB. Evidence: `evidence/repository_cleanup.json`.

**Giữ local có chủ đích:** CSV Kaggle, bảng synthetic/preprocess lớn, môi trường Python/Node; trong ignored `tmp/` chỉ giữ credentials, ticket replay guard và backup rollback vận hành đang cần. Đây không phải bản dataset/model lịch sử đưa lên GitHub.

**Phạm vi giữ nguyên:** LightGBM tuned 127 features, model/calibration/SHAP hash và các hàng dữ liệu/prediction. Không train/sinh lại full cohort, không gọi cloud/n8n/LLM, không reset/import hoặc thay Auth/consent, không commit/push/deploy trong bước dọn local.

**Điểm cần nhớ:** source UI có Dashboard Care performance/Period outcome và notifications mới; chưa xác minh browser sau đăng nhập/hosted release của thay đổi mới nhất. Assignment filters mở case từ pipeline, Team workload chỉ Agent. Tin mock hiện gửi trong DB lúc commit; gate contact đã bỏ theo migrations hiện hành. Notes chưa được đưa vào ticket AI context; referrals “trong ngày” chưa có cột thời điểm phù hợp. Không khôi phục mô tả cũ về các gate này.

**Việc kế tiếp:** review diff và bản nộp, commit/push khi người dùng yêu cầu; kiểm deployment thật/browser theo ngân sách demo. Hoàn thiện Kaggle URL/license và đối soát số tài chính trong PDF. Không chạy setup/seed/workflow để chứng minh việc di chuyển file.

**File cần đọc:** `README.md`, `SYSTEM.md`, `DATA_ML.md`, `../ml/README.md`, `../ml/config.json`, `evidence/repository_cleanup.json`, source/tests module sẽ sửa.

## Thứ tự và trạng thái

| Bước | Trạng thái hiện hành | Đầu ra / điều kiện còn lại |
|---|---|---|
| 1. Phạm vi và luồng nghiệp vụ | Đã chốt trong phạm vi demo | `PROBLEM.md`, `SYSTEM.md`, mockup brief |
| 2. Nguồn/dữ liệu | Có local và generator | Kaggle URL/license còn thiếu |
| 3. Schema/contract | Có migrations/RLS/RPC | Giữ nguyên migration đã áp dụng, regression local |
| 4. UI/mockup | Có source React/Vite | Agent/Supervisor/portal, Assignment, Dashboard; browser QA mới nhất còn thiếu |
| 5. Supabase/Auth/demo | Đã triển khai trước phiên này | Không chạy lại setup/replace/seed khi chỉ dọn repo |
| 6. Luồng xuyên suốt | Có bằng chứng tích hợp API/LLM/mock trước đây | Còn browser journey trọn vẹn cho release hiện hành |
| 7. ML/SHAP | Đã hoàn tất synthetic benchmark | 127 features, 30 trials/họ, selected LightGBM, 6 SHAP groups; không train lại |
| 8. UI/workflow mở rộng | Có source và integrations | Ticket, assignment, Dashboard/notifications; theo dõi kiểm sau đăng nhập |
| 9. QA/phát hành | 44 ML +72 DB +35 UI +9 n8n và build local đạt | Chưa full browser/mobile/keyboard/concurrency hoặc hosted release mới nhất |
| 10. Bản nộp/diễn tập | Có report/slide PDF | Nhóm review nội dung/financial, nguồn/license, link GitHub và diễn tập |

Không đánh dấu hoàn thành một bước bằng placeholder hoặc kế hoạch. Bằng chứng lịch sử chứng minh đúng phạm vi lúc kiểm; không coi như kiểm lại cloud hiện tại.

## Cổng kiểm tra

### Local

- ML: feature/schema, purge, grouped calibration, source-label exclusion, save/reload và native SHAP cho hai họ; prediction khớp artifact đã lưu.
- DB: fresh setup, RLS/quyền/ownership, immutable revisions, request idempotency, approval/portal, outcome/cost, ticket, assignment và Dashboard seed/rollback bằng fixtures synthetic.
- Web: unit tests, production build; không đổi Vercel root `website/app`.
- n8n: validators local; exports inactive và mọi schedule disabled.
- Repo: đường dẫn/import/link hợp lệ, không secrets, không artifacts lịch sử/placeholder dư, PDF và đầu ra chia sẻ được Git theo dõi.

### Demo/release còn lại

1. Đăng nhập Agent/Supervisor/portal trong các session riêng; kiểm đúng scope và không lộ notes/draft/score.
2. Request từng AI output, giữ editor chưa lưu khi polling, kiểm retry/error; không gọi lặp để thử credential.
3. Duyệt đúng revision → mock sent receipt → portal reply; không gửi trùng hoặc tự gửi AI output.
4. Ticket draft/edit/submit và support receipt; internal notes chưa là AI context.
5. Assignment preview/confirm/stale/quota/idempotency, notifications và Dashboard filters đúng scope.
6. Unknown không thành retained khi đóng case; known cần đủ kỳ/evidence.
7. Laptop/mobile/keyboard, loading/empty/error và một video journey trọn vẹn.
8. Đối soát report/slide: synthetic/mock/assumptions, financial units và nguồn; bản clone trên máy thứ hai.

Trước live n8n phải nêu cap executions; ngân sách tài khoản 1.000, không bật timer liên tục. Tác vụ monitor/polling live không thuộc lần dọn repo.

## Quy tắc bàn giao

Mỗi phiên có thay đổi cập nhật mục “Tiếp tục từ đây”: đã làm, đã kiểm, còn vướng, việc kế tiếp và file cần đọc. Không tạo PLAN.md hoặc file nhật ký theo chat. Không lưu secrets hoặc dữ liệu cá nhân trong bàn giao. UI và PDF hiện có giữ nguyên ngôn ngữ; tài liệu repo được viết tiếng Việt.
