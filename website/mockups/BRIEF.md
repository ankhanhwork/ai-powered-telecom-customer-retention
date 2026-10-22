# Giao diện demo hiện hành

Brief làm việc bằng tiếng Việt; UI và nội dung AI hiện có giữ tiếng Anh. Source trong `website/app/src/` và contract `docs/SYSTEM.md` là trạng thái triển khai hiện hành. Ba ảnh dưới đây là baseline thiết kế, không phải ảnh chụp đầy đủ mọi chức năng mới.

## Tài liệu hình ảnh

| Ảnh | Nội dung |
|---|---|
| [Care queue](01-care-queue-en.png) | Hàng chờ và pipeline ban đầu |
| [Customer details](02-customer-details-en.png) | Hồ sơ chăm sóc ban đầu |
| [Customer chat](03-customer-chat-en.png) | Portal hội thoại mock |
| [Logo](fpt-telecom-logo.png) | Tài nguyên thương hiệu dùng trong mockup |

## Agent

- Header có Care Queue / Conversations, chuông Notifications, profile và Sign out.
- Queue có At-risk / Open cases / Technical referrals; search và tháng/năm theo target_period_start. Pipeline/bảng dùng cùng tập lọc.
- Conversations có danh sách case, chat và panel hồ sơ; các cột có thể resize, hai panel đóng/mở được.
- Stage bar hỗ trợ chuyển trạng thái, Care completed cần reason; Failed tách với Care completed. Care stage và period outcome là hai lớp riêng.
- Ô soạn nhận AI message draft; Send lưu và duyệt đúng nội dung đang hiển thị. Không tự gửi kết quả AI.
- Panel phải: Info / Call / Ticket / Insights. Call có script, contact result và note; Ticket giữ mounted để tránh mất editor; Insights có explanation và risk drivers.
- Kênh hiển thị Zalo; transport mock. Message sent chỉ khi có receipt, draft/internal note không hiện trong portal. Approved mock messages hiện gửi trong DB lúc commit.

## Supervisor

- Header có Dashboard / Assignment; mở case chuyển sang Conversations.
- Dashboard có hai tab Care performance / Period outcome. Care performance gồm số liệu công việc, Where care stands, Needs attention, pipeline/workload; không trộn closed care với retained outcome.
- Needs attention gồm Unassigned / Not yet cared / Support request not handed off / Message not delivered; bấm chart mở bảng có lọc loại attention.
- Not yet cared = số case vẫn New predictions / tổng case được giao trong khoảng activity, dùng lần case.assigned gần nhất và fallback created_at. Team workload chỉ lấy Agent.
- Assignment có Team workload, search/tháng-năm/All agents/Unassigned/từng Agent và care pipeline dùng chung với Queue. Filters chỉ đổi pipeline, không đổi scope workload hoặc batch assignment.
- Assign cases mở Manual / Round-robin / Weighted; cấu hình → Preview → Confirm. Preview server read-only, Confirm server recheck quota/owner/idempotency. Info tab có manual owner change và explicit confirm.
- Default demo 20/day, 40 open, weights 40/30/30; Supervisor sửa/lưu được. Không tự tạo AI request, đổi stage hoặc outcome từ assignment.

## Notifications

Header có mark-all-read/close; Important/Updates với badge unread. Item có icon, tên khách, ngày; bấm mở case hoặc màn liên quan và mark read. Ghép notifications lưu DB với cảnh báo tính từ queue. Đọc notification không hoàn thành task. DEV preview `?preview=notifications` dùng dữ liệu giả, không xác nhận hành vi live.

## Ticket và risk drivers

Ticket AI dùng hội thoại external đã gửi/nhận để tạo draft có quoted evidence; staff sửa rồi submit. Thiếu thông tin có Ask customer in chat; sau Submit có thể yêu cầu một AI message xác nhận, tốn một execution n8n. Receipt support mock không có nghĩa đã xử lý kỹ thuật. Internal notes chưa vào ticket AI context.

Risk drivers hiển thị tối đa 3 nhóm signed SHAP dương của model 127 features; facts/window/evidence cho staff xác minh. Không gọi nhóm này là nguyên nhân đã xác nhận hoặc % xác suất. Prepaid payment null không làm bằng chứng nhắc nợ. Giữ flags/provenance synthetic trong backend/tài liệu.

## Tương tác và nghiệm thu

- Request có Working/Done/error, không gọi trùng khi job pending; retry dựa trạng thái. Polling khi tab visible không làm mất editor chưa lưu.
- Customer portal chỉ đọc external sent/inbound đúng scope; không thấy model internals, notes hoặc drafts.
- Prediction có start/end một tháng lịch; outcome Unknown nếu chưa đủ kỳ, không đổi theo thao tác đóng case.
- Kiểm browser sau đăng nhập, mobile, keyboard, empty/error/loading và một journey trọn vẹn trước release. Unit tests/build không thay browser E2E.
- Không chạy n8n/LLM hoặc seed cloud chỉ để kiểm bố cục; DEV previews và fixture local dùng khi review layout. Vercel root giữ `website/app`.
