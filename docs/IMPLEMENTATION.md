# Hướng dẫn triển khai và tiếp tục dự án

Cập nhật: **21/10/2026**. Tài liệu làm việc chung cho leader, thành viên và AI ở các chat tiếp theo. Đây là thứ tự triển khai, tiêu chí nghiệm thu và trạng thái thực tế; không phải tuyên bố sản phẩm đã hoạt động.

## Tiếp tục từ đây

**21/10 — Case Assignment đã tích hợp Supabase theo yêu cầu leader:** đã áp cloud `case_assignment` + `assignment_daily_receipts`, thêm một bảng `assignment_runs` (26 public tables), 5 RPC mới capacity/settings/preview/confirm/change_assignment; sửa manual RPC và mark_notification_read, notifications có batch target/RLS riêng. Queue mở modal live cho Supervisor trên mọi build; Details có capacity và explicit Confirm owner change, unassign cần reason; batch notification mở Queue. Preview thực thi SQL read-only; Confirm derive actor, validate kỳ/Agent/config, global transaction lock → share lock staff → case locks theo ID, risk-sorted commit, owner/capacity recheck, skipped reasons, unique request key/payload hash; assignment + tasks + events + grouped notification cùng transaction. Không tự đổi care stage/outcome, approve/send hoặc tạo AI job.

Mặc định tích hợp theo UI leader duyệt: **20/day, 40 open, weights40/30/30**, có nút **Save team limits & default weights** lưu workspace; weights có thể đổi riêng mỗi run. Hạn mức hiện hành áp cả manual/batch, không có bypass riêng; đây là quyết định triển khai demo, không phải policy nội bộ FPT. Daily distinct case/Agent/ngày Việt Nam, transfer không hoàn quota cũ, no-op không event, nhận lại cùng case cùng ngày không tính thêm. Capacity mọi kỳ. Continuity/Experience dùng hoạt động có actor trong 90 ngày, closed case + actual care activity cho Experience, frozen top-1 SHAP v5; history Dashboard mô phỏng được nhận diện/label, không tạo bảng history/seed mới, không dùng outcome làm skill. Guard case chồng kỳ trả review owner. Hai migrations dùng để giữ nguyên lịch sử migration đầu khi bổ sung edge case nhận lại trong ngày.

**Đã kiểm:** 9 assignment DB +38 workspace +8 ticket +7 rolling +2 replace/restore checks; Dashboard seed/rerun/rollback/RLS regression đạt; 28 UI/unit tests, build và diff check. Hosted Auth thật: Supervisor capacity200/3 preview200, Agent/Customer403 cho capacity/preview/confirm/settings, anon401; invalid weights400. Capacity ~697ms, Preview206–307ms trên mẫu này. Cloud Confirm1/retry/audit/group notification/owner đã kiểm trong transaction rollback; 0 test runs tồn tại sau kiểm, 12 October unassigned giữ nguyên. Hai backend PIDs khác nhau đã thử rollback, nhưng không đo được lock wait nên **chưa coi là proof concurrency đồng thời hoặc load test**. Browser localhost đăng nhập Supervisor thật, modal Live workspace, Weighted Preview1/11 remaining, owner dropdown chỉ 4 Agents/capacity + nút confirm riêng đã kiểm. 3 Agent roster bổ sung vẫn bị cấm đăng nhập theo seed Dashboard trước; không đổi Auth/credentials/consent. 25 SECURITY DEFINER warnings =22 cũ+3 RPC write có Supervisor guard; private deny-all INFO và leaked-password setting cũ giữ nguyên, không gọi production sign-off. Evidence `docs/evidence/case_assignment.json`, screenshot `assignment-live.jpg`, local test results; backup schema/settings/functions trong ignored `tmp/assignment-before.json`.

**Bước 3/4/8 — phần mở rộng assignment:** DB/RPC + UI integration hoàn tất, bước9 còn mobile/keyboard/tải đồng thời. **Chưa push/deploy Vercel**, không làm thay đổi deployment Dashboard ở chat khác. **0 n8n executions**, không ML/train/seed/timer/customer outbound. **Tiếp theo:** review trực tiếp app đăng nhập ở `http://127.0.0.1:5175/` (không dùng `?preview=assignment` nếu muốn ghi thật); khi release chỉ đưa source assignment + migrations/evidence liên quan, không chạy lại setup/seed/replace. Nếu cần demo đăng nhập đủ 4 Agent, phải provision quyền đăng nhập roster riêng, không coi các identities seed là account dùng được. Đọc 2 migrations, AutoAssign/ManualAssignment/Queue, tests assignment và evidence trước tiếp tục. Bản kế hoạch bên dưới là lịch sử review; các điểm quota/override/history phải đối chiếu quyết định triển khai tại mục mới này.

**21/10 — executive summary 5 trang theo final deck nhóm:** đã xuất `deliverables/Executive_Summary_PDMT_A4_5_Pages.pptx` (149.014 bytes), nguồn file Downloads `AI_Powered_Telecom_Customer_Retention.pptx.pptx`, 30 slides. Đúng 5 trang A4 dọc: 1 bìa Group2; 2 PD; 3 MT (gồm Chat-to-Ticket và Supervisor tools); 4 ROI/testing/pilot/roadmap/risks; 5 bìa sau không chữ. White/FPT, logo chỉ p2, native chart/workbook p2 và editable ROI table p4. ROI theo final rollout12 tháng54,9%/132,3%; cost27,232bn khớp benefit−net, threshold57.331 retained/year; không tái dùng6,67pp cũ hoặc cellbreak-even21,312bn mâu thuẫn. Notes ghi rõ reconciliation và assumptions. **Đã kiểm:** đọc toàn text30slides và ảnhROI/risk, render xem5trang, import final/re-render pixel-identical5/5; package/layout/font/chart/import đạt,0findings/0warnings, exactA4/back/logo/model/ROI checks đạt. **Còn:** chưa mở PowerPoint native/in giấy; không xuất PDF. **Tiếp theo:** người dùng review/bổ sung tên thành viên nếu cần, in actual-size reader order; 5trang không tự imposition booklet4trang. Đọc đầu `EXECUTIVE_SUMMARY_INFOGRAPHIC.md`, REPORT và output; phần4trang cũ đã đánh historical. Build/evidence riêng `tmp/summary-five/`, không sửa ML/app/cloud hoặc gọi n8n,0executions.

**21/10 — bàn giao release Dashboard cho leader tự deploy:** commit `efcfdd7` đã push main; Vercel chưa có deployment/status cho commit mới, browser quản trị yêu cầu login và máy không có Vercel token/session CLI. Leader chọn **“Tôi sẽ tự deploy”**, nên không tiếp tục thao tác phát hành thay leader. Cloud seed/API đã hoàn tất và kiểm login thật: Supervisor200/507 cases/5 staff/detail200, Agent+Customer403, anon401; 22 tests release/build và DB seed/rerun/rollback/RLS local đạt. Browser login Supervisor trên domain thật đạt nhưng vẫn bundle cũ; chưa thể gọi là Dashboard production đã chạy. Thay đổi Case Assignment riêng trong working tree được giữ, không nằm trong commit Dashboard. Evidence `docs/evidence/supervisor_dashboard.json` đã cập nhật local sau push. Tiếp theo: leader deploy main/efcfdd7, refresh và mở Dashboard; kiểm browser/filter/drill-down sau khi deployment ready. Không cần seed lại hoặc gọi n8n.

**21/10 — slide Supervisor Dashboard & Case Assignment:** đã xuất `deliverables/Supervisor_Dashboard_Case_Assignment.pptx`, đúng 1 slide English 16:9 để chèn sau slide Chat-to-Ticket người dùng gửi. Giữ nền trắng, navy/cam, heading METHOD và dải nhấn cuối; hai cột Dashboard/Case Assignment, có hai vùng chèn ảnh prototype và hướng dẫn crop. Copy mô tả workload/care progress, outcome đủ kỳ, Manual/Round-robin/Weighted và Supervisor Preview/Confirm; không ghi hiệu quả đã đo hoặc policy quota chưa chốt. **Đã kiểm:** render xem toàn slide, package/layout checks đạt, 0 findings/warnings, font Arial và text editable; finalizer đã qua validation/import nhưng bước hard-link bị EPERM trên Windows nên copy nguyên candidate đã kiểm ra file cuối, kiểm lại package/layout đạt. Chưa mở Microsoft PowerPoint, chưa chèn screenshot hoặc ghép vào deck chính. **Bước 8–9:** bổ sung artifact trình bày, không thay trạng thái nghiệm thu sản phẩm. **Tiếp theo:** thay hai vùng ảnh bằng screenshot crop Dashboard metrics/team và Assignment Preview, chèn sau Chat-to-Ticket và cập nhật số trang toàn deck. Đọc file PPTX này và đặc tả `docs/SUPERVISOR_DASHBOARD.md`, delta assignment trong mục dưới. Không sửa app/DB/ML hoặc gọi live, **0 n8n executions**.

**21/10 — Dashboard đã tích hợp Supabase, chuẩn bị release:** thêm RPC `retention_supervisor_dashboard` SECURITY INVOKER + active Supervisor guard; không thêm bảng. Đã import `dashboard-v1`: 300 case lịch sử (150 August/150 September) và chăm sóc 204 case October còn trống; 3 case đã dùng demo giữ ngoài seed. Cloud 507 cases/2.748 customers/3.005 predictions/4 Agents+1 Supervisor; 250 active/22 churned, October 207 Unknown. Ba roster identities mới bị cấm đăng nhập và không có credential; giữ login accounts hiện hành. Historical sample không lọc >500; điểm historical tính bằng champion frozen, không train/sửa model/data, không đưa labels vào ML/context. Seed giữ immutable revision→approval→mock receipt và các timestamps; không thêm consent, AI job, queued delivery/support. Đã kiểm local seed/rerun/rollback/RLS, 22 tests release/build, login thật Supervisor RPC200/detail200, Agent/Customer403/anon401. Evidence `docs/evidence/supervisor_dashboard.json`; private backup/manifest/rollback trong tmp/dashboard-cloud*. Có hoạt động người dùng song song trên ba fixture cũ nên không dùng thay đổi tổng jobs để quy kết seed. Code Case Assignment đang làm ở working tree được giữ ngoài release Dashboard. Deploy đang chờ; tiếp theo kiểm Vercel status/hosted bundle và browser nếu được cấp quyền. 0 n8n executions. Đọc migration 20261021150146, prepare_dashboard.py, seed/rollback templates và evidence trước sửa tiếp.

**21/10 — Case Assignment UI local theo yêu cầu leader:** thêm `AutoAssign.jsx`, `assignment.js`, `assignment.css`, `AssignmentPreview.jsx`; Queue có nút **Assign cases**, mở ba lựa chọn Manual/Round-robin/Weighted với icon **i** giải thích từng cơ chế. Chọn Agent, cấu hình daily/open limits, Weighted weights/reset, Preview bảng điểm/lý do, đổi owner rồi Preview lại; Confirm chỉ đổi state local, giữ cursor RR và cập nhật Queue/capacity, kết quả có notification preview từng Agent. Trang `http://127.0.0.1:5175/?preview=assignment` DEV-only dùng 207 predictions >500 từ fixture Dashboard local; reset toàn owner thành unassigned cho kịch bản review, capacity/history/group routing là mô phỏng, không lấy làm trạng thái cloud. Signed-in Supervisor ở DEV có đường mở preview; production chưa hiện nút vì chưa có assignment RPC mới. **Đã kiểm:** 27 UI/unit tests gồm 5 assignment tests (risk/capacity/cursor, weighted 62,5, invalid weights, manual, missing history/eligibility); build/diff đạt. Browser đã mở chooser/icon i, chặn weights=101%, Weighted Preview→Confirm 51 assignments/156 remaining (14/16/11/10 theo Agent), Queue Outreach51; Manual Preview1 và RR Preview51 đạt; reset rồi để chooser mở cho leader. Screenshot `docs/evidence/assignment-chooser.jpg`. **Còn vướng:** chưa mobile/keyboard QA đầy đủ, chưa backend concurrency/RLS/persistence hoặc notification thật; policy đang ở mục review bên dưới. **Bước 4/8:** prototype UI local có thể review, bước 3 backend và bước 9 nghiệm thu đầy đủ chưa hoàn tất. **Tiếp theo:** review UI rồi triển khai RPC/migration theo kế hoạch, nối server-authoritative Preview/Confirm, không mang JS simulation sang production writes. Không seed/cloud/ML/LLM/deploy/push, **0 n8n executions**. Vite ngoài sandbox session 31175 chạy port5175; browser IAB tab2 đã giữ làm deliverable. Đọc các file mới, Queue.jsx và kế hoạch dưới đây trước tiếp tục.

**21/10 — review và kế hoạch tích hợp Case Assignment (ponytail):** đã đọc `C:/Users/ADMIN/Downloads/CASE_ASSIGNMENT.md`, đối chiếu Queue/Details, assignment RPC, RLS/notifications, v5 ingestion và Dashboard local. Kết luận: giữ manual + preview/confirm Round-robin/Weighted, cần làm rõ quota/reassignment, kinh nghiệm SHAP và concurrency trước triển khai. Kế hoạch chi tiết ngay dưới đây; đây là đề xuất, không phải leader đã duyệt các policy trong file đính kèm. **Đã kiểm:** source/schema/callers và diff tài liệu; chưa chạy runtime/concurrency/cloud. **Bước 3/4/8/9:** mới review thiết kế phần mở rộng, chưa triển khai hoặc nghiệm thu. Không sửa app/DB/ML, không seed/tạo Auth accounts/deploy; **0 n8n executions**. **Tiếp theo:** chốt các lựa chọn nghiệp vụ ở cuối kế hoạch, triển khai migration và test local trước UI; đọc mục này, SYSTEM delta assignment, BRIEF delta assignment và file nguồn người dùng. Giữ nguyên các thay đổi Dashboard đang có trong working tree.

### Kế hoạch tích hợp Case Assignment — đề xuất 21/10, chưa triển khai

**Nguồn và phạm vi:** file CASE_ASSIGNMENT người dùng cung cấp là đầu vào để review, không phải lệnh thực thi hay phê duyệt mọi chi tiết. Mục tiêu là Supervisor chia nhanh case chưa có owner, xem trước và xác nhận; không tự outbound, không gọi n8n/LLM. Giữ hai cơ chế batch; triển khai Round-robin trước để có một luồng hoàn chỉnh, rồi bổ sung Weighted trên cùng preview/confirm. Không tạo trang quản trị, engine phân ca, tự cân bằng lại hoặc thuật toán tối ưu toàn cục.

**Hiện trạng đã đối chiếu:**

- `Queue.jsx` đọc `retention_care_queue`, lọc theo `target_period_start`, chưa có batch assignment. Dùng cả start/end thực của v5, không lọc theo tháng 10 chung chung.
- `main.jsx` Details gọi `retention_assign_case` ngay khi đổi select, chỉ lọc active nên có cả Supervisor. RPC cũng chỉ kiểm active, chưa ép role Agent, chưa chặn closed, chưa có quota/no-op guard. Option Unassigned gửi null nhưng RPC hiện từ chối null: phải quyết định hỗ trợ unassign có chủ đích hoặc bỏ option, không để UI báo thành công giả.
- RPC hiện khóa case, đổi owner, chuyển pending/due follow-ups, ghi `case.assigned` và thông báo từng case. Phải giữ chuyển task và quyền theo owner, không viết đường batch làm mất hành vi này. Lặp gán cùng owner hiện vẫn sinh event/notification.
- `notifications.case_id` đang NOT NULL; policy yêu cầu recipient và quyền đọc case; UI luôn Open case. Một thông báo gộp cần đổi cả schema, RLS và đường mở Queue.
- Dashboard local có staff fixture/history riêng; chưa là Auth accounts hay lịch sử cloud. Không nhập 507 case fixture Dashboard để phục vụ assignment hoặc gọi đó là dữ liệu vận hành thật.

**Quy tắc đề xuất để đặc tả có thể code/test được:**

1. **Case/Agent đủ điều kiện:** case unassigned, status khác closed, đúng start/end của kỳ chọn và prediction thuộc alert >500; Agent active thuộc pilot hiện hành, do Supervisor chọn. Search, Mine và care-stage filter trên Queue không âm thầm thu hẹp phạm vi: modal ghi rõ toàn bộ unassigned của kỳ. Open load tính mọi kỳ, gồm new/in_progress/waiting_customer/resolving_request; không lọc chỉ kỳ đang xem. Case hết kỳ mà chưa closed vẫn chiếm tải, không tự đóng hoặc suy outcome.
2. **Quota:** capacity = max(0, min(daily_limit − received_today, open_limit − open_count)). Ngày là [00:00, 00:00 ngày sau) Asia/Ho_Chi_Minh theo clock server, lưu timestamp UTC; không lấy ngày browser. Daily assignment limit khác `daily_contact_limit` hiện có (giới hạn gửi/contact theo khách). Theo file nguồn, 20/day được mô tả là đã chốt, nhưng cùng file lại cho manual vượt mọi hạn mức: đây là mâu thuẫn cần leader xác nhận. Đề xuất giữ 20 là hard cap mọi đường gán; chỉ cho manual override open cap 40 với xác nhận và lý do. Nếu leader muốn override cả 20 thì sửa tiêu chí thành hard cap cho batch, soft cap cho manual.
3. **Đếm lượt nhận:** đề xuất đếm distinct (Agent, case, ngày nhận), từ assignment thành công; transfer A→B tính cho B, không hoàn quota đã dùng của A. Gán lại đúng owner là no-op; case quay lại cùng Agent trong cùng ngày không đếm thêm, nhưng vẫn kiểm open cap khi nhận lại. Case đang mở chuyển người làm tải A giảm/B tăng; unassign không hoàn daily quota. Preview/skipped/failed/retry không tính. Event mới phải có old/new owner, thời điểm, mode, run, override reason; không suy daily quota từ owner hiện tại hay `updated_at`. Event cũ thiếu old owner không được backfill thành lịch sử chính xác; ghi giới hạn legacy và bắt đầu đếm đáng tin từ cutover.
4. **Quyền manual:** chỉ Supervisor thao tác; đích là Agent active. Chặn assign/reassign case closed. Đề xuất giữ unassign như thao tác riêng có xác nhận/lý do, chuyển pending/due tasks về null và không tạo notification gửi null. Khi chuyển owner, old Agent mất quyền thao tác; queued outbound/AI vẫn theo revision, consent và ownership recheck hiện hành, không tự approve/send hoặc rewrite actor cũ. Test cả stale tab của old Agent và delivery đã approve trước transfer.
5. **Ưu tiên/fairness:** sort probability DESC, case.created_at ASC, case.id ASC. Round-robin chia số lượt mới tương đối đều, không bảo đảm tổng workload đều khi tải ban đầu khác nhau; ghi rõ trên UI. Dùng danh sách Agent sắp xếp ổn định theo user_id, cursor chung pilot lưu last committed Agent, chọn người kế tiếp trong tập đang chọn, wrap cuối danh sách. Khi người cũ bị bỏ/inactive, tìm người kế tiếp theo cùng thứ tự. Preview không đổi cursor; Confirm chỉ đổi theo dòng Round-robin thực sự commit cuối cùng; Weighted/manual không đổi cursor. Với override trong preview, dùng recipient thực commit cho cursor.
6. **Weighted:** giữ công thức 40/30/30 như gợi ý cần duyệt, không giới thiệu là tối ưu đã đo. Continuity 40 điểm có thể thắng chênh lệch Load tối đa 30 điểm: ví dụ A 62,5/B 52,5 đúng toán và thể hiện ưu tiên quan hệ hơn cân tải. Giữ hard capacity để chặn quá tải; nếu Product ưu tiên cân tải hơn thì đổi weights sau review, không tự chỉnh. Tính capacity/load sau từng lượt dự kiến, không dùng toàn bộ tải ban đầu cho cả batch. Tie: open thấp hơn → received_today thấp hơn → user_id để có kết quả xác định.
7. **Định nghĩa tín hiệu:** đổi nhãn Skill thành **Relevant case experience**, không gọi số case đã xử lý là năng lực hoặc tỷ lệ giữ chân. Continuity lấy người chăm sóc gần nhất có bằng chứng trước lần phân bổ, không lấy bất kỳ người từng được gán; chỉ dùng lịch sử đã xảy ra, không dùng dữ liệu tương lai. Experience đếm distinct case đã closed và có activity chăm sóc thực sự quy cho Agent đó, theo top-1 nhóm SHAP tại thời điểm case lịch sử; không đếm mỗi event, mỗi prediction chồng nhau hoặc case mới được giao. Chốt cùng khoảng lịch sử, đề xuất 90 ngày trước lúc phân bổ. Case closed không đồng nghĩa retained, không dùng outcome để giả performance.
8. **SHAP/missing:** dùng `group_id` của driver rank 1 trong frozen context đúng prediction/explanation version; chỉ positive signed group như pipeline v5, không dùng abs SHAP hoặc tự suy từ tên complaint. Thiếu driver hợp lệ → Experience=0 với lý do rõ; max experience=0 → 0 cho mọi Agent, không chia 0. Giữ weights đã chọn, không âm thầm phân phối lại phần thiếu sang yếu tố khác; điểm là routing score 0–100, không phải churn probability. Mẫu số max lấy tập Agent còn capacity tại lượt đó, chốt lại sau mỗi lượt; giải thích điểm mang tính tương đối trong tập tham gia. Backend kiểm weights hữu hạn, không âm, tổng 100; cả ba yếu tố phải cùng thang [0,1].
9. **Cửa sổ chồng nhau:** nếu khách đã có case khác đang mở và đã có owner, batch mới đưa vào `Existing active case — review owner`, không tự giao cho Agent khác. Đây là guard nhỏ tại assignment, chưa thay đổi grain ingestion hoặc tự merge cases. Supervisor xem case liên quan để quyết định manual; không suy Continuity chỉ từ việc trùng customer trong hai cửa sổ hiện tại.

**Thiết kế tối thiểu và các nơi phải sửa:**

| Phần | Thay đổi cần tới |
|---|---|
| Migration mới | Thêm assignment daily/open limits, default weights và RR cursor vào workspace_settings; không dùng daily_contact_limit cho assignment. Thêm assignment_runs có unique request_key, actor, payload hash, kỳ, mode/settings, kết quả từng dòng/counts. Dùng interaction_events làm ledger từng lượt, tránh thêm bảng assignments trùng công dụng. |
| Lịch sử | staff_care_history chỉ thêm khi cần seed demo đã được duyệt; lưu customer/Agent, thời điểm chăm sóc, case/source reference, group_id, is_simulated và seed key chống nhân bản. Lịch sử thật lấy từ activity hiện có có quy actor, không chép thành hai nguồn để double count. |
| API | retention_agent_capacity; retention_preview_assignment; retention_confirm_assignment; sửa retention_assign_case nhưng giữ các caller hai tham số hoạt động ở đường không override. Chỉ thêm optional args cho explicit override/expected_owner khi cần, không tạo overload mơ hồ. Một helper private ghi assignment dùng chung, giữ follow-up transfer và audit; batch không phát thông báo từng case. |
| Audit | case.assigned có old/new owner, mode, run_id, score components, basis real/simulated, người thực hiện, override/reason. Payload do server tính, không tin score/history/actor từ browser. Unassign dùng case.unassigned riêng, không tính quota nhận mới. |
| Notifications | Thêm type case_assignment_batch, assignment_run_id và case_id nullable có constraint: notification case cũ phải có case_id, batch phải có run. Gộp một recipient/run với unique key; policy batch chỉ đúng recipient, không mở quyền đọc run chứa case người khác. UI Open queue cho batch; Open case giữ với loại cũ. Summary chỉ số đã commit, không gồm skipped. |
| UI | Queue.jsx thêm nút Supervisor-only, modal riêng AutoAssign.jsx, dùng style/form hiện có. main.jsx Details thêm capacity và bước xác nhận override/unassign; notification click xử lý batch. Không refactor toàn App. |
| Dashboard | Dùng cùng định nghĩa open load; giữ filter cohort của chart nhưng ghi rõ capacity toàn bộ kỳ. case.assigned không trở thành activity chăm sóc/worked; simulated routing history không tự nhập KPI hiệu suất. |
| Install/fixtures/tests | Migration là nguồn chuẩn; build_setup.py sinh lại setup.sql, kiểm generated upgrade_lean.sql có đường assignment cũ không để regress. Cập nhật verify_workspace.sql/count checks/grants nếu thêm bảng, không sửa migration lịch sử. Thêm DB assignment tests + UI helper tests, giữ workspace/ticket/rolling/replacement regressions và fixture hiện có. |
| Docs | SYSTEM và BRIEF ghi delta đề xuất, Implementation giữ tiến độ; cập nhật contract/evidence thực tế khi triển khai. Không tạo thêm plan/log theo chat. |

**Preview → Confirm và đồng thời:**

- Preview chỉ đọc và mô phỏng trong một DB snapshot nhất quán; trả kỳ, settings/cursor version hoặc fingerprint, as_of, capacity before/after, proposals, components/reasons, blocked list và totals. Không insert run, không reserve quota/case, không notification.
- Đổi Agent một dòng phải tính lại capacity của toàn phương án, cập nhật lý do và gắn Manual override, không giữ score của người cũ. Bản nhỏ nhất cho sửa rồi bấm Preview lại trước Confirm. Override trong batch vẫn không vượt hard cap; ngoại lệ xử lý từ màn manual.
- Confirm nhận request_key ổn định cho một thao tác và danh sách case→Agent đã duyệt. Cùng key/cùng actor/payload trả kết quả cũ; key khác payload bị từ chối. Validate role, kích thước, duplicate cases, selected Agents, kỳ và settings; không nhận thêm closed/assigned/out-of-period case bằng sửa request client. Score/reasons lấy từ server, audit phân biệt đề xuất/override và capacity lúc commit.
- Với pilot một workspace, dùng transaction-level advisory lock chung cho mọi assignment manual/batch/unassign trước row locks; sau đó khóa cases theo ID và re-read quota/owner. Nếu settings/cursor dùng khi Preview đã đổi, yêu cầu Preview lại; capacity/case đổi thì giữ người đã duyệt, dòng không hợp lệ bị skipped với reason, không tự reroute. Activity/close/ingestion đổi trạng thái case phải được recheck sau case lock; không gán lại case vừa đóng. Hạn chế lock scope ở transaction, không giữ khóa qua thời gian người dùng xem modal.
- Lý do cần khóa chung: hai Supervisor có thể gán hai case khác nhau cho cùng Agent còn một slot, nên chỉ khóa từng case không ngăn vượt quota. Thứ tự assignment lock trước case lock phải nhất quán mọi caller để tránh deadlock. Một helper riêng không tự đủ nếu đường manual vẫn đi đường cũ.
- Commit assignment + follow-up owner + events + run result + batch notifications cùng transaction; validation business lỗi theo dòng được skipped, lỗi DB bất ngờ rollback cả run. Confirm thành công dù một phần, UI hiển thị Assigned/Skipped/Remaining bằng kết quả thực. Retry sau mất mạng dùng cùng key; muốn chia tiếp dùng Preview mới/key mới.
- RLS/grants cho bảng mới; RPC chỉ Supervisor active, derive actor bằng auth.uid(), search_path an toàn, revoke PUBLIC/anon EXECUTE; không dựa vào ẩn nút. Agent/portal không được đọc capacity cả đội, simulated history hoặc assignment run của người khác. Có thể tiếp tục pattern RPC có guard của repo, không mở direct browser writes.

**Thứ tự triển khai và cổng hoàn thành:**

1. **Chốt policy/contract:** giải quyết hard/soft quota, đơn vị đếm, continuity/experience, overlapping case, cursor và override. Chốt payload/error/skip reason English. Đầu ra: cập nhật chính mục này + SYSTEM/BRIEF, không coi file đính kèm tự là phê duyệt.
2. **Backend manual + capacity + Round-robin:** migration non-destructive và test local; quota dùng chung, cursor/idempotency, audit/tasks/notification gộp. Đạt khi example fixtures đúng, quyền bị chặn và concurrency hai kết nối trên PostgreSQL thật đạt. PGlite hiện có hữu ích cho regression nhưng không được gọi là bằng chứng multi-session concurrency.
3. **UI luồng hoàn chỉnh:** modal Config → Preview → Confirm → Results, default kế thừa đúng kỳ Queue, hiển thị remaining capacity/tổng unassigned không giao được; nút disabled khi pending nhưng server vẫn idempotent. Keyboard/focus/labels, loading/error/empty, giữ config khi poll. Kiểm manual transfer/unassign, recipient notifications và stale Agent tab.
4. **Weighted:** thêm scoring vào cùng API/modal và tests; cùng input/state cho cùng output, ví dụ A/B của nguồn đạt; zero history/top1 missing/tie/weights invalid/dynamic capacity đạt. Không cần thêm ML hoặc LLM.
5. **Demo/release:** ưu tiên fixture local, reused history đã kiểm; nếu leader duyệt thì seed history riêng có nhãn mô phỏng và provision Agent Auth thật (fixture IDs chưa đủ). Review migration/diff, deploy DB trước UI tương thích, giữ dữ liệu/consent hiện có; browser Supervisor→Agent và kiểm role portal. Không seed/deploy trong phiên lập kế hoạch; 0 n8n executions cần cho cả tính năng.

**Ma trận nghiệm thu cần bổ sung vào file nguồn:**

- Biên 19/20, 20/20, 39/40, vượt 40; tất cả trạng thái mở, nhiều kỳ; ngày Việt Nam qua 00:00 (17:00 UTC), midnight giữa Preview/Confirm.
- Transfer/no-op/unassign/reassign lại cùng ngày; daily không hoàn khi chuyển; override open có reason; hard daily không bị manual bypass nếu policy này được chốt. Legacy events được cảnh báo, không giả backfill.
- RR qua hai Confirm, Preview lặp không tiêu cursor; đổi tập Agent/inactive/skip/all full/override; sort risk tie theo tuổi rồi ID.
- Weighted đúng 62,5/52,5; zero max, missing SHAP, các weights ngoài miền, deterministic tie và cập nhật Load/eligibility theo lượt; một history case không nhân theo events hoặc customer snapshot chồng nhau.
- Confirm double click, retry sau timeout, key trùng khác payload, request giả điểm/owner/case ngoài kỳ, cùng case xuất hiện hai lần; không notification/event thừa; Agent/portal bị từ chối ở server.
- Hai Supervisor tranh cùng case; hai case khác nhau tranh slot thứ 20 hoặc 40, manual chạy đồng thời batch; close/reassign/disable Agent sau Preview. Test thật nhiều connections, xác nhận committed counts không vượt policy.
- Unassign hoặc transfer chuyển pending/due tasks, không tự chuyển actor lịch sử; notifications cũ không lộ case sau mất quyền; summary route Queue không cố mở case null. Existing active case của cùng customer phải được báo.
- Reconciliation: eligible = committed + skipped + remaining theo scope đã định nghĩa; summary mỗi Agent bằng số assignments thực commit, không tính preview; Dashboard worked/KPI không tăng chỉ vì phân công hoặc seed history.
- Fresh setup/upgrade và workspace/ticket/rolling/replacement regressions đạt; build và browser desktop/mobile/keyboard đạt. Không gọi tất cả là pass trước khi có output/evidence.

**Các quyết định còn cần leader review:** 40 open và 40/30/30; 20/day có thực sự hard cả manual hay cho ngoại lệ; đơn vị distinct case/Agent/day và không hoàn quota; continuity là chăm sóc gần nhất, cửa sổ kinh nghiệm 90 ngày; guard case chồng cửa sổ; có dùng lịch sử mô phỏng/tạo thêm Agent Auth hay chỉ demo local. Đề xuất UX cho bản đầu: Round-robin mặc định, Weighted là lựa chọn có giải thích và badge simulated khi có dùng lịch sử mô phỏng. Không cần chờ các mục demo để xây backend/fixture local sau khi được yêu cầu triển khai.

**Tài liệu kỹ thuật đã đối chiếu:** [PostgreSQL explicit/advisory locking](https://www.postgresql.org/docs/current/explicit-locking.html), [Supabase database functions và quyền execute](https://supabase.com/docs/guides/database/functions). Web reader không đọc được changelog.md do content-type; trước lúc thực thi migration cần kiểm changelog/docs hiện hành. Đây là cơ sở chọn cách khóa và guard, không phải evidence runtime của app.

**21/10 — tinh chỉnh Dashboard theo yêu cầu leader:** đổi 4 tên fixture thành Nguyễn Minh Anh/Trần Thu Hà/Lê Hoàng Nam/Phạm Ngọc Linh; cloud chỉ có 2 staff, đã UPDATE đúng display_name Agent=Nguyễn Minh Anh và Supervisor=Trần Thanh Hằng, đọc lại đạt; không đổi Auth/quyền. Bỏ banner/note synthetic/simulated khỏi product header/footer/dashboard/queue/ticket theo yêu cầu; vẫn giữ provenance và simulated flags trong dữ liệu/docs, không gọi dữ liệu thành observed thật. Thêm biểu đồ **Primary care issues · Contracts & churn**, 6 nhóm trong fixture, 2 thanh chung thang đo, known coverage/rate, bảng số và drill-down. Nhóm fixture được phân bổ deterministic SHA256 theo case identity để mô phỏng vấn đề chăm sóc, độc lập outcome, không phải latent cause/SHAP hoặc nguyên nhân churn xác nhận. Live dùng category của ticket submitted gần nhất, thiếu thì Unclassified; không thêm bảng. Khi nhiều kỳ chọn kỳ mature gần nhất/customer, nếu chưa có mature dùng selected current để đếm hợp đồng và để churn unavailable; 294 hợp đồng lịch sử duy nhất, 22 churn, không cộng lặp case qua cohort. Đã kiểm 22 tests, generator assertions, group reconciliation và build; UI copy được rà source. Còn browser click/mobile chưa kiểm do browser policy đã ghi trước. Chưa seed lịch sử lên cloud/deploy; chỉ display_name cloud đã đổi, 0 n8n executions. Tiếp theo review localhost rồi tiếp tục cloud seed theo phạm vi đã thống nhất; đọc Dashboard.jsx/dashboard.js/seed-dashboard.py và spec.

**21/10 — xuất snapshot đầy đủ cho slide theo yêu cầu leader:** đọc live Supabase bằng SELECT, chọn hợp đồng synthetic `DEMO-0196-VULGZ`, snapshot 10/10/2026, kỳ [11/10,11/11), label Unknown. Đầu ra `deliverables/example_customer_snapshot_0196-VULGZ.md` (bảng English + lựa chọn cho slide) và `.json` (giá trị gốc + schema): đủ 53/53 cột của customers/customer_snapshots/churn_predictions/prediction_runs/prediction_contexts, mở đủ 127 features và giữ nested SHAP context/null. Đã kiểm schema cloud, whitelist config và liên kết IDs local; không sửa DB/model/app, 0 n8n executions. Phạm vi là customer snapshot, không xuất chat/ticket/Auth; chưa chèn vào PPTX. Tiếp theo: leader chọn trường từ bản Markdown để cập nhật slide, giữ caption synthetic demo và đúng ngày/kỳ; đọc hai file xuất nếu tiếp tục.

**21/10 — Dashboard Supervisor đã có source và localhost preview:** thêm Dashboard.jsx/dashboard.js/dashboard.css, tab Supervisor trong main.jsx, live reads qua Supabase/RLS hiện hành; preview DEV-only `?preview=dashboard` dùng fixture riêng, không bypass Auth cloud. Script `website/app/scripts/seed-dashboard.py` giữ nguyên ML, đọc nhãn v5 và latest predictions; tạo 507 case (150 August +150 September +207 October), 4 demo staff local, 2.225 events, tasks/tickets. Historical sample không lọc risk >500, không gọi là alert cohort; current 207 theo inference >500. Outcome 250 active/22 churned/28 mature missing/207 awaiting, sum=507; 174 open/13 unassigned/41 overdue tasks. Các fixture staff chỉ là identity local, chưa tạo Auth accounts. Fixture `.dashboard-fixture.json` ignored và chỉ phục vụ qua Vite configureServer; không đóng gói production. Đã sửa outcome parser nhận nhãn CSV 0/1 và live queue dùng case_id, ticket attribution dùng submitted_by khi có. **Đã kiểm:** generator assertions (nhãn, ID, thời gian/pre-churn), reconciliation và cohort/owner filters local, 21 UI/unit tests, build và diff check đạt; HTTP200 trang/fixture/transformed JSX trên localhost ngoài sandbox. Server Vite session 85334 tại `http://127.0.0.1:5173/?preview=dashboard`; đã gửi open_in_codex. **Còn vướng:** browser tab trước báo timeout; sau restart, browser automation vẫn từ chối URL authority/protocol nên chưa kiểm screenshot/click/mobile hoặc authenticated live view. Không gọi đường vòng để vượt browser policy. **Bước 8:** source + local simulation đã có; bước 9 chưa tổng nghiệm thu UI. **Tiếp theo:** kiểm visual/click khi browser access hoạt động; review fixture trước mọi cloud import. Không seed cloud, không deploy/push, không tạo job/outbound và 0 n8n executions. Đọc Dashboard.jsx, dashboard.js, seed-dashboard.py và SUPERVISOR_DASHBOARD trước tiếp tục.

**21/10 — làm rõ dữ liệu mô phỏng Dashboard:** leader hỏi bổ sung tháng trước; đã kiểm lại migration/RPC v5, có thể thêm lịch sử August/September với outcome đủ kỳ, còn cohort [11/10,11/11) giữ Unknown. Chưa seed/sửa cloud hoặc sinh lại ML. Phát hiện và sửa một lỗi trong đặc tả: `retention_outcomes.window_end` lưu ngày cuối **bao gồm**, bằng prediction end_exclusive−1, không phải cận exclusive. Nguồn kiểm: migration rolling dòng join outcome và retention_record_outcome; diff Markdown đạt. Tiếp theo nếu triển khai: dựng fixture local có staff hợp lệ, lịch sử activity và labels nhất quán; kiểm trước import, không dùng n8n để sinh lịch sử.

**21/10 — đặc tả tab Dashboard cho Supervisor theo yêu cầu leader:** đã viết [SUPERVISOR_DASHBOARD.md](SUPERVISOR_DASHBOARD.md), gồm bố cục, filters/thời gian, KPI có tử/mẫu và grain, charts/drill-down, workload/activity attribution, outcome coverage và bổ sung dữ liệu tối thiểu. Đã đọc tài liệu nguồn/schema/UI, chạy 2 SELECT aggregate cloud và tổng hợp churn_labels.csv v5 local: cloud có 207 case (204 unassigned), 0 outcome, một Agent; lịch sử synthetic có 2.812 churn events duy nhất, không là kết quả chăm sóc app. Phân biệt contacted/sent/replied, closed/active và cohort chồng nhau; theo guard RPC v5 chỉ known outcome sau hết kỳ. **Đã kiểm:** số aggregate/reconciliation và diff Markdown; không đổi code/schema/data, không test runtime hoặc browser, **0 n8n executions**. **Trạng thái bước 4/8:** đặc tả xong, chờ leader review, Dashboard chưa triển khai. **Còn vướng:** chưa có outcome/service event feed, thiếu event attribution cho KPI năng suất đầy đủ. **Tiếp theo:** review đặc tả rồi triển khai workload/empty outcome trước; chỉ bổ sung instrumentation theo metric được chọn. Đọc SUPERVISOR_DASHBOARD, System, BRIEF và các write RPC trước code. Yêu cầu mới mở rộng baseline bằng tab Supervisor, không tạo dashboard kỹ thuật.

**21/10 — Chat-to-Ticket theo mockup leader duyệt:** thêm tab Support ticket giữa Call script/Internal notes, thay form Refer to Technical Support cũ; editor giữ nội dung khi đổi tab/poll, form manual/AI, routing theo category, repeat/churn từ chat có evidence, missing fields → AI message nháp để staff review. Thêm migration `20261020182841_chat_to_ticket.sql`: mở rộng support_requests (không thêm bảng), trạng thái draft, version guard, snapshot chat/job và 5 RPC; staff Save/Submit riêng, worker chỉ Context/Complete. Chỉ lấy inbound/external và outbound đã gửi đúng revision, không call notes/unsent/ML score; snapshot được đóng băng khi request, AI completion không ghi đè draft staff. Giữ consent/approval/timer và model v5. Workflow [Retention · AI ticket](https://group-2-new.app.n8n.cloud/workflow/uYazemvlz8sw7FW3) 10 nodes, 2 groups, webhook-only, publish trên group-2-new; JWT/RLS → atomic claim → frozen context → LLM JSON schema → evidence validation → draft; lỗi mark job failed. Không lưu execution data, export active=false. Supabase MCP đã OAuth lại theo yêu cầu leader; migration cloud applied, grants đã đọc lại; 3 RPC staff/2 RPC worker, anon không có quyền. Advisor 22 definer RPC warnings (19 cũ+3 mới có require_staff), no-policy INFO private deny-all và leaked-password setting cũ giữ nguyên.

Kiểm tra: **18 UI +38 DB regression +8 ticket DB +9 n8n validator**, build đạt. Live cap2 nhưng dùng đúng **1 execution**: Supervisor trên chat synthetic có sẵn, job completed/ticket draft với evidence, không submit/không tạo message; output missing_fields=[] nên không gọi clarification AI thừa. Nhánh clarification được kiểm helper/wiring local; chưa live nhánh thiếu thông tin. Cloud Save→Submit/idempotence đã kiểm role authenticated trong transaction rollback, không để ticket queued. Evidence `docs/evidence/chat_to_ticket.json`, kết quả DB `supabase/tests/ticket-results.json`. Không sửa data/ML hoặc bật lịch. **Release đã kiểm 21/10:** leader cho phép commit/push toàn bộ code và tài liệu lên main; commit `8aec764` đã deploy, Vercel status success/Deployment has completed. Domain thật HTTP200 tải `/assets/index-Cuvgv-ph.js` chứa Support ticket và Request/Submit RPC mới; GET `/api/retention-ai-ticket` trả lỗi JSON n8n đúng POST-only, không tạo execution. **Còn vướng:** chưa browser click E2E/mobile. Submit ticket chỉ enqueue bàn giao mock; operator chạy worker Follow-ups/support thủ công theo cơ chế hiện hành. **Tiếp theo:** leader refresh website, mở Support ticket và review; browser QA khi cần, chỉ thêm live AI nếu có lý do mới. Đọc SupportTicket.jsx, ticket.js, migration, n8n/02_ai_ticket.json và evidence trước tiếp tục. Bước 8–9 mở rộng này đã kiểm backend và hosted bundle/proxy, chưa nghiệm thu click UI end-to-end.

**21/10 — sửa nút AI treo theo báo lỗi leader:** đọc job thật thấy 2 explanation queued/unclaimed; cả ba workflow active/sameAsDraft, CORS local đạt, Vercel proxy nhận đúng POST. Dùng đúng **4 executions** qua domain production: khôi phục 2 explanation cũ +1 message +1 call_script, tất cả completed/LLM; message vẫn draft/not_queued, không duyệt/gửi. Retry RPC được kiểm dùng lại job ID cũ; không còn queued theo Supervisor. Không xác định được nguyên nhân transport của lượt lỗi ban đầu vì execution data production tắt. Sửa AIRequestButton: queued chưa claim >30 giây cho Retry, claimed >5 phút theo timeout server cho Retry, không tự gọi thêm workflow; server coalesce/atomic claim giữ nguyên. Đưa load UI sau webhook để lỗi refresh không chặn wakeup; kiểm JSON acknowledgment để không coi HTML 200 là accepted. Scope normal/rewrite dùng chung nút; không đổi workflow/SQL/credentials/consent/timer. 14 UI tests (có regression timeout/refresh/HTML response) và build đạt; evidence `docs/evidence/ai_request_recovery.json`. **Release đã kiểm 21/10:** leader xác nhận “push đi”, commit `96b8270` đã push main; GitHub Vercel status success/Deployment has completed. GET production HTTP200 tải `/assets/index-CP-tuubk.js`, có cả Retry và acknowledgment validation mới. Không gọi thêm AI để kiểm deploy. **Còn vướng:** chưa kiểm click browser end-to-end; nguyên nhân transport cũ chưa xác định. **Tiếp theo:** leader refresh trang để dùng UI mới; chỉ chạy thêm live khi có lỗi mới. Đọc AIRequestButton.jsx, tests/ai-request.test.js, evidence recovery và n8n/README.

**19/10 — cutover webhook n8n theo yêu cầu leader:** publish đúng ba AI worker `nNbDkr6XkXbbNOjl` / `0rCQHXSgtE7LKuhC` / `5Kt2SpYMSKcnxJ2s` trên group-2-new, đọc lại active version=sameAsDraft và timer disabled. Đổi host trong main.jsx, vercel.json, deployment test và agent-flow.mjs; sửa thông báo lỗi để không hứa fallback tự chạy khi timer tắt. Test đúng **5 executions**, IDs 1–5: AI message/call_script/explanation completed và lưu LLM artifacts; message chưa duyệt/chưa gửi. RPC coalesce đã dùng pending job có sẵn cho message/explanation, fixture đối chiếu persisted request_key, không gọi AI lại. Delivery #4 success nhưng chỉ nhánh queue rỗng: 3 preferences Zalo có consent không khớp case hiện hành, không tự cấp consent; tin test cố định ở case Agent bị server chặn duyệt nên còn draft chưa gửi. Follow-up/support #5 success, mỗi nhánh xử lý 1; đã đọc lại mock receipt, task due và notification bằng đúng Agent recipient. Evidence `docs/evidence/n8n_cutover.json`; fixture/script `n8n/tests/cutover-flow.mjs`, state ignored trong tmp. Local 10 UI/deployment +6 validator checks và build đạt. Không đổi data/model/consent/schema, không bật timer. **Còn vướng:** source chưa push/redeploy Vercel; hosted proxy còn cần release và kiểm browser. Delivery nhánh gửi chưa kiểm do thiếu case có consent; cần fixture được người dùng duyệt nếu muốn test thêm. **Tiếp theo:** deploy UI/proxy khi thực hiện release, browser QA; demo operator chạy delivery và follow-up/support thủ công. Đọc n8n/README, DEPLOYMENT, evidence cutover trước các ghi chú lịch sử bên dưới. Bước 8–9 đã có kiểm live trên account mới nhưng chưa nghiệm thu browser/hosted hoặc delivery send.

**19/10 — bổ sung giải thích slide15:** cập nhật SLIDE_CONTENT slide15 thành 3 đoạn đầy đủ về lý do chọn boosted-tree candidates, Optuna TPE (30 combinations/họ, dùng kết quả trial trước, đánh giá 3 chronological folds), Platt calibration (ranking khác probability, nhóm khách riêng, gate Brier/logloss out-of-fold). Cột phải dành bảng tuned-pair, lý do chọn theo validation AUC và 114rounds/depth7/leaves12. Chi tiết mechanics/CV metrics/early stopping và ví dụ70% conceptual ở speaker notes. Không đổi model/metrics/PPTX; đã đối chiếu wording với protocol hiện hành. Việc tiếp theo: review copy rồi cập nhật deck khi yêu cầu; 0 executions.

**19/10 — ảnh slide14 theo ngôn ngữ đơn giản/nền trắng tinh:** final `deliverables/training_records_white.png` (2000×2500), source SVG cùng tên. Tiêu đề Which Records Can Be Used for Training?, không dùng từ purging trong ảnh; hai cửa sổ training đối chiếu boundary01/07. Hai thử ImageGen vẫn có noise gần trắng nên final dựng vector mới, rasterize SVG; đã xem ảnh/kiểm đúng dates và border #FFFFFF. Link current asset trong SLIDE_CONTENT; không thay PPTX/model, 0 n8n executions.

**19/10 — ảnh minh họa purging cho slide 14:** tạo `deliverables/purging_validation_boundary.png` bằng ImageGen, nền trắng/màu FPT/English. Hai ví dụ [01/06,01/07) được giữ và [11/06,11/07) bị loại tại boundary01/07; đã xem ảnh/kiểm dates và ý nghĩa. Spacing là schematic, không dùng đo độ dài thời gian. Copy asset vào workspace, link và prompt trong SLIDE_CONTENT. Chưa chèn vào PPTX; không đổi model hoặc chạy n8n. Việc tiếp theo: chèn ảnh vào cột phải slide14 theo yêu cầu, giữ tháng lịch thay fixed30.

**19/10 — tăng chiều sâu data science ở slide 14–15:** sửa tiếp `docs/SLIDE_CONTENT.md` theo yêu cầu mới, ưu tiên mô tả đầy đủ thay vì chỉ bảng metric. Slide 14 có observation unit/127 features, snapshot month-end/10/20, issue 1/11/21, target một tháng lịch (~30 ngày), ví dụ interval và lý do purged temporal split thay random row split. Slide 15 có LightGBM/CatBoost mechanics, loss vs tuning objective, TPE 30 trials/3 folds/early stop 50, champion 114 rounds/depth7/leaves12, calibration customer-grouped và results tuned-pair; bảng4 model chuyển notes. Đã đối chiếu code/config/evidence và tài liệu chính thức. Giữ đúng horizon một tháng lịch 28–31 ngày, không đổi label thành fixed30; ví dụ20/10 là lịch tương lai tại as-of19/10. Chưa cập nhật PPTX, không train/chạy live. Việc kế tiếp: review bố cục nội dung mới rồi cập nhật deck khi yêu cầu; đọc SLIDE_CONTENT 14–15 và ml/README.

**19/10 — viết lại slide 14–16 dễ hiểu:** cập nhật `docs/SLIDE_CONTENT.md` tại đúng ba slide theo yêu cầu: 14 giải thích 5 bước học–tune–chọn–calibrate–test bằng ngôn ngữ đơn giản; 15 giữ 4 model nhưng chỉ đưa validation/test AUC lên bảng, giải thích AUC là ranking; 16 chuyển trọng tâm từ log-odds sang signal → câu hỏi staff cần xác minh. Số liệu/model/v5/SHAP không đổi; technical details giữ notes/backup. Đã đối chiếu RESULTS/chart_data và đủ 24 slide. Chưa sửa/xuất lại PPTX; deck 24 slide hiện có vẫn dùng wording cũ ở 14–16. Việc kế tiếp: review copy mới rồi cập nhật PPTX khi yêu cầu; đọc SLIDE_CONTENT 14–16. Không chạy ML/n8n, 0 executions.

**19/10 — infographic A4 đã xuất PPTX:** `deliverables/Executive_Summary_PDMT_A4.pptx` (130.924 bytes), đúng 4 trang A4 dọc 210 × 297 mm theo brief EXECUTIVE_SUMMARY_INFOGRAPHIC: bìa / PD / MT+ROI+roadmap / bìa sau không chữ. Nền trắng/palette FPT, logo chỉ trang 2; 1 native chart kèm workbook và bảng ROI editable. Đã kiểm kích thước OOXML/count/logo/back-text/giá trị; import lại final, render và xem đủ 4 trang. Package/layout/font/chart checks đạt; validator có 1 cảnh báo ước lượng native table trang 3, ảnh final không tràn. Chưa PowerPoint native/in giấy/PDF; bìa không bịa tên nhóm/thành viên khi chưa cung cấp. Build/preview/receipt tại `tmp/infographic-build/`; không đổi ML/app/cloud, 0 n8n executions. Việc tiếp theo: người dùng review/chỉnh danh tính nếu cần, kiểm PowerPoint và in actual-size A4 long-edge trước khi in chính thức. Đọc brief, final PPTX và REPORT.

**19/10 — điều chỉnh trọng tâm infographic:** cập nhật `docs/EXECUTIVE_SUMMARY_INFOGRAPHIC.md` ngay trên file hiện có: Problem chiếm ~70–75% trang 2, thêm current process/8.000 khách September và gap–decision; Data rút thành một strip. Trang 3 giải thích Method theo 6 bước, Tools ngắn; cuối trang bổ sung ROI low/base/high đồng bộ slide 21, assumptions, break-even +6,67 pp và roadmap 4 cổng/pilot. Giữ 4 trang/white/FPT/English, logo trang 2; ROI minh họa, không phải measured. Đã đối chiếu số học/source và word budget; chưa dựng PDF/kiểm actual-size print. Việc tiếp theo: review copy rồi dàn infographic theo brief khi yêu cầu; đọc file đó và SLIDE_CONTENT slide 21–24. Không đổi ML/app/cloud, 0 n8n executions.

**19/10 — brief executive summary infographic:** đã tạo `docs/EXECUTIVE_SUMMARY_INFOGRAPHIC.md` theo yêu cầu mới: 4 trang A4 portrait, 1 bìa / 2 PD / 3 MT / 4 bìa sau không chữ. Có exact printed copy English ngắn, layout mm/type/palette trắng–FPT, logo chỉ company case trang 2, nguồn và checklist duplex/A4 vs A3 booklet. Đối chiếu v5/LightGBM/2.705 khách/207 alerts, Unknown, [11/10,11/11); giữ nhãn internal/synthetic và runtime pending, không đưa ROI giả thành kết quả. Đã kiểm đủ 4 trang, nguồn local và thông số; chưa dựng PDF/ảnh hoặc kiểm actual-size print. Đây là phương án nhóm, chưa xác nhận format 2 trang ruột với giảng viên. Việc kế tiếp: người dùng review copy, cung cấp tên nhóm/thành viên rồi dựng infographic khi yêu cầu; đọc file này + REPORT/SLIDE_CONTENT và evidence v5. Không đổi ML/app/cloud, 0 n8n executions.

**19/10 — đã xuất PPTX 24 slide:** `deliverables/AI_Powered_Telecom_Customer_Retention.pptx` (857.860 bytes), English, 16:9 nền trắng/theme FPT, logo chỉ slide 3 (đã kiểm relationship/media, crop logo khỏi screenshot khác). Có 24 speaker notes, 16 native tables và 3 native charts với workbook Excel nhúng. Nguồn `docs/SLIDE_CONTENT.md`; build/preview/validation riêng ở `tmp/pptx-build/`. Đã kiểm từng ảnh render, sửa mũi tên và spacing; import lại final và render đủ 24, hai chart có thay đổi pixel sau import đã xem riêng, 22 slide còn lại pixel-identical. Package/layout/font/chart-workbook/import checks đạt; validator có 7 cảnh báo ước lượng độ cao native table, ảnh render cuối không tràn. Chưa mở bằng PowerPoint native, chưa rehearsal hoặc xác nhận layout trên máy thành viên. Chưa có executive summary/gói nộp cuối. Không đổi app/model/cloud hoặc chạy n8n (0 executions). Bước tiếp theo: người dùng review deck, bổ sung tên nhóm/thành viên nếu cần; kiểm bằng PowerPoint máy nhóm trước nộp, giữ nhãn financial assumptions/demo historical. Đọc SLIDE_CONTENT, REPORT và final PPTX.

**19/10 — nội dung deck 24 slide:** đã tạo `docs/SLIDE_CONTENT.md` theo outline người dùng đính kèm: English on-slide copy, speaker notes, visual/source instructions từng slide, literature review/mapping, demo fallback, test evidence có ngày và business case giả định có công thức. Giữ thứ tự (demo slide 13, model 14–15, SHAP 16, chat/call 17); cập nhật nội dung v4 cũ sang v5/LightGBM/2.705 khách/207 cases. Theme trắng, palette lấy từ logo local; logo chỉ slide 3 và crop khỏi screenshot khác. Đã kiểm đủ số/thứ tự 24 slide, nguồn local, số liệu model/SHAP và số học kịch bản; không chạy ML/n8n/cloud, 0 executions. Còn thiếu tên nhóm/thành viên, URL/license nguồn, acceptance runtime hiện hành; chưa xuất PPTX hoặc tổng nghiệm thu. Việc tiếp theo: tạo deck từ `SLIDE_CONTENT.md` khi người dùng yêu cầu; đọc file đó cùng REPORT, RESULTS v5, figures/slides/README và evidence cutover/migration. Không tự bật workflow để làm ảnh demo.

**SHAP và Supabase đã hoàn tất 19/10/2026:** native LightGBM SHAP cho 5.533 snapshots, giữ nguyên model/xác suất; 127 features/6 nhóm, signed sums và Platt a=1,2400316422/b=0,3482248508. Raw additivity error 7,41e-15, probability error 2,11e-15. Supabase đã thay v4 bằng latest batch 11/10: **2.705 khách/predictions/contexts, 207 cases >500**, kỳ [11/10,11/11), outcome Unknown. Xóa v4 khỏi bảng vận hành; backup 25 bảng ở `app_private.v4_demo_backup`, không có quyền browser/worker; `supabase/restore_demo_v4.sql` đã kiểm round-trip local. Giữ Auth 3 users/staff 2; portal remap vào case mới, consent/opt-out được giữ theo customer_ref khi khớp. Không tự cấp consent mới hoặc gửi tin.

**Biểu đồ English cho slide:** `docs/evidence/ml/rolling_month_v5/figures/slides/` có 7 biểu đồ × PNG/SVG, `README.md` hướng dẫn dùng và `chart_data.json` lưu số liệu/hashes. Dùng latest 2.705 khách một lần/người cho SHAP global; test ROC/PR là 1.485 dòng/758 khách với cửa sổ chồng nhau. SHAP là model risk drivers, không phải nguyên nhân xác nhận, không phải % xác suất.

**19/10 — hoàn tất data/train v5 theo yêu cầu leader:** prediction ngày **1/11/21**, snapshot **cuối tháng/10/20**, horizon **một tháng lịch trượt**. Đã tạo **5.517 khách, 113.937 snapshot, 127 features** và tune **30 trials/họ**. Chọn **LightGBM tuned** theo validation ROC AUC **0,9483**; test exploratory AUC **0,9467**, AP **0,7138**, đạt mốc khoảng **0,89** leader làm rõ. CatBoost tuned validation/test AUC **0,9356/0,9348**. Một full-cohort generation, không sửa simulator sau test; baseline chỉ đối chiếu, không đổi winner theo test. 36 ML tests + verification hash/save-reload/customer-grouped calibration đạt. Canonical mới trong `final/rolling_month_v5/`; local artifacts v4 giữ nguyên; dữ liệu cloud v4 đã chuyển vào backup private.

**Còn vướng/việc kế tiếp:** data/train/SHAP và Supabase v5 đã hoàn tất; không chạy lại khi không có yêu cầu/lỗi mới. Nguồn UI đã hiển thị kỳ trượt và tự chọn lại period sau cutover, 10 UI tests/build đạt. Tiếp theo deploy UI khi được yêu cầu, diễn tập browser, tiếp tục cost/catalog/report; xử lý n8n migration group-2-new còn unpublished/timer disabled theo quota. Chưa chạy n8n/LLM/send/E2E browser, 0 executions. Không coi controlled reset lần này là cơ chế refresh case tự động ở mọi batch tương lai. Đọc ml/README, DATA_ML, evidence/ml/rolling_month_v5/shap_summary.json, supabase_v5_cutover.json, figures/slides/README.md, SYSTEM và DEPLOYMENT.

**AI ở chat mới phải đọc mục này trước khi làm việc**, rồi kiểm tra file thực tế trong repo. Không dựa vào việc nhớ một cuộc chat khác.

| Nội dung | Trạng thái tại lần cập nhật này |
|---|---|
| Đã có | V5 data/train/SHAP/cloud: 2.705 khách/207 cases latest 11/10, 127 features/6 nhóm; 43 ML +38 DB +7 rolling migration +2 replace/restore +10 UI tests/build đạt. Biểu đồ English PNG/SVG đã xuất. V4 private backup và local artifacts giữ lịch sử. |
| Mockup hiện hành | English: `01-care-queue-en.png`, `02-customer-details-en.png`, `03-customer-chat-en.png` trong `website/mockups/`; bản VI lưu `tmp/mockups-vi-20261017/`, không dùng để code |
| Nguồn dữ liệu đã nhận | telecom_customer_churn.csv, telecom_data_dictionary.csv và group_features_exp_3 (1).py từ Downloads. Người dùng xác nhận file Python là tài liệu nhóm cần tham khảo; đã profile bằng ml/generation/profile_source_data.py, kết quả docs/evidence/source_data_profile.json |
| Chưa có | Kaggle URL/license đầy đủ; kiểm định trên dữ liệu thật FPT |
| Đã chốt về phạm vi | App nghiệp vụ chỉ cho DVKH; model doanh nghiệp đã có; kỹ thuật dùng phần mềm riêng, DVKH chỉ gửi yêu cầu hỗ trợ |
| Ngôn ngữ bắt buộc | Giảng viên yêu cầu sản phẩm, report/executive summary, slide và nội dung trình bày demo bằng tiếng Anh. Docs nội bộ vẫn tiếng Việt; không cần dịch toàn bộ repo |
| Chưa hoàn thiện | Cost form và chart; catalog/eligibility được duyệt; delay 3 giờ còn là cấu hình đề xuất; UI polish; deadline/phân công tên |
| Bước hiện tại | Bước 7 data/train/SHAP v5 hoàn tất và đã import Supabase. Bước 8–9 còn browser/deploy UI/n8n cutover/cost/catalog. Bước 10 chưa xuất bộ nộp cuối. |
| Việc tiếp theo | Dùng bộ figures/slides cho report/deck; deploy UI và diễn tập khi được yêu cầu. n8n group-2-new giữ unpublished/timer disabled; không execute để kiểm import. |
| Đã xác minh về dữ liệu | 7.043×38; 5.517 khách Internet, 5.245 Stayed/Churned có tỷ lệ churn 33,48%; 9 nhóm công ty/1.964 feature; nguồn public mô tả fictional. Cột reason/category hậu churn và 120 Monthly Charge âm cần được xử lý đúng phạm vi |
| SHAP UI 18/10 | Mỗi nhóm hiện % của net SHAP increase trên cả 6 nhóm: contribution_log_odds / (logit(probability) − baseline). Không phải % xác suất churn; có thể >100% do nhóm âm bù trừ; không chuẩn hóa riêng top 3. Dữ liệu invalid/net không dương hiện Unavailable. 7 UI checks + build đạt; đối chiếu toàn bộ 3.202 dòng group_shap.csv đạt. Chưa kiểm browser ở phiên này; không đổi model/data/schema/workflow. |
| Phiên gần nhất | Hoàn tất SHAP LightGBM, migrate Supabase và xóa v4 khỏi bảng vận hành (backup private 25 bảng). Giữ Auth/staff, remap portal, bảo toàn consent/opt-out khi khớp; 2.705 khách/207 cases. 43 ML/38 DB/7 migration/2 replacement/10 UI checks đạt. 0 n8n executions. |
| File cần đọc tiếp | ml/README.md; DATA_ML; evidence/ml/rolling_month_v5/shap_summary.json và supabase_v5_cutover.json; figures/slides/README.md; SYSTEM; n8n/README; DEPLOYMENT. |
| Deploy hiện hành | App local/Vercel proxy config đã trỏ group-2-new; ba AI webhook live active và timer disabled. Source chưa push/redeploy Vercel; hosted domain/browser chưa kiểm. |
| Quota / migration n8n | Ngân sách 1.000. Cutover đã dùng đúng 5 executions (#1–5), không gọi lại AI. Ba AI artifacts completed; delivery success nhánh queue rỗng; follow-up/support 1+1. Mọi timer disabled; không có send-branch E2E do thiếu case có consent sẵn. |

**Auth/mapping đã kiểm chứng:** 3 accounts confirmed; 2 staff và 1 portal mapping. Password login thật cho cả 3 accounts qua Auth API đạt; PostgREST: Supervisor 260 case, Agent 1 case, Customer 0 internal case và 1 portal thread. Agent lưu note idempotent; Customer bị chặn detail và không đọc note. Evidence: docs/evidence/hosted_auth_checks.json. Credentials test được người dùng cho phép lưu tại tmp/demo-auth/accounts.md (Git ignore), không sao chép nội dung vào docs/source/log. Script chạy lại: node tests/hosted-smoke.mjs trong website/app; tạo một internal test note idempotent, không gửi tin hay gọi điện.

**Tóm tắt cần giữ khi chuyển chat:** trọng tâm là hệ thống phối hợp sau cảnh báo, không phải chỉ xây thêm một mô hình churn. Vấn đề ở phạm vi Internet FPT Telecom toàn quốc; Bình Dương là case/pilot theo [Problem hiện hành](PROBLEM.md). Không tự quay về bản bối cảnh địa phương cũ hoặc khôi phục nhận định so sánh đã được sửa.

**Bàn giao Supabase 18/10 — hiện hành:** `telecom-retention-demo`; n8n Cloud đã nối Supabase và Gateway credits; Supabase thay S3. Chưa nối GitHub/local không có Git metadata. Source hiện có 25 bảng/30 public RPC; build_setup.py tạo setup.sql (project mới/6 bảng) và upgrade_lean.sql (đã có full bản cũ). Không chạy lại setup trên full workspace. AI dùng retention_pending_jobs → worker_context(job.id) → complete_job(job.id,...), không có lease_token/claim_job; fail_job chỉ đánh dấu lỗi cuối; lỗi/retry ở n8n. Outbox gửi tin giữ transaction/lease/retry, mọi outbound cần duyệt. Seed true chỉ khởi tạo, không reset opt-out; reply chỉ hủy no_reply, giữ nhắc thủ công. 37 DB checks local đạt, gồm migration full cũ giữ draft/job; có regression old lock-order thất bại và new order đạt. Evidence supabase/tests/results.json. Local Auth/Storage/JWT dùng stub; cloud schema/import/RLS đã được kiểm tra riêng bên dưới. Hosted password login/PostgREST đã kiểm riêng; chưa chứng minh multi-connection concurrency. Đã tạo/map 3 Auth users; tiếp tục dựng web+n8n thành một luồng trước khi chia việc.

**Kết quả xử lý Ponytail review:** cả ba vấn đề đã sửa và có regression: import không ghi đè opt-out, reply không hủy manual_reminder, staff write khóa case trước kiểm quyền. Phần AI job giản lược về yêu cầu/kết quả idempotent, n8n quản lý execution/error; không cắt RLS, approval theo revision, chống trùng, kiểm dữ liệu hoặc outcome đúng kỳ. shortcut: demo một AI workflow tuần tự; execution chồng có thể gọi LLM dư nhưng không lưu hai draft. Chỉ thêm claim/lease AI khi cần parallel workers. Skill Ponytail 5.3.2 vẫn bật; không cần cài thêm dependency trong lượt sửa này.

**Kết nối và cloud đã xác minh 18/10:** MCP project `azeqdnbtzwaehewnyfdq` hoạt động. Đã áp riêng 14 source migrations bằng apply_migration (history version do MCP sinh); không chạy lại setup/upgrade. Import đủ 3.202 khách synthetic từ canonical October output, 127 features/khách; 3.202 snapshots/predictions/contexts, 260 cases >500. Snapshot 30/09 → October, model catboost_tuned; source SHA-256 khớp local. Reimport 5 hồ sơ không nhân đôi; chỉ 5 hồ sơ có explicit fictional demo consent. Kiểm tra cloud: 25/25 bảng RLS, 30 RPC, anon table/RPC=0, authenticated/worker direct writes=0, bucket private. Người chưa mapping thấy 0 case và portal rỗng. Security advisor có 18 cảnh báo authenticated SECURITY DEFINER ở RPC được thiết kế kiểm quyền, cần giữ access tests; đã kiểm hosted password login/PostgREST, xem hosted_auth_checks.json. Evidence: docs/evidence/supabase_cloud.json. Auth users=3 confirmed, mapping và SQL role checks đã xong; sau đó web+n8n. Chưa upload CSV vào Storage hoặc kiểm concurrency nhiều connection. E2E n8n/hosted API đã đạt; xem evidence/n8n_workflows.json.

**Website local hiện hành:** React/Vite/Supabase ở website/app, preview http://127.0.0.1:5173/. Queue Pipeline/Table; detail care progress/status, facts, request AI explanation, tab Message/Call script/Internal notes, approval→queue, support, reminder, notifications và period-end outcome form (chặn trước khi đủ kỳ); portal reply/opt-out. Labels cố định; số liệu/facts/rank lấy Supabase, không render Python explanation_draft/suggested_action như AI. Kết quả AI phải generation_mode=llm và đúng loại request. Call script/explanation không tạo outbound draft. Ba workflow AI Agent dùng LLM thật và worker RPC; không dùng nội dung giả làm LLM. Kanban 4 care columns và 2 outcome columns; Unknown không tự biến thành retained. Chưa có cost form/chart cuối. Kiểm build, 4 UI checks, 37 DB checks; hosted Auth/API checks và browser Agent queue/detail/tabs/request đạt, E2E hosted API/n8n LLM/delivery/reply đạt (không thay thế usability browser toàn luồng). File cần đọc: docs/SYSTEM.md delta, n8n/README.md manual contract, website/app/src/Queue.jsx/Progress.jsx/Notes.jsx và main.jsx. Evidence website_checks.json, hosted_auth_checks.json và website-pipeline.png. Chỉ local, chưa publish.

**Rewrite request:** website/app/src/RewriteRequest.jsx, hai ô độc lập cho Message/Call script; chỉ queue khi staff bấm Request AI rewrite. Message lấy nội dung hiện tại của editor, Call script lấy script đang hiển thị; nếu chưa có bản gốc thì instruction hướng dẫn draft đầu tiên. RPC retention_request_recommendation thêm optional p_instructions/p_source_text, vẫn gọi được với 2 đối số cũ; job lưu rewrite_instructions/rewrite_source_text, worker_context trả cả hai. Không gửi notes vào context; không tự đổi bản đã duyệt. Đã sinh bản viết lại qua n8n/Gateway LLM. Nối workflow cần coi instruction/source là dữ liệu staff yêu cầu, không được ghi đè system policy/facts/consent.

**n8n hiện hành:** 5 worker active: AI message 6vz0G2kEFy1v0f6V, call script Ead0Qlw8LGkl0Ncv, explanation MBnCQdjOKV2XX0GU; mock delivery BtozaQeAwIhpQu4m và follow-ups/support DCKhogHvYb4cIEVs. AI gộp cũ đã unpublish. Mỗi loại output dùng AI Agent + Chat Model + demo knowledge tool. Request đánh thức webhook ngay, xác thực job qua JWT/RLS trước worker credential. Fallback mỗi phút lọc loại trước limit. Không lưu production execution data để tránh giữ JWT. Export active=false; live active=true. Ba Agent requests hoàn tất trong 10 giây, invalid JWT bị chặn trước Agent. Evidence: evidence/n8n_agents.json. FAQ Sheet 15 mục đã tạo, 14 enabled, Google Sheets tool đã chạy thực; link và dataset trong n8n/README.md.

### Cách cập nhật bàn giao cuối mỗi phiên

Sửa trực tiếp bảng trên, bảng tiến độ và các checklist liên quan; không tạo bản sao theo ngày. Cuối mục này có thể thay bằng một ghi chú ngắn gồm:

- Đã làm: đầu ra và file thật đã tạo/sửa.
- Đã kiểm tra: lệnh hoặc thao tác, kết quả và giới hạn.
- Chưa xong: việc còn thiếu, quyết định cần người dùng hoặc lỗi cụ thể.
- Làm tiếp: một đến ba việc có thứ tự, input cần có và điều kiện hoàn thành.

Tài liệu này và [AGENTS.md](../AGENTS.md) là cơ chế tiếp nối khi chat mới truy cập cùng repo. Không có dịch vụ nền tự cập nhật tiến độ; mỗi phiên làm việc phải cập nhật bằng chứng thực tế. Nếu chat mới không có quyền đọc repo, người dùng cần cung cấp tài liệu thay vì giả định AI đã biết.

## 1. Nguyên tắc và phạm vi phải giữ

1. **Giá trị cốt lõi:** cảnh báo → phân công DVKH → hiểu tình trạng khách → chọn hành động → duyệt → liên hệ → theo dõi/phối hợp → outcome.
2. **Người dùng:** nhân viên và quản lý DVKH. Portal khách là kênh demo bên ngoài; kỹ thuật/Finance/Analyst không cần thêm các ứng dụng hoặc trang quản trị trong MVP này.
3. **Giao diện:** hai màn hình nội bộ (hàng chờ, chi tiết) và một portal chat demo. Tận dụng tab/form trong trang chi tiết để tránh sinh quá nhiều trang.
4. **Kỹ thuật:** nút chuyển hỗ trợ + nhập yêu cầu + trạng thái bàn giao. Không xây quản lý nhân viên, tiến độ hoặc SLA xử lý nội bộ kỹ thuật.
5. **AI:** giải thích từ dữ kiện có nguồn, đề xuất action/message/call script. Nhân viên duyệt từng outbound revision; AI không tự quyết ưu đãi hoặc nguyên nhân churn.
6. **ML:** model doanh nghiệp là input mục tiêu. Model public-data là nguồn demo khi chưa truy cập model thật. Ngưỡng điểm nội bộ >500 tương đương probability >0,5; không tự đồng nhất độ tin cậy của model demo với model nội bộ.
7. **Dữ liệu:** giữ observed, synthetic, simulated và giả định tách rõ. Top 3 nhóm trong ảnh chỉ minh họa; số liệu và group mapping phải được xác định theo nguồn thật trước khi dùng như kết quả model.
8. **Nghiệm thu:** đầu ra tồn tại, chạy được theo phạm vi và có kiểm tra thì mới đánh dấu xong. Không dùng mockup/placeholder thay bằng chứng tính năng hoạt động.
9. **Quy mô demo:** không cần tạo đủ 210.000 khách hoặc 8.000 case ngay. Dùng một hồ sơ, sau đó một tập nhỏ đa dạng để kiểm chứng; tách kiểm thử tải khỏi demo nghiệp vụ.
10. **Ngôn ngữ:** sản phẩm và bản nộp bằng tiếng Anh. UI, explanation, recommendation, draft, call script, portal, empty/error và screenshot dùng English thống nhất; docs nội bộ được tiếng Việt. Model/data source không thay đổi chỉ vì đổi ngôn ngữ.

Nguồn chuẩn: [Problem](PROBLEM.md), [System](SYSTEM.md), [Data/ML](DATA_ML.md), [Report](REPORT.md), [brief mockup](../website/mockups/BRIEF.md), [n8n](../n8n/README.md). Nếu các tài liệu khác nhau, kiểm tra yêu cầu mới nhất và nguồn dữ liệu; giải quyết mâu thuẫn, không tự chọn số liệu thuận tiện.

## 2. Thứ tự và bảng tiến độ

Trạng thái dùng thống nhất: **Chưa bắt đầu / Đang làm / Chờ đầu vào / Chờ review / Hoàn thành**. Chờ dataset không ngăn phần mockup hoặc schema nghiệp vụ độc lập tiến triển.

| Bước | Công việc | Phụ thuộc | Trạng thái hiện tại |
|---|---|---|---|
| 1 | Chốt phạm vi và luồng nghiệp vụ | Câu trả lời leader đã ghi nhận; rule runtime còn cấu hình | Hoàn thành |
| 2 | Nhận và kiểm tra dataset | Dataset v4/127 đã chốt, QA và split đã có; còn URL/license nguồn | Chờ đầu vào |
| 3 | Chốt schema, trạng thái và contract | Bước 1; feature contract cần bước 2 | Chờ review: 25 bảng/32 RPC/state contract đã triển khai; local tests và cloud schema/import/RLS smoke checks đạt. Hosted Auth/PostgREST đã đạt ở bước 5 |
| 4 | Duyệt mockup và chia module | English mockup được duyệt baseline; Channel/Notifications đã có trong app | Đang làm: có gói giao việc ở mục 4; chưa gán tên/nhận bàn giao, UX còn hoàn thiện |
| 5 | Supabase, Auth/RLS và seed demo | Bước 3 | Hoàn thành nền demo: cloud 25 bảng/32 RPC theo evidence, data/Auth mapping; chạy lại 39 local checks đạt. Catalog/eligibility chưa được duyệt để trống; không phải kiểm định production |
| 6 | Một luồng xuyên suốt cho một khách | Bước 4–5; prediction đã có từ model chốt | Hoàn thành luồng cốt lõi: real LLM draft → staff approval → mock delivery → customer reply; evidence/n8n_workflows.json |
| 7 | Hoàn thiện ML và giải thích nhóm rủi ro | LightGBM v5/127 features, 6 nhóm native SHAP, 2.705 contexts/207 cases Supabase; evidence/figures có nguồn | Hoàn tất kỹ thuật v5; còn kiểm browser/LLM quality ở bước 9 |
| 8 | Hoàn thiện workflow và UI/UX | Bước 6; tích hợp output bước 7 | Đang làm: 5 workflow active; còn cost/chart, catalog và UI polish. Tab Dashboard Supervisor có đặc tả 21/10, chờ review/chưa code |
| 9 | Kiểm thử, sửa lỗi và thu bằng chứng | Module có thể chạy; chốt sau bước 8 | Đang làm: chạy lại 39 DB + 7 UI + 5 workflow checks, build đạt; có hosted E2E evidence cũ. Chưa tổng nghiệm thu browser/usability/concurrency |
| 10 | Chốt báo cáo, xuất file và diễn tập | Evidence bước 7–9 | Đã có REPORT.md, figures, SLIDE_CONTENT.md, PPTX English 24 slide và brief/copy EXECUTIVE_SUMMARY_INFOGRAPHIC.md cho 4 trang A4 (2 trang ruột PD/MT). PPTX render/import checks đạt; chưa kiểm PowerPoint native, xuất infographic/summary PDF, data-code package cuối hoặc rehearsal |

Bước 2 và mockup của bước 4 có thể song song. Bước 7 có thể chạy song song bước 5–6 khi đã chốt feature/output contract. Bước 6 dùng prediction simulated có nhãn nếu model demo chưa sẵn sàng; không báo đó là prediction đã train. Research, viết báo cáo và soạn checklist bắt đầu từ bước 1, không chờ đến bước 10.

## 3. Hướng dẫn chi tiết từng bước

### Bước 1 — Chốt phạm vi và luồng nghiệp vụ

**Mục tiêu:** thống nhất app làm gì, ai quyết định gì và thế nào là một case đã được xử lý. Leader cùng AI rà [System](SYSTEM.md), [Problem](PROBLEM.md) và brief hiện tại.

**Việc cần làm:**

1. Xác nhận Internet là dịch vụ trong phạm vi; Bình Dương là pilot, không suy rộng kết quả địa phương ra toàn quốc.
2. Khóa hai màn hình DVKH và portal demo; không thêm dashboard/trang kỹ thuật riêng.
3. Viết lại happy path bằng actor và hành động: nhận prediction, mở case, xác minh, đề xuất, duyệt/gửi, reply, nhắc lại, bàn giao kỹ thuật và ghi outcome.
4. Chốt quyền ai xem case, ai sửa nội dung, ai duyệt/gửi và ai phân công. Xác định nhân viên được tự duyệt trong hạn mức hay cần supervisor; không để nút UI tự quyết quyền.
5. Đã xác nhận đầu tháng t dự báo cùng tháng t; demo ngày 01/10/2026 cho tháng 10. Khi có dataset vẫn kiểm tra snapshot và giới hạn horizon thật, không giả dữ liệu public có timestamp.
6. Thống nhất nghĩa của đã gửi, khách đã trả lời, đã liên hệ, case đóng và churn/retained/unknown. Chúng không thay thế cho nhau.
7. Chốt contact preference, opt-out, offer eligibility và quy tắc nhắc theo thời lượng cấu hình (mặc định làm việc 3 giờ). Làm rõ đây là rule đề xuất khi chưa được doanh nghiệp xác nhận.
8. Ghi các quyết định đã chốt vào phần tương ứng của System; câu hỏi chưa chốt ghi vào bảng bàn giao của file này.

**Đầu ra:** scope và luồng được review, role/approval rule rõ; quyết định chưa chốt không bị ghi thành fact.

**Điều kiện hoàn thành:** leader xác nhận phạm vi và luồng; không còn mâu thuẫn cản trở schema/contract. Chưa tự coi các ảnh đã được duyệt chỉ vì đã tạo xong.

### Bước 2 — Nhận và kiểm tra dataset Kaggle

**Mục tiêu:** biết dataset hỗ trợ được gì trước khi thiết kế features, nhóm rủi ro và train. Leader/AI phụ trách; kết quả cập nhật vào Data/ML.

**Việc cần làm:**

1. Nhận link/file, tên/version, tác giả, license; xác định được tải/chia sẻ những gì.
2. Giữ raw nguyên trạng ở `data/raw/`; lưu thông tin nguồn, hash và cách tải tái lập. Chưa commit raw khi chưa kiểm tra license/PII.
3. Kiểm tra grain: một khách, hợp đồng hay snapshot; customer ID có ổn định và có nhiều dòng/khách không.
4. Kiểm tra cỡ mẫu, schema, kiểu dữ liệu, missingness, duplicate, phân bố nhãn, outlier và đơn vị tiền/thời gian.
5. Xác định nhãn churn là gì, có timestamp/horizon thật không. Không gọi snapshot classifier là dự báo theo kỳ tương lai nếu dữ liệu không hỗ trợ; nhãn kịch bản demo tháng 10 không thay thế bằng chứng thời gian của dataset.
6. Loại hoặc đánh dấu leakage: churn reason, ngày hủy, score có sẵn và dữ liệu phát sinh sau outcome.
7. Lập data dictionary ngắn và feature list được phép train; tách ID, label, observed features và context dùng chăm sóc.
8. So sánh với mockup: ticket, giảm sử dụng, lịch sử liên hệ có trong dataset không? Trường không có phải thu thập hoặc tạo context synthetic có nhãn, không coi là feature thật đã ảnh hưởng model.
9. Dataset B đã chuyển sang snapshot cuối tháng 2026, nhãn tháng sau và temporal split theo DATA_ML v2; không random-split các dòng panel. Customer có thể lặp theo thời gian, ID không là feature.

**Đầu ra:** nguồn/license, data quality findings, dictionary, leakage exclusions và split proposal. Khi có bằng chứng mới tạo `docs/evidence/` hoặc notebook cần thiết; không sinh nhiều file rỗng.

**Điều kiện hoàn thành:** hiểu nhãn và grain, xác định features hợp lệ, biết giới hạn bằng chứng và có cách tái tạo split.

### Bước 3 — Chốt schema, trạng thái và contract tích hợp

**Mục tiêu:** frontend/n8n/ML phát triển song song mà không tự đặt tên trường hoặc trạng thái khác nhau. Leader chốt; người frontend/n8n cùng review.

**Việc cần làm:**

1. Rà các entity trong System; xác định bảng MVP thật cần và liên kết customer/snapshot/prediction/case/message/approval/outbox/outcome.
2. Chốt ID, version, timestamp UTC, đơn vị tiền, enum/check, FK và unique constraints; xác định dữ liệu nullable khi chưa biết.
3. Chốt case lifecycle riêng với message approval/delivery lifecycle. Support request chỉ theo dõi việc gửi ra ngoài, không quản lý kỹ thuật.
4. Thiết kế ownership: mapping Auth user với staff/customer demo; quyền staff và supervisor. Secret chỉ ở server/worker.
5. Chốt prediction payload: score/probability, source, model/version, kỳ dự báo, snapshot nếu có; thiếu driver thì ghi unavailable.
6. Chốt top-group payload: group ID/rank, feature contributions có provenance, facts có nguồn, câu diễn giải và tình trạng thiếu dữ liệu.
7. Chốt action/offer/draft, approval revision/hash, message send/receive, follow-up, support request và outcome payload.
8. Chốt phần nào chạy bằng database transaction/RPC/server function, phần nào n8n chỉ điều phối. Không đẩy xác thực approval xuống prompt LLM.
9. Thống nhất một example payload an toàn cho mỗi đường nối và lỗi điển hình; thống nhất idempotency key.

**Đầu ra:** schema/payload/state/auth design trong System; mỗi thành viên biết field nào mình nhận/ghi và ai sở hữu thay đổi.

**Điều kiện hoàn thành:** có thể truy vết một case qua các module bằng ID; không có quyền public rộng, score bị hiểu sai hoặc hành động thiếu bước kiểm quyền. SQL và sample thực thi sẽ tạo ở bước 5, không nhầm thiết kế là đã triển khai.

### Bước 4 — Duyệt mockup và chia module

**Mục tiêu:** chốt cách nhân viên sử dụng đầy đủ công cụ trong ít trang. Hai người frontend dẫn dắt, leader review cùng người n8n.

**Việc cần làm:**

1. Review hàng chờ, trang chi tiết English và portal demo English theo [brief](../website/mockups/BRIEF.md); không dùng bản VI đã lưu trữ.
2. Kiểm tra tìm/lọc, phân công, mở case; xác định trường nào thật có trong contract, trường nào chỉ là minh họa.
3. Ở trang chi tiết, chốt top 3 nhóm + facts + diễn giải, action/offer, draft, duyệt/gửi, call script, ghi chú, hội thoại/nhật ký, nhắc lại và outcome.
4. Chốt hành vi các tab/form, trạng thái loading/empty/error, thiếu driver, bị từ chối, đang gửi, gửi lỗi, opt-out và outcome unknown.
5. Chốt form chuyển kỹ thuật: nội dung, thông tin được gửi kèm, giờ mong muốn nullable và xác nhận gửi/lỗi; không thêm dashboard kỹ thuật.
6. Hai frontend chia phần theo sở hữu component/luồng, thống nhất styles và shared types; tránh cùng sửa một component lớn khi chưa phối hợp.
   - Dùng bộ mockup English hiện hành; labels, trạng thái, tooltip, empty/error và nội dung mẫu đều tiếng Anh. Không code từ ảnh tiếng Việt đã lưu trữ.
7. Ghi feedback và quyết định duyệt vào bảng review trong brief; chỉ code chi tiết theo bản đã chốt.

**Đầu ra:** brief được review và bảng module có người sở hữu. Có thể bắt đầu scaffold/theme/component shell sau khi chốt, nhưng chưa tự xây thêm trang.

**Điều kiện hoàn thành:** nhân viên có đường thao tác rõ cho happy path và nhánh lỗi; leader duyệt bố cục/chức năng, các con số demo được nhận diện.

### Bước 5 — Dựng Supabase, Auth/RLS và dữ liệu demo

**Mục tiêu:** có nền dữ liệu dùng được trước khi nối nhiều workflow. Leader thực hiện cùng AI; chỉ kết nối môi trường phát triển được cung cấp/cho phép.

**Việc cần làm:**

1. Chuẩn bị project dev/sandbox và biến môi trường qua kênh phù hợp; không ghi secrets vào Markdown, Git hoặc frontend.
2. Viết migration có version ở `supabase/`, constraints/indexes/FK theo contract đã duyệt; không chạy SQL phá dữ liệu có sẵn.
3. Tạo cơ chế Auth/ownership và RLS deny by default, rồi cấp đúng quyền cần thiết. Dùng publishable key + user session ở browser.
4. Tạo server/RPC cho approval và enqueue trong transaction; nội dung chỉnh sau duyệt phải tạo revision mới.
5. Seed một hồ sơ fictional hoàn chỉnh: customer, prediction demo, context, offer eligibility, case và trạng thái ban đầu; không cần tạo sẵn chat hoặc retained outcome chưa xảy ra.
6. Thêm một số tình huống khác khi cần: thiếu dữ liệu, không đủ điều kiện offer, opt-out, gửi lỗi. Gắn cờ nguồn synthetic/simulated.
7. Kiểm tra đọc/ghi hợp lệ, FK khớp customer, unique/dedup, staff ngoài phạm vi bị chặn và khách demo không đọc được dữ liệu khách khác.
8. Ghi cách thiết lập và kết quả kiểm tra trong System/evidence khi có; không dùng key đặc quyền trong browser để vượt lỗi RLS.

**Đầu ra:** migration, seed an toàn, Auth/RLS và server actions dùng được trong sandbox.

**Điều kiện hoàn thành:** một case có thể được đọc/ghi đúng quyền; chưa duyệt không enqueue; không có secrets lộ ra client. Nếu chưa có dịch vụ/credentials thì đánh dấu chờ đầu vào, không ghi đã triển khai.

**Trạng thái thực tế 18/10 — Đang làm:**

- Đã triển khai: MCP kết nối project; 14 migrations, 25 bảng/32 RPC; import 3.202 khách synthetic với 127 features, prediction và SHAP context, tạo 260 case October. Chỉ 5 hồ sơ có consent liên hệ mô phỏng; chưa seed offer/eligibility chưa được duyệt.
- Đã kiểm tra: 25/25 bảng bật RLS; anonymous không có quyền bảng/RPC; authenticated và worker không ghi trực tiếp; bucket private. Reimport 5 hồ sơ giữ nguyên số lượng; hash nguồn khớp local. Người chưa mapping không thấy case/portal và bị chặn sửa settings. Bằng chứng: [cloud](evidence/supabase_cloud.json), [35 checks local](../supabase/tests/results.json).
- Hosted password login/PostgREST đã kiểm cho 3 accounts, gồm note isolation. n8n/LLM/mock delivery/reply đã kiểm bằng hosted API; xem evidence/n8n_workflows.json. 18 cảnh báo SECURITY DEFINER là các RPC được cấp quyền có chủ đích; hosted role checks đã bổ sung; tiếp tục giữ regression khi đổi RPC. Chưa kiểm browser toàn luồng hoặc đồng thời nhiều connection.
- Làm tiếp: diễn tập web theo luồng đã kiểm ở bước 6, rồi hoàn thiện bước 8. Không chạy lại setup/upgrade/source migrations trên project đã cài.

### Bước 6 — Dựng một luồng xuyên suốt cho một khách

**Mục tiêu:** phát hiện lỗi tích hợp sớm. Leader dựng khung mẫu, hai frontend và hai người n8n nối vào cùng contract.

**Việc cần làm:**

1. Dùng prediction fixture có nhãn simulated nếu model chưa sẵn sàng; nhập theo contract, tạo case idempotent bằng workflow 1.
2. Dựng web shell tối thiểu, đăng nhập, hàng chờ và trang chi tiết đọc đúng dữ liệu từ Supabase.
3. Workflow 2 lấy context/offer và tạo group explanation/action/draft đúng schema; có mock generator hoặc fixture để test khi chưa có LLM, ghi rõ chế độ đó.
4. Render top nhóm/facts theo dữ liệu nguồn; simulated ranks phải có nhãn, không coi là SHAP thật.
5. Nhân viên sửa và duyệt bản nháp; workflow 3 nhận quyết định qua server đã kiểm quyền, gắn đúng revision.
6. Workflow 4 gửi đúng message đã duyệt qua portal demo và lưu receipt/status. Không nối kênh thật ở giai đoạn này.
7. Khách ở phiên riêng nhận tin và reply; workflow 5 xác thực/dedupe, ghi inbound, cập nhật hội thoại và thông báo staff; staff bấm Request khi cần draft tiếp theo rồi duyệt.
8. Kiểm tra cùng customer/case/message IDs đi hết luồng; refresh trang không mất trạng thái hoặc nhân đôi message.
9. Ghi lỗi hợp đồng và sửa tại nguồn, không vá mỗi module bằng một mapping khác nhau.

**Đầu ra:** một luồng thực thi hoàn chỉnh cho một khách; có thể diễn tập lại từ seed/reset sandbox có kiểm soát.

**Điều kiện hoàn thành:** hành trình gửi–nhận chạy thật trong demo, chưa duyệt không gửi và reply tiếp theo vẫn cần approval. Chưa yêu cầu mọi tính năng hoặc UI polish đều hoàn thiện.

### Bước 7 — Hoàn thiện ML và giải thích nhóm rủi ro

**Trạng thái 19/10:** data/train/chọn model/SHAP v5 và payload Supabase đã hoàn tất theo evidence; UI source đã sửa/build, chưa deploy Vercel hoặc diễn tập browser. Các mục v4 dưới đây là lịch sử đã triển khai, không phải yêu cầu quay lại model cũ.

**Mục tiêu:** thay đầu vào simulated bằng output model demo có thể tái lập, hoặc dùng adapter model doanh nghiệp nếu được cấp dữ liệu/quyền phù hợp. Leader/AI phụ trách.

**Việc cần làm:**

1. Lịch sử v4 (v5 dùng purged split ở DATA_ML): temporal split dataset v4/127: snapshots Jan–Jun train (targets Feb–Jul), Jul validation/calibration với khách riêng (target Aug), Aug audit test (target Sep, một tháng, exploratory), Sep inference (target Oct Unknown). Calibration/audit IDs không vào fit/tuning/selection. Không dùng ID làm feature; không thay frozen data.
2. Lịch sử v4 đã so sánh baseline/tuned LightGBM và CatBoost native categorical, 30 Optuna trials/họ trên ba rolling folds; CatBoost tuned đã được leader duyệt. Không chạy lại tuning hoặc đổi winner theo test khi nhận phần hoàn thiện sản phẩm.
3. Chọn model, calibration và ngưỡng/capacity policy bằng train/CV/validation; khóa trước khi đánh giá test cuối.
4. Đánh giá PR-AUC, Recall@K/Precision@K, calibration và confusion matrix theo dữ liệu/nhãn thật; nêu cỡ mẫu và giới hạn.
5. Lưu preprocessing/model/metadata và environment; infer phải dùng lại artifact, không fit lại encoder.
6. Tạo driver/SHAP hợp lệ với output space rõ. Map feature về nhóm nghiệp vụ, tổng hợp đóng góp đúng dấu và xếp nhóm có bằng chứng; không để LLM tự xếp hạng.
7. AI diễn giải facts bằng ngôn ngữ DVKH: tình trạng hiện tại, vì sao cần xác minh và câu hỏi/hành động gợi ý. Không suy từ feature thành động cơ chắc chắn hoặc bịa ticket.
   - Trong sản phẩm, ngôn ngữ dễ hiểu cho DVKH là **plain English**; giữ nguyên facts và mức độ chắc chắn. Không suy diễn thêm khi dịch.
8. Context synthetic phục vụ chăm sóc phải tách khỏi feature đã ảnh hưởng model; không trộn synthetic vào test để báo hiệu quả trên dữ liệu thật.
9. Thay fixture ở bước 6 bằng output pipeline; validate payload và kiểm tra UI/AI diễn giải vẫn đúng.
10. Lưu run metadata, metrics/plots và giới hạn vào evidence; không nhận là model nội bộ FPT Telecom.

**Đầu ra:** pipeline/adapter, artifacts, evaluation và risk-group payload có nguồn.

**Điều kiện hoàn thành:** có thể tái tạo một run và truy vết từng giải thích về dữ liệu/model; không có leakage hoặc benchmark giả. Nếu chỉ có score nội bộ thì phần giải thích model cần thêm input, không giả vờ đã có top 3 thật.

### Bước 8 — Mở rộng workflow và hoàn thiện UI/UX

**Mục tiêu:** từ một case chạy được thành MVP dùng được với nhiều tình huống. Frontend/n8n sở hữu phần mình làm, leader review thay đổi contract.

**Việc cần làm:**

1. Mở rộng seed/demo cohort, hàng chờ, bộ lọc, sorting, pagination và phân công; ưu tiên không chỉ dựa một ngưỡng vượt điểm.
2. Hoàn thiện group explanation thiếu dữ liệu, tạo lại AI draft, lựa chọn action/offer đủ điều kiện, call script và internal note.
3. Hoàn thiện approval/rejection/revision, gửi lỗi/retry, inbound reply, opt-out và lịch sử đúng visibility.
4. Chuyển kỹ thuật: form + ghi nhận/gửi yêu cầu + chống trùng + receipt/lỗi; chưa tích hợp thật thì mô phỏng có nhãn. Không phát triển công cụ của kỹ thuật.
5. Workflow 6 theo dõi lịch nhắc của DVKH, case chưa tiếp cận và quá thời lượng cấu hình chưa reply; recheck điều kiện để không tạo task thừa hoặc tự gọi.
6. Workflow 7 ghi outcome đúng cohort/kỳ, chi phí và aggregate; chưa có kết quả phải unknown. Không suy ROI hoặc causal uplift từ việc khách reply/đóng case.
7. Hoàn thiện responsive portal, accessibility cơ bản, disabled/pending states, thông báo lỗi và thao tác xác nhận; không thêm animation làm chậm nghiệp vụ.
   - Kiểm tra toàn bộ text người dùng nhìn thấy và output LLM bằng tiếng Anh, kể cả message/call script, lỗi và follow-up. MVP không cần xây bộ chuyển ngôn ngữ.
8. Pin dependencies/lockfile, chuẩn hóa cấu hình và export các workflow thực thi không có secrets (hiện 5 worker cho 7 chức năng logic) theo n8n README.

**Đầu ra:** MVP đủ phạm vi, UI và workflow dùng chung dữ liệu/trạng thái.

**Điều kiện hoàn thành:** các chức năng cốt lõi trong brief có đường thao tác và hành vi thực, không chỉ là nút trang trí; không mở rộng sang kênh thật/production khi chưa có yêu cầu.

### Bước 9 — Kiểm thử xuyên suốt, sửa lỗi và thu bằng chứng

**Mục tiêu:** kiểm chứng các rủi ro nghiệp vụ quan trọng, không chỉ build thành công. Người QA điều phối; owner module sửa lỗi; leader review tích hợp.

**Việc cần làm:**

1. Data/ML: kiểm tra temporal split/censoring, không có ID feature, leakage, synthetic flags, artifact/schema và explanation/output; snapshot A nếu làm benchmark có group/ID split riêng.
2. Quyền: khách A không xem khách B; staff ngoài phạm vi không duyệt; không lộ internal note, nhãn test hoặc server secrets.
3. Approval: chưa duyệt không gửi; sửa nội dung mất hiệu lực approval cũ; double click/concurrent approval không gửi hai lần.
4. Workflow: batch và webhook lặp, retry/timeout, LLM lỗi, context thiếu, offer hết hạn, opt-out, reply đến trước/cùng follow-up.
5. Handoff kỹ thuật: yêu cầu đúng khách, đúng nội dung, không trùng; receipt không bị trình bày là đã khắc phục hoặc đã xác nhận lịch.
6. Outcome: đúng kỳ và nguồn; unknown không biến thành retained; không đếm chi phí trùng hoặc dùng model probability như hiệu quả can thiệp.
7. Kiểm tra usability: một người chưa quen dự án thử tìm khách, đọc giải thích, sửa/duyệt tin và theo dõi; ghi vướng mắc thực.
8. Chạy build/check phù hợp cho code đã có; ghi lệnh, kết quả, lỗi chưa sửa và giới hạn môi trường. Chỉ bổ sung test có ý nghĩa với hành vi/rủi ro.
9. Lưu screenshot/video và run references an toàn; không đưa PII/secrets vào báo cáo. Chuẩn bị seed/reset để diễn tập lại.

**Đầu ra:** kết quả kiểm tra, bug còn mở, bản demo ổn định và evidence có nguồn.

**Điều kiện hoàn thành:** không còn lỗi cản luồng cốt lõi hoặc lỗi quyền/gửi trùng chưa xử lý; giới hạn được công bố. Demo không đồng nghĩa đã đạt hiệu quả retention thực tế.

### Bước 10 — Chốt báo cáo, xuất file nộp và diễn tập

**Mục tiêu:** một câu chuyện kinh doanh nhất quán với sản phẩm và bằng chứng. Người báo cáo dẫn nội dung; QA/presentation dẫn demo/slide; cả nhóm review.

**Việc cần làm:**

1. Hoàn thiện Problem, tham chiếu ngành/thế giới, PDMT, data plan, analytical design và lý do chọn tools theo đề môn học.
2. Phân biệt bối cảnh toàn quốc với số liệu case Bình Dương; giữ cùng kỳ/mẫu số và nguồn, không diễn giải tăng số churn thành tăng churn rate.
3. Chèn kết quả ML và vận hành thật đã kiểm tra; để rõ thông tin nội bộ, giả định, simulated và measured.
4. Business case dùng contribution margin, chi phí và sensitivity; 512,5 triệu đồng/tháng là doanh thu tham chiếu liên quan, không phải số tiền đã cứu được hoặc lợi nhuận.
5. Giải thích giới hạn dữ liệu/horizon, SHAP không causal, model demo không phải model nội bộ và pilot có đối chứng là bước đo tác động tương lai.
6. Review tính nhất quán giữa Report, System, Data/ML và app; sửa nội dung lỗi thời thay vì bổ sung kết luận mâu thuẫn.
7. Sau review mới xuất executive summary Word, pitch PowerPoint/PDF và gói data/code vào `deliverables/`; kiểm tra layout và nội dung của file xuất.
   - Biên tập và review bản **tiếng Anh** trước khi xuất; kiểm tra English trên headings, bảng, biểu đồ, captions, screenshots và nội dung demo. Docs tiếng Việt chỉ là nguồn làm việc, chưa phải bản final.
8. Chuẩn bị hướng dẫn chạy, nguồn tải dữ liệu đúng license, dependency/config, seed và các bước demo; không đóng gói secrets.
9. Diễn tập có người bấm demo và người thuyết trình; chuẩn bị video/screenshot fallback được ghi rõ là bản ghi nếu dịch vụ lỗi.

**Đầu ra:** slide, executive summary, data/code tái lập, demo script và fallback.

**Điều kiện hoàn thành:** đáp ứng checklist môn học trong Report; file xuất được kiểm tra; mọi lời khẳng định có nguồn hoặc nhãn giả định; nhóm diễn tập được toàn bộ pitch.

## 4. Phân công và phối hợp trong nhóm 7 người

### Đánh giá hiện tại — rà soát 18/10/2026

**Kết luận: đủ nền để nhóm dùng, hoàn thiện và diễn tập demo có giám sát; chưa đủ bằng chứng để tuyên bố MVP đã tổng nghiệm thu hoặc triển khai cho khách thật.** Đánh giá cho nhóm nhỏ thao tác trên 260 case synthetic, transport mock, web local. Không quy đổi 10 bước thành phần trăm hoàn thành vì khối lượng các bước khác nhau.

- Nền lõi khá chắc: schema/RLS, import 127 features, approval theo revision, outbox/receipt, opt-out, context SHAP, ba loại AI output và portal đã có code cùng evidence. Không cần xây lại hoặc đổi model.
- Phiên này chạy lại: `npm test` ở website/app đạt **7/7**; `npm run build` đạt; `node --test n8n/tests/validator.test.mjs` đạt **5/5**; `npm test` ở supabase/tests đạt **39 checks**, exit 0. DB chạy trong PGlite với Auth/JWT/Storage stub, không chứng minh concurrency Postgres cloud.
- Evidence đã có từ các lượt trước: hosted login/quyền, AI Agent/FAQ trong khoảng 12 giây ở một lượt, mock send/reply, ảnh send spinner/timestamps. Đây không phải SLA hay xác nhận live services vẫn khỏe tại thời điểm rà soát.
- Rà cấu trúc tất cả module chính, entry points UI, tests, migration quyền/AI/portal, contract SQL, workflow exports/validator và ML artifacts/approval. Không đọc từng dòng CSV lịch sử lớn, dependency/vendor, binary model hoặc tmp/secrets. Không rerun tuning/generator/ML tests đã xác minh vì không đổi ML. Không gọi LLM/gửi tin/reset consent hay chạy cloud mới trong phiên này.

### Những việc cần ưu tiên trước demo cuối

| Ưu tiên | Phát hiện / bằng chứng cụ thể | Việc nhỏ nhất cần làm | Owner |
|---|---|---|---|
| P1 | `website/app/tests/hosted-smoke.mjs` bắt buộc portal có đúng 1 thread, trong khi `evidence/n8n_agents.json` ghi 2 thread. Script còn cố định 260/1 case theo role | Sửa fixture để kiểm quyền và các thread dự kiến bằng ID/config của lượt test; dùng test khách bình thường để chứng minh isolation, tách reserved demo selector. Không giảm kiểm quyền thành chỉ kiểm HTTP 200 | QA + leader |
| P1 | Chưa có evidence một người mới tự thao tác toàn luồng trên browser; kiểm API và ảnh từng đoạn đã có | Chạy ma trận bên dưới trên hai browser profiles; ghi elapsed time, IDs, kết quả, ảnh/video và lỗi thực | QA, cả hai n8n owners |
| P1 | Không có cost form/chart cuối ở UI dù đã có `retention_record_cost`/`retention_metrics` và DB regression | Dùng RPC sẵn có; form amount/currency/type/source/simulated và summary cùng kỳ, không dựng backend mới. Không ghép khác currency hoặc gọi care completed là retained | Frontend 1 + report |
| P1 nếu demo offer | Catalog/eligibility chưa duyệt, dropdown hiện No offer | Chuẩn bị catalog demo nhỏ có điều kiện/hạn/cost/reviewer; leader duyệt rồi mới seed. Có thể trình diễn No offer nếu chưa duyệt, phải nói rõ giới hạn | n8n 1 + leader |
| P1 trước nộp | URL/license nguồn thiếu; deliverables hiện chỉ có `.gitkeep`; REPORT có khung/TODO | Bổ sung nguồn chính xác từ người cung cấp, hoàn thiện narrative English và xuất bản nộp sau review. Chưa rõ license thì không phân phối lại raw | Report + leader |
| P2 | Queue chỉ sort risk giảm dần; search/filter client-side, chưa pagination. Với nhiều case mới, case đến hạn rủi ro thấp hơn có thể nằm dưới | Thêm ưu tiên due/overdue rồi risk và phân trang đơn giản cho table; kiểm số tổng không bị tính theo riêng trang. 260 case chưa phải bằng chứng chịu tải lớn | Frontend 1 |
| P2 | Notifications chỉ fetch khi bấm nút, chưa unread badge/live notification; khác delta UX mong muốn | Bổ sung badge và cập nhật dùng cơ chế refresh sẵn có; read notification không hoàn thành task; không cần framework realtime mới | Frontend 2 |
| P2 | UI chỉ gọi review với `approved`; SQL hỗ trợ `rejected`. AI message chưa dùng vẫn nằm Unused khi không phù hợp | Thêm Reject + lý do theo RPC có sẵn; kiểm không enqueue và lịch sử đúng revision. Không biến reject thành xóa lịch sử | Frontend 1 |
| P2 | `Details.load` tải toàn detail/jobs mỗi 3 giây, Supervisor còn tải staff directory mỗi lượt; lịch sử hiển thị dài. Queue 6 cột cần cuộn ngang ngay trên ảnh desktop hiện có | Rút gọn màn chi tiết theo tác vụ, loading/error dễ hiểu, tải directory khi cần; test màn laptop/mobile. Chỉ tối ưu thêm nếu đo thấy giật/chậm | Frontend 2 + Frontend 1 |

Không xác nhận có lỗi gửi trùng/lộ dữ liệu đang xảy ra: regression hiện tại đạt. Các nhánh concurrency/timer/live browser chưa kiểm cần được đo, không chuyển thành bug đã tái hiện.

### Gói việc có thể giao ngay

Đây là **đề xuất phân công theo 7 người đã nêu trong plan**, chưa gán tên, chưa gửi tin cho thành viên hoặc cam kết deadline. Một buổi tập trung dưới đây tạm tính 3–4 giờ, chỉ để chia cỡ việc; phải điều chỉnh theo năng lực/thời gian thực. Mỗi owner nhận một đầu ra đầu tiên trước khi mở rộng.

| Người / gói | Việc và file đầu vào | Đầu ra đầu tiên / nghiệm thu | Review / ước lượng |
|---|---|---|---|
| **Leader — tích hợp và khóa phạm vi** | Đọc mục này + SYSTEM/DATA_ML. Giữ CatBoost/127/6 nhóm; quản quyền, migrations và fixture; quyết catalog/delay/config | Gán tên 6 owner, duyệt catalog hoặc chốt demo No offer, phân case test còn consent, review hợp đồng và tích hợp từng thay đổi. Không cùng lúc nhận toàn bộ report/UI | QA kiểm chéo; review ngắn mỗi đợt |
| **Frontend 1 — nghiệp vụ và chỉ số** | `Queue.jsx`, `Progress.jsx`, vùng Care actions trong `main.jsx`; RPC sẵn trong SYSTEM | Đợt đầu: cost form + metrics cùng kỳ, ghi lặp không nhân chi phí, Agent không thấy ngoài phạm vi. Đợt sau: due/risk sorting, table pagination, Reject reason; giữ exact-revision approval và Unknown | Leader review logic/quyền, QA nghiệm thu; 2–3 buổi |
| **Frontend 2 — UI/UX và portal** | `style.css`, English BRIEF/3 mockups; header/notifications/Portal trong `main.jsx` | Đợt đầu: Queue/detail/portal rõ hierarchy, thao tác chính dễ tìm; test 1366×768 và 390×844 không tràn cả trang, có keyboard focus/labels, error/empty/loading rõ. Đợt sau unread badge, feedback tin mới, giữ editor khi refresh. Nộp ảnh trước/sau và 3 vấn đề usability đã xử lý | QA + leader; 2 buổi |
| **n8n 1 — chất lượng AI và knowledge** | `02_ai_message.json`, `02_ai_call_script.json`, `02_ai_explanation.json`, FAQ dataset/Sheet, n8n README | Đợt đầu: review 6 tình huống (Prepaid, snapshot cũ, thiếu facts, khách reply, rewrite, không offer), mỗi tình huống một output mẫu + nhận xét ground truth. Chặn bịa nợ/lịch hẹn/ưu đãi, không lộ risk/notes; đề xuất FAQ/catalog có nguồn. Sửa prompt/schema khi có lỗi tái hiện, giữ 3 worker và claim/auth gate | Leader review facts/policy, report review English; 1–2 buổi |
| **n8n 2 — độ ổn định và vận hành demo** | `04_mock_delivery.json`, `06_followups_support.json`, tests/demo-flow, SYSTEM state contract | Đợt đầu: kiểm production schedule với fixture riêng: approved→receipt, support receipt, reminder đến hạn. Đợt sau lỗi/retry/replay, opt-out giữa approval/send, reply trước reminder, close case. Nộp execution IDs + trạng thái trước/sau, hướng dẫn khôi phục khi timeout; không gửi kênh thật | QA + leader; 2 buổi |
| **Business/report — câu chuyện kinh doanh** | REPORT/PROBLEM/DATA_ML, RESULTS và figures; owner UI/n8n cung cấp evidence | Đợt đầu: bản English problem + PDMT + system/workflow + data/method/results/limits, sổ claim→source ngay trong REPORT. Đợt sau executive summary nhiều trang và business case low/base/high có assumptions/horizon/currency, break-even và pilot có đối chứng. Chưa có margin/cost thật thì để giả định rõ, không bịa ROI | Leader review số/ML, QA/presentation review dễ hiểu; 2–3 buổi |
| **QA/demo/presentation — tổng nghiệm thu và pitch** | Ma trận bên dưới, tests, evidence; REPORT và app | Đợt đầu: chạy happy path browser + ghi lỗi có bước tái hiện/expected/actual/severity/owner; sửa smoke fixture với leader. Đợt sau English slide theo narrative đã review, demo script có người bấm/người nói, video fallback, bộ source/config sạch secrets. Đo thời gian 1 người mới làm tác vụ | Leader chốt release, report review nội dung; 2–3 buổi |

**Giảm xung đột:** `main.jsx` chứa cả App/Details/Portal nên FE1 và FE2 không sửa cùng lượt. FE2 bắt đầu ở CSS và portal layout; FE1 bắt đầu Queue/Progress và cost. Hẹn vùng sửa/merge trước; chỉ tách component tại ranh giới App/Details/Portal nếu hai owner thực sự cần sửa đồng thời, không refactor toàn app. n8n owner đầu tiên rà/test workflow hiện có, không dựng lại 7 workflow cho đủ số. Một người sửa graph live tại một thời điểm, export lại và QA kiểm trước publish.

**Cách nhận bàn giao mỗi task:** owner nêu file/component mình sửa, input/fixture, ảnh hoặc test result, giới hạn còn lại và người review. Ghi trạng thái chung vào file này; lỗi/checks vào evidence hiện có hoặc một record chung, không tạo nhật ký/plan theo từng thành viên. Không chia sẻ credential qua report, screenshot hoặc gói nộp.

### Ma trận nghiệm thu browser/n8n giao QA

Các dòng sau là **việc cần kiểm**, không phải pass mới của phiên rà soát này. Backend regressions đã pass cho nhiều invariant tương ứng; nghiệm thu thêm đường thao tác và schedule thực tế. Dùng fixture riêng/idempotency key mới, không reset opt-out của 2931. Khách 7801 còn consent theo evidence trước, phải kiểm lại consent/owner trước lượt chạy. Reserved demo customer được chuyển giữa synthetic Outreach threads theo thiết kế; normal customer vẫn phải bị cô lập.

| # | Kịch bản | Kết quả cần thấy / evidence |
|---|---|---|
| 1 | Supervisor phân case; Agent tìm/mở; customer phiên khác | Đúng scope và case IDs; customer không thấy queue nội bộ/notes, normal customer không mở thread khác |
| 2 | Request explanation/message/call script; bấm nhanh lặp/refresh | Mỗi loại đúng output, một pending request/claim; không gọi LLM hai lần; có Working→Done/error; editor chưa lưu không mất |
| 3 | Sửa draft, save, sửa tiếp sau save; approve revision cũ | Chưa save/approval sai revision không gửi; chỉ body/revision đã duyệt xuất hiện đúng portal, Created/Sent hợp lệ |
| 4 | Customer reply; request draft tiếp | Không tạo auto outbound; staff thấy reply đúng thứ tự và tự Request rồi review; lời AI tiếp nối nội dung mới |
| 5 | Re-send/replay/timeout; lỗi worker có kiểm soát ở sandbox | Không có receipt/message thứ hai; lỗi hữu ích, retry/backoff đúng; thu execution IDs. Không phá workflow live dùng chung để tiêm lỗi |
| 6 | 2931 opt-out; fixture khác opt-out giữa approval và send | Nút bị chặn và server/worker recheck; không tự phục hồi consent khi reply/reimport |
| 7 | Manual reminder + no-reply reminder, khách trả lời trước hạn | Reply hủy đúng no_reply, giữ manual; timer sinh notification một lần, không tự gọi/gửi; read không đồng nghĩa complete task |
| 8 | Technical referral | Request đúng khách/nội dung, receipt mock một lần; UI không nói đã sửa xong/xác nhận lịch |
| 9 | Close/reopen care; outcome tháng 10 chưa đủ kỳ | Unknown giữ nguyên khi close, công việc chưa gửi bị hủy đúng; outcome sớm bị chặn. Outcome đã đủ kỳ dùng fixture quá khứ ở DB test, không đổi đồng hồ cloud |
| 10 | Ghi cost lặp và đổi role/kỳ | Không nhân chi phí; tách currency/simulated; tổng theo đúng scope/kỳ, không suy uplift/ROI từ score |
| 11 | LLM thiếu facts/Prepaid/prompt injection/FAQ offer disabled | Không bịa nợ/giá/lịch; không lộ score/SHAP/notes; input khách không ghi đè policy. Staff review vẫn bắt buộc |
| 12 | Người mới làm tìm khách→đọc drivers→sửa/duyệt→xem reply, laptop/mobile/keyboard | Ghi thời gian và điểm mắc; ảnh không tràn màn, focus nhìn rõ, không mất draft khi poll; yêu cầu trợ giúp phải được ghi nhận |

**Thứ tự chốt:** (A) QA và n8n rà happy path/fixture trước, report và hai FE làm song song; (B) ghép UI/cost/chart và nội dung AI đã review, chạy nhánh lỗi; (C) đóng thay đổi chức năng, diễn tập từ đầu và xuất file. Không ấn định ngày khi chưa có deadline.

**Cổng demo cuối:** build/tests đạt; một browser journey trọn vẹn có video; schedule delivery/reminder/support đã quan sát; không còn lỗi quyền/sai khách/gửi chưa duyệt/gửi trùng/Unknown sai; No offer hoặc catalog được duyệt; chủ demo biết thông báo lỗi và fallback. **Cổng nộp:** thêm report/slide English đã đối soát claims, nguồn/license và package chạy được trên máy thành viên thứ hai. Production còn cần kiểm định dữ liệu thật, concurrency/load thực, quản lý secrets/ops và tích hợp provider/policy riêng; chưa thuộc đợt hoàn thiện bài này.

## 5. Việc cần người dùng cung cấp hoặc chốt tiếp

1. **Kaggle URL/version/license** — đã có file local, cần bổ sung nguồn phân phối. Dataset v4/127 đã chốt cho demo; không sinh lại hoặc đổi nhãn theo test.
2. **English mockup đã được duyệt baseline** — bổ sung Channel/Notifications và kỳ tháng 10 khi code; chưa yêu cầu tạo lại ảnh.
3. **Deadline, tên và năng lực thành viên** — để giao việc/ngày công cụ thể thay vì ước lượng không có cơ sở.
4. **Đặc tả Auth/approval đã chốt về nghiệp vụ** — chuyển thành ownership/RLS ở bước 3. Kỳ demo tháng 10; không cần hỏi lại các quyết định đã có.
5. **Môi trường Supabase/n8n/LLM** — chỉ cần khi bắt đầu kết nối thực; không gửi API key vào tài liệu hoặc chat bàn giao.

Bước 1 đã chốt; dataset v4/127 và pipeline Optuna/train/calibration/test/predict đã chạy. Model và nhóm đã duyệt, grouped SHAP đã chạy; chưa kiểm định trên FPT và đã có app local và dịch vụ Supabase/n8n demo. Đọc kết quả hiện hành trong DATA_ML và ml/README.

## 6. Kết quả bước 1 — đã ghi nhận câu trả lời leader

Ngày chốt: 17/10/2026. Đây là quyết định phạm vi/nghiệp vụ, không phải kết quả kiểm thử triển khai. Chi tiết thực thi và ví dụ outcome nằm ở [System](SYSTEM.md), mục Quyết định bước 1.

| # | Kết luận | Trạng thái |
|---|---|---|
| 1 | Đầu tháng dự báo cùng tháng; kịch bản demo batch 01/10/2026 cho tháng 10/2026. Giữ số liệu tháng 9 ở Problem | Đã chốt |
| 2 | Agent sở hữu case được giao; Supervisor xem toàn pilot và điều phối; portal tách đúng khách | Đã chốt |
| 3 | Agent tự review/sửa/Approve & Send trong policy; ngoại lệ cần Supervisor; revision nào duyệt gửi đúng revision đó | Đã chốt |
| 4 | AI soạn trước, người review mọi nội dung; mọi outbound và reply cần duyệt riêng. Lý do thiết kế: giữ quyền kiểm soát với nhóm khách rủi ro cao, không khẳng định tác động causal đã đo | Đã chốt |
| 5 | Gợi ý phân công theo tải; quản lý được đổi; ưu tiên risk + chờ + đến hạn. Không xây phân ca | Đã chốt |
| 6 | Chuẩn bị tài liệu catalog phương án/ưu đãi duyệt trước; AI chỉ dùng rule hợp lệ; leader/nhóm chatbot sẽ hoàn thiện sau | Kiến trúc đã chốt; nội dung catalog để bước sau |
| 7 | Channel mặc định Zalo, có selector; mọi nhãn kênh đều dẫn đến chatbot mô phỏng đúng khách/case, có badge Simulated; không nối provider thật | Đã chốt |
| 8 | Có thông báo tin khách mới và nhắc quá hạn. AI đề xuất chuông góc trên phải + badge/dropdown/toast; mốc default cấu hình 3 giờ, có thể chọn 24 giờ | Cơ chế đã chốt; 3 giờ và vị trí cụ thể là đề xuất UX/cấu hình, chưa coi leader đã khóa |
| 9 | Contact result, case state và outcome theo kỳ độc lập. Đóng case chưa đồng nghĩa retained; Unknown khi chưa có bằng chứng đủ kỳ | Đã chốt; diễn giải chi tiết trong System |
| 10 | English mockup đủ làm baseline; bổ sung Channel/Notifications, ngày demo và delay cấu hình lúc code, không thêm trang | Baseline đã duyệt; chưa phải code hoạt động |

Điểm để bước sau cấu hình: nội dung catalog/ngoại lệ, khung giờ và giới hạn liên hệ, delay nhắc cuối cùng, ownership/schema cụ thể. Các mục này không còn chặn phạm vi bước 1 vì đã xác định cơ chế policy/config và không cho tự thực hiện hành động vượt quyền. Không tự áp ưu đãi khi catalog chưa được duyệt.

**Bàn giao tiếp:** đã nhận/profile nguồn; đọc đề xuất dataset v1 đầu DATA_ML.md để review và chuẩn bị generator sau. Không tự đổi bộ số tháng 9 thành tháng 10, không giả score-only tạo được SHAP, không sinh history theo nhãn Kaggle để ép AUC, không dùng nhãn holdout để giả kết quả can thiệp.


## 7. Bàn giao ML hiện hành — 127 features

- Dữ liệu: `data/synthetic/final/features_127.csv`; config train `ml/config.json`. Tất cả bốn ứng viên đều đúng 127 biến; không dùng bảng nền 22 như model input.
- Luồng và lệnh: `ml/README.md`. Kết quả: `docs/evidence/ml/RESULTS.md`, `comparison.csv/json`. Optuna đủ 30 trials/họ, tách khách calibration trước tuning; test September exploratory.
- Đã duyệt và triển khai: CatBoost tuned 92 vòng, đủ 127 features và 6 nhóm SHAP. Không train lại hoặc đổi tham số/xác suất. Đọc DATA_ML và shap_summary.json; selection/metrics giữ trạng thái lịch sử, champion/approval.json ghi quyết định duyệt hiện hành.
- Output tích hợp: `data/inference/final/predictions.csv` và `explanations/care_context.jsonl`; bundle champion. October Unknown; SHAP available, English drafts cần staff review. Đã kiểm LLM và gửi tin mock qua n8n; xem evidence/n8n_workflows.json. Không gửi nhãn/audit cho AI.
- Code tạo sample/dataset/history/window giữ ở `ml/generation/`; dữ liệu/model cũ đã dọn khỏi luồng làm việc, tổng hợp lịch sử tại `docs/evidence/ml/historical_experiments.json`.
- Đã kiểm tra 23 tests pipeline và 7 tests SHAP; probability round-trip không đổi; config/feature/model hash giữ nguyên. Đã có app local/Supabase/n8n demo; chưa có bằng chứng hiệu quả kinh doanh.

## Delta hiện hành — AI Agent, live updates và portal selector

Nút Request queue job rồi gọi đúng webhook bằng JWT/publishable key, không chứa service secret. Queue/Details/Portal poll mỗi 3 giây khi tab visible, giữ message editor/rewrite inputs. Hook ngăn poll chồng, cleanup khi unmount và hiện lỗi sync.

Migration 20261018091216_typed_ai_queues_demo_portal đã áp. pending_jobs thêm p_output optional, lọc trước limit. Chỉ customer@retention.example đã provision và active portal mapping được chọn thêm conversation mock của khách is_synthetic=true, profile_source=synthetic_demo, stage in_progress/waiting_customer, đã có external outbound sent. Normal customer vẫn chỉ thấy mapping của mình; không lộ note/model internals. Browser Request explanation đã hoàn tất không bấm Refresh, editor chưa lưu giữ nguyên; ảnh evidence/website-live-ai.png. Hosted API thấy cả 2931-VUVJN và 7801-CEDNV; regression kiểm normal/real/inactive bị chặn.

37 DB checks, 5 validator checks, 4 UI checks và build đạt. Hosted smoke n8n/tests/agent-flow.mjs chỉ tạo draft chưa duyệt; evidence/n8n_agents.json. FAQ chưa nối thật; n8n/faq-template.csv có id/topic/question/answer/source/approved, để nhóm điền và review. LLM vẫn cần staff kiểm thời gian/facts. Không reset tin đã gửi của các lần demo trước.

## Delta mới nhất — Request progress, knowledge và approval feedback

- AIRequestButton: spinner/Working trong lúc submitting/queued/claimed, tick Done 1,8 giây sau completed rồi trả nhãn Request; failed/cancelled cho retry. Normal/rewrite cùng loại bị khóa khi còn pending, kể cả refresh trang. Lỗi đồng bộ được báo riêng.
- Migration 20261018093807_ai_request_progress_and_usage: claimed_at trên jobs, used_at trên recommendations; thêm retention_claim_ai_request (worker only), retention_mark_script_used (staff scoped). Request khóa case và coalesce cùng output đang queued; cùng input vừa completed có cooldown 15 giây. Claim atomic, chỉ một execution đi tiếp tới LLM; claimed treo quá 5 phút được đánh failed, không tự gọi LLM lại. Nâng từ 30 lên 32 public RPC, vẫn 25 bảng. Đây thay thế giới hạn cũ cho phép gọi LLM dư vì execution chồng.
- Worker context mỗi lần lấy đầy đủ external sent messages + customer inbound, đúng revision đã gửi, thứ tự sent_at/created_at; thêm care_stage/contact_result. Không có draft chưa gửi hoặc internal notes. Agent được yêu cầu nối tiếp reply mới nhất, không hỏi lặp, không xem snapshot cũ là hiện tại.
- Message Used = queued/sending/sent, Unused = chưa gửi/failed/cancelled; approve chuyển khỏi Unused và xóa editor. Script có Mark as used, RPC idempotent, không có nghĩa hệ thống đã gọi điện. Lịch sử không bị xóa.
- FAQ Sheet: https://docs.google.com/spreadsheets/d/12Pl6SVo_tNFSVP4S4Nxh57rIlRvkFqKMksgzWzDw-Gs/edit ; 15 dòng, 14 enabled, 1 offer draft disabled. 6 mục từ nguồn FPT công khai, 8 quy tắc demo; approved=true nghĩa được bật cho demo, không phải FPT xác nhận chính sách nội bộ. Dataset local n8n/faq-dataset.csv. Ba Agent dùng Google Sheets Tool Read_company_FAQ chỉ read approved=true, có source; không có customer data trong Sheet. Workflow setup một lần 9zA8OwsBtr77RhG6 đã archive sau read-back execution 261 xác nhận 16 rows gồm header.
- Hosted Agent smoke: duplicate request keys coalesce và duplicate wakeups bị claim chặn; cả 3 loại hoàn tất trong 12 giây, draft chưa duyệt/chưa gửi; evidence/n8n_agents.json. 39 DB checks và 5 workflow validator checks đạt. Test lỗi trước là so sánh hai Date object, đã sửa so sánh timestamp và chạy lại.
- Approve & Send vẫn gọi transaction approval/outbox, receipt sent mới xác nhận gửi. 2931-VUVJN case waiting_customer, Zalo contact_allowed=false, opt_out_at 18/10/2026 16:05 Asia/Saigon, consent_basis=customer_opt_out; không tự reset. UI chỉ rõ lý do, disable nút trước RPC. 7801-CEDNV còn consent để demo.
- Sheet trống dư 1vyrZ9yNrFh8Xt_1X0ieJODXj4-v9BE6wSvjYYdPYsh0 phát sinh trong sửa lỗi khởi tạo; automatic approval từ chối thao tác trash vì ngoài quyền tạo/nạp FAQ. Đã hỏi người dùng và chưa được chấp thuận; không thử dọn bằng đường khác. Sheet chính không ảnh hưởng.

Browser đã kiểm khách 2931: chọn saved draft, nút Approve & Send vẫn disabled vì opt-out và cảnh báo rõ ngay trên editor. Evidence: evidence/website-send-permission.png. UI tests 6/6, build đạt; không đổi consent hoặc gửi thêm tin trong kiểm tra này.

Message timestamp/send feedback: website/app/src/main.jsx dùng created_at và sent_at từ Supabase, format Asia/Saigon qua date(). Spinner Approve & Send theo approval request và delivery_status queued/sending; sent mới tick, failed hiện hướng dẫn quay Unused. Giữ nguyên revision approval, consent và outbox worker.

Browser kiểm trên 7801: lưu một tin test mô phỏng, Approve & Send hiện Working và disabled xuyên suốt queued; delivery worker execution 336 xử lý, tin xuất hiện trong hội thoại và Used có Created 17:01 / Sent 17:02 (18/10 Asia/Saigon). Không gọi LLM trong lượt kiểm này. Evidence website-send-working.png và website-message-times.png.

**Security review sau cutover 19/10:** 25 public tables RLS; Agent1/Supervisor207/Portal0 internal +1 thread đã kiểm SQL. Backup/staging private có RLS và không có browser/worker grants (no-policy INFO là chủ ý deny-all); staging đã xóa payload sau commit. Advisor vẫn cảnh báo 19 RPC SECURITY DEFINER có auth/ownership guards và leaked-password protection đang tắt; chưa đổi Auth setting ngoài phạm vi. Tham khảo [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Không gọi đây là production security sign-off. Restore đã kiểm local; chưa restore cloud vì sẽ thay dữ liệu đang dùng.
