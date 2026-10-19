# Luồng ML hiện hành — rolling month v5, 127 features

**Phạm vi đã chốt 19/10/2026:** chạy ngày **1, 11, 21**; snapshot cuối tháng trước, ngày 10 và ngày 20. Mỗi lần dự báo **một tháng lịch tới**, không phải chỉ phần còn lại của tháng. Giữ đúng whitelist 127 features trong `config.json`. Đã tạo dữ liệu/tune lại; kết quả nằm ở `../docs/evidence/ml/rolling_month_v5/RESULTS.md`.

Ví dụ: snapshot 30/09 → [01/10, 01/11); 10/10 → [11/10, 11/11); 20/10 → [21/10, 21/11). Cận trên không bao gồm. Snapshot là hết ngày địa phương Asia/Ho_Chi_Minh, cutoff_at lưu UTC. Không tạo snapshot 20/10 khi as_of mới là 19/10.

**Kết quả hoàn tất 19/10/2026:** đã tạo 5.517 khách / 113.937 snapshot, đủ 127 features; 30 Optuna trials mỗi họ. Chọn **LightGBM tuned** theo validation AUC **0,9483**; test exploratory AUC **0,9467**, AP **0,7138**, đạt mốc demo khoảng 0,89. CatBoost tuned: validation AUC **0,9356**, test AUC **0,9348**. Selection khóa trước test; một full-cohort generation, không sửa simulator theo test. 36 ML tests và kiểm hash/save-reload/grouped calibration đạt.

| Tuned model | CV AUC | Validation AUC | Test AUC (exploratory) | Test AP |
|---|---:|---:|---:|---:|
| **LightGBM — selected** | 0.9107 | 0.9483 | 0.9467 | 0.7138 |
| CatBoost | 0.9088 | 0.9356 | 0.9348 | 0.7253 |

Selected LightGBM: 114 boosting rounds; Platt adopted from customer-grouped OOF, slope=1.2400316422, intercept=0.3482248508. Baseline LightGBM test AUC 0.9473 hơi cao hơn tuned 0.9467; không đổi winner theo test, không tuyên bố tuning luôn cải thiện. CatBoost tuned AP cao hơn nhưng không thắng tiêu chí validation AUC đã khóa.

Inference: 5.533 dòng / 2.828 khách riêng, gồm 30/09 (2.828 dòng, 202 alerts) và 10/10 (2.705 dòng, 207 alerts). 409 alerts là tổng theo snapshot, không phải số case duy nhất. Latest batch là 11/10: 207/2.705 >500. Nhãn cả hai batch Unknown. `verification.json` ghi checks và metrics theo từng test snapshot. Không sinh thêm data sau khi xem test.

**SHAP và Supabase đã hoàn tất 19/10/2026:** native LightGBM SHAP cho 5.533 snapshots, giữ nguyên model/xác suất; 127 features/6 nhóm, signed sums và Platt a=1,2400316422/b=0,3482248508. Raw additivity error 7,41e-15, probability error 2,11e-15. Supabase đã thay v4 bằng latest batch 11/10: **2.705 khách/predictions/contexts, 207 cases >500**, kỳ [11/10,11/11), outcome Unknown. Xóa v4 khỏi bảng vận hành; backup 25 bảng ở `app_private.v4_demo_backup`, không có quyền browser/worker; `supabase/restore_demo_v4.sql` đã kiểm round-trip local. Giữ Auth 3 users/staff 2; portal remap vào case mới, consent/opt-out được giữ theo customer_ref khi khớp. Không tự cấp consent mới hoặc gửi tin.

**Biểu đồ English cho slide:** `docs/evidence/ml/rolling_month_v5/figures/slides/` có 7 biểu đồ × PNG/SVG, `README.md` hướng dẫn dùng và `chart_data.json` lưu số liệu/hashes. Dùng latest 2.705 khách một lần/người cho SHAP global; test ROC/PR là 1.485 dòng/758 khách với cửa sổ chồng nhau. SHAP là model risk drivers, không phải nguyên nhân xác nhận, không phải % xác suất.

## Tái lập phiên bản mới

Môi trường có sẵn: `ml/.venv-lgbm/Scripts/python.exe`; không thêm dependency. Chạy từ repo root:

```powershell
& ml/.venv-lgbm/Scripts/python.exe ml/generation/generate_data.py --source data/raw/telecom_customer_churn.csv --config ml/generation/simulator_rolling.json --output data/synthetic/final/rolling_month_v5 --quality-output docs/evidence/ml/rolling_month_v5/generation_quality.json
& ml/.venv-lgbm/Scripts/python.exe ml/generation/build_window_features.py --data data/synthetic/final/rolling_month_v5 --output data/synthetic/final/rolling_month_v5/features_127.csv
& ml/.venv-lgbm/Scripts/python.exe ml/train.py
& ml/.venv-lgbm/Scripts/python.exe ml/report.py
& ml/.venv-lgbm/Scripts/python.exe -m unittest discover -s ml/tests -v
```

Generator và feature builder từ chối ghi đè dataset; train từ chối ghi đè comparison. Khi tuning đã xong nhưng comparison chưa có, `ml/train.py --skip-tuning`. Thí nghiệm khác phải dùng version/path mới, không ghi đè frozen run. `config_monthend_v4.json` giữ config lịch sử; bộ v4 vẫn ở các thư mục `final` gốc.

## Dữ liệu, nhãn và đánh giá

- Generator rolling dùng lại lịch sử service/billing/support, thêm episode persistence và hazard theo trạng thái quan sát tại snapshot. Một sự kiện churn duy nhất/khách sinh ra tất cả nhãn chồng nhau. Không đọc nhãn churn public; audit probability/episode tuyệt đối không vào model/AI.
- `churn_next_month` giữ tên cột để tái dùng pipeline, nhưng nghĩa v5 là churn trong **một tháng lịch bắt đầu tại target_period_start**. Nhãn 0 chỉ khi đã quan sát hết kỳ; toàn bộ cửa sổ chưa đủ kỳ là Unknown. Khách đã churn bị loại khỏi snapshot/lịch sử service tiếp theo.
- 127 features tính đúng as-of. Cửa sổ 7/30/90 ngày giữ nguyên; `consecutive_issue_months` là trạng thái 30d hiện tại cộng streak tại các cuối tháng trước, không đếm số snapshot.
- Train development: các cửa sổ kết thúc không muộn hơn 01/07. Validation/calibration: kỳ bắt đầu 01/07, 11/07, 21/07, hai nhóm khách riêng. Test audit IDs: kỳ bắt đầu 01/09 và 11/09, hoàn tất trước 19/10. Các dòng giữa ranh giới bị purge/không dùng; calibration/audit IDs không vào fit/CV/selection.
- Optuna TPE 30 trials/họ × ba chronological folds, objective **mean ROC AUC**, early stopping Logloss; số vòng fit cuối là median best iterations. Inner folds purge theo ngày **kết thúc nhãn**, không chỉ ngày snapshot.
- Chọn **giữa hai bản tuned** theo validation ROC AUC; hòa thì log loss rồi tên candidate. Baseline vẫn được đo để đối chiếu, không đủ điều kiện làm winner. Selection khóa trước khi score test. Không đổi winner theo test.
- Calibration riêng từng bundle: 5-fold StratifiedGroupKFold giữ toàn bộ snapshot của một khách trong cùng fold. Chỉ áp Platt nếu OOF Brier và log loss cùng cải thiện; không dùng hệ số v4.
- `score=p*1000`, rule **>500**; inference có thể chứa nhiều snapshot của một khách, phải phân biệt số dòng và số khách. `predictions.csv` xuất cả target_period_end_exclusive.

## Artifacts và giới hạn tích hợp

Data/processed/model/inference mới nằm trong **`final/rolling_month_v5/`** của từng module; evidence tại `docs/evidence/ml/rolling_month_v5/`. Cấu hình `ml/config.json` trỏ v5. As-of 19/10/2026; các kỳ chưa hoàn tất không là nhãn train/test.

**SHAP/Supabase v5 đã hoàn tất:** `predict.py --explain` dùng native LightGBM `pred_contrib`, kiểm hash/mapping/additivity và phép biến đổi calibrator. `ml/shap_groups.json` là mapping v5; mapping v4 giữ riêng tại `shap_groups_monthend_v4.json` cho lịch sử/tests. Chạy `ml/presentation_figures.py` để tái xuất PNG/SVG cho slide ở `docs/evidence/ml/rolling_month_v5/figures/slides/`. Supabase dùng latest 10/10: 2.705 khách/207 cases; 5.533 inference rows vẫn giữ offline. SQL migration có ngày kết thúc kỳ; cutover/backup/evidence đọc `supabase_v5_cutover.json`. UI source đã sửa ngày kỳ/build local; Vercel chưa deploy, n8n giữ timer tắt/chưa gọi live. Không chạy lại `upgrade_lean.sql` trên workspace v5.

Mục tiêu demo người dùng xác nhận là AUC khoảng **0,89**. Đây là synthetic benchmark có DGP mới, không so sánh trực tiếp với AUC v4 hoặc gọi là accuracy FPT. Nếu điều chỉnh simulator sau khi xem test, mọi kết quả tiếp theo phải ghi test-informed/exploratory; không tìm seed để gọi kết quả là kiểm định độc lập.

## Tài liệu lịch sử v4 — không dùng làm contract v5

# Luồng ML hiện hành — 127 features

**Chỉ dùng bộ 127 features mới nhất**, đã khóa trong `config.json`. Cả LightGBM và CatBoost, baseline và tuned, đều nhận cùng 127 cột. Không quay lại bộ 22. Leader đã duyệt CatBoost tuned và 6 nhóm SHAP. Đã chạy SHAP trên batch October; hướng dẫn bên dưới.

## Đọc nhanh

1. `../docs/DATA_ML.md`: nguồn, cách sinh dữ liệu và giới hạn kết luận.
2. `config.json`: danh sách chính xác 127 features, seed, split và luật chọn model.
3. `../docs/evidence/ml/RESULTS.md`: kết quả đã đo để đọc và đưa vào báo cáo.
4. `../docs/evidence/ml/comparison.csv`: bảng so sánh bốn ứng viên; JSON cùng tên giữ chi tiết.
5. `models/final/champion/metadata.json`: model và tham số ở lần train. Trạng thái proposed trong artifact là lịch sử; leader đã duyệt CatBoost tuned, quyết định hiện hành ở DATA_ML/IMPLEMENTATION.

## File nằm ở đâu?

| Đường dẫn | Vai trò |
|---|---|
| `generation/` | Giữ nguyên code tạo sample/synthetic, config simulator và code tính feature theo thời điểm |
| `config.json`, `common.py` | Contract 127 biến, đường dẫn và kiểm tra input |
| `data.py` | Tách vai trò khách, snapshot và rolling folds; không random-split các dòng panel |
| `models_api.py` | Fit, raw margin, save/load native LightGBM và CatBoost |
| `tune.py` | Optuna TPE, 30 trials/model × 3 rolling folds |
| `train.py` | So sánh baseline/tuned, calibration, khóa model đề xuất, test và predict |
| `calibration.py` | Platt với calibration-only OOF, khách tách riêng |
| `evaluate.py` | AUC, AP, Brier, log loss, top-10% và threshold >500 |
| `predict.py` | Nạp bundle, dự báo batch không nhãn; --explain để xuất cả giải thích |
| `explain.py`, `shap_groups.json` | Native SHAP, 6 nhóm/127 biến, facts và bản nháp English cần nhân viên duyệt |
| `report.py` | Xuất ghi chú kết quả và hình English từ evidence |
| `tests/` | Kiểm tra mốc thời gian, thanh toán, 127 features và save/load |
| `../data/synthetic/final/` | Dataset frozen: lịch sử, snapshot, nhãn riêng và `features_127.csv` |
| `../data/processed/final/` | Matrix và split chuẩn; `evaluation/` chỉ phục vụ đánh giá offline |
| `../data/inference/final/` | Input không nhãn và prediction October để tích hợp app |
| `models/final/` | Bốn bundle, bản champion đề xuất và SQLite Optuna trong `search/` |
| `../docs/evidence/ml/` | Hash, metrics, trial CSV, selection, QA và hình báo cáo |

`customer_features.csv` trong dữ liệu sinh là bảng nền để tính tiếp các cửa sổ. **Input model là `features_127.csv`, không phải bảng nền.** Các cột ID/kỳ/trạng thái ở ngoài danh sách 127 không được đưa vào learner.

## Chạy lại

Chạy từ root repo. Môi trường local hiện có là `ml/.venv-lgbm`; cài mới dùng Python tương thích và `pip install -r ml/requirements.txt`. Các package đã dùng được ghi trong comparison JSON. Dữ liệu/model local không commit mặc định; cần nguồn và license hợp lệ khi chia sẻ.

```powershell
& ml/.venv-lgbm/Scripts/python.exe -m unittest discover -s ml/tests -v
& ml/.venv-lgbm/Scripts/python.exe ml/train.py
& ml/.venv-lgbm/Scripts/python.exe ml/report.py
```

`train.py` chạy tuning cả hai họ, sau đó fit bốn ứng viên và predict. SQLite cho phép tiếp tục trial đã hoàn tất của cùng protocol; không đảm bảo lịch sử TPE resume giống hệt một lần chạy liên tục. Nếu tuning đã xong và comparison chưa tồn tại, dùng `ml/train.py --skip-tuning`. Pipeline từ chối ghi đè comparison đã chốt. Muốn làm thí nghiệm mới, tạo config/protocol và output directory mới; không sửa đè frozen dataset hay dùng test để chọn tham số.

Chỉ chạy lại inference, không train:

```powershell
& ml/.venv-lgbm/Scripts/python.exe ml/predict.py
```

Để sinh lại dữ liệu vào thư mục mới (thao tác này không cần cho batch đã có):

```powershell
& ml/.venv-lgbm/Scripts/python.exe ml/generation/generate_data.py --source data/raw/telecom_customer_churn.csv --output tmp/rebuild-final --quality-output tmp/rebuild-quality.json
& ml/.venv-lgbm/Scripts/python.exe ml/generation/build_window_features.py --data tmp/rebuild-final --output tmp/rebuild-final/features_127.csv
```

Generator từ chối overwrite. `generation/generate_sample.py` được giữ để tái lập sample và cung cấp helper cho generator hiện hành; không xóa. `generation/requirements.txt` lưu môi trường của generator ban đầu. `config.json` cấp root là config train; `generation/simulator.json` là config sinh dữ liệu, không nhầm hai file.

## Cách đọc quy trình

- Snapshot cuối tháng t chỉ dùng sự kiện biết tại thời điểm đó để dự báo churn tháng t+1. Test đúng một tháng; không dùng RandomSearchCV mặc định trộn các dòng panel.
- Hash khách development trước tuning: khoảng 20% dành riêng calibration; audit IDs dành test. Những khách này không vào fit/tuning/validation của lượt hiện tại.
- Ba fold tuning có snapshot validation April, May, June; fit ở các tháng trước đó. Early stopping theo log loss bên trong fold; Optuna tối đa hóa mean average precision (AP). Số vòng fit cuối là median best iterations của ba fold.
- Fit cuối dùng Jan–Jun snapshot; validation July→August chọn giữa bốn ứng viên. AP cách best không quá 0,005, xét log loss với tolerance 0,001 rồi thời gian predict. Luật khóa trước test.
- Calibration dùng khách riêng tại snapshot July→August: 5-fold OOF chỉ fit calibrator. Chỉ nhận map nếu cả Brier và log loss OOF giảm, sau đó fit map trên toàn tập calibration. Đây không phải 5-fold CV của cả mô hình nền.
- Snapshot August→September là test exploratory vì đã được xem trong các phiên cũ. Không dùng để tune/chọn/calibrate. Snapshot September→October là inference, Unknown tại 17/10/2026.
- `score = probability × 1000`; cảnh báo là **>500**, không phải ≥500. Calibration điều chỉnh xác suất, không tạo thêm khả năng xếp hạng cho một map tăng đơn điệu.

## Giới hạn và bước sau

Dữ liệu là simulator có tín hiệu mạnh được thiết kế chủ động, không phải dữ liệu vận hành FPT. Không dùng điểm test để khẳng định hiệu quả giữ chân hoặc độ chính xác production. Bộ test hiện tại không còn là kiểm định xác nhận độc lập. Muốn kết luận tổng quát cần tập mới chưa từng dùng và kiểm định thực tế.

Leader đã duyệt model/tham số và 6 nhóm. Chạy lại từ root:

```powershell
& ml/.venv-lgbm/Scripts/python.exe ml/predict.py --explain
& ml/.venv-lgbm/Scripts/python.exe -m unittest discover -s ml/tests -p test_explain.py -v
```

Hoặc chạy `ml/explain.py` với input/bundle mặc định để xuất lại SHAP. Code không fit lại model. Các lệnh này ghi lại outputs explanation cùng batch; không đổi xác suất. `predict.py` không có --explain chỉ score nên trạng thái cho lần gọi đó là chưa tạo SHAP; dùng --explain cho batch tích hợp.

Config explicit `shap_groups.json` gắn SHA-256 model đã duyệt; đủ 127 feature, mỗi feature một nhóm. Đổi model hoặc mapping phải review lại. Không sửa `ml/config.json` để bật shap_enabled: cờ false ở đó là protocol lịch sử của lần train/model selection, còn SHAP là bước sau đã được duyệt riêng.

Output `data/inference/final/explanations/`: raw feature SHAP CSV, group SHAP CSV, care_context.jsonl, predictions.csv, group_importance.csv và manifest.json. Mỗi care context có top tối đa 3 nhóm tổng dương, facts không lặp họ feature, evidence status, English draft/action và requires_staff_review=true. Nhóm không có bằng chứng hiện tại không được biến thành nguyên nhân đã xác nhận; Prepaid không bị nhắc nợ từ biến Postpaid null. SHAP không là phần trăm xác suất.

`docs/evidence/ml/shap_summary.json` có checks; `shap_example.json` có một ví dụ synthetic đã ẩn ID; hình `figures/shap_group_importance.png` phục vụ báo cáo. Bản nháp do Python xuất dùng template, không gọi LLM hoặc gửi tin. Cập nhật tích hợp 18/10: context đã import Supabase, UI hiển thị nhóm/facts và n8n tạo LLM output riêng sau staff Request; có evidence approval→mock send→reply. Xem `../docs/IMPLEMENTATION.md` và `../docs/evidence/n8n_agents.json`. Không tự gửi nhãn/audit cho AI, không gửi điểm churn/SHAP nội bộ cho khách.
