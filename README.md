# AI-Powered Telecom Customer Retention

**Case Assignment đã nối Supabase 21/10:** Supervisor dùng **Assign cases** → Manual/Round-robin/Weighted → Preview/Confirm; server kiểm quota, chống Confirm trùng, ghi audit và thông báo gộp. Hai migrations assignment đã áp cloud; UI chạy tại `http://127.0.0.1:5175/` với đăng nhập thật, không còn chỉ là simulation. 9 assignment DB +38 workspace +8 ticket +7 rolling +2 restore checks, Dashboard seed regression, 28 UI tests và build đạt; Confirm cloud được kiểm trong rollback. Không để lại phân công thử, không n8n/outbound. Source chưa push/deploy Vercel; xem `docs/evidence/case_assignment.json` và mục Tiếp tục từ đây.

**Chat-to-Ticket đã deploy 21/10:** tab Support ticket nằm giữa Call script và Internal notes; AI đọc chat đã trao đổi, lưu ticket nháp có dẫn chứng, staff chỉnh sửa và tự submit. Supabase migration và worker n8n webhook-only đã hoạt động; test live 1 execution, ticket vẫn Draft, không gửi. 73 checks/build đạt; Vercel commit `8aec764` và proxy đã kiểm. Bàn giao support mock vẫn cần operator chạy worker thủ công; chưa browser click E2E. Chi tiết trong Implementation/System và `docs/evidence/chat_to_ticket.json`.

**Phạm vi ML mới đã chốt 19/10/2026:** prediction ngày **1/11/21**, snapshot **cuối tháng/10/20**, dự báo **một tháng lịch trượt**. Đã tạo v5 và tune xong LightGBM/CatBoost trên cùng **127 features**; `ml/config.json` trỏ các thư mục `final/rolling_month_v5/`. Chọn **LightGBM tuned**, validation AUC **0,9483**, test exploratory AUC **0,9467**; đạt mốc khoảng 0,89. 43 ML tests + artifact checks đạt. Xem [ML hiện hành](ml/README.md) và [Data/ML](docs/DATA_ML.md). **Supabase/SHAP đã chuyển v5; UI source đã sửa/build local, chưa deploy Vercel**; các số liệu và evidence 17–18/10 dưới đây là lịch sử, chưa phải kết quả/tích hợp v5.

**SHAP và Supabase đã hoàn tất 19/10/2026:** native LightGBM SHAP cho 5.533 snapshots, giữ nguyên model/xác suất; 127 features/6 nhóm, signed sums và Platt a=1,2400316422/b=0,3482248508. Raw additivity error 7,41e-15, probability error 2,11e-15. Supabase đã thay v4 bằng latest batch 11/10: **2.705 khách/predictions/contexts, 207 cases >500**, kỳ [11/10,11/11), outcome Unknown. Xóa v4 khỏi bảng vận hành; backup 25 bảng ở `app_private.v4_demo_backup`, không có quyền browser/worker; `supabase/restore_demo_v4.sql` đã kiểm round-trip local. Giữ Auth 3 users/staff 2; portal remap vào case mới, consent/opt-out được giữ theo customer_ref khi khớp. Không tự cấp consent mới hoặc gửi tin.

**Biểu đồ English cho slide:** `docs/evidence/ml/rolling_month_v5/figures/slides/` có 7 biểu đồ × PNG/SVG, `README.md` hướng dẫn dùng và `chart_data.json` lưu số liệu/hashes. Dùng latest 2.705 khách một lần/người cho SHAP global; test ROC/PR là 1.485 dòng/758 khách với cửa sổ chồng nhau. SHAP là model risk drivers, không phải nguyên nhân xác nhận, không phải % xác suất.

Hệ thống phối hợp liên phòng ban để chuyển cảnh báo churn thành hành động giữ chân khách hàng Internet của FPT Telecom. Bài toán xuất phát từ toàn quốc; Bình Dương là case điển hình và địa bàn thí điểm trước khi xem xét mở rộng. Model doanh nghiệp đã có; ML trên public data phục vụ nguồn prediction demo khi chưa tiếp cận model nội bộ.

**Cập nhật 17/10/2026:** đã so sánh baseline/tuned LightGBM và CatBoost trên **cùng 127 features**, 30 Optuna trials/model. Leader đã duyệt `catboost_tuned`; validation AP 0,6640, test September AUC 0,9843 chỉ exploratory. October 260/3202 khách >500, nhãn Unknown. Đọc [luồng ML](ml/README.md) và [kết quả](docs/evidence/ml/RESULTS.md). Dataset/model dùng đường dẫn `final`; **không dùng bộ 22**. 6 nhóm đã duyệt; SHAP 127 biến và English care drafts đã xuất cho batch October. Chạy `ml/predict.py --explain`; đọc DATA_ML/ml/README trước tích hợp. Kết quả synthetic không phải độ chính xác FPT; đã có app local/Supabase/n8n demo, xem trạng thái 18/10 bên dưới.

**Ngôn ngữ đã chốt theo yêu cầu giảng viên:** sản phẩm và bản nộp (report/executive summary, slide và nội dung demo) bằng **tiếng Anh**. UI, AI diễn giải, tin nhắn/call script mẫu và thông báo hệ thống cũng dùng tiếng Anh. Tài liệu làm việc trong repo vẫn được phép viết **tiếng Việt**; bản thảo tiếng Việt chưa phải bản nộp cuối. Mockup chuẩn hiện hành là bộ English trong `website/mockups/`.

**n8n cutover 19/10:** ba webhook AI đã publish trên `group-2-new`; app local, proxy config Vercel và smoke script đã đổi host mới. Test đúng 5 executions: ba AI artifacts completed, delivery thành công nhánh queue rỗng, follow-up/support tạo 1 reminder + 1 mock receipt. Không có case hiện hành có sẵn Zalo consent phù hợp để kiểm nhánh gửi; không đổi consent. Mọi timer vẫn tắt; delivery/support/reminder cần operator chạy thủ công. Source chưa push/redeploy Vercel, domain hosted chưa được kiểm. Xem [n8n README](n8n/README.md) và [evidence cutover](docs/evidence/n8n_cutover.json).

## Tài liệu cần đọc

| File | Nội dung |
|---|---|
| [Bắt đầu / tiếp tục triển khai](docs/IMPLEMENTATION.md) | 10 bước chi tiết, tiến độ thực tế, tiêu chí hoàn thành và bàn giao cho chat sau |
| [Problem](docs/PROBLEM.md) | Bối cảnh nội bộ, số liệu, hiện trạng model, insights và giả định |
| [Hệ thống](docs/SYSTEM.md) | Phạm vi, kiến trúc, chat/database, quyền, API và events |
| [Dữ liệu & ML](docs/DATA_ML.md) | Kaggle, split, inference, synthetic, pipeline và artifacts |
| [Báo cáo](docs/REPORT.md) | Yêu cầu môn học, PDMT, business case, executive summary, pitch/demo và nguồn |
| [Brief mockup](website/mockups/BRIEF.md) | Màn hình, luồng, trạng thái và review thiết kế |
| [n8n](n8n/README.md) | 5 worker thực thi và 7 trách nhiệm logic |
| [Deploy Vercel](docs/DEPLOYMENT.md) | Import GitHub, Root Directory, env và kiểm tra domain thật |

## Cấu trúc làm việc

```text
docs/               Problem, System, Data/ML, Report và Implementation
website/
  mockups/          Brief + 3 ảnh mockup + logo FPT Telecom
  app/              Code web sau khi duyệt mockup
ml/                 Pipeline 127 features, generation/, tests/, config và models/final/
supabase/           SQL migrations khi bắt đầu triển khai
n8n/                README + workflow exports khi có
data/               Raw, processed, inference, nhãn đối chiếu, synthetic, samples
deliverables/       Word, PowerPoint, PDF và gói nộp cuối
```

Evidence và test code chỉ tạo thư mục khi có nội dung thực. Giữ bản thảo trong Markdown; không tạo thêm README hoặc file placeholder cho từng hạng mục nhỏ. Không triển khai module mới trong lần tinh gọn này.

## Trạng thái chốt bước 1

Leader đã duyệt phạm vi và English mockup baseline. Demo batch 01/10/2026 dự báo cùng tháng 10; số liệu tháng 9 giữ làm bối cảnh. Hai vai trò Agent/Supervisor; nhân viên duyệt mọi outbound AI. Kênh hiển thị Zalo/selector nhưng toàn bộ chạy chatbot mô phỏng. Bổ sung chuông thông báo góc trên phải; nhắc theo delay cấu hình, AI đề xuất default 3 giờ (chưa khóa). Case đóng khác với outcome giữ chân. Chi tiết trong [System](docs/SYSTEM.md) và [bàn giao bước 2](docs/IMPLEMENTATION.md).

Bước 1 đã hoàn thành. Dataset v4/127, CatBoost tuned và 6 nhóm đã chốt; train/valid/test/predict/SHAP đã chạy. Cập nhật 18/10: Supabase có bản cài đặt đầy đủ 25 bảng/32 RPC và 39 database checks local. Đọc `supabase/setup.sql` và mục Contract Supabase đầy đủ trong System; cloud đã áp 14 migrations và import 3.202 khách/260 cases, RLS đã kiểm tra. Auth/mapping và hosted login đã kiểm. Đã kiểm real LLM → staff approval → mock portal → customer reply; 5 workflow active (3 AI Agent riêng) và JSON lưu trong n8n/. Bước tiếp theo: diễn tập web, hoàn thiện cost/chart/catalog rồi chia module. Có web local đầu tiên ở website/app (npm ci, npm run dev); đã có Kanban/care tabs; đã nối worker n8n; xem n8n/README.md và docs/evidence/n8n_workflows.json. Còn URL/license nguồn.

## Luồng sản phẩm

Prediction hiện có → case có người phụ trách → tổng hợp context/đề xuất → nhân viên duyệt → gửi/nhận → phối hợp kỹ thuật/retention và follow-up → outcome và phản hồi cho phân tích.

Đề xuất stack: Supabase/PostgreSQL, n8n + LLM, React/Vite/TypeScript; Python cho dữ liệu và prediction demo. Frontend không giữ server secrets; approval và quyền truy cập cần kiểm tra phía server/database.

## Cách làm việc

1. Khi bắt đầu chat mới, đọc [hướng dẫn triển khai](docs/IMPLEMENTATION.md), nhất là mục Tiếp tục từ đây, rồi đối chiếu Problem và System trước khi sửa. [AGENTS.md](AGENTS.md) ghi quy tắc tiếp nối cho AI trong repo. Không duy trì PLAN.md theo yêu cầu của leader.
2. Cập nhật tài liệu nguồn cùng code; chỉ đồng bộ những phần bị ảnh hưởng. Không tạo một file mới cho mỗi thay đổi.
3. Giữ thông tin nội bộ, dữ liệu observed, synthetic, simulated và giả định tách rõ; không điền metric chưa đo.
4. Mỗi task có đầu vào, đầu ra, tiêu chí nghiệm thu và người review. Chốt mockup/contract trước, dựng một luồng xuyên suốt rồi mở rộng.
5. Kết quả thật sau này lưu docs/evidence/ có run metadata; test tự động nằm cạnh module hoặc trong tests/ khi triển khai. Điều kiện nghiệm thu nằm trong System và brief mockup.
6. Secrets, raw/processed data, nhãn test và artifacts để ngoài Git mặc định. Dataset public chỉ phân phối lại sau khi kiểm tra license; mẫu chia sẻ phải an toàn.
7. Nội dung nộp lấy từ Report + Problem và evidence; tạo Word/PPT/PDF vào deliverables/ khi đã review. Chưa có automation nền cập nhật tài liệu.
8. Sau mỗi phiên có thay đổi, cập nhật trạng thái và mục Tiếp tục từ đây trong Implementation: đầu ra, kiểm tra, vướng mắc và việc kế tiếp. Không đánh dấu hoàn thành bằng kế hoạch hoặc placeholder.

Nội dung cũ trước khi gộp có bản sao ZIP local trong tmp/structure-before-simplify-*.zip. tmp/ được ignore trong Git; không phải bộ tài liệu làm việc thứ hai.

Request AI dùng webhook ngay; Queue/Details/Portal tự cập nhật mỗi 3 giây. Customer demo chọn thêm khách Outreach đã nhận tin. Google Sheets FAQ đã nối; dataset: n8n/faq-dataset.csv, link trong n8n/README.md. Request có spinner/tick và chống gọi trùng; drafts chia Used/Unused.

**Rà soát sẵn sàng và giao việc 18/10:** dự án ở bước 8–9; ML/SHAP và luồng demo lõi đã hoàn thành trong phạm vi synthetic/mock. Chạy lại đạt 39 DB + 7 UI + 5 workflow checks và web build. Đủ nền để nhóm hoàn thiện/diễn tập, chưa tổng nghiệm thu browser hoặc sẵn sàng production. [IMPLEMENTATION mục 4](docs/IMPLEMENTATION.md#4-phân-công-và-phối-hợp-trong-nhóm-7-người) có đánh giá, 6 gói việc cho thành viên ngoài leader, phạm vi file, tiêu chí nhận bàn giao và 12 kịch bản QA; chưa gán tên/deadline. Bộ nộp English chưa xuất; nguồn/license còn thiếu. Evidence: [project_readiness.json](docs/evidence/project_readiness.json).
