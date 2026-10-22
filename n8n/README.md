# n8n trong demo

Workflow exports hiện hành ở `workflows/`; FAQ đang dùng là `faq-dataset.csv`. Chỉ chứa credential references, không chứa API key hoặc mật khẩu. Khi import sang instance khác cần map credential và webhook đúng môi trường; các exports giữ `active=false`, schedule disabled.

| Workflow | Trigger / vai trò |
|---|---|
| `02_ai_explanation.json` | Staff Request explanation |
| `02_ai_message.json` | Staff Request/rewrite message |
| `02_ai_call_script.json` | Staff Request/rewrite call script |
| `02_ai_ticket.json` | Staff yêu cầu ticket nháp từ hội thoại |
| `04_mock_delivery.json` | Delivery worker thủ công, không cần cho nhánh inline mock hiện hành |
| `06_followups_support.json` | Operator xử lý reminder/support mock |

App production gọi bốn route `/api/retention-ai-*` trong `website/app/vercel.json`; local gọi webhook trực tiếp. Request có JWT/publishable key/job_id; webhook authorize qua RLS rồi atomic claim trước LLM. Webhook nhận request không có nghĩa job đã completed. Outputs chỉ là nội dung nháp để staff review, không tự submit/send.

Ba Agent explanation/message/call script có Google Sheets tool `Read_company_FAQ`, chỉ đọc approved=true. Dataset có 15 dòng: 14 enabled và một offer draft disabled. approved=true là được bật cho demo, không phải FPT xác nhận policy nội bộ. Không đưa customer data vào FAQ Sheet. Ticket dùng chain có structured output và quoted evidence từ chat external.

AI dùng model cấu hình trong workflow exports; xem JSON để biết model/credential hiện hành. Không dùng shared chat memory giữa khách. Không giữ successful/error production execution data chứa token. Staff kiểm facts và thông tin thiếu trước khi dùng.

## Quota

Tài khoản demo có ngân sách **1.000 executions**. Mỗi live execution có chi phí quota, kể cả schedule không có việc. Không bật schedule liên tục, không gọi workflow chỉ để kiểm credential/import hoặc dọn thư mục. Trước test live phải nêu số executions tối đa và dùng mẫu nhỏ nhất cần thiết.

Approved mock message hiện được gửi trong Supabase lúc commit; follow-up/support vẫn cần operator theo flow demo. Không tự bật timer khi import hoặc phát hành source. Không chạy các script `*-flow.mjs` như unit tests: chúng có thể gọi cloud/LLM hoặc thay đổi fixtures.

## Kiểm tra local

```powershell
node --test n8n/tests/validator.test.mjs n8n/tests/ticket-validator.test.mjs
```

Validators kiểm schema, grounded evidence, JWT/RLS gate, atomic claim, credential references và timers disabled, không tạo execution n8n. Bằng chứng tích hợp trước đây ở `docs/evidence/n8n_agents.json`, `chat_to_ticket.json`, `ai_request_recovery.json`; không dùng kết quả cũ làm xác nhận deployment mới.
