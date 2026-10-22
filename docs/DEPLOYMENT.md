# Deploy demo lên Vercel

Chỉ deploy website; Root Directory giữ `website/app`. Lần dọn repo không deploy, chạy migration, import data hoặc gọi n8n. Backend đã có; xác minh deployment mới nhất là việc riêng sau release.

## 1. Import GitHub repository

Trong Vercel chọn **Add New → Project**, kết nối GitHub và import `ankhanhwork/ai-powered-telecom-customer-retention`. Nếu không thấy repo, cấp quyền cho Vercel GitHub integration đối với đúng repo này.

| Setting | Giá trị |
|---|---|
| Production Branch | `main` |
| Root Directory | **`website/app`** |
| Framework Preset | `Vite` |
| Node.js Version | `24.x` (local đã build bằng 24.15.0) |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

`website/app/vercel.json` đã lưu framework/install/build/output và bốn proxy routes. Root Directory phải đúng để Vercel đọc file này và package-lock.json của app, không lấy root repo làm app. Không cần deploy Python hoặc Supabase migrations lên Vercel.

## 2. Environment Variables

Thêm trước khi bấm **Deploy**:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://azeqdnbtzwaehewnyfdq.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Giá trị publishable key từ `website/app/.env.local` trên máy leader hoặc Supabase Dashboard → project API keys |

Chọn Production. Nếu bật thêm Preview, dùng cùng demo backend thì Preview cũng đọc/ghi cùng dữ liệu demo; không coi đó là sandbox tách riêng. Không điền worker/service-role/secret key, LLM key hay mật khẩu demo vào biến `VITE_*`: các biến này được nhúng vào JavaScript công khai. File `.env.local` không được commit.

Vite lấy env lúc build; đổi biến cần **Redeploy** để bundle nhận giá trị mới. Nút Deploy chỉ chạy build web, không tự import/reset data hoặc thay consent.

## 3. Request AI trên domain Vercel

Bản production gọi `POST /api/retention-ai-message`, `/api/retention-ai-call_script`, `/api/retention-ai-explanation`, `/api/retention-ai-ticket` cùng domain. Bốn external rewrites chuyển request tới đúng webhook n8n hiện hành; không tạo một proxy tùy ý tới mọi workflow. JWT phiên, publishable key và job_id vẫn được gửi, n8n vẫn kiểm JWT/RLS rồi claim trước khi gọi LLM. Không bật cache cho các routes này.

Local `npm run dev` gọi webhook group-2-new trực tiếp với localhost origins hiện có. Không cần thêm wildcard `*.vercel.app` vào n8n CORS khi dùng proxy cùng domain. Nếu proxy lỗi, job đã tạo vẫn ở database; staff dùng Retry theo trạng thái job; fallback timers vẫn tắt. Không bấm liên tục để thử lại.

## 4. Sau deploy

1. Lấy Production URL trong Vercel. Supabase Dashboard → Authentication → URL Configuration: đặt Site URL thành domain production, thêm URL callback cần dùng vào Redirect URLs nếu triển khai email/reset/OAuth. Đăng nhập password hiện tại gọi API trực tiếp, không cần một OAuth callback và không dùng Redirect URLs như cấu hình CORS.
2. Mở URL, xác nhận logo/login không lỗi và đăng nhập Agent/Supervisor bằng tài khoản demo đã provision. Dùng browser profile riêng cho Customer vì Auth session lưu theo origin. Không đưa mật khẩu vào repo hoặc video.
3. Mở một case đúng quyền, Request AI explanation. DevTools Network phải có POST `/api/retention-ai-explanation` cùng domain, không 404/HTML và không lỗi CORS; kết quả Working→Done và rationale cập nhật. Đây là kiểm tra live sau deploy, chưa được xác minh trong bước chuẩn bị.
4. Diễn tập approval→mock receipt→portal reply trên case thuộc quyền. Mock delivery hiện gửi trong DB lúc commit; contact gate đã bỏ theo migration hiện hành. Không đổi preferences hoặc tạo thêm fixture chỉ để kiểm deploy.
5. Kiểm Customer không đọc notes/risk nội bộ; Unknown không thành retained. Deployment không thay thế cổng QA trong IMPLEMENTATION.

Nếu login bị lỗi Invalid API key, kiểm publishable key và redeploy. Nếu trang trắng, kiểm Console và env build. Nếu Request AI trả 404/HTML, kiểm Root Directory/vercel.json; nếu 401/403 kiểm session và RLS, không thay bằng service key. Nếu n8n không có kết quả, kiểm worker active và executions bằng credential quản trị hiện có. Follow-up/support chạy theo phiên demo có kiểm soát; timers tắt, không có Vercel cron. Approved mock messages không phụ thuộc delivery timer.

Sau khi ổn, các push tiếp theo lên `main` sẽ deploy qua Vercel Git integration đã kết nối. Không cần commit `dist`, `node_modules`, `.vercel` hoặc `.env.local`. Giữ deployment protection phù hợp với người cần truy cập demo; không cung cấp quyền Vercel admin chỉ để xem app.
