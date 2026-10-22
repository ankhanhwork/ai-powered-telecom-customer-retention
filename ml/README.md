# Pipeline ML

Chạy từ root repo bằng Python 3.13 và các dependency trong `ml/requirements.txt`. Môi trường local đang có: `ml/.venv-lgbm/Scripts/python.exe`.

## Luồng và nơi lưu

| Công đoạn | Code | Kết quả |
|---|---|---|
| Sinh dữ liệu | `data/synthetic/generation/` | `data/synthetic/dataset/` |
| Preprocess | `ml/preprocess/` | `data/output/preprocess/` |
| Train / finetune | `ml/train_finetune/` | `data/output/train_finetune/` |
| Predict | `ml/predict/` | `data/output/predict/` |
| SHAP | `ml/shap/` | `data/output/shap/` |

`ml/config.json` quy định 127 features, split, calibration, selection và toàn bộ đường dẫn. Các module dùng imports từ root repo và chạy bằng `python -m`; không gọi file Python đã chuyển chỗ bằng đường dẫn cũ.

## Dự báo và SHAP

```powershell
# Kiểm tra inference mà không ghi đè output tích hợp.
python -m ml.predict.predict --output tmp/predictions.csv
# Dự báo và SHAP bằng model đã chọn; không train, không gọi LLM.
python -m ml.predict.predict --explain --output tmp/check/predictions.csv
python -m unittest discover -s ml/tests -v
```

Chạy không có `--output` sẽ dùng vị trí canonical trong config. Với `--explain`, output mặc định tách prediction và SHAP; output tùy chọn đặt SHAP cạnh file prediction trong thư mục `explanations/`. Mapping `ml/shap/shap_groups.json` gắn đúng hash model được duyệt. Model chính nằm ở `data/output/train_finetune/models/champion/`; ba bundle còn lại là ứng viên đối chiếu của cùng lần train.

## Tạo dữ liệu khi cần tái lập

CSV gốc đặt vào `data/original/telecom_customer_churn.csv` và `telecom_data_dictionary.csv`. Chưa xác nhận URL/license nên repo không phân phối CSV nguồn. Generator chỉ đọc ID, tenure và Internet Service; không dùng nhãn churn Kaggle.

```powershell
python -m data.synthetic.generation.generate_data --source data/original/telecom_customer_churn.csv --output tmp/rebuild/dataset --quality-output tmp/rebuild/generation_quality.json
python -m ml.preprocess.build_window_features --data tmp/rebuild/dataset --output tmp/rebuild/dataset/features_127.csv
```

Generator giữ seed/config hiện hành và từ chối ghi đè dataset. `common.py` chứa các helper mà generator và feature builder dùng; cần giữ code này. Không sinh lại bộ hiện hành chỉ để kiểm việc di chuyển thư mục.

## Train và báo cáo

```powershell
python -m ml.preprocess.data
python -m ml.train_finetune.train
python -m ml.train_finetune.report
python -m ml.shap.presentation_figures
```

Các lệnh preprocess/train phục vụ tái lập khi thực sự cần; train từ chối ghi đè comparison đã chốt. Nếu trials đã hoàn thành nhưng comparison chưa có, dùng `--skip-tuning`. Không train/sinh lại full cohort trong lần dọn repo này.

LightGBM tuned được chọn bằng validation AUC 0,9483; test exploratory AUC 0,9467. Cả hai họ có 30 Optuna trials và cùng 127 features. Chi tiết split/purge/calibration ở [DATA_ML](../docs/DATA_ML.md); bảng kết quả tại [RESULTS](../data/output/train_finetune/results/RESULTS.md).

Các manifest giữ hash của lần sinh/train gốc; hash config/code gốc không được sửa thành hash mới để giả vờ chúng chưa thay đổi. Bằng chứng di chuyển và kiểm tra hiện tại nằm ở `docs/evidence/repository_cleanup.json`. Định danh dataset/protocol trong nội dung giữ nguyên để khớp database; đường dẫn không có số phiên bản.
