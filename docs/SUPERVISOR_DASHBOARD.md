# Supervisor Dashboard — đặc tả chức năng và dữ liệu

Ngày: **21/10/2026**. Trạng thái: **Đã tích hợp cloud, đang phát hành web; chưa nghiệm thu browser**. Đây là tài liệu làm việc tiếng Việt; toàn bộ nội dung trong sản phẩm dùng English. Yêu cầu mới bổ sung một tab Dashboard cho Supervisor, mở rộng baseline trước đây gộp tổng quan vào Queue.

Delta triển khai 21/10: Dashboard dùng React/CSS trong app hiện có, không thêm dependency. Có live workspace reads dưới RLS và DEV-only local preview `http://127.0.0.1:5173/?preview=dashboard`; 507 case/4 nhân viên mô phỏng, 272 known outcomes khớp labels v5. Historical sample không phải tập cảnh báo lọc >500. Fixture chỉ nằm local, không sửa training/cloud hoặc tạo outbound. Đã kiểm 21 tests/build/HTTP200 và reconciliation; chưa screenshot/click do browser tool chặn URL authority. Chưa có endpoint aggregate server, SHAP strategy chart, lịch sử closure đầy đủ hoặc cloud seed; các mục tương ứng phía dưới vẫn là contract cho bước tiếp theo. Chi tiết và cách tiếp tục ở Implementation.

### Delta cloud 21/10

Đã có API Supervisor dưới RLS và seed cloud: 507 case, 4 Agents +1 Supervisor, 272 outcome đủ kỳ; October Unknown. Không thêm bảng, không train lại hoặc sửa model. Seed/rollback được kiểm local; login/API live và detail lịch sử đạt. Chi tiết cập nhật mới nhất ở Implementation và evidence/supervisor_dashboard.json; các ghi chú “chưa cloud/chưa API” phía dưới là trạng thái lịch sử trước cutover này.

### Delta UI 21/10 — tên nhân viên, copy và nhóm vấn đề

Theo yêu cầu leader, bỏ các banner/note synthetic/simulated khỏi giao diện sản phẩm; provenance vẫn giữ trong docs và dữ liệu. Staff dùng tên tiếng Việt, các label UI vẫn English. Bổ sung **Primary care issues · Contracts & churn**: grouped horizontal bars cùng thang đếm hợp đồng và churn, có known/coverage/rate và drill-down. Chọn kỳ mature gần nhất cho mỗi customer trong scope; nếu scope chưa mature thì đếm hợp đồng nhưng churn unavailable. Local fixture phân bổ 6 primary care issues deterministic độc lập outcome để minh họa, không sử dụng generation audit hoặc coi group là nguyên nhân churn xác nhận. Live đọc primary category từ ticket submitted gần nhất, thiếu ghi Unclassified. Activity date filter không đổi outcome window. Không cần thêm bảng.

## 1. Mục tiêu và quyết định cần hỗ trợ

Supervisor cần trả lời ba câu hỏi theo thứ tự:

1. **Hôm nay cần điều phối việc gì?** Case chưa phân công, hồ sơ chưa được tiếp cận, follow-up quá hạn, tin gửi lỗi và bàn giao hỗ trợ đang chờ.
2. **Đội đang xử lý công việc thế nào?** Tải còn mở của từng nhân viên, số case có hoạt động, số khách phản hồi, số hồ sơ hoàn tất và điểm nghẽn.
3. **Kết quả theo thời gian ra sao, nên đổi chiến lược gì?** Outcome đủ kỳ, churn theo thời gian, nhóm tín hiệu rủi ro và nhóm vấn đề được xác nhận trong chat/ticket.

Ba KPI chính đề xuất: **Open cases**, **Overdue follow-ups**, **Active at period end rate**. Hai KPI đầu phục vụ vận hành hằng ngày; KPI thứ ba phục vụ đánh giá cohort đã đủ kỳ. Các số còn lại giúp giải thích và chọn hành động, không biến tất cả thành mục tiêu thi đua.

Dashboard phải đưa được người quản lý đến danh sách case tương ứng. Không chấm điểm nhân viên chỉ bằng số tin gửi hoặc tỷ lệ active; không coi việc khách tiếp tục dùng dịch vụ là bằng chứng can thiệp gây ra kết quả đó. Chưa đặt chỉ tiêu cứng khi chưa có baseline vận hành.

## 2. Dữ liệu đã đọc và hiện trạng thực tế

### 2.1. Nguồn và mức độ xác minh

Đã đối chiếu README, Implementation, Problem, System, brief UI; đọc schema/migrations Supabase, Queue.jsx và contract ML v5; đọc header/manifest dữ liệu synthetic và tổng hợp trực tiếp `churn_labels.csv`. Đã chạy **hai truy vấn SELECT tổng hợp** trên Supabase; không đọc nội dung chat hoặc thông tin định danh cá nhân vào tài liệu này. Không chạy n8n, không sửa cloud.

Snapshot Supabase lúc **17:34 ngày 21/10/2026, Asia/Ho_Chi_Minh** (10:34 UTC). Đây là số liệu kiểm tra tại thời điểm viết, không phải số cố định để hardcode vào dashboard:

| Dữ liệu | Kết quả đọc được | Hệ quả thiết kế |
|---|---:|---|
| Customers / predictions / contexts | 2.705 / 2.705 / 2.705 | Toàn bộ customers hiện có là synthetic; không đại diện 210.000 thuê bao Bình Dương |
| Retention cases | 207 | Cohort ưu tiên từ ngưỡng score >500; không phải toàn bộ thuê bao |
| Cửa sổ outcome hiện hành | [11/10/2026, 11/11/2026) | Ngày cuối được tính là 10/11; ngày 21/10 chưa đủ kỳ |
| Case stages | 206 new; 1 in_progress | Chart hiện tại sẽ tập trung gần hết ở New predictions |
| Case assigned / unassigned | 3 / 204 | Phần chưa phân công là tín hiệu điều hành rõ nhất |
| Case có due_at / closed_at | 1 / 0 | Chưa có độ phủ deadline để đo SLA cho toàn đội |
| Staff active | 1 Agent; 1 Supervisor | Hiện chưa có dữ liệu so sánh nhiều Agent; giữ hàng Supervisor nếu có tham gia xử lý |
| Messages | 4 outbound not_queued; 1 inbound received | Chưa có outbound sent trong snapshot này; draft không tính là liên hệ |
| Follow-up tasks | 1 cancelled | Không có pending/due tại thời điểm kiểm tra; không suy ra đội luôn xử lý đúng hạn |
| Support requests | 1 draft; 1 sent | Sent chỉ là bàn giao mock, không chứng minh xử lý kỹ thuật xong |
| Outcomes / intervention costs | 0 / 0 | Chưa có tỷ lệ outcome hoặc chi phí thực đo |
| Interaction events | 17 | Lịch sử thử demo ngắn, chưa phải baseline năng suất |

Không dùng các số 60 nhân sự, 15 khách/ngày, 8.000 cảnh báo, 2.500 churn tháng 9 trong Problem làm giá trị vận hành của app. Đây là thông tin nội bộ/bối cảnh có phạm vi riêng; không khớp tự động với cohort synthetic.

### 2.2. Dữ liệu nào có thể phục vụ từng phần?

| Nguồn hiện có | Grain và trường chính | Tính được | Giới hạn |
|---|---|---|---|
| `retention_cases`, `retention_care_queue` | Một case; customer/prediction, assigned_agent_id, case_status, priority, created_at, closed_at, due_at, target_period_start/end | Tải hiện tại, phân công, cơ cấu care stage, tuổi case, số hiện đang đóng | Current state không phải lịch sử backlog; closed_at mất khi mở lại |
| `staff_members` | Một staff; role, active, region | Danh sách người phụ trách và trạng thái tài khoản | Chưa có ca làm, nghỉ phép, giờ dành cho retention |
| `messages`, `delivery_outbox`, `message_approvals` | Message/revision, receipt giao, người duyệt, thời gian | Tin đã gửi, case có outreach, phản hồi inbound, lỗi giao, người duyệt tin đã giao | AI draft có thể không có sender là Agent; worker gửi không phải người thực hiện nghiệp vụ |
| `interaction_events` | Một sự kiện; event_type, actor_user_id, occurred_at, metadata | Hoạt động theo thời gian, một phần lịch sử phân công/cập nhật | Không phải mọi sự kiện là công việc có giá trị; chưa có đầy đủ before/after cho mọi thay đổi |
| `follow_up_tasks` | Một task; case, due_at, status, assigned_agent_id, completed_at | Quá hạn hiện tại, hoàn thành task | Reassignment có thể đổi assignee; chưa có completed_by |
| `support_requests` | Một yêu cầu; requested_by, category, department, handoff_status, sent_at, flags/evidence | Draft/queued/sent/failed, nhóm vấn đề được ghi nhận trong ticket | Chưa có phản hồi resolved từ phần mềm kỹ thuật; một case có nhiều ticket |
| `retention_outcomes` | Một case + evaluation window; churned nullable, observed_at, source, evidence_ref, is_simulated | Outcome đủ kỳ và độ phủ dữ liệu | Hiện rỗng; observed_at là ngày xác minh, không phải ngày churn |
| `intervention_costs` | Một chi phí can thiệp; amount, currency, type, recorded_at | Chi phí đã ghi theo currency | Hiện rỗng; không đủ để tính ROI hoặc lợi nhuận giữ lại |
| `churn_predictions`, `prediction_contexts` | Một customer/snapshot/run; probability, period, context/SHAP | Cơ cấu rủi ro và nhóm tín hiệu model | SHAP không phải nguyên nhân được xác nhận; tránh nhân đôi khách qua các snapshot |
| `contact_preferences`, `conversations` | Quyền liên hệ và hội thoại | Opt-out, consent và channel phù hợp | Không coi thiếu consent là nhân viên bỏ sót khách |
| CSV v5 trong `data/synthetic/final/rolling_month_v5/` | Lịch sử synthetic service/billing/support và nhãn theo snapshot | Bối cảnh churn mô phỏng, xu hướng dịch vụ ngoài app | Không phải lịch sử thao tác nhân viên; không nhập labels vào AI context |

`contact_result='contacted'` hiện được gán cả khi mock delivery thành công. Vì vậy **không dùng contacted làm số khách đã phản hồi hoặc số lần gọi thành công**. `ai_recommendations.used_at` chỉ xác nhận staff đánh dấu dùng script, không chứng minh đã gọi điện.

### 2.3. Lịch sử churn synthetic đã kiểm

Đọc `churn_labels.csv`: **113.937 dòng, 5.517 customer, 28 kỳ bắt đầu**, gồm 105.521 nhãn `Simulated complete rolling month` và 8.416 `Unknown`. Có **2.812 sự kiện churn duy nhất theo customer** từ trường churn_date. Một sự kiện xuất hiện ở nhiều cửa sổ dự báo, nên không cộng số nhãn 1 qua các snapshot.

| Tháng 2026 | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct* |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Unique synthetic churn events | 40 | 281 | 544 | 414 | 286 | 344 | 317 | 214 | 249 | 123 |

*October là kỳ chưa trọn tháng; dataset frozen có as_of **19/10**, không tự mở rộng đến ngày viết 21/10. Đây là population mô phỏng 5.517 khách ban đầu, khác population latest 2.705 còn trong inference. Có thể dùng ở phần **Historical context · Synthetic**, không đưa thành kết quả của 207 case hiện hành; không so October lũy kế với September đủ tháng rồi kết luận churn giảm. Chưa triển khai bảng dữ liệu/API cho chart này. Không dùng `generation_audit_private.csv`, latent episode hoặc xác suất sinh để giải thích cho người dùng.

## 3. Vị trí, bố cục và tương tác

### 3.1. Tab và quyền truy cập

- Thêm **Dashboard** cạnh **Customer Care Queue** cho Supervisor. Mặc định giữ trang Queue hiện hành; supervisor chủ động mở Dashboard. Agent và Customer portal không có tab này.
- Trang chỉ đọc; click card, bar hoặc hàng bảng mở Queue/Case detail với đúng bộ lọc. Phân công thực hiện bằng chức năng Case owner hiện có, không tạo một luồng phân công thứ hai trong đặc tả này.
- Title **Supervisor Dashboard**; subtitle **Workload, care progress and observed outcomes**. Theo delta 21/10, không đặt badge synthetic/mock trên sản phẩm; nguồn và giới hạn vẫn ghi trong tài liệu nội bộ.
- Phân quyền được kiểm ở API/database; ẩn tab không đủ. Supervisor theo scope hiện hành, Agent/Portal không đọc được aggregate toàn đội qua endpoint trực tiếp.

### 3.2. Wireframe nội dung desktop

```text
Supervisor Dashboard                         Data refreshed at ...   Refresh
Synthetic demo data · Mock transport
[Activity dates] [Prediction cohort/window] [Case owner] [More filters]

CURRENT WORKLOAD · As of ...
[Open cases] [Unassigned open cases] [Overdue follow-ups]
[Care completed in period] [Active at period end rate + observed n / eligible n]

[Care pipeline — horizontal bars]   [Case activity — daily/weekly columns]

[Team workload and activity — table, sort and open matching cases]

OUTCOMES · Selected prediction window
[Outcome distribution + coverage]  [Observed outcomes by cohort]

STRATEGY AND FOLLOW-UP
[Top risk signals / Ticket categories] [Needs attention — actionable list]
[Historical churn context · Synthetic — secondary, when data is connected]
```

Một trang cuộn dọc; không tạo các trang quản trị con. Desktop 2 cột chart; bảng nhân viên toàn chiều ngang. Mobile xếp một cột, bảng cho cuộn ngang có nhãn cột cố định. KPI dùng cùng typography/card của app; cam FPT cho emphasis, xanh cho active/complete, đỏ cho overdue/churn, xám cho unknown. Luôn có nhãn số hoặc pattern; không truyền đạt bằng màu đơn thuần. Mỗi chart có bảng số liệu thay thế, tooltip dùng được bằng keyboard và đơn vị rõ ràng.

### 3.3. Filters và ba cách hiểu thời gian

Không dùng một bộ lọc ngày để ngầm thay đổi mọi loại số liệu:

| Bộ lọc | Áp dụng | Quy tắc |
|---|---|---|
| **Activity dates**: Today, Last 7 days, Last 30 days, Custom | Số hoạt động, đóng case, gửi/nhận tin, hoàn thành task | Dựa trên thời gian sự kiện; default Last 7 days; ngày hiện tại đánh dấu Partial day |
| **Prediction cohort** | Chọn case/prediction và outcome window | Default latest cohort thực có dữ liệu, hiện [11 Oct, 11 Nov); không tạo batch 21/10 vì đến lịch |
| **Case owner** | Current workload; giới hạn case trong các khối cohort | All owners, từng staff, Unassigned; hiển thị rõ current owner |
| **Activity by** trong bảng năng suất | Nhân viên thực hiện hành động trong Activity dates | Dùng actor/reviewer/requested_by, không dùng current owner để nhận công cho lịch sử |
| More filters: Priority, care stage, billing mode/plan, region | Chi tiết điều tra | Chỉ hiển thị dimension có dữ liệu; region lấy khách hàng khi phân tích khách, không suy từ staff |

Current workload luôn ghi **As of now**, không bị Activity dates biến thành backlog quá khứ. Bảng nhân viên ghi riêng cột workload theo current owner và activity theo actor; bộ lọc current owner giới hạn tập case trước, sau đó activity vẫn được gán đúng actor. Các khối Outcome dùng cohort/window; active date filter chỉ tác động nơi có nhãn rõ. Channel chỉ lọc phần message/handoff thích hợp, không loại các case chưa có conversation khỏi Open cases.

Lưu filter khi mở case và quay lại. Tooltip và tiêu đề khối nhắc scope; nút **Reset filters**. Hai kỳ để so sánh phải cùng độ dài, cùng định nghĩa và cùng độ trưởng thành outcome; nếu không đủ dữ liệu thì ẩn delta, không hiển thị mũi tên giả.

## 4. Từ điển KPI và quy tắc tính

### 4.1. Ký hiệu và nguyên tắc chung

- `C`: tập case duy nhất thỏa cohort và bộ lọc case; `O`: các case trong C có case_status khác closed tại thời điểm đọc.
- `A`: khoảng Activity dates theo múi giờ Asia/Ho_Chi_Minh, chuẩn hóa thành [start, end) UTC để truy vấn.
- `E`: case trong C có target_period_end_exclusive đã qua tại thời điểm dữ liệu được xác minh. Mốc ngày tính theo giờ Việt Nam.
- `K`: case trong E có outcome churned khác null, có nguồn/evidence hợp lệ và khớp `window_start=target_period_start`, `window_end=target_period_end_exclusive−1 ngày`. RPC/queue v5 hiện lưu outcome.window_end là **ngày cuối bao gồm**, khác prediction.target_period_end_exclusive là cận trên không bao gồm.
- `R`: case trong K có churned=false; `H`: case trong K có churned=true. `U=E−K` là đủ kỳ nhưng thiếu outcome; `I=C−E` là chưa đủ kỳ.
- Các outcome simulated tách khỏi observed thật, không cộng chung. Không có outcome tương ứng vẫn là Unknown; không inner join khiến mất case chưa có outcome.
- Đếm case/customer/message/task theo đúng grain; aggregate từng bảng trước khi join. Không nhân số tin, chi phí hoặc case khi join nhiều bảng một-nhiều.
- Mẫu số 0 trả `null`, UI ghi **Not available**, không mặc định 0%. Mọi tỷ lệ hiển thị thêm tử/mẫu.

### 4.2. Thẻ và số đo vận hành

| English label | Định nghĩa/cách tính | Mục đích và lưu ý |
|---|---|---|
| **Open cases** | count distinct case_id trong O | Quy mô việc đang mở; không chỉ đếm in_progress |
| **Unassigned open cases** | Case trong O có assigned_agent_id null | Ưu tiên phân công; hiển thị cả n / Open cases |
| **Overdue follow-ups** | count task_id pending/due có due_at < now và case trong O | Badge phụ số case distinct; tính từ due_at ngay cả khi timer chưa đổi status thành due |
| **Care completed** | Case hiện closed, closed_at nằm trong A, reason care_completed hoặc mã chuẩn được chốt | Hoàn tất chăm sóc theo khai báo; khác tổng case closed. Nếu lý do còn free text/chưa chuẩn, dùng nhãn **Cases closed**, không suy success |
| **Cases worked** | Case distinct có ít nhất một hành động staff đủ điều kiện trong A | Hành động: cập nhật case thực sự đổi trạng thái/contact result, gửi tin đã duyệt và giao thành công, hoàn thành follow-up, submit ticket; loại AI generation, draft, refresh và assignment thuần túy |
| **Outbound reached cases** | Case distinct có external outbound delivery_status=sent với sent_at trong A | Chỉ chứng minh transport nhận giao; tên tooltip nói rõ mock receipt |
| **Customer reply rate** | Case có outbound đầu tiên trong A, đã nhận inbound sau lần gửi ấy trước data_as_of / tất cả case có outbound đầu tiên trong A | Tỷ lệ lũy kế từ lần outreach đầu, không phải mọi inbound/A. Ghi thời gian theo dõi chưa bằng nhau; không xếp hạng hoặc so kỳ khi cohort còn non |
| **Pending support handoffs** | Ticket queued; tách failed và draft | Draft chưa submit không phải việc kỹ thuật đang chờ xử lý |

`Cases worked` chỉ bật khi đã xác minh event coverage. Với dữ liệu hiện tại, ưu tiên các cột rõ nghĩa **Sent messages**, **Replied cases**, **Submitted tickets**; chưa gộp thành một điểm năng suất nếu thiếu completed_by/transition đầy đủ. Customer reply rate chỉ là reply qua chat, không bao gồm cuộc gọi chưa được ghi nhận.

### 4.3. Thành công/thất bại phải hiện thành hai lớp

**Lớp công việc:** Closed là đã kết thúc hồ sơ theo lý do. Có thể là hoàn tất, từ chối, không liên hệ được hoặc opt-out. Không gọi tất cả closed là thành công, cũng không gọi refused/no_answer là churn.

**Lớp kết quả dịch vụ:**

| English label | Công thức | Cách đọc |
|---|---|---|
| **Active at period end rate** | R / K ×100% | Trong các case đủ kỳ đã biết outcome, bao nhiêu khách vẫn dùng dịch vụ |
| **Observed churn rate** | H / K ×100% | Trong cùng mẫu đã biết outcome, bao nhiêu khách churn |
| **Outcome coverage** | K / E ×100% | Độ phủ xác minh; E=0 thì Not yet eligible |
| **Awaiting period end** | I | Chưa đủ kỳ |
| **Missing outcome** | U | Đã đủ kỳ nhưng chưa có outcome có nguồn |

R/K + H/K =100% khi K>0; không lấy R/C rồi gọi là tỷ lệ giữ chân. Hai tỷ lệ có thể lệch do outcome missing có chọn lọc; luôn đặt coverage sát cạnh. Không gọi H/K là churn rate toàn địa bàn hoặc “nhân viên chăm sóc thất bại”. Nếu muốn đánh giá riêng nhóm đã được chăm sóc, cung cấp segment **With recorded care activity** dựa trên activity trước window end; hiển thị mẫu số mới, vẫn không suy causal.

Tại snapshot hiện tại: E=0, K=0; thẻ hiển thị **Not yet eligible**, **207 awaiting period end**, không hiển thị success 100% hoặc failure 0%. Đóng hồ sơ hôm nay không thay đổi điều này.

Mâu thuẫn cần biết trước khi code: một đoạn System lịch sử cho phép ghi churn sớm, nhưng RPC v5 hiện hành chặn mọi known outcome trước khi hết kỳ. Đặc tả này theo **RPC v5 đang chạy**: chỉ thống kê outcome đã đủ kỳ. Churn sớm theo event phải có contract riêng, không lách RPC hay dùng close_reason thay outcome.

## 5. Các biểu đồ và bảng chi tiết

### 5.1. Care pipeline — ưu tiên điều phối

Horizontal bars: **New predictions**, **Outreach**, **Resolving request**, **Care completed**. Mapping giữ đúng app: new; in_progress/waiting_customer; resolving_request; closed. Chart là phân bố trạng thái hiện tại, **không phải funnel conversion** vì case có thể mở lại hoặc bỏ qua stage. Nhãn Care completed dùng mapping UI hiện hành nhưng tooltip phải ghi **Closed cases, all closure reasons**; số hoàn tất thành công chỉ dùng KPI có reason chuẩn.

Hover: số case, tỷ trọng trên C, unassigned; click mở Queue cùng cohort/stage. Sub-breakdown Outreach có Awaiting reply nếu dữ liệu cho phép. Không cộng overdue tasks như một stage vì có thể trùng case đang Outreach.

### 5.2. Case activity over time — nhịp xử lý

Grouped columns ngày/tuần cho **Cases created**, **Cases with sent messages**, **Cases with customer replies**, **Cases closed**. Mỗi series đếm distinct case trong từng bucket; một case có thể nằm ở nhiều series/ngày nên không stack thành tổng. Không gọi Cases with sent messages là “số khách giữ được”.

Created dùng created_at; sent dùng sent_at; reply dùng inbound created_at; closed dùng transition vào closed nếu event history đủ. Với schema hiện tại chỉ có closed_at, có thể bật series **Currently closed cases by close date**, kèm caveat mất lịch sử khi reopen. Không vẽ historical open backlog từ current state.

Ngày không có event được ghi 0 chỉ trong giai đoạn nguồn có coverage. Trước mốc bắt đầu tracking hiển thị **No history available**, không tô 0 cho cả quá khứ. Khi thêm đầy đủ state transitions mới có thể tính closed/reopened hoặc backlog theo thời điểm.

### 5.3. Team workload and activity — quản lý nhân sự

Bảng default sort Overdue cases giảm dần, sau đó Open cases. Có hàng **Unassigned** cho workload, hàng Supervisor nếu trực tiếp làm việc; staff inactive còn lịch sử vẫn xuất hiện khi Activity dates có hành động.

| Nhóm cột | Nội dung |
|---|---|
| Workload now | Staff, role, Open cases, New cases, Awaiting reply, Resolving request, Overdue cases, Oldest open case age |
| Activity in selected dates | Distinct cases with sent messages, Sent messages, Replied cases, Submitted tickets; Cases worked khi đủ instrumentation |
| Outcomes, mở rộng khi đủ kỳ | Active / known n, Churned / known n, coverage; không có bảng xếp hạng mặc định |

Message attribution dựa trên reviewer của đúng revision đã giao qua outbox/approval; không dựa vào actor của message.sent vì sự kiện do worker tạo và có thể null. Ticket theo requested_by tại submit nếu đã lưu chắc chắn; draft author không mặc nhiên là người submit. Reply của khách không phải hành động Agent: muốn chia Replied cases theo nhân viên thì gán cho người duyệt outreach trước reply gần nhất, ghi rõ **Replies following reviewed outreach**; không xác định được thì Unattributed. Outcome theo nhân viên chỉ bật sau khi khóa owner-at-intervention, không lấy current owner làm người chịu kết quả lịch sử.

Click workload mở case theo current owner; click activity mở các case nhân viên đã hành động trong kỳ, có thể khác owner hiện tại. Khi chỉ có một Agent, bảng vẫn có ích cho tải việc nhưng không gắn nhãn Best/Worst performer. Thiếu ca làm thì không tính cases/hour, utilization hay kết luận thiếu/thừa biên chế; 15 khách/ngày từ Problem không là KPI đo hiện hành.

### 5.4. Outcomes by prediction cohort — theo dõi kết quả

Hai view cùng một khối:

- Bar phân bố **Active at period end / Churned / Missing outcome / Awaiting period end**, tổng bằng C. Click mở case tương ứng.
- Theo cohort: mỗi hàng hiển thị start/end đầy đủ, Eligible cases, Known outcomes, Active rate, Churn rate, Coverage. Có thể dùng 100% stacked bar cho Active/Churned trong known sample và coverage bên cạnh; không che Unknown.

Supabase hiện chỉ giữ một cohort nên hiển thị một hàng; chưa có trend outcome vận hành. Các cửa sổ ngày 1/11/21 chồng nhau: không cộng các hàng để ra “tổng khách churn”. Case cập nhật prediction phải giữ lịch sử evaluation window nếu sau này muốn báo cáo cohort cũ. So cohort chỉ là repeated measurement có khách trùng, không phải các nhóm độc lập.

### 5.5. Churn over time — hai nguồn, hai ý nghĩa

**Trong phạm vi vận hành:** hiện chỉ có outcome theo cửa sổ; chart dùng nhãn **Observed churn by prediction window**, count case churned và mẫu số known, không gắn vào ngày observed_at như ngày churn. Chỉ bật khi đã có outcome đủ kỳ.

**Bối cảnh synthetic:** secondary chart **Historical churn events · Synthetic population**, columns theo tháng từ churn_date dedupe customer. Hiển thị population/source/cutoff khác app. October hatch/nhãn Partial month; không so MoM trực tiếp. V1 có thể để khối này ẩn cho tới khi có nguồn aggregate được kiểm và đưa qua API; CSV trên máy không tự là dữ liệu browser.

**Churn thực theo ngày/tháng toàn địa bàn:** cần event chấm dứt dịch vụ có effective date và dữ liệu thuê bao at risk đầu kỳ. Chỉ có số churn thì vẽ count; có denominator đúng phạm vi mới vẽ churn rate. Không lấy 207 case hoặc 2.705 latest predictions làm mẫu số cho churn toàn Bình Dương.

### 5.6. Strategy signals — chọn ưu tiên điều tra

Hai chế độ, tách rõ:

- **Top risk signals**: số khách distinct trong cohort có từng nhóm SHAP dương thuộc top≤3. Sáu nhóm theo mapping v5 đã duyệt. Một khách có thể xuất hiện ở nhiều bar, tỷ trọng có thể cộng >100%. Nhãn **Model signals, not confirmed causes**; không gọi SHAP là phần trăm xác suất hoặc nguyên nhân churn.
- **Ticket categories**: số ticket đã submit theo category; draft tách riêng. Có thêm distinct cases để tránh một khách nhiều ticket lấn át. Flags repeat_issue/churn_concern có evidence dùng để lọc, không coi AI flag là outcome confirmed.

Chọn bar mở danh sách kiểm tra và lên phương án chăm sóc. Ví dụ nhiều tín hiệu Connection Quality cùng nhiều ticket connectivity là lý do rà soát phối hợp hỗ trợ; chưa chứng minh đó là nguyên nhân churn hoặc việc phối hợp đã giải quyết xong.

### 5.7. Needs attention — danh sách hành động

Tối đa 10 case/nhóm, nút View all. Ưu tiên: unassigned high-priority open; overdue follow-ups; delivery failed; queued/failed support handoff; mature missing outcome. Một case có nhiều vấn đề được gộp với nhiều badge, không đếm trùng thành nhiều khách.

Hiển thị Case reference, Owner/Unassigned, Care stage, Attention reason, Age/due time và Open case. Opt-out/thiếu consent có badge **Outreach restricted**; không đưa vào đề xuất “gửi ngay”. Hành động chỉ điều hướng; không tự gửi AI, gọi điện, submit ticket hoặc thay consent.

## 6. Dữ liệu thực sự nên bổ sung

### 6.1. Ưu tiên tối thiểu

| Mức | Cần bổ sung | Vì sao cần và cách tận dụng hiện có |
|---|---|---|
| P0 cho tỷ lệ outcome | Nguồn cập nhật outcome đúng window và bằng chứng sau hết kỳ | Đã có retention_outcomes/RPC, **không cần thêm bảng chỉ để đếm tỷ lệ**. Cần quy trình nhập/đối soát và data freshness; synthetic phải is_simulated=true. Không điền outcome giả để dashboard có số |
| P0 cho lịch sử công việc đáng tin | Chuẩn hóa interaction_events tại các write path hiện có: case transition before/after + reason, assignment old/new, task completed_by, ticket submitted_by/time | Giữ bảng event hiện có; ghi cùng transaction nghiệp vụ, chống trùng bằng entity/action identity. Mới có thể đo closure/reopen, năng suất lịch sử và attribution chính xác |
| P0 cho chất lượng liên hệ ngoài chat | Bản ghi call attempt có staff, case, occurred_at, kết quả chuẩn (answered/no_answer/wrong_contact/declined), request key; chỉ thêm khi dùng KPI cuộc gọi | Có thể mở rộng interaction_events thay vì thêm call center module. Đánh dấu dùng call script không thay cho cuộc gọi; thiếu dữ liệu thì V1 chỉ báo chat |
| P0 cho phân loại hoàn tất | Chuẩn hóa close_reason tại UI và server; giữ dữ liệu legacy là Unclassified nếu không map chắc | Có sẵn trường; cần tập mã care_completed/customer_declined/unreachable/opted_out/confirmed_churn hoặc tập tương đương được leader duyệt. Không suy lý do cũ bằng LLM |
| P1 cho churn theo lịch và rate | Service termination event: customer/contract, effective_at, observed_at, source/evidence, simulated flag; population active đầu kỳ cùng dịch vụ/địa bàn | Đây là phần thật sự thiếu để có churn trend vận hành theo ngày/tháng. Nhãn rolling không thay event. Ưu tiên feed/bảng aggregate được quản lý, không copy audit private |
| P1 cho lịch sử cohort | Lưu association case–prediction/window và owner tại mốc can thiệp khi refresh batch | Tránh current prediction làm mất cohort cũ; giữ case/history, tránh outbound trùng. Chưa bắt buộc để xem latest workload, bắt buộc trước trend nhiều cohort/attribution outcome |

P0 ở đây là điều kiện cho **metric tương ứng**, không chặn toàn bộ trang. Có thể phát hành dashboard workload trước, còn cột chưa đo được thì ẩn hoặc ghi rõ unavailable.

### 6.2. Chỉ bổ sung khi có quyết định cần dùng

- **Ca làm, ngày nghỉ, giờ retention khả dụng** nếu cần năng suất/giờ hoặc cân đối nhân sự; không cần cho bảng Open cases. Không thu thời gian online hay keyboard activity để thay năng suất.
- **First-contact deadline và lịch ngày làm việc** nếu muốn đo SLA liên hệ. A07 trong Problem là đề xuất 2 ngày làm việc, không phải SLA đã chốt. Chưa đủ dữ liệu thì chỉ hiển thị elapsed calendar time và due_at thật; không tự gán SLA 24h/48h.
- **Callback kết quả hỗ trợ bên ngoài** nếu cần biết vấn đề đã xử lý/khách xác nhận; không xây dashboard kỹ thuật trong app DVKH. Sent mock receipt chỉ là bàn giao.
- **Chi phí/offer và phản hồi khảo sát** khi thực sự dùng để đánh giá cost/customer satisfaction. Trường chi phí đã có; chưa có số thì không ước tính ROI bằng cước 205.000 đồng.
- **Nhóm đối chứng hoặc thiết kế đo lường can thiệp** khi cần incremental retention/ROI. Đây là bước đánh giá sau pilot, không là điều kiện để làm dashboard vận hành đầu tiên.

Không cần thêm feature ML, train lại model, thêm latent churn cause, tạo bảng KPI trùng nguồn hoặc sinh hàng loạt dữ liệu chăm sóc chỉ để chart đẹp.

## 7. Contract triển khai được đề xuất

Đây là định hướng cho lần code sau, chưa tạo migration/RPC trong phiên này:

1. Dùng schema và RLS hiện có làm nguồn; một endpoint aggregate riêng cho Supervisor, kiểm role phía server. Trả workload, activity, outcomes, staff table và data-quality summary từ cùng data_as_of nhất quán. Không tải toàn bộ chat/customer context vào browser để đếm.
2. Payload có metric definition version, timezone, applied filters, data_as_of, source last observation, cohort start/end, synthetic/simulated flags, coverage và unavailable_reason theo khối. Page refresh time khác source freshness.
3. Aggregate theo grain trước join; dedupe delivery retry/revision, event replay, ticket và churn event. Outcome join đúng window; chi phí cộng độc lập với số outcome/window.
4. Dùng Refresh thủ công và refresh khi quay lại tab; đề xuất tối đa mỗi 60 giây khi Dashboard visible, không kế thừa polling 3 giây cho aggregate toàn trang. Không cần workflow n8n hay timer nền để đọc KPI.
5. Click-to-filter phải được bổ sung vào Queue hiện có; giữ filter/back navigation. Card số không bằng danh sách drill-down là lỗi cần sửa trước nghiệm thu.
6. Không dùng RPC summary cũ nguyên trạng khi chưa audit: phải kiểm đúng window start/end, missing outcome, RLS và grain; current queue view chỉ là nguồn current state, không đủ history cho mọi chart.

Nếu endpoint đọc lỗi, giữ dữ liệu cũ với badge **Refresh failed · Showing data from ...** và Retry; không thay bằng 0. Một khối thiếu nguồn có trạng thái riêng, không làm toàn trang giả như đã tải thành công.

## 8. Trạng thái UI và tiêu chí nghiệm thu

English copy đề xuất:

| Trạng thái | Copy |
|---|---|
| Chưa đủ kỳ | **Outcomes are not yet eligible. The selected window ends on 11 Nov 2026 (exclusive).** |
| Đủ kỳ nhưng chưa nhập | **Outcome data is missing for eligible cases.** |
| Không có hoạt động trong kỳ có tracking | **No recorded activity in this period.** |
| Không có lịch sử | **Historical tracking is not available for this period.** |
| Chỉ một Agent | **Only one agent has recorded data. Team comparisons are limited.** |
| Delivery/support thủ công | **Mock delivery and support handoffs require a manual worker run.** |

Nghiệm thu khi triển khai:

1. Supervisor mở tab được; Agent/Customer/anonymous gọi trực tiếp aggregate đều không đọc được dữ liệu toàn đội; staff inactive không được tiếp tục truy cập.
2. Với snapshot kiểm tra trong tài liệu: tổng stages=207, assigned+unassigned=207; open=207; không có known outcome; Active rate là null/Not yet eligible, 207 Awaiting period end. Số runtime có thể thay đổi nên đối chiếu cùng data_as_of.
3. Draft, queued, failed không tính thành sent; inbound không cần outbound trước đó không tạo reply-rate numerator. Contacted hoặc script used không tạo kết quả gọi/retention.
4. Outcome tests bao gồm thiếu row, null, sai window, đủ kỳ chưa evidence và n=0; tổng R+H+U+I=C. Synthetic và dữ liệu thật không gộp.
5. Retry/webhook trùng, nhiều message/ticket/window không nhân đôi case, churn hoặc cost. Một churn event nằm trong nhiều prediction windows chỉ xuất hiện một lần trong event trend.
6. Reassign không chuyển công lịch sử sang owner mới; reopen không mất closure history ở chart quảng bá có hỗ trợ lịch sử. Chưa đủ event coverage thì metric bị giới hạn/ẩn đúng đặc tả.
7. Midnight Việt Nam, cận trên exclusive, partial day/month và kỳ current so kỳ complete được xử lý đúng. Không giả ngày không có tracking là zero.
8. Từng số/actionable bar mở được danh sách đúng mẫu số và scope; quay lại giữ filter. Loading/error/empty đều English; keyboard/mobile đọc được, không chỉ dựa màu.
9. Workload/outcome/chart đối soát qua fixture/local tests và một truy vấn cloud read-only khi cần. Kiểm browser trước release; không chạy AI/LLM/n8n để chứng minh dashboard đọc số được.

## 9. Phạm vi đề nghị triển khai trước

**Bản đầu:** tab Supervisor + filters rõ thời gian; Open/Unassigned/Overdue; pipeline; activity chart với các event thật sự có coverage; bảng staff workload; Needs attention; outcome distribution/coverage với empty state đúng; risk signals và ticket categories nếu context đã có nguồn đọc phù hợp. Không chờ dữ liệu churn thật để hoàn thành phần điều hành.

**Bổ sung có điều kiện:** chuẩn hóa event/closure/call recording; lịch sử cohort và attribution; feed churn event/population; khi đó mới mở trend churn theo lịch, năng suất đã chuẩn hóa và outcome nhiều cohort. Synthetic historical chart chỉ là bối cảnh tùy chọn, không lấn phần việc cần làm hôm nay.

Leader review chủ yếu ba điểm: nhóm KPI có đáp ứng quyết định điều hành; chấp nhận cách tách care completion khỏi service outcome; ưu tiên event/call recording hay nguồn service churn ở đợt sau. Đây là các lựa chọn sản phẩm tiếp theo, không phải lý do trì hoãn bản đặc tả này.

## 10. Nguồn đối chiếu trong repo

- [README](../README.md), [Implementation](IMPLEMENTATION.md), [Problem](PROBLEM.md), [System](SYSTEM.md): phạm vi, quyền, định nghĩa và ràng buộc demo.
- [Brief UI](../website/mockups/BRIEF.md), [Queue.jsx](../website/app/src/Queue.jsx), [main.jsx](../website/app/src/main.jsx): navigation/case owner và UI hiện hành.
- [Supabase setup](../supabase/setup.sql), [Rolling migration](../supabase/migrations/20261019033021_rolling_month_v5_shap.sql), [Ticket migration](../supabase/migrations/20261020182841_chat_to_ticket.sql): fields, window rules và API hiện hành.
- [V5 cutover evidence](evidence/ml/rolling_month_v5/supabase_v5_cutover.json): snapshot cloud 19/10; số hiện trạng 21/10 ở mục 2 lấy từ SELECT trực tiếp mới hơn.
- [ML README](../ml/README.md), [Data/ML](DATA_ML.md), [V5 manifest](../data/synthetic/final/rolling_month_v5/dataset_manifest.json), [Churn labels](../data/synthetic/final/rolling_month_v5/churn_labels.csv): nguồn synthetic local, có thể không được track/phân phối trong Git.

Giới hạn xác minh: chưa triển khai dashboard/query production; chưa browser QA; chưa audit đầy đủ mọi event write path hoặc kiểm cơ chế ghi service churn thực. Các metric và data additions ở trên là đề xuất thiết kế, không phải tính năng đã tồn tại.
