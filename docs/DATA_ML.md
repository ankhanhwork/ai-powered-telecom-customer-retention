# Dữ liệu và phương pháp ML

## Nguồn và phạm vi

Nguồn public local: `data/original/telecom_customer_churn.csv` (7.043 khách, 38 cột) và data dictionary. Đây là dữ liệu fictional tại California, không phải FPT. Lọc Internet Service=Yes còn 5.517 khách. Chưa xác nhận URL/version/license Kaggle; không phân phối lại CSV gốc trên GitHub.

Generator chỉ đọc Customer ID, Tenure in Months và Internet Service để chọn cohort/seed. Không dùng status/reason/category churn Kaggle, địa lý hoặc code doanh nghiệp. Giá cước/tốc độ là catalog demo chưa được FPT xác nhận. Code tạo dữ liệu luôn được giữ ở `data/synthetic/generation/`.

## Dataset hiện hành

- 5.517 khách, 113.937 snapshots, 1.182.087 dòng service history.
- 105.521 nhãn đã đủ kỳ, 8.416 Unknown; as-of 19/10/2026.
- Snapshot cuối tháng, ngày 10, ngày 20; prediction phát hành ngày 1, 11, 21.
- Một tháng lịch từ `target_period_start` đến `target_period_end_exclusive`, không gồm cận trên. Ví dụ 10/10 → [11/10,11/11).
- Một sự kiện churn/khách xác định các nhãn chồng nhau. Chỉ gán 0/1 khi toàn bộ kỳ đã hoàn tất; chưa đủ kỳ là Unknown.

Dataset duy nhất ở `data/synthetic/dataset/`. `features_127.csv` là input model; `customer_features.csv` chỉ là bảng nền. Nhãn ở `churn_labels.csv`, audit ở `generation_audit_private.csv`; cả hai không được đưa vào inference hoặc AI context. Dữ liệu ngày/billing/support được tính as-of, không nhìn sự kiện sau cutoff. Payment null của Prepaid nghĩa là không áp dụng, không phải nợ hoặc giá trị 0.

## Feature, split và lựa chọn model

Whitelisted 127 features trong `ml/config.json`; ID, ngày churn, nhãn, episode và xác suất sinh không là input. `billing_mode` là categorical native, không có one-hot thủ công. Các nhóm feature gồm connection, support, payment, usage, renewal và plan/relationship; cửa sổ 7/14/30/60/90 ngày theo từng biến.

| Partition | Quy tắc | Số dòng |
|---|---|---:|
| Train | Development IDs, target end ≤01/07; purge trước validation | 42.936 |
| Inner CV | Các kỳ bắt đầu April/May/June; fit chỉ nhãn đã hoàn tất tại đầu fold | 3 folds |
| Validation | Development IDs, kỳ bắt đầu 01/07, 11/07, 21/07 | 6.253 |
| Calibration | Nhóm khách riêng, cùng ba kỳ July | 1.552 |
| Test | Audit IDs, kỳ bắt đầu 01/09 và 11/09 | 1.485 |
| Inference | Snapshot 30/09 và 10/10, nhãn Unknown | 5.533 |

Calibration/audit IDs không vào fit/tuning/selection. Calibration dùng 5-fold StratifiedGroupKFold, toàn bộ snapshot của một khách trong cùng fold. Chỉ nhận Platt nếu cả OOF Brier và log loss cải thiện; mỗi bundle có calibrator riêng.

Optuna TPE 30 trials/họ LightGBM/CatBoost, objective mean purged CV ROC AUC, early stopping Logloss. Chọn giữa hai model tuned bằng validation ROC AUC, hòa thì validation log loss rồi tên. Baseline chỉ đối chiếu; selection khóa trước khi chấm test. Không chọn winner bằng test.

## Kết quả

| Model | Validation AUC | Test AUC (exploratory) | Test AP |
|---|---:|---:|---:|
| LightGBM baseline | 0,9469 | 0,9473 | 0,7166 |
| **LightGBM tuned — được chọn** | **0,9483** | **0,9467** | **0,7138** |
| CatBoost baseline | 0,9365 | 0,9374 | 0,7183 |
| CatBoost tuned | 0,9356 | 0,9348 | 0,7253 |

Model được chọn có 114 boosting rounds; Platt slope 1,2400316422, intercept 0,3482248508. Không đổi winner dù baseline test AUC hơi cao hơn hoặc CatBoost AP tốt hơn. Chênh lệch nhỏ không chứng minh ưu thế tổng quát.

`score=p×1000`, alert khi **>500**. Hai inference snapshots có 5.533 dòng/2.828 khách riêng và tổng 409 alerts theo snapshot. Latest 10/10 có 2.705 khách/207 alerts. Không cộng các snapshots thành số khách độc lập.

## SHAP và context chăm sóc

Native LightGBM/CatBoost SHAP, 127 features thuộc đúng 6 nhóm đã duyệt. Cộng có dấu trong từng nhóm; chọn tối đa 3 nhóm có tổng dương. Nhóm âm bù trừ rủi ro; không ép đủ 3 nhóm. Transform contributions theo Platt để tái dựng xác suất, không thay model hoặc p.

Các nhóm: Connection Quality; Support Experience; Payment & Overdue Bills; Usage & Engagement; Renewal & Promotion Status; Plan, Pricing & Relationship. Mapping gắn hash model ở `ml/shap/shap_groups.json`. Mỗi driver kèm facts, window/unit, evidence status và yêu cầu staff review. Prepaid payment null không làm bằng chứng nhắc nợ; thiếu dữ kiện yêu cầu xác minh.

Output ở `data/output/shap/`: feature/group SHAP, care context, predictions và manifest. SHAP là model attribution, không là nguyên nhân đã xác nhận hoặc % xác suất churn. Biểu đồ tại `data/output/train_finetune/results/figures/slides/` dùng latest cohort một dòng/khách; các số liệu test có snapshot chồng nhau được ghi rõ.

## Tích hợp và khả năng kiểm chứng

Supabase đã nhận latest cohort; import dùng cặp `(customer_id,snapshot_date)`, giữ start/end và loại nhãn/audit. Dữ liệu vận hành có thể có thêm hoạt động/fixtures Dashboard; không coi số khách ML là tổng case live hiện tại. Không chạy lại reset/import khi chỉ dọn repo.

Tất cả code, config, bundles và kết quả hiện hành theo [ML README](../ml/README.md). Các bảng synthetic/preprocess lớn và raw CSV giữ local; model, inference và kết quả đủ cho review được theo dõi bằng Git. Manifest gốc giữ seed/hash tại thời điểm thực nghiệm; bằng chứng di chuyển nằm ở `evidence/repository_cleanup.json`.

Test là exploratory synthetic benchmark, không phải kiểm định độc lập trên FPT. Simulator có tín hiệu chủ động; không tìm seed hoặc sửa DGP theo test. Muốn kết luận hiệu quả giữ chân/doanh thu cần dữ liệu thật và pilot có đối chứng.
