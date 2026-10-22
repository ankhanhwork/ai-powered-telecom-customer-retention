# Thiết kế hệ thống hiện hành

## Phạm vi và kiến trúc

Prototype hỗ trợ chăm sóc sau cảnh báo churn cho Internet FPT Telecom. Agent sở hữu case được giao; Supervisor điều phối toàn pilot; Customer portal chỉ đọc hội thoại đúng quyền. Website React/Vite gọi Supabase bằng JWT/publishable key. Python cung cấp prediction/SHAP demo. n8n tạo explanation, message, call script và ticket khi staff yêu cầu.

Luồng: prediction → case → phân công → đọc context/yêu cầu AI → nhân viên sửa và duyệt → mock delivery → customer reply → phối hợp hỗ trợ/follow-up → đối soát outcome đúng kỳ.

UI/AI output hiện có bằng tiếng Anh; tài liệu repo bằng tiếng Việt. Zalo là nhãn kênh demo, transport là mock; chưa nối provider thật. Facts/model attribution không phải nguyên nhân churn đã xác nhận. Không tự áp ưu đãi ngoài catalog hợp lệ.

## Prediction và outcome

127 features, model LightGBM tuned; phát hành ngày 1/11/21 từ snapshot cuối tháng/10/20. Horizon một tháng lịch, lưu cả `target_period_start` và `target_period_end_exclusive`. Latest ML cohort là snapshot 10/10 với 2.705 khách/207 alerts >500, kỳ [11/10,11/11).

Case đóng và outcome giữ chân độc lập. Outcome Unknown là null; chỉ ghi known khi đủ toàn bộ kỳ, có nguồn/thời điểm/evidence và đúng scope. Không suy retained từ đóng case, trả lời tin hoặc điểm model giảm. Outcome/cost synthetic mang cờ simulated. [Phương pháp ML](DATA_ML.md).

## Quyền, dữ liệu và API

Migrations trong `supabase/migrations/` là nguồn schema chuẩn; `supabase/setup.sql` được sinh từ chuỗi migrations bằng `python supabase/scripts/build_setup.py`. Giữ nguyên tên migration đã áp dụng. Setup dành cài mới hoặc bản nền được script hỗ trợ, không chạy lại trên workspace live đã có.

Public tables có RLS; browser không DML trực tiếp vào bảng nghiệp vụ. RPC ghi derive actor từ Auth, kiểm ownership/role và khóa case trước khi thay đổi. Agent chỉ đọc/ghi case thuộc quyền; Supervisor được điều phối; worker credential chỉ ở trusted server/n8n. Portal không được thấy feature matrix, score, SHAP, draft, notes hoặc recommendation nội bộ. Backup/staging nằm private schema, deny-all cho browser/worker.

| Phần | API/nguồn chính |
|---|---|
| Queue/detail | `retention_care_queue`, `retention_case_detail` |
| Dashboard | `retention_supervisor_dashboard`, scoped reads queue/events/staff |
| Phân công | `retention_agent_capacity`, `retention_assignment_settings`, `retention_preview_assignment`, `retention_confirm_assignment`, `retention_change_assignment`, `retention_assign_case` |
| Stage/contact | `retention_update_case` |
| Draft/note | `retention_save_draft` và immutable revisions |
| Duyệt/gửi | `retention_review_message`, outbox, deferred mock-delivery trigger |
| Worker delivery | `retention_claim_delivery`, `retention_deliver_mock`, `retention_fail_delivery` |
| AI | `retention_request_recommendation`, `retention_pending_jobs`, `retention_claim_ai_request`, `retention_worker_context`, `retention_complete_job`, `retention_fail_job` |
| Ticket | `retention_ticket_context`, draft/save/submit ticket RPC và support worker |
| Portal | `retention_portal_threads`, `retention_portal_thread`, `retention_portal_send`, `retention_opt_out` |
| Reminder | `retention_schedule_reminder`, `retention_process_followups`, `retention_complete_task`, `retention_mark_notification_read` |
| Outcome/cost | `retention_record_outcome`, `retention_record_cost` |
| Import | `retention_ingest_prediction` |

Đối số và invariants cụ thể nằm trong SQL/tests; browser gửi user token, không gửi worker secret. Import kiểm đúng 127 key/kiểu, run metadata/hash/kỳ, frozen snapshot/prediction và context khớp hash/model/group whitelist. Không nhận nhãn/audit vào context.

## Tin nhắn, AI và mock delivery

Nhân viên duyệt mọi outbound; revision nào được duyệt thì gửi đúng revision đó. Edit tạo revision mới, approval/outbox cũ bị hủy theo contract. Request key và content hash ngăn replay khác nội dung hoặc gửi lặp. Draft, notes và lời giải thích nội bộ không hiện trong portal.

AI jobs có queued/claimed/completed/failed/cancelled; atomic claim trước LLM, không tạo tự động outbound. Nút Request báo Working/Done/error; UI có retry cho job treo theo trạng thái hiện hành. Worker đọc external sent history và inbound đúng thứ tự, không đọc draft chưa gửi. Mỗi loại output có webhook riêng và JWT/RLS gate. Staff phải kiểm facts, thời gian, policy và các chỗ thiếu dữ kiện.

**Hành vi demo hiện hành:** migration `20261021160000_remove_contact_gate.sql` đã bỏ gate consent/closed case/khung giờ/cooldown/daily contact limit. Các preferences/opt-out vẫn được lưu; không mô tả chúng như gate gửi tin đang được enforce. Migration `20261022000100_inline_mock_delivery.sql` gửi approved outbox của conversation mock đang mở ngay lúc commit: receipt/message sent, case waiting_customer, hủy no_reply cũ và tạo follow-up mới. Không cần chạy worker delivery n8n cho nhánh này. Worker delivery thủ công vẫn có tests riêng; provider thật ngoài phạm vi.

Portal reply dùng Auth mapping và event key; replay cùng nội dung không tạo tin mới. Reply hủy no_reply/AI work cũ theo contract nhưng giữ manual reminder. Không tự gọi LLM hoặc gửi tiếp sau reply.

## Chat-to-Ticket

AI chỉ tạo ticket nháp có dẫn chứng từ hội thoại external đã gửi/nhận. Thiếu thông tin dùng flow AI message cho staff duyệt; không tự submit ticket. Staff sửa và submit, support worker tạo receipt mock; receipt không có nghĩa kỹ thuật đã xử lý hoặc xác nhận lịch. UI có thể yêu cầu một AI message xác nhận sau Submit, tốn một execution n8n.

Internal notes hiện không vào ticket AI context; yêu cầu mở rộng này chưa triển khai. Giữ quoted evidence, category/department/priority checks và chống source revision cũ. Source/tests: `n8n/workflows/02_ai_ticket.json`, `supabase/tests/ticket.test.mjs`, `website/app/src/SupportTicket.jsx`.

## Phân công và Supervisor Dashboard

Manual/Round-robin/Weighted đều đi qua RPC server. Mặc định demo: 20 case mới/ngày, 40 case mở, trọng số Continuity/Experience/Load 40/30/30; Supervisor sửa/lưu được. Daily distinct case/Agent theo Asia/Ho_Chi_Minh; transfer không hoàn quota cũ, nhận lại cùng case trong ngày không đếm thêm. Capacity tính mọi kỳ; case closed không nhận owner mới.

Preview read-only, không reserve. Confirm recheck quyền, kỳ, settings, owner, quota và cursor; khóa transaction chung manual/batch rồi staff/case theo thứ tự. Dòng stale bị skip, không tự reroute. Cùng request key/payload trả cùng result; khác payload từ chối. Assignment, task owner, audit và notification gộp cùng transaction. Không tự đổi care stage/outcome hoặc tạo AI job.

Continuity/Experience từ hoạt động 90 ngày có actor, không dùng retained outcome làm skill. SHAP top-1 chỉ là gợi ý nhóm tín hiệu; history mô phỏng không chứng minh chuyên môn. Case chồng kỳ có owner khác phải review. Thông báo batch đúng một recipient/run.

Dashboard có hai tab Care performance / Period outcome. Care performance dùng chung care stages với Agent, Team workload chỉ Agent, và Needs attention cho Unassigned / Not yet cared / Support request not handed off / Message not delivered. Not yet cared tính trên các case được giao trong khoảng activity, vẫn ở New predictions. Period outcome chỉ báo known sau đúng cửa sổ, latest mature window/customer tránh cộng trùng. Notifications ghép dữ liệu lưu DB và cảnh báo tính từ queue; read không hoàn thành task.

## Cài đặt và kiểm chứng

Các script admin ở `supabase/scripts/`, chỉ chuẩn bị/chạy có chủ đích trên môi trường phù hợp. `prepare_import.py` mặc định xuất 5 payload label-free vào ignored `tmp/supabase/`, không upload; không tự cấp consent nếu không có flag rõ ràng. `prepare_dashboard.py` cần private backup local để seed/rollback; không chạy để kiểm việc dọn repo.

```powershell
npm ci --prefix supabase/tests
npm test --prefix supabase/tests
npm test --prefix website/app
npm run build --prefix website/app
node --test n8n/tests/validator.test.mjs n8n/tests/ticket-validator.test.mjs
```

DB tests dùng PostgreSQL WASM/PGlite, Auth/Storage/JWT gateway có stub; không thay hosted Auth, browser E2E hoặc tải đồng thời. Test worker delivery chủ động tắt inline trigger trong DB test riêng; test inline delivery kiểm hành vi mặc định sau commit. Các fixtures chỉ synthetic, không cần private cloud backup. Kết quả dọn repo: `docs/evidence/repository_cleanup.json`; kiểm chứng tính năng đã có tại `docs/evidence/` và test results trong module.
