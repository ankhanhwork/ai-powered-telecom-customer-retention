# Dữ liệu và ML

## Phạm vi hiện hành đã chốt 19/10/2026 — rolling month v5

**Mục này thay thế contract snapshot/nhãn/split v4 ở phần lịch sử bên dưới.** Giữ đủ 127 features; chạy ngày 1/11/21 từ snapshot cuối tháng/10/20 và dự báo một tháng lịch từ ngày chạy. 30/09 → [01/10,01/11), 10/10 → [11/10,11/11), 20/10 → [21/10,21/11). Ngày snapshot là hết ngày Asia/Ho_Chi_Minh; không dùng sự kiện sau cutoff.

Dữ liệu v5 được sinh mới ở `data/synthetic/final/rolling_month_v5`; processed/model/inference tương ứng dùng cùng suffix. `ml/config.json` là contract train v5; `ml/config_monthend_v4.json` giữ lịch sử. Generator/config/code được giữ tại `ml/generation/`; không xóa hoặc ghi đè dữ liệu v4.

**Nhãn:** tên cột vẫn `churn_next_month`, nghĩa là churn trong [target_period_start,target_period_end_exclusive). Một ngày churn duy nhất/khách đảm bảo nhãn nhất quán trên các cửa sổ chồng nhau. Chỉ gán 0/1 sau khi hết toàn bộ kỳ; chưa đủ kỳ là Unknown. Chỉ dự báo khách còn hoạt động tại snapshot. As-of v5 là 19/10/2026; snapshot 20/10 chưa tồn tại. Synthetic daily hazard được xác định từ facts as-of tại snapshot và giữ tới snapshot kế tiếp; adverse episodes có persistence. Đây là DGP khác v4, không phải cải thiện trên cùng dataset.

**127 features:** giữ tên/kiểu/null contract, tính lại theo snapshot. `consecutive_issue_months` dựa trạng thái hiện tại và các snapshot cuối tháng trước, không tăng theo số snapshot. Prepaid payment null vẫn không áp dụng. Không thêm horizon/ID/churn date/episode/generation probability vào feature whitelist.

| Partition | Cửa sổ và nguyên tắc |
|---|---|
| Train | Development IDs, target end ≤01/07/2026; snapshot Jan–May, purge các nhãn chưa đủ trước validation |
| Inner CV | Target starts trong April/May/June; fit chỉ các nhãn đã hoàn tất tại ngày bắt đầu validation fold |
| Validation | Development IDs, target starts 01/07, 11/07, 21/07 |
| Calibration | Nhóm khách riêng tại cùng ba kỳ July; 5-fold customer-grouped OOF |
| Test | Audit IDs, target starts 01/09 và 11/09, kết thúc 01/10 và 11/10; kỳ 21/09 chưa đủ tại as-of |
| Inference | Các kỳ bắt đầu October chưa hoàn tất, snapshot 30/09 và 10/10; Unknown |

**Đầu ra dữ liệu đã kiểm tra:** 5.517 khách, 113.937 snapshot, 1.182.087 dòng service history; 105.521 nhãn hoàn tất và 8.416 Unknown. Sau partition: train 42.936 dòng/3.166 positive; validation 6.253/465; calibration 1.552/138; test 1.485/134; inference 5.533 dòng tại snapshot 30/09 và 10/10. Các partition history/purged/incomplete khác không dùng fit/selection. Đây là số dòng snapshot, không phải số khách độc lập. Evidence: `evidence/ml/rolling_month_v5/generation_quality.json`, `split_summary.csv`.

Tune LightGBM/CatBoost **30 trials/họ**, cùng 127 cột, objective mean purged CV ROC AUC. Chọn giữa hai bản tuned bằng validation ROC AUC (tie-break log loss/tên), khóa selection trước score test; baseline chỉ đối chiếu. Calibrator riêng từng model chỉ được áp nếu cả OOF Brier/log loss giảm. Các snapshot của cùng khách không được tách giữa fold calibration.

Mục tiêu synthetic AUC người dùng xác nhận khoảng **0,89**. Test là benchmark exploratory, không dùng chọn model; nếu phải đổi DGP sau test phải ghi lịch sử rõ. Kết quả đã cập nhật tại `evidence/ml/rolling_month_v5/RESULTS.md`. Evidence v4 bên dưới giữ nguyên như lịch sử.

**Kết quả hoàn tất 19/10/2026:** đã tạo 5.517 khách / 113.937 snapshot, đủ 127 features; 30 Optuna trials mỗi họ. Chọn **LightGBM tuned** theo validation AUC **0,9483**; test exploratory AUC **0,9467**, AP **0,7138**, đạt mốc demo khoảng 0,89. CatBoost tuned: validation AUC **0,9356**, test AUC **0,9348**. Selection khóa trước test; một full-cohort generation, không sửa simulator theo test. 36 ML tests và kiểm hash/save-reload/grouped calibration đạt.

Calibrator LightGBM tuned được áp dụng vì cả grouped OOF Brier và log loss giảm; identity của v4 không được tái dùng. Full baseline/tuned metrics và tham số có ở RESULTS/comparison; không thay winner dù baseline LightGBM test AUC 0,9473 hơi cao hơn tuned. Chênh lệch nhỏ không chứng minh ưu thế tổng quát.

**SHAP và Supabase đã hoàn tất 19/10/2026:** native LightGBM SHAP cho 5.533 snapshots, giữ nguyên model/xác suất; 127 features/6 nhóm, signed sums và Platt a=1,2400316422/b=0,3482248508. Raw additivity error 7,41e-15, probability error 2,11e-15. Supabase đã thay v4 bằng latest batch 11/10: **2.705 khách/predictions/contexts, 207 cases >500**, kỳ [11/10,11/11), outcome Unknown. Xóa v4 khỏi bảng vận hành; backup 25 bảng ở `app_private.v4_demo_backup`, không có quyền browser/worker; `supabase/restore_demo_v4.sql` đã kiểm round-trip local. Giữ Auth 3 users/staff 2; portal remap vào case mới, consent/opt-out được giữ theo customer_ref khi khớp. Không tự cấp consent mới hoặc gửi tin.

**Biểu đồ English cho slide:** `docs/evidence/ml/rolling_month_v5/figures/slides/` có 7 biểu đồ × PNG/SVG, `README.md` hướng dẫn dùng và `chart_data.json` lưu số liệu/hashes. Dùng latest 2.705 khách một lần/người cho SHAP global; test ROC/PR là 1.485 dòng/758 khách với cửa sổ chồng nhau. SHAP là model risk drivers, không phải nguyên nhân xác nhận, không phải % xác suất.

**Tích hợp hiện hành:** migration `20261019033021_rolling_month_v5_shap` đã áp cloud, constraints cho ngày phát hành 1/11/21, end-exclusive một tháng lịch và context/queue/outcome cùng kỳ. Import dùng snapshot mới nhất theo `(customer_id,snapshot_date)`, không gộp nhầm hai dòng/khách. Supabase chỉ nhận features/prediction/SHAP/context không nhãn; train/test/audit offline. Đây là controlled reset theo yêu cầu leader, chưa phải tự động refresh case lịch sử ở mọi batch tương lai.

## Lịch sử v4 và nguồn dữ liệu


Cập nhật 17/10/2026. **Phiên bản hiện hành: dataset v4 strong-signal, đúng 127 features.** Cả LightGBM và CatBoost đều dùng cùng bộ này. Không dùng bộ 22 của các thử nghiệm cũ. Model là nguồn prediction demo; giá trị chính của dự án vẫn là hệ thống DVKH phối hợp sau cảnh báo.

## Nguồn và phạm vi

Nguồn public đã nhận: `telecom_customer_churn.csv` (7.043 khách × 38 cột), `telecom_data_dictionary.csv`; lọc Internet Service=Yes còn 5.517 khách. Profile ở `evidence/source_data_profile.json`; raw local ở `data/raw/`. Nguồn mô tả dữ liệu fictional tại California, không phải FPT. Chưa có URL/license Kaggle đầy đủ để quyết định phân phối lại.

Generator chỉ đọc Customer ID, Tenure in Months và Internet Service để chọn cohort/seed. Không đọc status/reason/category churn gốc, zip/địa lý hoặc code doanh nghiệp để sinh dữ liệu. File Python nhóm feature công ty chỉ được đọc như tài liệu tham khảo; không thực thi/đưa vào repo. Giá cước/tốc độ trong simulator là catalog demo, chưa phải danh mục FPT đã xác nhận.

## Dataset frozen và khả năng tái lập

`data/synthetic/final/` giữ lịch sử ngày, hóa đơn, ticket, liên hệ, hồ sơ, snapshot và nhãn riêng. `dataset_manifest.json` giữ seed/config/hash gốc. **`features_127.csv` là input 127 feature**, được tính từ lịch sử v4 đã có; lượt Optuna không đổi nhãn hoặc sinh lại dữ liệu. `customer_features.csv` chỉ là bảng nền để mở rộng, không phải input model hiện hành.

- 5.517 khách ban đầu, 38.680 snapshot, 1.256.384 dòng lịch sử ngày. Lịch sử sinh từ January đến 16/10/2026, snapshot cuối tháng Jan–Sep.
- Snapshot ngày cuối tháng t dùng dữ kiện đã biết lúc đó để dự báo churn trong tháng t+1. Trả tiền/xử lý ticket sau cutoff không được làm thay đổi feature quá khứ.
- Các biến Payment chỉ áp dụng Postpaid. Prepaid để missing có nghĩa, không lấp 0 như không có trễ hạn. Thiếu telemetry khác với không sử dụng; chưa đủ lịch sử không coi như 0.
- Whitelist 127: 22 biến nền + 3 lịch sử + 102 biến cửa sổ/thanh toán; gồm 49 biến thanh toán mới. Các cửa sổ dịch vụ/hỗ trợ 7/14/30/60/90 ngày; thanh toán 30/60/90 ngày, mức/ngày trễ hạn, aging, streak và xu hướng hóa đơn. Dictionary cửa sổ tại `evidence/ml/feature_dictionary_windows.csv`; whitelist cuối ở `ml/config.json`.
- Taxonomy gốc trong generator dùng Billing & Payment và Customer Relationship & Plan. Mapping SHAP đã duyệt ở mục dưới chuyển giá/thay đổi cước sang Plan, Pricing & Relationship và giữ Payment & Overdue Bills riêng; không đổi feature, dữ liệu hoặc model khi đổi cách gom diễn giải.
- ID, timestamp, partition, cohort, nhãn và audit generator không là model feature. `billing_mode` là categorical native; không có bước one-hot thủ công. Cách learner xử lý categorical nội bộ là riêng của thuật toán.

**Code luôn được giữ:** `ml/generation/generate_data.py`, `generate_sample.py`, `simulator.json`, `build_history_features.py`, `build_window_features.py`. Hướng dẫn tạo lại vào thư mục mới ở `ml/README.md`. Dataset frozen không ghi đè. Môi trường generator gốc có requirements riêng; manifest còn giữ hash của code ở lần sinh ban đầu, code hiện được chuyển chỗ có thay đổi CLI/import cho tổ chức thư mục, không giả rằng hash source mới trùng hash lịch sử.

## Split và trình tự đánh giá

Trước tuning, hash chia development IDs để dành khoảng 20% cho calibration, không dùng nhãn để chia. Audit IDs từ simulator dành test. Calibration/test IDs không xuất hiện trong fit/CV/validation của protocol hiện tại, nhưng đã có lịch sử thử nghiệm trên dữ liệu này; không gọi chúng hoàn toàn chưa từng được xem.

| Phần | Snapshot | Nhãn | Số dòng | Cách dùng |
|---|---|---|---:|---|
| Train | Jan–Jun 2026 | Feb–Jul | 16.896 | Fit, rolling tuning với khách development còn lại |
| Validation | 31/07 | August | 2.154 | Chọn giữa bốn ứng viên |
| Calibration | 31/07 | August | 569 (39 churn) | Khách riêng; fit/check calibrator |
| Test | 31/08 | September | 868 (63 churn) | Audit IDs; đúng một tháng, exploratory |
| Inference | 30/09 | October | 3.202 | Không nhãn; dự báo batch 01/10 |

Các dòng audit/calibration_history và unused_development không vào fit/selection. Split summary và hash được lưu ở `evidence/ml/split_summary.csv`, `data_manifest.json`; không random-split các dòng panel. Khách development có thể xuất hiện ở nhiều tháng trước/validation; điều này phản ánh dự báo khách đang tồn tại. ID không là input.

Optuna **TPE, 30 trials/họ × 3 rolling folds**, seed 42. Fold validation snapshot April/May/June, train chỉ các tháng trước fold. Early stopping Logloss tối đa 1.000 vòng, patience 50, trong fold; objective Optuna là mean AP. Số vòng fit cuối lấy median best iterations, không early stop trên outer July validation. Baseline dùng tham số mặc định đã cấu hình và cùng cách xác định số vòng.

AP là average precision, phù hợp quan tâm thứ hạng lớp churn hiếm; không đồng nhất hoàn toàn với mọi cách tính diện tích PR curve. Luật chọn đã cấu hình trước test: giữ ứng viên có AP validation cách best ≤0,005, tiếp tục giữ log loss cách tốt nhất trong nhóm ≤0,001, rồi chọn latency predict thấp nhất. Latency nhỏ có nhiễu; chênh lệch này không chứng minh một model tốt hơn phổ quát. `selection.json` được ghi trước chấm test và kiểm tra hash sau đó.

## Kết quả đo thực tế — cùng 127 features

| Model | CV AP | Validation AP | Validation AUC | Test AUC* | Test AP* |
|---|---:|---:|---:|---:|---:|
| lightgbm_baseline | 0.7090 | 0.6526 | 0.9659 | 0.9844 | 0.7215 |
| lightgbm_tuned | 0.7238 | 0.6425 | 0.9653 | 0.9853 | 0.7237 |
| catboost_baseline | 0.7091 | 0.6597 | 0.9665 | 0.9837 | 0.7134 |
| catboost_tuned | 0.7308 | 0.6640 | 0.9650 | 0.9843 | 0.7020 |

*Test exploratory: September đã được xem ở các vòng trước; không coi đây là kiểm định xác nhận độc lập.

**Đề xuất CatBoost tuned**, 92 vòng: learning_rate=0,149722; depth=7; l2_leaf_reg=4,370048; random_strength=1,738892; bagging_temperature=0,521443. Tham số chính xác và các default cố định trong `evidence/ml/catboost_best.json`, `ml/models_api.py` và bundle metadata. CatBoost baseline cũng gần sát AP; LightGBM tuned có AUC test cao hơn. Không đổi lựa chọn theo test; tuning cải thiện inner CV nhưng không bảo đảm cải thiện outer validation (LightGBM là ví dụ).

Lý do so sánh hai họ: hỗ trợ categorical native và dữ liệu numerical, tránh pipeline one-hot thủ công. Không lập luận LightGBM luôn tốt hơn CatBoost với biến liên tục nếu chưa có bằng chứng. **Leader đã duyệt CatBoost tuned**; 6 nhóm SHAP cũng đã được duyệt và triển khai theo mục dưới.

## Calibration và prediction

Mỗi ứng viên có Platt sigmoid trên raw margin riêng. 5-fold stratified OOF chỉ cho calibrator, dùng nhóm 569 khách calibration riêng. Chỉ nhận map nếu Brier và log loss OOF đều giảm; sau đó fit map cuối trên toàn nhóm calibration. Không fit calibrator từ test, không dùng lại hệ số bộ 22. OOF này đánh giá bước calibration điều kiện theo model nền; số positive nhỏ nên cần kiểm định thêm.

CatBoost tuned: calibration OOF Brier 0.01995→0.02012; log loss 0.06693→0.06814. Map adopted=False. Test sau calibration AUC 0.9843, AP 0.7020, Brier 0.02375 (exploratory). Map tăng đơn điệu giữ nguyên AUC test.

October có **260/3.202** khách >500; `churn_score=p×1000`, `company_gt_500=p>0,5`. Nhãn October **Unknown** tại 17/10; không dùng nhãn tương lai để train. Số lượng alert synthetic không cần khớp 8.000 case thực tế được cung cấp và không chứng minh policy nhân sự tối ưu.

- Input/output tích hợp: `data/inference/final/features.csv`, `predictions.csv`; không chứa nhãn.
- Bundle đề xuất: `ml/models/final/champion/` gồm model, schema127, calibrator, metadata và hash model. Giữ riêng cả bốn bundle để review đối chiếu.
- Evidence: `docs/evidence/ml/RESULTS.md`, `comparison.csv/json`, `*_trials.csv`, `*_best.json`, `selection.json`; Optuna SQLite trong `ml/models/final/search/`.
- Hình English: `evidence/ml/figures/tuning_history.png`, `model_comparison.png`, tái tạo bằng `ml/report.py`.
- Script dùng app/batch: `ml/predict.py`; kiểm tra schema/hash và từ chối nhãn/audit. Lệnh tái lập ở `ml/README.md`.

## SHAP và diễn giải nhóm — đã duyệt và triển khai

**Leader đã duyệt CatBoost tuned và 6 nhóm SHAP.** Đã triển khai `ml/explain.py`, config `ml/shap_groups.json` và chạy trên toàn bộ batch October 3.202 khách. Không train/tune lại, không đổi dataset, nhãn, tham số hay xác suất. Artifact selection/comparison giữ nguyên trạng thái lịch sử; `approval.json` trong champion lưu quyết định hiện hành.


### 6 nhóm đã duyệt cho nhân viên DVKH

| Nhóm hiển thị English | Phạm vi feature | Hướng xác minh/hành động |
|---|---|---|
| Connection Quality | disconnect_count, outage_minutes, evening_speed_ratio, service_issue_days ở mọi window; consecutive_issue_months | Xác minh chất lượng kết nối; lập yêu cầu hỗ trợ kỹ thuật nếu cần |
| Support Experience | support_contacts, repeat_contacts, opened_tickets, unresolved_tickets, avg_resolution_hours ở mọi window; oldest_open_ticket_days | Kiểm tra vấn đề tồn đọng, liên hệ lại và phối hợp xử lý |
| Payment & Overdue Bills | overdue_days, overdue_amount_vnd; toàn bộ due/late/paid invoice, payment, delay, aging và streak features | Hỏi về hóa đơn, lý do chưa thanh toán, hướng dẫn xử lý trong policy; không suy đoán khó khăn tài chính |
| Usage & Engagement | usage_gb, usage_change_pct, inactive_days ở mọi window | Xác minh nhu cầu sử dụng, vắng nhà hoặc vấn đề truy cập; không tự kết luận chuyển nhà/dùng đối thủ |
| Renewal & Promotion Status | prepaid_days_remaining, promo_days_remaining, billing_mode | Xác nhận kỳ gia hạn/ưu đãi; kiểm tra phương án được duyệt. Billing mode là bối cảnh, không tự coi Prepaid/Postpaid là nguyên nhân |
| Plan, Pricing & Relationship | monthly_fee_vnd, fee_change_pct ở mọi window, plan_speed_mbps, plan_change_requests ở mọi window, tenure_months | Xác minh gói phù hợp và thay đổi cước; tenure là bối cảnh quan hệ, không tự gọi là bất mãn |

Khác taxonomy trước: tách mức cước/thay đổi cước khỏi thanh toán trễ hạn và chuyển sang nhóm gói cước. Thanh toán đúng hạn và mức giá là hai hướng chăm sóc khác nhau. Mọi window của cùng một họ feature nằm cùng nhóm. Mỗi feature thuộc đúng một nhóm, không bỏ hoặc đếm trùng; mapping đã kiểm tra đủ 127/127, không trùng. Số feature theo thứ tự bảng: 21, 26, 51, 15, 3, 11. Config explicit ở `ml/shap_groups.json`; không tự đổi nhóm theo từng khách.

### Quy tắc top 3 đã triển khai

1. Tính SHAP từng feature của đúng CatBoost tuned, rồi **cộng có dấu** trong nhóm. Xếp nhóm theo tổng đóng góp tăng rủi ro, không theo tổng trị tuyệt đối hoặc số lượng feature.
2. Chỉ hiển thị tối đa 3 nhóm có tổng dương; nếu chỉ có 1–2 nhóm tăng rủi ro thì hiển thị đúng số đó. Nhóm tổng âm là yếu tố giảm rủi ro, có thể đặt ở phần phụ.
3. Tổng nhóm là tổng đóng góp feature đã gom để diễn giải, không gọi là phép tính Shapley trực tiếp trên các nhóm mới. Window tương quan có thể chia sẻ attribution; thứ hạng nhóm chưa là kết luận nhân quả.
4. Trong mỗi nhóm hiển thị 2–3 dữ kiện gốc có đóng góp tăng rủi ro nổi bật, kèm kỳ đo. Ưu tiên diễn đạt không lặp: 7d/30d/90d của một hiện tượng có thể tóm tắt thành diễn biến gần đây so với trước đó, vẫn giữ đủ contributions ở backend.
5. AI viết: tình trạng quan sát → vì sao đáng ưu tiên theo model → việc cần xác minh/hành động. Chỉ dùng số liệu có thật và được cấp, không suy diễn thu nhập, đối thủ, cảm xúc hoặc nguyên nhân kỹ thuật chưa xác nhận. Chưa có SHAP thì chưa gắn ví dụ vào khách thật.
6. UI dùng **Top risk drivers**, không khẳng định **Confirmed churn reasons**. Không đổi SHAP thành % xác suất churn hay nói nhóm chiếm x% nguy cơ. Đóng góp raw margin và calibrated log-odds cần được kiểm tra riêng khi triển khai; phải tái dựng đúng xác suất của bundle đã calibration.

### Output và cách dùng cho báo cáo/app

Chạy `ml/predict.py --explain` để score + explain hoặc `ml/explain.py` để giải thích batch đã có. `ml/README.md` hướng dẫn chi tiết. CatBoost native `ShapValues` không dùng reference_data, trả 127 đóng góp và một baseline; không cần cài thêm package SHAP. Nhóm là tổng feature attribution, không phải Shapley coalition trực tiếp.

- `data/inference/final/explanations/feature_shap_raw.csv`: 127 contributions/raw margin và baseline cho từng khách.
- `group_shap.csv`: tổng có dấu của 6 nhóm trong deployed log-odds, baseline và xác suất tái dựng.
- `care_context.jsonl`: mỗi khách một object, top tối đa 3 nhóm dương, facts có giá trị/đơn vị/window, contribution, evidence status, bản nháp English và action cần nhân viên review. Các trường kỹ thuật chỉ cho backend; UI dùng tên nhóm, observation, draft và action.
- `predictions.csv` trong thư mục explanations và bản hiện hành ở `data/inference/final/predictions.csv`: cùng xác suất trước đây, đã bổ sung trạng thái/version explanation. Plain `predict.py` không có --explain chỉ score và không tự tính SHAP.
- `manifest.json`: hash input/model/schema/calibrator/mapping/output và kiểm tra tính cộng. Không gửi full SHAP, raw margin, nhãn hoặc audit vào tin khách; payload chăm sóc là nội bộ.
- `docs/evidence/ml/shap_summary.json`, `shap_mapping_coverage.csv`, `shap_group_importance.csv`, `figures/shap_group_importance.png`: bằng chứng kỹ thuật và biểu đồ English.
- `shap_example.json`: hồ sơ synthetic có điểm cao nhất batch, đã đổi ID thành SYNTHETIC-EXAMPLE; đây là ví dụ chọn có chủ đích, không phải khách thật hay hồ sơ điển hình.

Bản nháp English hiện dùng template có căn cứ, **chưa gọi LLM**. Dữ kiện gốc, window, đóng góp và trạng thái bằng chứng được xuất để n8n/LLM viết tự nhiên ở bước tích hợp. UI không cần hiển thị tên cột, log-odds hoặc thuật ngữ SHAP. Chưa có chatbot/UI/n8n hoạt động chỉ vì file đã được xuất.

### Kiểm tra và giới hạn quan trọng

Sai số tối đa tái dựng raw margin khoảng 7,11e-15; tái dựng probability khoảng 8,88e-16. 23 tests pipeline đã đạt và 7 tests SHAP mới đạt: mapping thiếu/trùng/sai; signed cancellation; không ép đủ 3; missing/đơn vị; dedupe window; native additivity cả identity và Platt giả định trong test; chặn nhãn/audit/sai model; Prepaid không bị gọi là nợ quá hạn. Kiểm tra batch giữ nguyên xác suất và validate mọi care payload.

**Calibration CatBoost tuned không được áp dụng**: OOF Brier/log loss đều xấu hơn nên bundle dùng identity (a=1,b=0). Không gọi xác suất này là đã được Platt cải thiện. Code vẫn kiểm tra phép biến đổi contributions nếu một model/calibrator hợp lệ khác được duyệt sau này: feature contribution nhân a, baseline nhân a rồi cộng b, sau đó sigmoid.

**Missingness và khả năng hành động:** với Prepaid, biến hóa đơn Postpaid là không áp dụng, không phải thiếu hóa đơn/nợ. Model vẫn có thể quy attribution dương cho mẫu missing đó. Giữ đóng góp trung thực, nhưng card gắn `supports_customer_situation_claim=false`, trạng thái not applicable và không gợi ý nhắc nợ. Trường khác thiếu dữ kiện cũng yêu cầu xác minh trước hành động. Đây là giới hạn của model hiện tại, không sửa model/dữ liệu để làm explanation trông đẹp hơn.

Có 32 khách không có nhóm tổng dương: drivers là mảng rỗng, UI cần empty state thay vì bịa top 3. Nhóm nhiều feature có thể gom nhiều tín hiệu tương quan; không chuẩn hóa chia số feature vì sẽ phá ý nghĩa tổng đóng góp. Biểu đồ global dùng mean(abs(tổng có dấu của nhóm)) trên cohort October, không chứng minh đó là nguyên nhân churn phổ biến nhất thực tế.


Nguồn kỹ thuật: [CatBoost SHAP values](https://catboost.ai/docs/en/concepts/shap-values) mô tả đóng góp từng feature và expected value cộng lại thành model prediction. Cách gom nhóm có dấu và thiết kế top 3 trên đây đã được leader duyệt cho dự án. Không sử dụng contributions model cũ; SHAP giải thích model, không chứng minh nguyên nhân khách chắc chắn rời mạng.

## Giới hạn và quản lý phiên bản

V4 chủ động tăng tín hiệu simulator bằng các episode bất lợi và hazard mạnh, thay đổi cả nhãn/DGP so với v3. Vì vậy không trình bày AUC tăng là cải thiện cùng một dataset thực hoặc độ chính xác FPT. `generation_audit_private.csv` chỉ để QA, không vào training/AI. Cần một tập mới chưa từng xem, xác nhận catalog và pilot thực tế để kết luận hiệu quả giữ chân/doanh thu.

Data/model cũ được loại khỏi thư mục làm việc sau khi pipeline mới chạy thành công. Chỉ giữ tổng hợp lịch sử ở `evidence/ml/historical_experiments.json`, code generation vẫn nguyên trong repo. Thử nghiệm bộ 22 bị dừng khi leader sửa yêu cầu, không đưa vào comparison final. Dataset chốt không bị điều chỉnh theo test; chưa tối ưu thêm sau khi xem kết quả này.

Kiểm tra: 23 tests về lịch sử as-of, thanh toán, missing, split, đúng 127 feature cho cả hai họ, native categorical, calibration và save/load. Chạy thật đã kiểm tra prediction save/reload, map giữ AUC, selection hash trước test, inference không nhãn. Đây là kiểm tra kỹ thuật, không thay bằng chứng triển khai app hoặc hiệu quả kinh doanh.

### Staff UI: tỷ lệ SHAP tương đối (18/10/2026)

Giao diện dùng context Supabase hiện có để tính `100 × group contribution_log_odds / (logit(churn_probability) − base_value)`. Mẫu số bằng tổng signed SHAP của đủ 6 nhóm, không chỉ top 3 đang hiển thị. Đây là tỷ trọng của mức tăng log-odds trên baseline, không phải % xác suất churn hay nguyên nhân nhân quả. Nhóm âm có thể khiến nhóm dương vượt 100%; không clamp. Thiếu dữ liệu, p ở biên hoặc net increase không dương thì hiện Unavailable. Không đổi artifacts/model đã duyệt. Facts là snapshot đã lưu; selector deterministic trong ml/explain.py chọn nhóm dương lớn nhất và các feature dương khác family, ưu tiên observed. Payment prepaid là model signal only, không làm bằng chứng nợ.
