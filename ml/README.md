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
