# Tính năng phân bổ case cho CC (Supervisor)

Cập nhật: 21/10/2026 · Trạng thái: **chờ leader duyệt**, chưa triển khai code.

## 1. Mục tiêu

Supervisor (trưởng/phó phòng DVKH) đang phải gán từng case cho CC (customer care). Với batch có hàng trăm case vượt ngưỡng rủi ro, việc này chậm và dễ dồn việc cho một vài người. Tính năng này giúp Supervisor:

- Chia nhanh toàn bộ case chưa gán chỉ bằng vài lựa chọn.
- Ưu tiên khách có rủi ro churn cao được giao trước.
- Không làm quá tải CC nào.
- Giao khách cho người phù hợp: CC đã từng chăm sóc khách đó, hoặc có kinh nghiệm với nhóm rủi ro tương tự.
- Luôn xem trước và xác nhận trước khi giao. Hệ thống không tự gán khi chưa được duyệt.

## 2. Ba cơ chế phân bổ

| # | Cơ chế | Khi nào dùng |
|---|---|---|
| 1 | **Manual:** Supervisor mở case và chọn CC | Xử lý ngoại lệ, đổi người phụ trách |
| 2 | **Auto-assign · Round-robin:** chia lần lượt | Muốn chia đều, đơn giản |
| 3 | **Auto-assign · Weighted:** chia theo trọng số | Muốn giao đúng người, cân tải |

### 2.1 Quy tắc chung cho cơ chế 2 và 3

- **Case được chia:** các case chưa gán, chưa đóng, thuộc kỳ dự báo Supervisor đang chọn.
- **CC tham gia:** Supervisor tick chọn. Mặc định là toàn bộ Agent đang active.
- **Thứ tự xử lý case:** điểm rủi ro từ mô hình (churn probability) giảm dần. Nếu bằng nhau thì case chờ lâu hơn được chia trước.
- **Hạn mức của mỗi CC** (tính theo giờ Việt Nam):
  - Tối đa **20 case giao mới mỗi ngày**. Lượt gán tay cũng được tính vào con số này.
  - Tối đa **40 case đang mở** cùng lúc (*đề xuất, cần leader chốt*).
  - Số case còn nhận được = min(20 − số đã giao hôm nay, 40 − số case đang mở).
- Khi mọi CC đều hết hạn mức, các case còn lại giữ trạng thái Unassigned và được báo rõ trong kết quả.

### 2.2 Cơ chế 1: Manual

Giữ chức năng gán tay hiện có. Bổ sung hiển thị hạn mức cạnh tên từng CC, ví dụ "8/20 today · 25/40 open". Supervisor vẫn được gán vượt hạn mức, nhưng hệ thống hiện cảnh báo.

### 2.3 Cơ chế 2: Round-robin

Giao lần lượt A → B → C → A… theo danh sách CC đã chọn và bỏ qua CC đã hết hạn mức. Lần chạy sau bắt đầu từ CC kế tiếp sau CC cuối cùng của lần trước, để không ai luôn bị xếp đầu.

### 2.4 Cơ chế 3: Weighted (2 lớp)

**Lớp 1 — ràng buộc cứng:** loại CC không active hoặc đã hết hạn mức (mục 2.1).

**Lớp 2 — chấm điểm:** mỗi cặp (case, CC) được tính điểm. Case giao cho CC có điểm cao nhất.

```
score = (w_continuity × Continuity + w_skill × Skill + w_load × Load) / 100
```

| Yếu tố | Ý nghĩa | Cách tính (0–1) | Trọng số gợi ý |
|---|---|---|---|
| **Continuity** | CC đã từng chăm sóc khách này | 1 nếu CC từng phụ trách khách ở kỳ trước, ngược lại 0 | **40%** |
| **Skill** | CC có kinh nghiệm với nhóm rủi ro chính của khách | Số case CC đã xử lý có cùng **nhóm SHAP lớn nhất (top-1)** với case này, chia cho số lớn nhất trong các CC đủ điều kiện | **30%** |
| **Load** | CC còn trống việc | 1 − (số case đang mở / 40), cập nhật sau mỗi lượt giao | **30%** |

- Supervisor được sửa trọng số trước khi chạy, tổng phải bằng 100%. Có nút "Reset to suggested".
- Nếu bằng điểm thì giao cho CC ít case đang mở hơn.
- 6 nhóm SHAP: Connection quality, Support experience, Payment overdue, Usage engagement, Renewal & promotion, Plan pricing & relationship.
- Lưu ý: SHAP là tín hiệu mô hình (risk driver), **không phải nguyên nhân churn đã xác nhận**.

**Ví dụ:** case có nhóm rủi ro chính là *Connection quality*. Trọng số 40/30/30.

| CC | Từng chăm sóc khách? | Case cùng nhóm đã xử lý | Case đang mở | Điểm (thang 100) |
|---|---|---|---|---|
| A | Có → 1 | 2 (max 4) → 0,5 | 30/40 → 0,25 | 40 + 15 + 7,5 = **62,5** |
| B | Không → 0 | 4 → 1 | 10/40 → 0,75 | 0 + 30 + 22,5 = **52,5** |
| C | — | — | Hết hạn mức ngày | **Bị loại ở lớp 1** |

→ Giao cho **A**. Lý do hiển thị: *"Cared for this customer before · 2 past Connection quality cases · 30/40 open"*.

## 3. Luồng thao tác trên UI

1. Màn hình **Customer Care Queue** → nút **Auto-assign**. Chỉ Supervisor thấy nút này.
2. Trong modal, Supervisor:
   - chọn kỳ dự báo;
   - tick các CC tham gia (mỗi CC hiện hạn mức còn lại);
   - chọn **Round-robin** hoặc **Weighted**;
   - nếu chọn Weighted thì sửa 3 trọng số nếu muốn.
3. Bấm **Preview**. Hệ thống hiện:
   - bảng đề xuất: khách, risk, CC được đề xuất, điểm, lý do; đổi được CC từng dòng;
   - tóm tắt số case mỗi CC nhận;
   - danh sách case không chia được.
4. Bấm **Confirm**. Hệ thống:
   - kiểm tra lại từng dòng; dòng không còn hợp lệ (ví dụ case vừa được người khác gán) bị bỏ qua và báo lại;
   - ghi lịch sử phân bổ;
   - gửi **một thông báo gộp** cho mỗi CC: "You have N new cases".

Toàn bộ UI bằng tiếng Anh. Preview không ghi dữ liệu, nên Supervisor có thể thử nhiều cấu hình.

## 4. Dữ liệu demo

Dữ liệu hiện chỉ có một kỳ dự báo, nên Continuity và Skill gần như luôn bằng 0. Để demo thấy được tác dụng của cơ chế 3:

- Seed **lịch sử chăm sóc kỳ trước mô phỏng** vào một bảng riêng, gắn nhãn `is_simulated`, phủ đủ 6 nhóm SHAP.
- Không tạo prediction, case hay outcome giả, và không dùng làm feature cho mô hình.
- UI ghi rõ "Based on simulated history" khi điểm dựa trên dữ liệu này.
- Cần thêm **3–4 tài khoản Agent demo** để thấy rõ việc chia việc giữa nhiều người.

## 5. Triển khai kỹ thuật (tóm tắt)

Thuật toán là SQL xác định, chạy trong Supabase. **Không dùng n8n, không gọi LLM**, nên không tốn quota execution.

| Hạng mục | Nội dung |
|---|---|
| Cấu hình | Thêm vào `workspace_settings`: hạn mức ngày (20), hạn mức case mở (40), trọng số mặc định (40/30/30) |
| Bảng mới | `staff_care_history` (lịch sử chăm sóc, có cờ mô phỏng); `assignment_runs` (lưu mỗi lần chia: cơ chế, trọng số, người chạy, kết quả) |
| RPC | `retention_agent_capacity` (hạn mức từng CC); `retention_preview_assignment` (xem trước, không ghi); `retention_confirm_assignment` (xác nhận, khóa dữ liệu, chống chạy trùng) |
| Phân quyền | Chỉ Supervisor được chạy. Agent gọi sẽ bị từ chối. Browser không ghi trực tiếp vào bảng |
| Truy vết | Mỗi lượt giao ghi event `case.assigned` kèm run, điểm và lý do |
| UI | Nút và modal Auto-assign ở Queue; cảnh báo vượt hạn mức khi gán tay ở trang chi tiết |

**Tiêu chí nghiệm thu:**
- Hạn mức ngày và hạn mức case mở được tôn trọng; lượt gán tay được tính vào hạn mức.
- Round-robin xoay vòng đúng qua hai lần chạy.
- Từ chối trọng số có tổng khác 100.
- Thứ tự theo risk đúng.
- Điểm Continuity, Skill, Load và cách xử lý bằng điểm đúng như ví dụ.
- Confirm bỏ qua dòng không còn hợp lệ, không ghi đè case đã có người.
- Agent không chạy được tính năng.
- Bấm Confirm hai lần không giao trùng.
- Toàn bộ test hồi quy hiện có vẫn đạt.

## 6. Cần leader xác nhận

1. Trọng số gợi ý **Continuity 40 / Skill 30 / Load 30**.
2. Hạn mức **40 case đang mở** mỗi CC (20 case giao mới/ngày đã chốt).
3. Dùng **lịch sử chăm sóc mô phỏng** cho demo, có gắn nhãn.
4. Tạo thêm **3–4 tài khoản Agent demo**.

## 7. Ngoài phạm vi đợt này

- Dashboard hiệu suất CC.
- Phân bổ dựa trên performance hoặc tỷ lệ giữ chân của CC.
- Tự động cân bằng lại case giữa các CC.
- Tự động gán không qua bước xác nhận.
- Quản lý ca làm việc.
