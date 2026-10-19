# Workflow n8n hiện hành

**Delta ML 19/10:** bộ v5 đã tạo/train offline, chọn LightGBM tuned, cho prediction ngày 1/11/21, horizon một tháng lịch trượt. Supabase/SHAP đã chuyển LightGBM v5, latest 10/10: 2.705 khách/207 cases, worker context có start/end. UI source đã sửa/build local; Vercel chưa deploy. Workflow giữ unpublished/timer disabled; không execute/LLM/send trong lượt này. Khi cutover n8n phải dùng đúng context/hash v5. Quota/timer-disabled policy giữ nguyên.

**Migration hoàn tất ở trạng thái draft — 18/10/2026:** đã chuyển đủ 5 workflow sang `group-2-new` qua MCP đúng instance, gắn Supabase/Google Sheets credentials mới và Gateway credits. Đọc lại đủ 52 node, connections/parameters khớp bản nguồn; tất cả chưa publish và timer disabled. Local validator 6/6 đạt; không chạy workflow/LLM/gửi tin để kiểm migration. Evidence: `../docs/evidence/n8n_migration.json`. Supabase runtime chưa được kiểm; Sheets credential mới lookup được tab FAQ. Website/Vercel và hosted smoke scripts vẫn trỏ host cũ cho đến khi chốt activation/cutover. Các kết quả execution phía dưới là lịch sử account cũ, không phải test trên account mới.

**Giữ quota:** 3 AI fallback mỗi phút + delivery mỗi phút + follow-up mỗi 2 phút có thể tạo khoảng 6.480 executions/ngày khi để chạy liên tục, vượt nhanh ngân sách 1.000. Không bật lại lịch đó trên account mới. Import/read/validate local không cần execution live; không chạy workflow để kiểm credential/import. Trước test live phải nêu ngân sách executions tối đa; dùng một mẫu tối thiểu khi cần. Quy tắc lâu dài ở `../AGENTS.md`. Khi tắt schedules, AI không còn fallback tự chạy, delivery/support/reminder cũng không tự tick; phải hoàn thiện trigger theo sự kiện hoặc quy trình demo có kiểm soát trước khi gọi hệ thống đã hoạt động trở lại.

Bản hiện hành có 5 worker đã chuyển sang tài khoản n8n Cloud mới ngày 18/10/2026, tất cả unpublished. Bảy mục dưới đây là trách nhiệm logic; ingestion dùng Python/RPC, approval/inbound/outcome dùng Auth RPC của website nên không tạo workflow rỗng cho đủ số.

| Worker | Trigger | Export |
|---|---|---|
| [AI message](https://group-2-new.app.n8n.cloud/workflow/nNbDkr6XkXbbNOjl) | Request/rewrite message; fallback timer disabled | [02_ai_message.json](02_ai_message.json) |
| [AI call script](https://group-2-new.app.n8n.cloud/workflow/0rCQHXSgtE7LKuhC) | Request/rewrite call script; fallback timer disabled | [02_ai_call_script.json](02_ai_call_script.json) |
| [AI explanation](https://group-2-new.app.n8n.cloud/workflow/5Kt2SpYMSKcnxJ2s) | Request explanation; fallback timer disabled | [02_ai_explanation.json](02_ai_explanation.json) |
| [04 Mock delivery](https://group-2-new.app.n8n.cloud/workflow/DXzQNDZgoYA5HbuG) | Manual; timer disabled | [04_mock_delivery.json](04_mock_delivery.json) |
| [06 Follow-ups and support](https://group-2-new.app.n8n.cloud/workflow/YM3alB7plp9igVJq) | Manual; timer disabled | [06_followups_support.json](06_followups_support.json) |

AI worker gộp iFQqWykiGRtAmrLI đã unpublish; export cũ thay bằng ba JSON riêng. Mỗi workflow có AI Agent + OpenAI Chat Model + Google Sheets tool Read_company_FAQ. Rewrites dùng workflow cùng loại; không dùng shared chat memory giữa khách.

Request tạo job bằng Auth RPC rồi POST job_id đến `/webhook/retention-ai-message|call_script|explanation`, kèm JWT phiên và publishable key. Authorize requested job đọc đúng job queued qua RLS trước khi dùng worker credential. Webhook trả 200 là đã nhận, chưa phải đã sinh xong. CORS cho hai URL local 5173. Bản Vercel production dùng ba proxy routes cùng domain `/api/retention-ai-*` trong website/app/vercel.json; local dev vẫn gọi trực tiếp. Không cần mở wildcard CORS; xem ../docs/DEPLOYMENT.md. Không lưu production execution data cả success/error để tránh giữ bearer token; debug bằng manual trigger không chứa token. Fallback mỗi phút lọc requested_output trước limit. UI tự cập nhật mỗi 3 giây khi visible, giữ nguyên nội dung editor.

Credentials account mới: **Supabase account**, **Google Sheets account** và **Gateway credits**; không chứa secret trong JSON. AI dùng gpt-5.4-mini, kết quả kiểm ghi model gpt-5.4-mini-2026-03-17. Export lấy graph thật từ account mới: active=false và schedule disabled; chưa có bản live active trên account mới. Khi import sang instance khác cần chọn lại credential rồi publish.

Đã kiểm bằng hosted Auth API + n8n executions 21–25: message rewrite, call script, explanation, duyệt đúng revision → portal mock → customer reply; nhắc đến hạn và support receipt mock. [Evidence](../docs/evidence/n8n_workflows.json). Chưa kiểm toàn luồng bằng thao tác browser hoặc quan sát riêng production timer. Workflow không lưu successful production execution data.

Kiểm local: `node --test n8n/tests/validator.test.mjs` (5 checks, chạy lại đạt ở phiên rà soát 18/10). Script `n8n/tests/demo-flow.mjs` là fixture nhiều bước có trạng thái, đọc credential ở file ignored; các mode và input xem trong script. Không chạy lại mode prepare/verify-artifacts sau khi đã gửi fixture; dùng request key mới cho lượt diễn tập mới, không reset dữ liệu để ép test qua. Gói giao việc AI/knowledge và delivery/follow-up, cùng ma trận nghiệm thu browser/schedule, ở `../docs/IMPLEMENTATION.md` mục 4. Không chạy nguyên hosted-smoke cũ trước khi sửa giả định số thread/case theo fixture hiện hành.

| # | Workflow | Trigger | Việc chính |
|---|---|---|---|
| 1 | Tiếp nhận prediction & tạo case | Batch đầu tháng | Validate, lưu prediction, eligibility, chống case trùng, phân công |
| 2 | Tổng hợp hồ sơ & đề xuất | Staff bấm Request AI | Top 3 nhóm tín hiệu từ dữ liệu giải thích hợp lệ, AI diễn giải dễ hiểu, rule/offer hợp lệ, action/draft/kịch bản gọi |
| 3 | Xử lý quyết định duyệt | Quyết định đã được server xác thực | Ghi audit, xử lý từ chối/sửa, bàn giao đúng revision được duyệt cho outbox |
| 4 | Gửi tin & kết quả gửi | Approved outbox | Recheck consent/eligibility và revision; gửi portal demo; receipt, retry |
| 5 | Nhận phản hồi & điều phối | Inbound event hoặc DVKH gửi yêu cầu hỗ trợ | Xác thực/dedupe, lưu reply, dừng follow-up phù hợp, tạo draft hoặc bàn giao yêu cầu hỗ trợ ra hệ thống/kênh ngoài |
| 6 | Theo dõi thời hạn & follow-up | Schedule | Sau delay cấu hình chưa reply tạo notification/nhắc DVKH, có thể đề xuất call script; default làm việc 3 giờ là đề xuất, không tự gửi/gọi |
| 7 | Outcome & tổng hợp | Outcome update hoặc lịch đối soát | Ghi outcome đúng kỳ, cost và số liệu vận hành; chưa biết thì unknown |

## Quyết định bổ sung từ bước 1

- Batch demo 01/10/2026 cho kỳ churn tháng 10; tháng 9 là bối cảnh lịch sử, không đổi thành outcome demo.
- Workflow gửi/nhận dùng `selected_channel` mặc định Zalo nhưng `transport=mock` cho mọi lựa chọn. Badge Simulated, không cần credentials Zalo/Messenger thật. Dedupe và customer isolation vẫn áp dụng.
- Inbound workflow 5 ghi notification New customer message cho staff có quyền và hủy nhắc chờ reply đã lỗi thời; không tự tạo AI job. Staff bấm request riêng cho lần trả lời tiếp theo.
- Workflow 6 tạo Follow-up due theo config, recheck reply/opt-out/case và gửi cuối; notification được đọc không đồng nghĩa task hoàn tất. Default 3 giờ là giả định làm việc, có thể đổi 24 giờ. Không tạo nhiều thông báo giống nhau mỗi lần schedule chạy.
- Catalog phương án/ưu đãi sẽ viết nháp và review ở bước sau; không cho LLM tự tạo offer hoặc bypass approval.
- Workflow 7 chỉ ghi Active at period end khi đủ kỳ/có nguồn, Unknown nếu case đóng mà chưa có outcome. Outcome giả lập phải có nhãn.

## Ranh giới

- Sản phẩm/report nộp bài bằng tiếng Anh theo yêu cầu giảng viên. Workflow 2 tạo group explanation, recommendation, draft và call script bằng English; follow-up/portal và nội dung thông báo demo cũng dùng English. Không thay fact, rank hoặc policy khi chuyển ngôn ngữ. README làm việc này giữ tiếng Việt.

- Model hiện có/Python tạo prediction; n8n tiếp nhận, không train. Điểm nội bộ = probability ×1.000; >500 tương đương >50%.
- Auth, ownership, approval theo revision và transaction outbox được kiểm tra ở server/database; không tin trường approved=true từ browser.
- Mỗi outbound reply cần duyệt riêng. Reply/opt-out dừng tác vụ chờ phù hợp; không tự gọi/gửi khi nhắc đến hạn.
- App chỉ phục vụ DVKH. Chuyển kỹ thuật là form nhập nội dung yêu cầu và gửi ra hệ thống/kênh ngoài, lưu receipt hoặc trạng thái lỗi; không xây UI, phân công hay SLA cho kỹ thuật. Chưa tích hợp thật thì gắn nhãn bàn giao mô phỏng.
- Theo dõi quá hạn trong workflow 6 chỉ áp dụng việc chăm sóc/nhắc của DVKH; không quản lý công việc nội bộ của kỹ thuật.
- Dashboard đọc Supabase, không cần một workflow riêng chỉ để hiển thị biểu đồ.
- Thời gian lưu UTC; clock tăng tốc chỉ dùng test/demo và phải có nhãn.

## Cách triển khai gọn

Contract đã triển khai trong SQL (18/10): n8n dùng HTTP Request gọi `POST <SUPABASE_URL>/rest/v1/rpc/<function>` với credential server. Không dùng node ghi bảng trực tiếp cho approval/outbox, vì worker chỉ có SELECT và execute worker RPC, không có direct DML. Browser dùng token Auth và user RPC riêng; n8n không được duyệt thay người.

| Workflow | Đường nối database hiện hành |
|---|---|
| 1 | `retention_ingest_prediction` validate đúng 127 biến, frozen versions và context → case duy nhất/customer/kỳ; không tạo AI job tự động. Nguồn demo chuẩn bị từ prepare_import.py, không train trong n8n |
| 2 | Schedule/poll `retention_pending_jobs(p_limit)` → xử lý từng job.id → `retention_worker_context(p_job_id)` → template/LLM → `retention_complete_job(p_job_id,...)`. Array rỗng thì kết thúc; n8n quản lý retry/error execution; sau khi hết retry gọi `retention_fail_job(p_job_id)` để ngừng poll job lỗi, chi tiết lỗi ở Executions. Staff Regenerate tạo request_key mới. Output luôn English và draft |
| 3 | Website gọi `retention_review_message` bằng session nhân viên; transaction kiểm quyền/offer/consent, audit và enqueue. n8n chỉ theo dõi outbox; không nhận approved=true từ webhook browser |
| 4 | `retention_claim_delivery` → `retention_deliver_mock(outbox_id,lease_token)`; lỗi dùng `retention_fail_delivery`. Null/failed claim không phải job gửi được. Adapter mock ghi message.sent + receipt + follow-up atomically; không gửi provider thật |
| 5 | Portal gọi `retention_portal_send` bằng session customer → inbound/event/notification và hủy job cũ; không tạo AI job mới. Staff bấm request nếu cần nội dung tiếp theo. Staff gọi `retention_request_support`, worker `retention_process_support` ghi receipt mock; không quản lý kỹ thuật |
| 6 | Schedule `retention_process_followups(p_limit)` → notification/task; không tự gọi/gửi. Task/read notifications xử lý qua RPC của website |
| 7 | `retention_record_outcome`/`retention_record_cost` có quyền staff; worker đối soát đọc SELECT khi cần. `retention_metrics` dành staff và tôn trọng RLS. Không đổi unknown thành retained khi đóng case |

Chỉ delivery dùng lease_token. AI job không có claim/lease RPC: n8n đọc danh sách queued, dùng job.id khi lấy context và hoàn tất. Không ghi status trực tiếp. Trong lúc retry job vẫn queued; hết retry gọi fail_job để chuyển failed. Retry cùng job.id, complete idempotent và giữ nguyên message_id/revision khi gọi lại. Trước complete job, validate output LLM và trường hợp thiếu dữ liệu; không bịa facts/offer. Payload từ `retention_worker_context` đã bỏ raw features, probability, SHAP và internal notes, giữ evidence status/not-applicable. Prompt/LLM integration đã kiểm; validator kiểm schema, requested type và output separation. Chi tiết tham số và return schema nằm trong source SQL; giữ tên p_* khi gọi API.

Hiện dùng n8n Cloud và Supabase; không cần host n8n hoặc tạo S3. Mọi secrets lưu Credentials của n8n, không vào workflow export. Demo dùng ba workflow AI theo output, mỗi lượt tối đa một job và polling yêu cầu trong DB, không đặt webhook secret trong browser. shortcut: các lần chạy chồng nhau có thể gọi LLM hai lần, nhưng unique request_key + transaction hoàn tất không tạo hai draft. Chỉ thêm claim/lease khi cần nhiều worker; không xây bộ điều phối riêng trước đó.

Người A làm 1–3, người B làm 4–6, cùng làm 7 và thống nhất outcome với leader/người báo cáo. Ưu tiên luồng 1–5 xuyên suốt cho một khách, sau đó hoàn thiện 6–7.

Giữ năm JSON thực thi trong thư mục này; không tạo thêm export rỗng cho chức năng đã có RPC. Mỗi mục dưới đây bổ sung input/output, credentials cần thiết (tên, không giá trị), bảng read/write, trạng thái, lỗi/retry, idempotency và cách test. Không nhúng secret vào export.

## Checklist chung

- Chưa duyệt không gửi; sửa nội dung sau duyệt phải tạo revision được duyệt lại.
- Dedupe batch/case, provider event, outbox và follow-up task; worker claim atomic.
- Retry có backoff/giới hạn; timeout không rõ kết quả cần đối soát trước gửi lại.
- Kiểm tra opt-out/eligibility khi enqueue và trước gửi; reply đến đồng thời schedule không tạo follow-up thừa.
- LLM thiếu dữ liệu/lỗi thì chuyển người xử lý; không bịa drivers, offers hay lịch sử khách.
- Outcome phải khớp customer/cohort/kỳ; không gọi closed case hoặc khách reply là retained.

## Contract request thủ công 18/10 — hiện hành

Lịch sử trước migration: ba workflow AI từng active, credential Supabase/Gateway cũ đã chạy thử. Bản mới hiện unpublished và chưa chạy live. Nút Request gọi RPC authenticated để tạo job; worker chỉ xử lý job do staff yêu cầu. Import/reply không tự gọi AI. Queue vẫn là nguồn trạng thái; webhook đánh thức xử lý ngay, browser không có service secret.

UI dùng request_key `manual:<output>:<uuid>` với output `message`, `explanation`, `call_script`. pending_jobs trả job.id; worker_context trả requested_output + dữ kiện đã lọc. Ba workflow xử lý theo output; polling không có nghĩa tự sinh nội dung khi không ai request.

- explanation: LLM viết rationale English từ facts/evidence status, không xuất message body; complete_job truyền p_message_body=null. UI chỉ hiển thị rationale của generation_mode=llm cho request explanation.
- call_script: LLM viết p_call_script, rationale ngắn; p_message_body=null. Không tạo outbound draft hoặc thực hiện cuộc gọi.
- message: LLM viết p_message_body/rationale; complete_job tạo draft cần người duyệt.
- Nội dung ghi chú do staff viết/lưu riêng qua save_draft(p_internal=true), không đưa vào context LLM hay portal.

complete_job giữ signature cũ, call/explanation trả message_id=null và revision=null; replay idempotent. Không gửi message body cho request chỉ gọi điện/giải thích. Trước gọi LLM phải kiểm requested_output, evidence status; prepaid null không được suy thành nợ, không tự tạo offer/số liệu/appointment. Không dùng fixture/template để giả kết quả LLM trên UI.

Rewrite contract: retention_request_recommendation(p_case_id,p_request_key,p_instructions default null,p_source_text default null). Instructions tối đa 2.000 ký tự, source tối đa 10.000; chỉ message/call_script được nhận instructions. Idempotency kiểm cả instruction/source; khác nội dung cùng key bị chặn. automation_jobs.rewrite_instructions/rewrite_source_text được trả qua worker_context. Workflow hiện truyền hai trường này dưới dạng dữ liệu staff request, giữ facts/evidence/consent/policy là ràng buộc; không đặt instruction vào system prompt hoặc tự gửi kết quả. Message source từ editor; call script source từ kết quả script hiển thị. Không có source thì là draft đầu theo instructions. Không tự ghi đè draft/revision được duyệt.

Context có snapshot_date, target_period_start, requested_at và current_time. Prompt coi ngày/số ngày tương đối tại snapshot là lịch sử, yêu cầu xác minh hiện tại; không biến ngày gia hạn ở snapshot September thành lịch sắp tới trong October. Nội dung vẫn cần staff review.

## FAQ Google Sheets đang hoạt động

[Telecom Retention Demo — Knowledge Base](https://docs.google.com/spreadsheets/d/12Pl6SVo_tNFSVP4S4Nxh57rIlRvkFqKMksgzWzDw-Gs/edit), tab FAQ. Sáu cột id/topic/question/answer/source/approved. Dataset gốc: [faq-dataset.csv](faq-dataset.csv), 15 mục, 14 enabled và 1 mục offers chưa duyệt (false). Sáu FAQ tham chiếu FPT công khai và tám quy tắc demo có nguồn riêng; true chỉ là bật cho demo, không khẳng định công ty duyệt chính sách nội bộ. Không chứa dữ liệu khách.

Mỗi Agent có Google Sheets Tool Read_company_FAQ, operation read, lọc approved=true, dùng credential Google Sheets account. Dữ liệu Sheet là reference, không ghi đè system/facts/consent. Chỉnh answer/source rồi bật approved cho dòng đã review; chưa cần Pinecone/embeddings hoặc fine-tuning. Workflow tạo Sheet đã archive sau khi tạo/nạp/read-back; không chạy lại để ghi đè Sheet.

## Chống request lặp và lịch sử hội thoại

Request RPC khóa case, dùng lại job cùng output khi còn pending; cùng input vừa completed được dùng lại trong 15 giây. Webhook/fallback qua Selected request → Claim AI request → Read care context → AI Agent. Atomic claim trả [] cho execution trùng nên không gọi LLM; Agent không retry toàn node, model giữ retry giới hạn cho lỗi provider. Claim quá 5 phút được worker/RPC request đánh failed, staff có thể tạo request mới; không tự retry LLM vô hạn.

Context lấy lại toàn bộ external sent history + inbound replies mỗi lần, đúng sent revision, thứ tự coalesce(sent_at,created_at), không có draft chưa gửi/note/model internals. Care stage và contact result giúp Agent tiếp nối tình huống; system prompt yêu cầu ghi nhận latest reply, không hỏi lại điều đã trả lời. Staff vẫn review nội dung trước gửi.

Nút Request giữ spinner đến khi DB completed, tick 1,8 giây rồi reset; Used/Unused chỉ tổ chức artifacts, không xóa lịch sử. Hosted check: n8n/tests/agent-flow.mjs cố tình gửi duplicate request/webhook, cả ba output hoàn tất với Google Sheets tool, vẫn không tự approve/send. Evidence ../docs/evidence/n8n_agents.json. Model metadata là configured alias, không giả snapshot response.
