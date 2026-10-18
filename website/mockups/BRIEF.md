# Mockup website — 3 màn hình tiếng Anh

Cập nhật: 17/10/2026. Trạng thái: ảnh đề xuất để review; chưa phải app chạy được hoặc thiết kế đã được duyệt.

## Ảnh đã lưu

| Ảnh | Giá trị chính |
|---|---|
| [01-care-queue-en.png](01-care-queue-en.png) | Tổng quan gọn và hàng chờ ưu tiên, phân công, hạn xử lý, trạng thái |
| [02-customer-details-en.png](02-customer-details-en.png) | Top 3 nhóm tín hiệu + giải thích AI; hành động/ưu đãi, tin nhắn/kịch bản gọi, hội thoại, nhắc lại, outcome và chuyển yêu cầu kỹ thuật |
| [03-customer-chat-en.png](03-customer-chat-en.png) | Khách nhận tin đã duyệt, trả lời, đề nghị lịch hỗ trợ và dừng liên hệ |
| [fpt-telecom-logo.png](fpt-telecom-logo.png) | Bản sao logo gốc do người dùng cung cấp |

Tạo bằng **ImageGen tích hợp**, dùng logo người dùng làm tham chiếu. Không dùng CLI/API fallback. Hai ảnh hàng chờ/chat là 1586 × 992 px; ảnh chi tiết English là ảnh toàn trang cuộn dọc để thể hiện đủ công cụ trong cùng một trang. Chữ và logo trong ảnh là bản render tham khảo, khi code phải dùng logo gốc và text/component thật.

## Quy định ngôn ngữ

Yêu cầu mới của giảng viên, do người dùng cung cấp ngày 17/10/2026: sản phẩm và report/slide nộp bài bằng **tiếng Anh**. Brief và docs làm việc tiếp tục tiếng Việt. Ba ảnh English trong bảng là chuẩn hiện hành để code và chụp vào báo cáo; bản tiếng Việt và prompt cũ lưu trong `tmp/mockups-vi-20261017/`, không dùng làm bản final.

Mọi labels, status, placeholder, helper/error text, AI explanation/recommendation, draft, call script, follow-up và hội thoại demo đều dùng English. Không cần tạo tính năng chuyển ngôn ngữ trong MVP. Giữ giá trị tiền VND và facts gốc; dịch không được thay dữ liệu hoặc mức chắc chắn.

## Phạm vi giao diện

Ứng dụng nghiệp vụ **chỉ dành cho DVKH**. Giữ **2 màn hình nội bộ + 1 portal khách để demo kênh tương tác**, dùng một codebase:
1. Hàng chờ: gộp Dashboard, Customers và Retention Cases; tab và bộ lọc thay cho các trang riêng.
2. Hồ sơ xử lý: gộp top 3 nhóm tín hiệu và diễn giải AI, customer context, action/offer, bản nháp, approval, kịch bản gọi/ghi chú, hội thoại/nhật ký, lịch nhắc và outcome trong một trang cuộn; chuyển kỹ thuật chỉ là form gửi yêu cầu.
3. Chat khách: một hội thoại thuộc đúng khách; mở ở phiên riêng, không có menu nội bộ.

Phần nội bộ chỉ có hai mục điều hướng: Hàng chờ và Hồ sơ xử lý. Hồ sơ mở theo case từ hàng chờ, không cần thêm trang quản trị, offers, báo cáo chi tiết hoặc task board riêng trong MVP. Bộ phận kỹ thuật dùng phần mềm khác và không đăng nhập app này. DVKH bấm nút chuyển hỗ trợ, nhập nội dung và gửi; không quản lý người phụ trách kỹ thuật, tiến độ hoặc SLA kỹ thuật.

Màu chính: cam FPT #F37021, xanh FPT #1268AC, xanh lá cho trạng thái; nền sáng và card trắng, navy cho chữ. Ảnh mockup là định hướng tổng thể; code ưu tiên dễ dùng, responsive, độ tương phản và trạng thái đúng.

## Quy tắc nội dung và nghiệp vụ

- Quy mô danh sách 8.000 dựa trên thông tin đã cung cấp. Tên khách, ID, risk từng người, ticket, số 24/6, thời hạn và hội thoại đều là dữ liệu minh họa.
- Điểm = xác suất ×1.000. Các risk trong hàng chờ minh họa đều >50%; không suy ra nguyên nhân từ score.
- Vấn đề trong bảng là điều cần xác minh hoặc context demo; chưa khẳng định là nguyên nhân churn.
- Nhãn Cao/Trung bình là cách hiển thị demo, chưa chốt các ngưỡng phân nhóm cho production.
- AI tạo draft; nhân viên review rồi duyệt/gửi. Trong MVP có thể gộp thao tác ở UI, nhưng server phải ghi approval đúng revision trước khi enqueue; chưa duyệt không gửi.
- Sửa tin sau duyệt cần revision và approval mới. Tạo reply AI tiếp theo vẫn cần nhân viên duyệt.
- Chuyển kỹ thuật chỉ có nội dung yêu cầu, khung giờ khách mong muốn nếu có, tóm tắt được xem trước, nút Gửi yêu cầu và receipt/gửi lỗi. Không tự gán nhân viên, SLA hoặc lịch kỹ thuật. Chưa có kết nối thật thì ghi bàn giao mô phỏng.
- Portal khách không nhìn thấy risk, internal note hoặc AI draft. Chỉ hiện tin đã gửi, không tiết lộ suy đoán churn.
- Kết quả giữ chân để Chưa xác định khi chưa có outcome đúng kỳ; không dùng đóng case hoặc reply để thay retained.
- Ngày và giờ minh họa trong ảnh không phải SLA hoặc sự kiện vận hành đã đo.
- Các ảnh mô tả các thời điểm khác nhau trong cùng một hành trình; bản nháp ở màn nội bộ chưa gửi, chat là bước sau khi đã duyệt và tương tác.

## Luồng demo

Hàng chờ → mở BD-DEMO-001 → đọc top 3 nhóm và AI diễn giải từ dữ kiện → chọn phương án/ưu đãi hợp lệ → sửa và duyệt draft → khách nhận/reply → nhập yêu cầu và chuyển sang kỹ thuật khi cần → DVKH nhắc lại/ghi kết quả. Không xây quy trình xử lý nội bộ của kỹ thuật.

Nhánh cần kiểm tra khi code: empty/loading/error; LLM lỗi/thiếu context; gửi lỗi và retry không trùng; chỉnh tin sau duyệt; khách opt-out; khách reply trước follow-up; quyền giữa staff/customer. Chưa cần tạo thêm ảnh hoặc trang cho mỗi nhánh này.

## Trang chi tiết English — chức năng có vị trí rõ

| Khu vực | Nhân viên sử dụng |
|---|---|
| Top 3 nhóm | Đọc thứ tự nhóm, dữ kiện cụ thể và AI diễn giải vì sao cần ưu tiên xác minh |
| Hành động & nội dung tiếp cận | Chọn phương án, xem ưu đãi đủ điều kiện, tạo lại đề xuất |
| Tin nhắn / Kịch bản gọi điện / Ghi chú nội bộ | Soạn/sửa nội dung theo kênh hoặc ghi thông tin nội bộ trong cùng card |
| Duyệt & gửi | Review đúng revision trước gửi; lưu nháp khi chưa sẵn sàng |
| Hội thoại / Nhật ký | Xem tin đã gửi, phản hồi khách và lịch sử thao tác |
| Theo dõi chăm sóc | Lịch nhắc theo config (đề xuất 3 giờ), thông báo, trạng thái liên hệ và outcome riêng |
| Chuyển hỗ trợ kỹ thuật | Nhập yêu cầu gửi sang phần mềm/kênh ngoài; không quản lý kỹ thuật |

Ba nhóm trong ảnh: chất lượng kết nối; mức độ phù hợp gói cước; trải nghiệm hỗ trợ. Dữ kiện 2 lần lỗi/30 ngày, mức dùng giảm 35% và phản ánh 3 ngày trước đều là **minh họa**, chưa lấy từ dataset. Thứ hạng cũng là minh họa, không phải output model đã chạy.

Khi triển khai thật, xếp nhóm theo driver hợp lệ/mapping nghiệp vụ, chỉ diễn giải facts có nguồn. Không đủ ba nhóm thì hiển thị thiếu dữ liệu. LLM không tự dựng thứ hạng hoặc gọi tín hiệu là nguyên nhân đã xác nhận. DVKH thấy lời giải thích về tình trạng khách, không thấy tên cột kỹ thuật hay SHAP. Cần thu thập thêm ngữ cảnh nếu data public không có các trường dịch vụ này.

## Bổ sung đã chốt sau review bước 1

Leader đã duyệt bộ English làm baseline. Không cần thêm trang hoặc tạo ảnh mới ở phiên này. Khi code cập nhật các delta sau:

- Kịch bản batch **01 October 2026** dự báo trong **October 2026**; tháng 9 ở ảnh cũ là placeholder, không dời số liệu thực trạng thành kết quả tháng 10.
- Thêm `Channel` dropdown mặc định `Zalo`, tùy chọn `Messenger`/`Web Chat`; tất cả là chatbot mô phỏng với badge `Simulated · No live connection`. Mỗi khách có hội thoại riêng; mọi channel dùng transport mock.
- Thêm chuông góc trên phải cạnh avatar, badge unread, dropdown `Notifications` và toast bên dưới header. Đây là UX AI đề xuất theo yêu cầu thông báo của leader, không cần tạo trang Notifications riêng.
- Notification gồm `New customer message` và `Follow-up due`, bấm mở đúng case. Đọc notification không tự đánh dấu đã chăm sóc.
- Delay nhắc là config. Mặc định làm việc AI đề xuất **3 hours**; `24 hours` trong ảnh/prompt cũ chỉ là placeholder, không khóa logic. Reply/opt-out/case đóng hủy nhắc phù hợp; không tự gửi/gọi.
- Agent tự Approve & Send trong policy; mọi reply AI vẫn cần duyệt; ngoại lệ mới chuyển Supervisor.
- Catalog sẽ được viết nháp/review ở bước sau; chưa có rule thì không tạo ưu đãi tùy ý.
- Outcome hiển thị `Unknown`, `Churned`, `Active at period end`; riêng contact result và case closure reason không được gộp vào outcome.

Đây là review về phạm vi, không phải xác nhận sản phẩm đã thực thi. Đặc tả điều kiện và ví dụ ở [System](../../docs/SYSTEM.md).

## Review

| Phiên bản | Trạng thái | Phản hồi/người duyệt |
|---|---|---|
| English baseline · 17/10/2026 | Leader đã duyệt phạm vi | Khi code bổ sung Channel, Notifications, kỳ tháng 10 và delay cấu hình; ảnh chưa thể hiện delta này |

## Thuật ngữ hiển thị trong sản phẩm

| Nội dung làm việc | English UI |
|---|---|
| Hàng chờ chăm sóc | Customer Care Queue |
| Hồ sơ khách hàng | Customer Details |
| Top 3 nhóm tín hiệu rủi ro | Top 3 Risk Driver Groups |
| Chất lượng kết nối / Phù hợp gói / Trải nghiệm hỗ trợ | Connection Quality / Plan Suitability / Support Experience |
| Hành động và tiếp cận | Recommended Action & Outreach |
| Tin nhắn / Kịch bản gọi / Ghi chú | Message / Call Script / Internal Notes |
| Duyệt và gửi | Approve & Send |
| Hội thoại và lịch sử | Conversation & History |
| Theo dõi chăm sóc | Care Follow-up |
| Chuyển hỗ trợ kỹ thuật | Refer to Technical Support |
| Chưa xác định / Chưa liên hệ | Unknown / Not contacted |

Thuật ngữ trong ảnh là gợi ý thống nhất cho code; nội dung report sẽ được biên tập tiếng Anh trước khi xuất final. Tên proper names/brand có thể giữ nguyên; ảnh hiện dùng Binh Duong và tên Latin để nhất quán.

## Prompt set English đã sử dụng

Tạo bằng ImageGen tích hợp, chế độ chỉnh ngôn ngữ với từng ảnh gốc làm tham chiếu. Không dùng CLI/API fallback. Bản gốc VI chỉ lưu để đối chiếu trong tmp/.

<details>
<summary>English prompt 1 — Care Queue</summary>

Use case: text-localization. Edit the attached website mockup into an entirely ENGLISH product interface. Preserve original full image dimensions, layout, composition, FPT Telecom logo, blue/orange/green brand colors, white cards, icons, padding, hierarchy and all functionality. Do not crop, omit sections, add screens or simplify features. Replace every Vietnamese label, sentence, placeholder, tooltip, tab, footer and sample message with natural concise professional English. Keep customer names as Latin proper names, e.g. "Nguyen Minh Anh", region "Binh Duong". FPT Telecom brand remains unchanged. Translate DVKH to Customer Service or CS where space is tight. Number conventions: 8,000 customers; VND 205,000/month; 24 months; English dates and times. Use a crisp sans-serif font and reflow text only within existing components to prevent clipping. No leftover Vietnamese UI text, no developer jargon, no new claims or performance metrics. All individual customer activity is sample data; preserve a visible "Demo data" badge. This is a customer-service-only staff application, not a technical-team console. Technical support is an external handoff only.
SCREEN 1: Keep the landscape queue screen exactly. Product header "Retention Workspace"; nav "Care Queue" and "Customer Details"; region footer "Binh Duong · Internet". Main title "Customer Care Queue", subtitle "Prioritize the right customers. Reach out at the right time.", filter "September 2026". KPI cards "At-risk customers" "8,000" "Prediction score > 500"; "Due today" "24" "Demo data"; "Technical referrals" "6" "Follow-up needed". Tabs "My cases", "Referred to support", "Completed". Search "Search customer or contract ID", dropdowns "Priority" and "Status". Table columns "Customer", "Churn risk", "Issue to verify", "Case owner", "Due", "Status". Exactly five rows and same IDs BD-DEMO-001...005. Risks must remain 82%, 68%, 65%, 57%, 52%, all >50%. Rank badges "High" for first two, "Medium" for last three; do not introduce low risks below threshold. Issues "Repeated disconnections", "Slow Internet", "Area connectivity issues", "Plan change request", "Billing question". Case owners all CS, not technicians: "Lan · CS", "Hung · CS", "Minh · CS", "Lan · CS", "Hai · CS". Status chips "Not contacted", "Awaiting reply", "Referred to support", "Pending approval", "Contacted". Row buttons "Open case". Due "Today, 14:00", "Today, 16:00", "10 Sep 2026", "11 Sep 2026", "12 Sep 2026". Footer "Showing 5 of 24 cases". Quiet bottom note "Prioritized by risk, waiting time and case status." and "Proposed interface · Illustrative operational data". Preserve logo and all graphic positions.

</details>


<details>
<summary>English prompt 2 — Customer Details</summary>

Use case: text-localization. Edit the attached website mockup into an entirely ENGLISH product interface. Preserve original full image dimensions, layout, composition, FPT Telecom logo, blue/orange/green brand colors, white cards, icons, padding, hierarchy and all functionality. Do not crop, omit sections, add screens or simplify features. Replace every Vietnamese label, sentence, placeholder, tooltip, tab, footer and sample message with natural concise professional English. Keep customer names as Latin proper names, e.g. "Nguyen Minh Anh", region "Binh Duong". FPT Telecom brand remains unchanged. Translate DVKH to Customer Service or CS where space is tight. Number conventions: 8,000 customers; VND 205,000/month; 24 months; English dates and times. Use a crisp sans-serif font and reflow text only within existing components to prevent clipping. No leftover Vietnamese UI text, no developer jargon, no new claims or performance metrics. All individual customer activity is sample data; preserve a visible "Demo data" badge. This is a customer-service-only staff application, not a technical-team console. Technical support is an external handoff only.
SCREEN 2: Preserve the full tall scrolling customer-detail screenshot, EVERY section visible. Header "Retention Workspace", "Demo data", "Lan · CS". Sidebar "Care Queue", active "Customer Details"; footer "Binh Duong · Internet". Breadcrumb "Care Queue / BD-DEMO-001". Customer "Nguyen Minh Anh", badge "82% churn risk", owner "Lan · CS", status "Not contacted", top-right action "Refer to Technical Support". Facts strip "Monthly fee" "VND 205,000", "Tenure" "24 months", "Last contact" "None", "Contact permission" "Allowed". Section "Top 3 Risk Driver Groups", subtitle "AI explains the customer's current situation to help CS verify concerns and choose an approach." Preserve all 3 ranked cards with factual chips and explanation BELOW.
01 "Connection Quality"; facts "2 disconnection reports / 30 days" and "Recurring in the evening"; AI paragraph "This group comes first because recurring outages may directly affect daily use. Ask whether the connection is stable before offering a promotion."
02 "Plan Suitability"; facts "Monthly fee: VND 205,000" and "Usage down 35%"; paragraph "Usage fell from last month while the fee stayed the same. Ask about current needs to check whether the plan still fits."
03 "Support Experience"; facts "Latest report: 3 days ago" and "Resolution not confirmed"; paragraph "The latest report has no confirmed resolution. Check what support the customer received and agree on the next step."
Note under cards "Data signals, not confirmed reasons for leaving · Illustrative data".
Lower left card "Recommended Action & Outreach", badge "AI drafts · Staff decides"; orange callout "Verify the connection issue first; do not offer a discount yet."
Dropdown "Care approach" value "Check connection status and preferred support time".
Dropdown "Eligible offers" value "Not applied" and button "View options".
Tabs "Message", "Call Script", "Internal Notes".
Label "AI-generated draft"; editable message "Hello Minh Anh, I'm Lan from FPT Telecom. Has your Internet connection been stable in the evenings recently? If you still experience interruptions, please let me know a convenient time so I can refer your request to Technical Support."
Below "Not sent · Review and edit before approval"; buttons "Regenerate", "Save draft", primary "Approve & Send".
Expandable technical handoff form "Refer to Technical Support"; subtitle "Send a request to the external support team"; label "Support request"; textarea "Check evening disconnections. Contact the customer to agree on a suitable support time."; note "Include customer ID and conversation summary"; button "Send Request". No technician identity, assignment, SLA or progress tracker.
Right card "Conversation & History"; tabs "Conversation", "Activity"; empty state "No customer reply yet", "Sent messages and customer replies will appear here.", button "Open conversation"; note "Drafts are visible only in the editor".
Right lower card "Care Follow-up"; "Reminder" date "Tomorrow" and time "09:00"; checkbox "No reply after 24 hours: suggest a call"; button "Set Reminder"; label "Retention outcome" dropdown "Unknown"; label "Contact result" dropdown "Not contacted"; button "Save Outcome"; note "Confirm retention only after the observation period."
Bottom footer "Proposed interface · Demo data · Customer Service only". Keep the many product functions in the same one page, translate absolutely all visible Vietnamese text.

</details>


<details>
<summary>English prompt 3 — Customer Chat</summary>

Use case: text-localization. Edit the attached website mockup into an entirely ENGLISH product interface. Preserve original full image dimensions, layout, composition, FPT Telecom logo, blue/orange/green brand colors, white cards, icons, padding, hierarchy and all functionality. Do not crop, omit sections, add screens or simplify features. Replace every Vietnamese label, sentence, placeholder, tooltip, tab, footer and sample message with natural concise professional English. Keep customer names as Latin proper names, e.g. "Nguyen Minh Anh", region "Binh Duong". FPT Telecom brand remains unchanged. Translate DVKH to Customer Service or CS where space is tight. Number conventions: 8,000 customers; VND 205,000/month; 24 months; English dates and times. Use a crisp sans-serif font and reflow text only within existing components to prevent clipping. No leftover Vietnamese UI text, no developer jargon, no new claims or performance metrics. All individual customer activity is sample data; preserve a visible "Demo data" badge. This is a customer-service-only staff application, not a technical-team console. Technical support is an external handoff only.
SCREEN 3: Customer-facing support chat, preserve entire landscape screenshot and layout, NO staff navigation or risk score. Header supplied FPT Telecom logo, centered "Internet Support", badge "Demo environment". Chat header "FPT Telecom · Internet Support", online status "Lan is here to help". Blue notice "Our team will confirm availability before scheduling technical support." Translate ALL chat bubbles: left "Hello Minh Anh, I'm Lan from FPT Telecom. May I help check your Internet connection?" timestamp "09:20 · Sent"; right "My Internet often disconnects in the evening." timestamp09:22; left "I've noted that. What time would be convenient for Technical Support to contact you?" timestamp09:23; right "After 6 PM today, please." timestamp09:24. Inline request card "Connection Check Request", "Preferred time: After 18:00 today", status "Schedule not confirmed". Composer "Type a message..." and send arrow. Bottom links "Talk to a person" and "Stop proactive messages". Footer "Illustrative conversation". Do not imply a confirmed appointment or automatically promise technical availability. No AI drafts or risk data visible to customer.

</details>

## Delta UI đã triển khai 18/10

Queue có hai chế độ Pipeline/Table; 4 care columns New predictions, Outreach, Resolving request, Care completed; 2 outcome columns Continued service (green), Churned (red). Outcome chưa biết giữ ở care stage, không suy từ đóng case/reply. Detail có care progress/update, period-end outcome với evidence và chặn sớm; tab Message / Call script / Internal notes. Request AI explanation/message/call script là thao tác chủ động, chưa có n8n thì hiện queued và không bịa output. Số liệu/facts/rank truy vấn Supabase; chỉ labels/UI copy cố định. Không hiển thị Python explanation_draft hoặc suggested_action như AI-generated prose. Staff notes không thêm Sales role.
