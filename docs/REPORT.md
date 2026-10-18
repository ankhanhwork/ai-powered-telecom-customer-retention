# Bản thảo báo cáo và bài nộp

**Ngôn ngữ đầu ra đã chốt — 17/10/2026:** theo yêu cầu mới của giảng viên được người dùng cung cấp, report/executive summary, pitch deck và các đầu ra trình bày/nộp bài phải bằng **tiếng Anh**. Nội dung làm việc trong file này và các docs khác được giữ tiếng Việt. Khi hoàn thiện phải biên tập bản tiếng Anh trước khi xuất Word/PPT/PDF; tiêu đề, bảng, biểu đồ, captions và screenshot sản phẩm trong bản nộp cũng dùng tiếng Anh. Không gọi bản thảo tiếng Việt hiện tại là bản final đã sẵn sàng nộp. Đây là yêu cầu bổ sung từ giảng viên, không phải điều khoản đọc được từ PDF đề gốc.

Cập nhật: 18/10/2026. Trạng thái: draft; đã có app và evidence tích hợp, chưa có bộ nộp cuối. Phân công và tiêu chí nghiệm thu hiện hành ở mục 4 của IMPLEMENTATION.md.

Một bản thảo chung gồm yêu cầu môn học, PDMT, business case, executive summary, pitch, demo và nguồn. Problem nội bộ nằm riêng ở [PROBLEM.md](PROBLEM.md). Đã có kết quả thực nghiệm synthetic v3/v4 và code tái lập; chưa có kiểm định FPT hoặc file nộp cuối.

---

## Đối chiếu yêu cầu bài final

Nguồn: đề `Final Project Description (2).pdf`, 2 trang, đã đọc toàn bộ. Xem [nguồn](REPORT.md). Đây là mapping đầu ra; không phải thang điểm chính thức.

| Phần đề | Đầu ra yêu cầu | Vị trí bản thảo / bằng chứng | Trạng thái |
|---|---|---|---|
| Problem | Strategic problem statement, high-level PDMT map, expected business value | PROBLEM.md, REPORT.md | Đã chốt bối cảnh FPT toàn quốc/pilot Bình Dương từ thông tin nội bộ; cần biên tập English và ghi mức thẩm quyền nguồn |
| Data | Architecture/schema, sources/features, example extract hoặc simulated sample | SYSTEM.md, DATA_ML.md; evidence/ | Đã chốt v4/127 features, dictionary và QA; xem DATA_ML/evidence/ml |
| Method | Analytical design, prototype/mock results, partial implementation khuyến nghị, evaluation plan | SYSTEM.md, DATA_ML.md; evidence/ | Đã có model/SHAP/metrics synthetic và luồng app→n8n→approval→mock portal→reply; chưa đo tác động can thiệp thực |
| Tools | Lựa chọn và lý do, workflow, scalability/collaboration/usability | SYSTEM.md, REPORT.md | React local + Supabase + 5 n8n workers đã triển khai demo theo evidence; usability/concurrency chưa tổng nghiệm thu |
| Communication & Strategy | Consulting-style pitch: framing, PDMT, expected ROI/advantage, roadmap | REPORT.md | Có khung |
| Bản nộp | Slide presentation; executive summary nhiều trang; data + codes | deliverables/ và repo | Chưa tạo file nộp |

Đề cho phép partial/public data và conceptual/partial analytical solution; không buộc xây production app đầy đủ. Nhóm chủ động làm MVP end-to-end để chứng minh tính khả thi, đồng thời vẫn phải giải thích quyết định kinh doanh và giá trị liên phòng ban.

Không có quy định số slide, số trang cụ thể, mô hình bắt buộc, điểm số từng mục hoặc hạn nộp trong file này; cần lấy bổ sung từ giảng viên nếu có.

### Checklist trước nộp

- [ ] Business problem gắn quyết định và stakeholder, không chỉ mô tả model/chatbot.
- [ ] PDMT map chỉ ra liên kết vấn đề - dữ liệu - phương pháp - công cụ.
- [ ] Nguồn/license và dữ liệu observed/synthetic/simulated được công bố rõ.
- [ ] Có schema/diagram, example extract và data dictionary phù hợp dataset thực tế.
- [ ] Có lập luận chọn method, baseline và evaluation plan/kết quả đúng phạm vi.
- [ ] Tool choices, quy trình, tính cộng tác và usability cho quản lý không kỹ thuật rõ ràng.
- [ ] Business case có giả định, chi phí, sensitivity; không gọi simulation là ROI đo được.
- [ ] Pitch deck, executive summary và data/code tái lập đủ, cùng một phiên bản nội dung.

---

## PDMT làm việc v0.1

### Strategic problem statement

Theo thông tin nội bộ do người thực hiện dự án cung cấp, số khách hàng Internet rời mạng của FPT Telecom toàn quốc lũy kế năm 2026 tăng 20% so với cùng kỳ 2025. Mô hình dự báo mới được áp dụng vài tháng gần đây và gửi danh sách điểm >500 cho DVKH đầu tháng, nhưng vẫn tồn tại khoảng cách giữa kết quả dự báo và hành động chăm sóc. Trong cuộc họp gần đây, Giám đốc DVKH Bình Dương nêu phản ánh của nhân viên về khó chọn cách tiếp cận, tiếp cận muộn và đã tiếp cận vẫn chưa giữ được khách. Bình Dương, địa bàn có mức gia tăng tỷ lệ rời mạng cao nhất theo thông tin được cung cấp, được chọn làm case điển hình và nơi thí điểm. Tháng 9 có 2.500 churn trên khoảng 210.000 khách đầu tháng; các số địa phương không đại diện cho quy mô toàn quốc.

Bài toán là thiết kế hệ thống phối hợp Data Analytics, DVKH, kỹ thuật, Retention/Kinh doanh và Tài chính để chuyển cảnh báo thành hành động có người phụ trách, phê duyệt, theo dõi và đo outcome. Model hiện có là đầu vào; model public-data trong demo là thành phần thay thế nguồn prediction khi cần. Chi tiết nguồn thông tin, phép tính và giả định tại [Problem nội bộ](PROBLEM.md); không coi toàn bộ nội dung là dữ liệu vận hành đã được kiểm chứng.

| Quyết định | Problem | Data | Method | Tools | Kết quả cần đo |
|---|---|---|---|---|---|
| Chăm sóc ai trước? | Cần phân bổ năng lực cho danh sách rủi ro; chưa đủ số liệu kết luận quá tải | Prediction hiện có, thời gian chờ, eligibility, capacity K | Ưu tiên hàng chờ; đánh giá ranking khi có nhãn | Prediction adapter + dashboard; Python cho demo khi cần | Thời gian tiếp cận, backlog, Recall@K/Precision@K khi đo được |
| Nên làm gì? | Ưu đãi đại trà có thể lãng phí | Model drivers, ticket, eligibility, offers/cost | Rule-based action selection + LLM draft + human review | Supabase + n8n + CS UI | Tỷ lệ đề xuất được chấp thuận/sửa, chi phí |
| Khi nào chuyển kỹ thuật? | Giảm giá không giải quyết sự cố | Ticket trạng thái và customer reply | Workflow routing theo rule | n8n + case tracking | Thời gian xử lý, task đúng bộ phận |
| Có tạo giá trị? | Chưa biết lợi ích tăng thêm | Outcome, cost, cohort và intervention log | Scenario analysis; pilot ngẫu nhiên khi đủ điều kiện | SQL/reporting + experiment plan | Incremental retention và contribution margin |

### Stakeholder và giá trị kỳ vọng

Data Analytics cung cấp điểm rủi ro có version và giải thích. CS nhận một hàng chờ có ngữ cảnh. Technical Support nhận ticket đúng vấn đề. Retention/Marketing quản lý offer và eligibility. Finance đánh giá chi phí/lợi nhuận. Management nhìn thấy throughput và kết quả theo cohort.

Lợi ích giả định: giảm thời gian đọc hồ sơ, tập trung năng lực chăm sóc, giảm ưu đãi không phù hợp, cải thiện khả năng audit. Những lợi ích này phải đo trong pilot; chưa có tỷ lệ cải thiện hoặc số tiền được chứng minh.

### Lý do chọn công cụ

Python giúp tái lập và so sánh baseline. Supabase/PostgreSQL phù hợp dữ liệu quan hệ và state có transaction. n8n làm workflow dễ giải thích với nhóm, nhưng vẫn cần retry/idempotency. LLM soạn draft theo context, không thay model churn hoặc người phê duyệt. Web UI giúp người không kỹ thuật xem lý do và hành động; cần kiểm chứng usability qua mockup/demo. Tool stack là phương tiện cho quyết định, không phải giá trị kinh doanh tự thân.

---

## Business case và kế hoạch đo giá trị

Đã có quy mô sơ bộ do người thực hiện dự án cung cấp: khoảng 210.000 khách Internet đầu tháng 9, 2.500 churn tháng 9 và 1.300 tháng 8 tại FPT Telecom Bình Dương. Với giá tham chiếu 205.000 đồng/tháng, nhóm churn tháng 9 tương ứng 512,5 triệu đồng doanh thu thuê bao/tháng và 6,15 tỷ đồng quy đổi 12 tháng. Đây là quy mô doanh thu liên quan, chưa phải lợi nhuận, thiệt hại đã ghi nhận hoặc khoản tiền hệ thống chắc chắn giữ lại. Xem [Problem nội bộ](PROBLEM.md) để phân biệt nguồn và giả định; chưa có dữ liệu đủ tính ROI hoặc tác động tăng thêm.

### Đo lường theo ba lớp

1. Chất lượng dự đoán: PR-AUC, Recall@K/Precision@K và calibration trên holdout.
2. Vận hành: thời gian review/case; case xử lý/nhân viên; approval/edit rate; gửi thành công trên attempted sends; response trên delivered messages nếu kênh có delivery receipts (nếu không, ghi mẫu số sent); cost/case.
3. Kinh doanh: churn theo cohort đủ cửa sổ quan sát; incremental retention bằng đối chứng; contribution margin sau chi phí can thiệp.

Không dùng response hoặc offer acceptance để thay outcome churn. Không so sánh churn của nhóm được chọn vì rủi ro cao với toàn bộ nhóm còn lại rồi gọi đó là causal effect.

### Công thức theo kịch bản

Trên cùng horizon H:

`Lợi ích ròng = N * delta_retention * contribution_margin_H - intervention_cost_total - operating_cost_H`

`ROI = Lợi ích ròng / (intervention_cost_total + operating_cost_H)` nếu mẫu số > 0.

N là số khách eligible được phân bổ vào treatment; delta_retention là chênh lệch retained rate tăng thêm so với control tương đương. Nếu chưa có thí nghiệm thì delta là giả định, không được lấy churn probability làm hiệu quả can thiệp. Contribution margin_H phải là biên lợi nhuận trong horizon, không phải tổng doanh thu hoặc CLV vô hạn.

| Biến | Nguồn cần có | Trạng thái |
|---|---|---|
| N, capacity K và tần suất scoring | Quy mô, năng lực CS | 60 người × 15 khách/ngày; danh sách >500 bàn giao đầu tháng; N và capacity giữ chân thực tế chưa rõ. Kịch bản phân bổ năng lực nằm trong Problem nội bộ |
| Baseline churn trong H | Dữ liệu có timestamp/outcome | Tháng 9 khoảng 1,19% trên mẫu số xấp xỉ; chưa phải counterfactual cho pilot |
| Delta retention low/base/high | Giả định nhạy cảm hoặc pilot | TBD |
| Contribution margin_H | Finance, cùng currency và horizon | TBD |
| Chi phí offer thực dùng | Redemption + actual cost, tránh đếm double | TBD |
| Chi phí CS, LLM, hạ tầng, kênh | Thời gian thực tế và đơn giá có nguồn | TBD |

Giữ horizon, cohort và currency thống nhất. Báo kịch bản thấp/cơ sở/cao và break-even; không chọn một con số lạc quan duy nhất.

### Pilot có đối chứng trong tương lai

Chọn cohort eligible trước khi phân nhóm; random treatment/control theo customer để tránh một khách nhận cả hai chính sách. Treatment là workflow mới, control là quy trình hiện hành được mô tả rõ. Khóa primary metric, horizon, sample size/power theo baseline/MDE trước thử nghiệm; phân tích theo nhóm phân bổ (intent-to-treat), kiểm tra contamination, attrition và chi phí.

Guardrails: opt-out/khiếu nại, lỗi gửi, khách nhận ưu đãi sai, quá tải CS, chi phí và chất lượng phục vụ. Không kết luận causal impact từ demo synthetic hoặc một số khách nhận ưu đãi và không churn.

---

## Executive summary - bản thảo nội dung

Trạng thái: draft, chưa phải bản nộp nhiều trang. Sẽ mở rộng bằng evidence thực sau khi triển khai; không xuất Word trước khi nội dung được review.

### Bối cảnh và đề xuất

Theo thông tin nội bộ được cung cấp, số khách hàng Internet rời mạng của FPT Telecom trên toàn quốc lũy kế năm 2026 tăng 20% so với cùng kỳ 2025. Doanh nghiệp đã áp dụng mô hình dự báo trong những tháng gần đây, nhưng còn khoảng cách giữa cảnh báo và việc lựa chọn, thực hiện, theo dõi hành động chăm sóc. Dự án đề xuất hệ thống phối hợp liên phòng ban, với ứng dụng nghiệp vụ dành cho DVKH và các đầu kết nối dữ liệu/bàn giao với bộ phận liên quan. Bình Dương được chọn làm case điển hình và địa bàn thí điểm do mức gia tăng tỷ lệ rời mạng cao nhất trong hệ thống theo thông tin nội bộ. Tháng 9 địa bàn có 2.500 churn, tương đương khoảng 1,19% trên 210.000 khách đầu tháng; với giá tham chiếu, doanh thu thuê bao liên quan là 512,5 triệu đồng/tháng. Pilot đánh giá tính khả thi và kết quả trước khi xem xét mở rộng. Xem [Problem nội bộ](PROBLEM.md) cho nguồn, giới hạn và giả định.

### Quyết định được cải thiện

Ưu tiên khách theo giới hạn năng lực, lựa chọn hành động phù hợp thay vì ưu đãi đại trà, chuyển yêu cầu kỹ thuật đúng nơi và theo dõi chi phí/kết quả. Churn score là một tín hiệu quyết định, không phải xác suất giữ chân nhờ ưu đãi.

### Dữ liệu và thiết kế phân tích

Nguồn public fictional 7.043×38; Internet cohort 5.517. Pipeline hiện hành dùng simulator v4 strong-signal, cùng 127 features cho LightGBM/CatBoost baseline+tuned, Optuna 30 trials/họ. Kết quả và giới hạn ở DATA_ML.md và evidence/ml/RESULTS.md. Không coi kết quả synthetic là kiểm định trên FPT; test September đã lộ nên exploratory; October chưa đủ kỳ chỉ inference.

Đã so sánh bốn ứng viên baseline/tuned LightGBM và CatBoost trên cùng 127 features, lựa chọn bằng validation và đánh giá calibration theo protocol hiện hành. Nhãn tháng sau trong panel được sinh theo simulator, không phải longitudinal outcomes thật của FPT. SHAP giải thích đóng góp feature, không chứng minh nguyên nhân. Dùng RESULTS/comparison hiện hành khi viết bản English, không quay về phương án model cũ.

### Vận hành và công cụ

Adapter tiếp nhận prediction hiện có; Python public-data cung cấp prediction offline cho demo khi chưa truy cập model nội bộ. Supabase lưu hồ sơ, task và lịch sử; n8n/LLM soạn đề xuất; CS web hỗ trợ duyệt từng tin và theo dõi phối hợp. Customer portal mô phỏng kiểm chứng vòng tương tác. Tích hợp Zalo thật là bước sau và phụ thuộc điều kiện nền tảng/doanh nghiệp.

### Giá trị và bằng chứng

Đã có kết quả ML đo trên synthetic ở evidence/ml/RESULTS.md, hosted workflow evidence ở evidence/n8n_workflows.json và evidence/n8n_agents.json. Phiên rà soát 18/10 chạy lại 39 DB checks, 7 UI checks, 5 workflow validator checks và build đạt; xem evidence/project_readiness.json. Chưa có measured retention uplift/ROI hoặc đo usability toàn hành trình. TODO cho bản English: chuyển các bằng chứng này thành bảng kết quả có phạm vi, bổ sung thời gian tác vụ do QA đo và business case có giả định/nguồn.

### Lộ trình và rủi ro

Data/mockup -> ML -> một luồng hoàn chỉnh -> workflow/error handling -> báo cáo/pitch -> pilot. Rủi ro chính: leakage, dữ liệu không phản ánh thị trường mục tiêu, hallucination, ưu đãi sai, quyền truy cập, gửi trùng, scope vượt sức nhóm. Biện pháp và điều kiện nghiệm thu xem đặc tả.

### Quyết định cần nhóm/giảng viên chốt

Dataset v4/127, bối cảnh, model/6 nhóm SHAP, human approval và mock transport đã chốt; không trình bày lại như quyết định đang chờ. Còn nguồn/license, deadline, tên owner, catalog/policy/delay cuối và assumptions capacity/ngân sách cần xác nhận. Những chỗ TODO phải được hoàn thiện trước khi gọi tài liệu này là executive summary cuối.

---

## Khung consulting pitch

Đề xuất 10 phần nội dung, không phải yêu cầu số slide của giảng viên. Có thể gộp/tách khi chốt thời lượng.

1. Quyết định cần cải thiện và thông điệp chính của đề xuất.
2. Bối cảnh kinh doanh, stakeholder và quy trình hiện tại (giả định có gắn nhãn).
3. PDMT map nối vấn đề đến dữ liệu, phương pháp và công cụ.
4. Data plan: nguồn, schema, quality, privacy, observed/synthetic và khoảng trống.
5. Analytical design: baseline, split, model selection, calibration, SHAP và giới hạn.
6. Kết quả thật khi có: ranking/Recall@K, calibration và ví dụ hồ sơ; không điền số giả.
7. Demo quy trình: priority -> action -> approval -> customer reply -> outcome.
8. Business case: assumptions, contribution margin, cost, sensitivity và kế hoạch đo incremental impact.
9. Roadmap, owners theo vai trò, rủi ro, scaling và điều kiện pilot.
10. Đề nghị quyết định: chấp thuận pilot phạm vi nào, cần dữ liệu/nguồn lực nào, tiêu chí tiếp tục/dừng.

Appendix dự kiến: data dictionary, model/evaluation details, schema/events, nguồn và demo fallback. Xuất PowerPoint sau khi kết quả và narrative được review; Markdown này là nguồn nội dung.

---

## Kịch bản demo dự kiến

Luồng demo cốt lõi đã chạy bằng hosted API/n8n và đã có các đoạn kiểm browser. Checklist dưới dùng cho rehearsal browser trọn vẹn và bản ghi fallback; chưa đánh dấu tổng nghiệm thu. Ma trận chi tiết và owner xem IMPLEMENTATION.md mục 4.

1. Công bố dữ liệu nào public, synthetic và simulated; nêu giới hạn horizon.
2. Analyst trình bày adapter prediction và nguồn/model version; nếu dùng model public-data demo thì công bố rõ và trình bày holdout metrics tương ứng.
3. CS mở hàng chờ top K, giải thích vì sao capacity ảnh hưởng lựa chọn.
4. Mở một case; xem model drivers và context, phân biệt tín hiệu với nguyên nhân.
5. AI soạn action/message dựa vào offer/eligibility; thử thiếu dữ liệu để thấy yêu cầu người xử lý.
6. Nhân viên sửa, duyệt; kiểm tra chưa duyệt không gửi được và sửa sau duyệt cần duyệt lại.
7. Customer portal ở phiên riêng nhận đúng tin; gửi reply. AI tạo draft mới cho CS duyệt.
8. Minh họa opt-out, gửi lỗi/retry không trùng và task follow-up trên fixture riêng. Delay cấu hình, default 3 giờ còn là đề xuất; không mặc định 24 giờ hoặc đổi đồng hồ cloud. Kiểm nhánh đủ kỳ bằng fixture quá khứ ở DB test.
9. Queue hiện có case/delivery và Unknown; cost form/chart cuối còn cần hoàn thiện. Sau khi tích hợp, trình diễn chi phí cùng currency/kỳ/simulated flag. Không gọi case closed là retained.
10. Kết lại bằng business case có giả định và pilot đo tác động tăng thêm.

Lưu screenshot/video ngắn và run metadata làm fallback khi mạng/dịch vụ lỗi; vẫn ghi rõ đó là bản ghi demo, không phải hệ thống đang xử lý live.

---

## Nguồn và mức thẩm quyền

Đã đọc ngày 16/10/2026.

### Nguồn do người dùng cung cấp

1. `C:/Users/ADMIN/Documents/FTU/Học hành/Năm 4/Advanced Business Analytics/Final Project Description (2).pdf` (2 trang). Nguồn chuẩn cho đầu ra môn học: PDMT, tình huống liên phòng ban, data plan, analytical design, evaluation plan, tools/workflow, pitch deck, executive summary nhiều trang, data + code. Không có thang điểm số, deadline, số slide hay số trang cụ thể trong tài liệu này.
2. `C:/Users/ADMIN/Downloads/CODEX_PROJECT_SETUP.md`. Bản brainstorm/đề xuất setup cũ. Có cả các lệnh cho AI nhưng người dùng nói rõ chưa final. Dùng để đánh giá ý tưởng; không kế thừa tự động yêu cầu dựng React, SQL hay workflow JSON ngay.
3. Yêu cầu trực tiếp trong chat ngày 16/10/2026: ưu tiên Markdown, tách tài liệu hệ thống/bản nộp, mockup trước code, sau này có dataset Kaggle và dữ liệu sinh thêm; hướng tới sản phẩm áp dụng được.
4. Thông tin nội bộ do người thực hiện dự án cung cấp ngày 17/10/2026: bối cảnh churn toàn quốc tăng 20% lũy kế so với cùng kỳ; hiện trạng model; phản ánh tại cuộc họp DVKH; chọn Bình Dương làm case/thí điểm. Số liệu và giả định chi tiết tại PROBLEM.md; chưa có báo cáo nguồn đính kèm để kiểm chứng độc lập.

Các file gốc ngoài repo chưa được sao chép. Nếu chia sẻ cho nhóm, cần đưa bản đề môn học được phép chia sẻ vào đây hoặc cung cấp link dùng chung; đường dẫn máy cá nhân không tái lập ở máy khác.

### Tài liệu kỹ thuật đã kiểm tra

- [scikit-learn: Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html): split trước fit preprocessing; pipeline giúp hạn chế leakage.
- [scikit-learn: Cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html): chọn cách chia theo cấu trúc mẫu và thời gian.
- [Supabase: Securing your data](https://supabase.com/docs/guides/database/secure-data): publishable key ở frontend, Auth/RLS và secrets ở phía server.
- [Zalo OA: Khởi tạo ứng dụng và cấp quyền](https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195): tích hợp OA với ứng dụng/server qua cấp quyền.
- [Zalo OA: Tin Tư vấn](https://oa.zalo.me/home/documents/guides/tin-tu-van): có điều kiện tương tác, không chặn OA và cửa sổ gửi tùy công cụ. Không mặc định mọi khách có trong CSV đều nhận được tin chủ động.

Các giới hạn và tên sản phẩm Zalo có thể đổi; kiểm tra lại tài liệu chính thức khi triển khai adapter. Chưa đánh giá chính sách Messenger vì chưa chọn kênh đó. Chưa có nguồn Kaggle hoặc license dataset.

---

## Bản xuất nộp bài

Chưa tạo Word, PowerPoint hoặc PDF. File này cùng PROBLEM.md là nguồn nội dung; `docs/evidence/` sẽ được tạo khi có bằng chứng thực nghiệm.

Sau khi hoàn thiện và review: tạo executive summary nhiều trang, consulting pitch deck, bản PDF nếu cần, và gói data/code + hướng dẫn tái lập đúng license/quyền riêng tư. Ghi phiên bản/ngày và nguồn Markdown tương ứng. File xuất được ignore mặc định để tránh bản cũ trôi nổi; chỉ đưa bản final vào version control/storage theo quyết định nhóm sau này.


## Model comparison — bản nháp tiếng Anh cho báo cáo

> We compared baseline and Optuna-tuned LightGBM and CatBoost models using the same frozen set of 127 features. Both support native categorical inputs, avoiding a separate manual one-hot preprocessing pipeline. Thirty TPE trials per model family optimized mean average precision over three rolling temporal folds. Customer IDs reserved for calibration and audit testing were excluded from fitting and model selection in this protocol. A fixed August-outcome validation rule selected a proposed CatBoost model with 92 boosting iterations (AP 0.6640; ROC-AUC 0.9650).

> The September audit cohort had already been inspected in earlier experiments. Its subsequent results are exploratory: the proposed CatBoost model achieved ROC-AUC 0.9843 and AP 0.7020. We did not use these test results to change the selected model. LightGBM attained higher test AUC in this comparison; small differences across models do not establish general superiority. Separate-customer calibration-only cross-fitting assessed a positive-slope sigmoid map before fitting the final calibrator. October outcomes remain unknown. After model selection, the project leader approved six business groups. Native CatBoost SHAP values were summed with their signs within each group; up to three positive group totals were surfaced per customer, with grounded English care drafts requiring staff review. These grouped feature attributions explain the model, not confirmed reasons for churn. The selected model retained its original probabilities because the sigmoid calibration candidate failed the predefined adoption gate.

> Service histories and outcomes were generated in a deliberately strong-signal simulation, seeded by public Internet-customer identifiers and tenure. These metrics assess the designed simulation, not production accuracy or retention impact at FPT Telecom. The core contribution is the human-approved retention workflow following a risk alert. Operational and financial benefits require a separate intervention evaluation.

Tài liệu technical đầy đủ: [ML README](../ml/README.md), [kết quả](evidence/ml/RESULTS.md), [metrics](evidence/ml/comparison.csv). Không đưa số lịch sử bộ 22 vào bảng kết quả hiện hành. Grouped SHAP đã chạy và context đã tích hợp UI/LLM; evidence ở shap_summary.json, n8n_agents.json và DATA_ML. Bản draft Python vẫn là template; AI interpretation trong app là output LLM riêng cần staff review. Không trình bày attribution/missingness như nguyên nhân đã xác nhận hoặc hiệu quả giữ chân.
