# Dữ liệu gốc

Đặt hai CSV nguồn vào đây khi cần tạo lại dữ liệu:

- `telecom_customer_churn.csv`: 7.043 khách, 38 cột.
- `telecom_data_dictionary.csv`: mô tả các trường.

Nguồn được người dùng cung cấp từ Kaggle, mô tả khách hàng fictional tại California; không phải FPT. Repo chưa có URL/license đã xác nhận nên không phân phối lại CSV nguồn. Chỉ có file local, không giả định người clone đã có data. Cần bổ sung nguồn/license trước khi chia sẻ bản gốc.

Generator tại `../synthetic/generation/` chỉ đọc Customer ID, Tenure in Months và Internet Service; không dùng nhãn churn public. Xem `../../ml/README.md` để tái lập.
