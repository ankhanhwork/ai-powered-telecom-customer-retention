# Problem nội bộ: Chuyển cảnh báo churn thành hành động giữ chân khách hàng Internet

**Doanh nghiệp:** FPT Telecom  
**Phạm vi vấn đề:** Toàn quốc  
**Case điển hình và địa bàn thí điểm:** Bình Dương  
**Phạm vi dịch vụ:** Internet  
**Kỳ phân tích:** Lũy kế năm 2026 đến thời điểm nghiên cứu, so với cùng kỳ 2025; case Bình Dương tập trung tháng 9/2026
**Ngày cập nhật:** 17/10/2026  
**Trạng thái:** Bản thảo v3; vấn đề toàn quốc, thí điểm tại Bình Dương; tách thông tin nội bộ khỏi giả định thiết kế

## Quyết định sản phẩm mới 19/10/2026

Leader chốt cập nhật prediction ngày **1, 11, 21** từ snapshot **cuối tháng/10/20**, mỗi lần dự báo **một tháng lịch tới**. Đây là thiết kế prototype mới; không sửa thông tin nội bộ về danh sách tháng 9 hay giả định FPT đã vận hành lịch này. Batch 01/10 vẫn dự báo 01–31/10; batch 11/10 dự báo 11/10–10/11 và batch 21/10 dự báo 21/10–20/11. Dữ liệu/train v5 đã hoàn tất offline, chọn LightGBM tuned theo validation; Supabase/SHAP đã chuyển v5; UI source đã sửa/build local, Vercel/n8n chưa cutover.

## 1. Bối cảnh và mức độ vấn đề

### Áp lực rời mạng trên toàn quốc

Theo thông tin nội bộ được cung cấp, **số lượng khách hàng Internet rời mạng của FPT Telecom trên toàn quốc trong năm 2026, tính đến thời điểm nghiên cứu, đã tăng 20% so với cùng kỳ năm 2025**. Diễn biến này đặt ra áp lực đối với việc duy trì nguồn doanh thu thuê bao, hiệu quả chăm sóc khách hàng và khả năng tăng trưởng bền vững của doanh nghiệp.

Con số 20% là mức tăng tương đối của **số khách rời mạng lũy kế**, không phải churn rate 20% hoặc tăng 20 điểm phần trăm. Hai kỳ phải có cùng mốc chốt dữ liệu. Chưa có tổng số churn toàn quốc và ngày chốt cụ thể để quy đổi sang số khách tăng thêm hoặc doanh thu toàn quốc.

### Khoảng cách giữa dự báo và vận hành

Trong những tháng gần đây, FPT Telecom đã đưa mô hình dự báo rời mạng vào sử dụng nhằm hỗ trợ nhận diện sớm khách hàng có nguy cơ. Vào đầu tháng, danh sách khách hàng có điểm dự báo trên 500 — tương đương xác suất dự báo trên 50% — được chuyển đến bộ phận Dịch vụ Khách hàng (DVKH) để triển khai chăm sóc. Cơ chế này tạo điều kiện để doanh nghiệp chủ động tiếp cận khách hàng trước khi họ quyết định ngừng sử dụng dịch vụ.

Tuy nhiên, **việc có kết quả dự báo chưa bảo đảm cảnh báo được chuyển thành hành động phù hợp và kịp thời**. Nhân viên vẫn cần xác định khách hàng nào phải được ưu tiên, tìm hiểu vấn đề cụ thể, lựa chọn cách tiếp cận và phối hợp với các bộ phận liên quan để giải quyết. Khoảng cách giữa kết quả phân tích và quá trình thực thi vì vậy trở thành vấn đề cần được cải thiện.

Trong một cuộc họp gần đây, Giám đốc DVKH tại Bình Dương — địa bàn được phản ánh có **mức gia tăng tỷ lệ rời mạng cao nhất trong hệ thống** — đã nêu hai khó khăn từ nhân viên: biết khách có rủi ro nhưng chưa rõ cách tiếp cận; và tiếp cận muộn hoặc đã tiếp cận nhưng vẫn không giữ được khách. Chi tiết phản ánh được trình bày tại mục 3.

Các phản ánh tại Bình Dương là bằng chứng tình huống để thiết kế và kiểm thử giải pháp. Chưa đủ cơ sở khẳng định mọi địa bàn đều gặp cùng mức độ hoặc cùng nguyên nhân; cần kiểm chứng khi xem xét mở rộng.

### Bình Dương: case điển hình và địa bàn thí điểm

Bình Dương được lựa chọn làm **case điển hình và địa bàn thí điểm** do mức gia tăng rời mạng đáng báo động và các khó khăn vận hành đã được phản ánh. Theo thông tin được cung cấp, địa bàn có khoảng **210.000 khách hàng Internet đầu tháng 9**, ghi nhận **2.500 khách rời mạng trong tháng**, tăng từ **1.300 khách trong tháng 8**.

**Mức tăng số churn tháng 9 = (2.500 − 1.300) / 1.300 × 100% ≈ 92,31%, tương ứng tăng 1.200 khách.**

**Churn rate tháng 9 = 2.500 / 210.000 × 100% ≈ 1,19%.**

Mức tăng 92,31% là tăng số khách churn so với tháng trước tại Bình Dương; không so sánh trực tiếp với mức tăng 20% lũy kế toàn quốc so với cùng kỳ. Nhận định Bình Dương có mức gia tăng tỷ lệ rời mạng cao nhất dựa trên thông tin nội bộ được cung cấp, chưa có bảng mẫu số và churn rate theo địa bàn để đối soát. Không diễn giải thành Bình Dương có số churn hoặc mức churn rate tuyệt đối cao nhất cả nước.

Phạm vi dịch vụ chỉ bao gồm Internet của FPT Telecom; không gộp các dịch vụ khác. Số liệu địa phương được dùng để lượng hóa case thí điểm, không đại diện cho quy mô toàn quốc. Hai tháng chưa đủ để kết luận xu hướng dài hạn tại Bình Dương.

### Hiện trạng mô hình và bàn giao cho DVKH

Theo thông tin nội bộ được cung cấp, **vào đầu tháng, toàn bộ danh sách khách có điểm dự báo churn trong cùng tháng lớn hơn 500 được gửi cho bộ phận Dịch vụ Khách hàng (DVKH) để chăm sóc**. Người thực hiện dự án xác nhận điểm bằng **xác suất dự báo × 1.000**, nên ngưỡng >500 tương đương **xác suất dự báo >50%**. Danh sách bàn giao tháng 9 có khoảng **8.000 khách**. Trong tài liệu này, CSKH chỉ hoạt động/đội ngũ chăm sóc; DVKH chỉ bộ phận tiếp nhận danh sách theo mô tả nội bộ.

Luồng hiện tại được mô tả ở mức đã biết:

**Mô hình dự báo → lọc điểm >500 → gửi danh sách đầu tháng → DVKH tiếp nhận và chăm sóc.**

Đây là cơ chế bàn giao theo đợt. Chưa có đủ thông tin để khẳng định danh sách không được sắp xếp, không có công cụ theo dõi hoặc không được cập nhật bổ sung giữa tháng. Cần phân biệt các chi tiết chưa biết này với phản ánh đã có về khó tiếp cận, tiếp cận muộn và chưa giữ chân được khách.

Ngưỡng >50% mô tả cách lọc hiện hành; chưa có dữ liệu để kết luận xác suất đã được calibration tốt hoặc ngưỡng này tối ưu về kinh doanh. **Làm rõ đã được người dùng xác nhận:** danh sách gửi ngày 1/9 dự báo churn trong chính tháng 9. Kịch bản sản phẩm lần này chuyển sang danh sách giả lập ngày **1/10/2026**, dự báo churn trong **tháng 10/2026**, không phải tháng 11. Đây là kỳ tháng lịch, không mặc định horizon 30 ngày trượt. Số 2.500 churn, 1.300 churn tháng trước và 8.000 khách trong danh sách vẫn là thông tin của case tháng 9; không tự chuyển thành kết quả hoặc số liệu đã quan sát tháng 10. Dataset public phải được kiểm tra riêng xem có hỗ trợ forecasting theo thời gian hay chỉ historical classification.

Không lấy 2.500/8.000 làm precision hoặc tỷ lệ thất bại giữ chân: cần đối chiếu customer IDs, đúng kỳ outcome, lịch sử can thiệp và số churn thực sự thuộc danh sách. Tổng churn toàn địa bàn và quy mô danh sách dự báo là hai đại lượng khác nhau.

**Vai trò của mô hình trong dự án:** mô hình hiện có là đầu vào của hệ thống phối hợp giữ chân. Prototype có thể huấn luyện một model trên dữ liệu public để mô phỏng nguồn prediction khi chưa truy cập model nội bộ, nhưng không được giới thiệu đó là mô hình thật của FPT Telecom hoặc là đóng góp trung tâm của giải pháp.

## 2. Quy mô doanh thu liên quan

Lấy mức cước **205.000 đồng/khách/tháng** làm giá tham chiếu cho gói Internet phổ biến theo thông tin người thực hiện dự án cung cấp, có thể lượng hóa sơ bộ quy mô doanh thu gắn với lượng khách rời mạng:

| Chỉ tiêu | Cách tính | Giá trị |
|---|---|---:|
| Khách hàng Internet đầu tháng 9 | Quy mô xấp xỉ được cung cấp | 210.000 khách |
| Khách rời mạng trong tháng 9 | Thông tin nội bộ được cung cấp | 2.500 khách |
| Khách rời mạng trong tháng 8 | Thông tin nội bộ được cung cấp | 1.300 khách |
| Tăng số churn tháng 9 so với tháng 8 | 2.500 − 1.300 | **1.200 khách; tăng 92,31%** |
| Churn rate tháng 9 | 2.500 / 210.000 × 100% | Khoảng 1,19% |
| Giá cước tham chiếu | Giả định áp dụng chung để ước tính | 205.000 đồng/khách/tháng |
| Doanh thu thuê bao hằng tháng tương ứng | 2.500 × 205.000 | **512.500.000 đồng/tháng** |
| Giá trị quy đổi 12 tháng | 512.500.000 × 12 | **6.150.000.000 đồng/năm** |

**Thông điệp mở đầu đề xuất:**

> Số khách hàng Internet rời mạng của FPT Telecom trên toàn quốc lũy kế năm 2026 đã tăng 20% so với cùng kỳ năm trước, theo thông tin nội bộ được cung cấp. Mô hình dự báo mới được áp dụng trong những tháng gần đây, nhưng khoảng cách giữa cảnh báo và hành động chăm sóc vẫn còn. Bình Dương được chọn thí điểm do mức gia tăng tỷ lệ rời mạng cao nhất trong hệ thống: riêng tháng 9 có 2.500 khách rời mạng, tương ứng khoảng 512,5 triệu đồng doanh thu thuê bao hằng tháng theo cước tham chiếu. Dự án tập trung kết nối dự báo, DVKH và các bộ phận liên quan để thực hiện và theo dõi hành động giữ chân, trước khi xem xét nhân rộng.

### Cách diễn giải số tiền

- **512,5 triệu đồng/tháng** là doanh thu thuê bao hằng tháng tương ứng với lượng khách rời mạng theo mức cước giả định, chưa phải doanh thu thực tế bị mất ngay trong tháng 9. Khách có thể rời mạng vào những ngày khác nhau.
- **6,15 tỷ đồng/năm** là giá trị quy đổi 12 tháng nếu cùng mức cước và các thuê bao không còn đóng góp doanh thu trong đủ kỳ; không phải thiệt hại đã ghi nhận hoặc dự báo tài chính đã được xác minh.
- Mức 205.000 đồng chưa phải doanh thu bình quân thực tế của nhóm churn. Ước tính chưa điều chỉnh khác biệt gói cước, khuyến mại, thuế, chu kỳ thanh toán, tái kích hoạt hoặc các khoản giảm trừ.
- Đây là quy mô doanh thu liên quan, không phải lợi nhuận và không phải khoản tiền hệ thống chắc chắn có thể giữ lại. Đánh giá giá trị giải pháp phải xét hiệu quả can thiệp tăng thêm, biên lợi nhuận và chi phí chăm sóc/ưu đãi.
- Minh họa quy mô: giữ lại được 100 khách tương ứng khoảng **20,5 triệu đồng doanh thu thuê bao/tháng** theo cùng giả định. Đây không phải kết quả hoặc cam kết của dự án.

## 3. Phản ánh từ quản lý CSKH

Theo nội dung cuộc họp gần đây được người thực hiện dự án thuật lại, chị B, Giám đốc DVKH tại Bình Dương, đã tổng hợp hai khó khăn nhân viên phản ánh khi sử dụng kết quả dự báo:

> “Nhân sự biết khách hàng có điểm rủi ro rời mạng cao nhưng không biết làm cách nào để tiếp cận?”

> “Nhiều trường hợp chưa kịp tiếp cận đã rời mạng, hoặc nhiều trường hợp tiếp cận được nhưng không thể giữ chân được khách.”

Các phát biểu trên là phản ánh nội bộ được thuật lại qua người thực hiện dự án, chưa phải trích dẫn từ biên bản phỏng vấn đã được đối chiếu.

Từ phản ánh này, bài toán có thể được cấu trúc thành ba điểm nghẽn:

| Điểm nghẽn | Biểu hiện được phản ánh | Quyết định cần cải thiện |
|---|---|---|
| **Khoảng cách giữa cảnh báo và hướng xử lý** | Nhân viên biết khách có rủi ro nhưng chưa rõ cách tiếp cận | Cần tìm hiểu thêm điều gì, trao đổi nội dung gì và đề xuất hành động nào? |
| **Khoảng cách giữa cảnh báo và thời điểm tiếp cận** | Một số khách rời mạng trước khi được liên hệ | Khách nào cần xử lý trước, ai phụ trách và khi nào cần cảnh báo quá hạn? |
| **Khoảng cách giữa tiếp cận và giải quyết vấn đề** | Một số khách đã được chăm sóc nhưng vẫn rời mạng | Vấn đề của khách đã được xử lý chưa, có cần chuyển kỹ thuật hoặc thay đổi phương án chăm sóc không? |

Việc một khách được cảnh báo rồi rời mạng không tự chứng minh chất lượng tổng thể của mô hình. Tương tự, việc đã tiếp cận nhưng khách vẫn rời mạng không đủ để kết luận nhân viên xử lý kém. Cần xem xét thời điểm, vấn đề dịch vụ, phương án can thiệp và các yếu tố ngoài khả năng tác động của doanh nghiệp.

## 4. Ràng buộc nguồn lực CSKH

Đội CSKH tại địa bàn có **60 nhân sự**, với năng suất được cung cấp là **15 khách/ngày/nhân sự**.

**Năng lực chăm sóc danh nghĩa = 60 × 15 = 900 khách/ngày.**

Vì mô hình đã lọc danh sách >500, mẫu số thích hợp để đánh giá tải chăm sóc là **số khách trong danh sách cần can thiệp và số lượt xử lý cần thiết**, thay vì toàn bộ 210.000 khách. Chưa được dùng quy mô tổng khách để kết luận đội CSKH quá tải.

Cũng chưa thể kết luận năng lực đủ hay thiếu, vì:

- Đã biết danh sách tháng 9 khoảng 8.000 khách, nhưng chưa biết số đủ điều kiện liên hệ, phân bổ theo mức rủi ro và bổ sung giữa kỳ.
- Chưa rõ “15 khách” là số lượt liên hệ, khách tiếp cận thành công hay hồ sơ xử lý hoàn tất.
- Một khách có thể cần nhiều lần liên hệ, theo dõi và phối hợp kỹ thuật.
- Chưa biết tỷ trọng thời gian đội CSKH thực sự dành cho giữ chân chủ động so với các công việc khác.

Do đó, vấn đề cần giải quyết không chỉ là tăng số lượt liên hệ, mà là **phân bổ năng lực hiện có vào những hồ sơ cần ưu tiên và nâng chất lượng xử lý trong từng lần tiếp cận**.

### Giả định phục vụ thiết kế và demo

Các giả định dưới đây do nhóm dự án đặt để triển khai prototype, không phải số liệu vận hành đã xác nhận của FPT Telecom. Có thể thay bằng dữ liệu thật mà không đổi phát biểu bài toán.

| Mã | Giả định làm việc | Mục đích và giới hạn |
|---|---|---|
| A01 | Trong demo, một khách tương ứng một thuê bao/hợp đồng Internet đang hoạt động; churn là chấm dứt dịch vụ, không tính tạm ngưng hoặc chuyển gói còn sử dụng | Khóa grain; cần mapping lại theo định nghĩa nội bộ trước pilot |
| A02 | Dùng 210.000 khách đầu tháng 8 nếu cần so sánh churn rate giữa hai tháng | Tháng 8 xấp xỉ 0,62%; tháng 9 xấp xỉ 1,19%; tăng khoảng 0,57 điểm phần trăm. Mẫu số tháng 8 là giả định, không phải số chính thức |
| A03 | 15 khách/ngày được diễn giải trong mô phỏng là 15 lượt xử lý có ghi nhận; một khách có thể phát sinh nhiều lượt | Không đồng nhất lượt xử lý với tiếp cận thành công hoặc giữ chân |
| A04 | Dùng 22 ngày làm việc/tháng; kịch bản cơ sở phân bổ 50% năng lực cho giữ chân chủ động | Năng lực kịch bản = 60 × 15 × 22 × 50% = 9.900 lượt/tháng; không phải công suất thực tế được đo |
| A05 | Mỗi khách trong danh sách cần trung bình 2 lượt xử lý trong kịch bản cơ sở | Tương đương khoảng 4.950 khách/tháng theo giả định A04; so sánh với danh sách khoảng 8.000 khách ở bảng kịch bản bên dưới; số lượt/khách vẫn là giả định |
| A06 | Prototype kết nối hồ sơ thuê bao, hóa đơn, ticket kỹ thuật, lịch sử liên hệ và offer hợp lệ bằng customer_ref | Là dữ liệu cần có; chưa khẳng định các hệ thống thực tế đã kết nối hoặc đang tách rời hoàn toàn |
| A07 | Một case có người phụ trách; mốc liên hệ đầu tiên đề xuất trong 2 ngày làm việc sau phân công; lỗi kỹ thuật có bước chuyển việc và xác nhận tiếp nhận | SLA mục tiêu cho demo/pilot, không phải SLA hiện hành hoặc mức đã đạt |
| A08 | Chưa reply sau thời lượng cấu hình kể từ tin gửi thành công gần nhất thì thông báo nhắc DVKH; AI đề xuất default 3 giờ, leader chưa khóa 3 hay 24 giờ | Rule demo cấu hình theo cập nhật bước 1, không phải SLA công ty; recheck opt-out/reply/eligibility, không tự gửi hoặc gọi |
| A09 | Quan sát outcome theo kỳ churn được thống nhất; khi chưa có outcome thì ghi unknown | Không tự đánh dấu retained chỉ vì khách phản hồi hoặc case được đóng |

### Tải chăm sóc theo danh sách 8.000 khách tháng 9

| Kịch bản | Năng lực/ngày dành cho giữ chân | Nhu cầu lượt xử lý | Thời gian danh nghĩa |
|---|---:|---:|---:|
| Mỗi khách 1 lượt; dùng toàn bộ năng lực | 900 | 8.000 | 8,89 ngày làm việc |
| Mỗi khách 1 lượt; dùng 50% năng lực | 450 | 8.000 | 17,78 ngày làm việc |
| Mỗi khách 2 lượt; dùng toàn bộ năng lực | 900 | 16.000 | 17,78 ngày làm việc |
| Mỗi khách 2 lượt; dùng 50% năng lực | 450 | 16.000 | 35,56 ngày làm việc |

Với giả định 22 ngày làm việc và 50% năng lực, công suất là 9.900 lượt/tháng; so với nhu cầu 16.000 lượt nếu mỗi khách cần 2 lượt, chênh lệch là **6.100 lượt**. Đây là phân tích kịch bản, chưa phải backlog hoặc thiếu hụt nhân sự thực tế. Nếu toàn bộ năng lực được phân bổ cho giữ chân thì cùng tải 16.000 lượt vẫn nằm trong công suất tháng giả định.

Insight: bàn giao 8.000 khách cùng một đợt đòi hỏi lịch phân công và ưu tiên theo thời gian, chứ không chỉ một điều kiện vượt ngưỡng. Công suất đủ để bao phủ trong tháng không bảo đảm mọi khách được tiếp cận đủ sớm. Hệ thống cần giúp quản lý thấy đánh đổi giữa thời gian chờ, số lần xử lý, năng lực dành cho giữ chân và yêu cầu phối hợp, trước khi quyết định phân bổ người.

Precision/recall của model, tỷ lệ tiếp cận và tỷ lệ giữ chân hiện tại chưa có số xác nhận. Chưa điền số giả vào các metric này. Khi cần dữ liệu demo, phải gắn nhãn simulated và tách khỏi kết quả nội bộ.

## 5. Internal insights và hàm ý đối với giải pháp

Ba insight đầu dưới đây bám vào phản ánh đã được cung cấp. Hai insight sau là hướng phân tích bổ sung, chưa được xác nhận như thực trạng nội bộ.

| Insight | Cơ sở hiện có | Hàm ý thiết kế |
|---|---|---|
| **Cảnh báo cần đi kèm hỗ trợ hành động** | Nhân viên biết rủi ro nhưng chưa rõ cách tiếp cận | Tổng hợp hồ sơ, giải thích tín hiệu mô hình và soạn phương án để nhân viên xem xét |
| **Tính kịp thời là một phần của hiệu quả giữ chân** | Một số khách rời mạng trước khi được tiếp cận | Hàng chờ có ưu tiên, phân công, thời gian chờ và nhắc xử lý |
| **Tiếp cận thành công chưa đồng nghĩa giải quyết được nhu cầu** | Có khách đã được liên hệ nhưng vẫn rời mạng | Ghi vấn đề được khách xác nhận, hành động đã thực hiện và tình trạng giải quyết |
| **Cần kiểm tra khả năng phối hợp giữa CSKH và kỹ thuật** | Hướng tìm hiểu thêm; chưa có bằng chứng về điểm nghẽn cụ thể | Theo dõi chuyển việc và trách nhiệm nếu vấn đề đòi hỏi xử lý kỹ thuật |
| **Cần kiểm tra mức đầy đủ của vòng phản hồi sau chăm sóc** | Hướng tìm hiểu thêm; chưa xác minh chất lượng log hiện tại | Lưu lịch sử liên hệ, phản hồi, can thiệp, chi phí và kết quả để phân tích |

Không suy ra nguyên nhân rời mạng từ điểm rủi ro hoặc SHAP. Các tín hiệu mô hình hỗ trợ lựa chọn thông tin cần kiểm tra; động cơ và vấn đề cụ thể cần được xác nhận bằng dữ liệu phù hợp hoặc trao đổi với khách hàng.

## 6. Phát biểu bài toán trọng tâm

> **Trước tình trạng số khách hàng Internet rời mạng trên toàn quốc tăng 20% so với cùng kỳ, FPT Telecom cần thu hẹp khoảng cách giữa kết quả dự báo và hoạt động giữ chân. Bài toán của dự án là xây dựng một hệ thống phối hợp liên phòng ban, kết nối cảnh báo rủi ro với việc ưu tiên, phân công, lựa chọn phương án chăm sóc và theo dõi kết quả trong giới hạn nguồn lực và ngân sách. Bình Dương được chọn làm case điển hình và địa bàn thí điểm để đánh giá tính khả thi, hiệu quả vận hành và điều kiện mở rộng sang các địa bàn khác.**

Các câu hỏi ra quyết định mà hệ thống cần hỗ trợ:

1. **Ai cần được chăm sóc trước?** Xác định hàng chờ khả thi theo rủi ro, thời gian chờ, điều kiện liên hệ và năng lực xử lý.
2. **Nên tiếp cận như thế nào?** Cung cấp ngữ cảnh, đề xuất nội dung và hành động phù hợp với thông tin đã có và chính sách được phép.
3. **Ai cần thực hiện bước tiếp theo?** Phân công và theo dõi trách nhiệm khi cần CSKH, kỹ thuật hoặc cấp phê duyệt phối hợp.
4. **Khi nào cần theo dõi lại?** Nhận biết hồ sơ chưa được xử lý, chưa có phản hồi hoặc vấn đề còn mở.
5. **Can thiệp có tạo giá trị không?** Đánh giá thời gian xử lý, kết quả chăm sóc, chi phí và tác động giữ chân bằng phương pháp phù hợp.

## 7. Vai trò của giải pháp đề xuất

AI-Powered Telecom Customer Retention bổ sung lớp hỗ trợ quyết định và điều phối hành động sau cảnh báo: hàng chờ ưu tiên, tổng hợp ngữ cảnh, AI soạn đề xuất để nhân viên duyệt, theo dõi tương tác và ghi nhận kết quả. Thí điểm tại Bình Dương nhằm kiểm tra quy trình trước khi xem xét nhân rộng, không mặc định kết quả địa phương có thể áp dụng ngay toàn quốc.

Ứng dụng nghiệp vụ vẫn dành cho DVKH và quản lý DVKH. Phối hợp liên phòng ban được thực hiện qua dữ liệu và bàn giao yêu cầu; kỹ thuật xử lý trong hệ thống riêng, không bổ sung workspace hoặc tài khoản kỹ thuật vào MVP. Giới hạn này được quy định tại SYSTEM.md.

### Đóng góp trọng tâm: phối hợp liên phòng ban

| Bộ phận / vai trò trong thiết kế đề xuất | Đóng góp vào quy trình chung | Đầu ra cần theo dõi |
|---|---|---|
| Data Analytics | Cung cấp prediction có kỳ/version, hỗ trợ diễn giải và nhận outcome phản hồi | Chất lượng dữ liệu, danh sách hợp lệ và hiệu quả ranking |
| DVKH/CSKH | Xác minh nhu cầu, duyệt nội dung, tiếp cận và sở hữu case | Thời gian tiếp cận, phản hồi và trạng thái xử lý |
| Kỹ thuật | Tiếp nhận, xử lý và phản hồi các vấn đề dịch vụ cần chuyên môn | Người phụ trách, thời hạn và kết quả khắc phục |
| Kinh doanh/Retention | Quản lý phương án đổi gói hoặc ưu đãi theo điều kiện | Eligibility, phê duyệt và việc thực hiện phương án |
| Tài chính | Cung cấp cost/margin và giới hạn ngân sách | Chi phí can thiệp và giá trị kinh tế theo giả định có nguồn |
| Quản lý địa bàn | Theo dõi hàng chờ, SLA, điểm nghẽn và điều phối nguồn lực | Case quá hạn, throughput và outcome theo cohort |

Đây là phân công chức năng đề xuất, chưa phải sơ đồ tổ chức hoặc quy trình hiện hành đã được công ty xác nhận. Luồng chung cần nối **cảnh báo → phân công → xác minh vấn đề → hành động/phối hợp → theo dõi → outcome → phản hồi cho phân tích**.

Đóng góp học thuật và sản phẩm nằm ở thiết kế quy trình cross-function, hỗ trợ quyết định và vòng phản hồi có thể đo lường. Việc churn là bài toán đã được nghiên cứu không làm mất giá trị của việc cải thiện quy trình cụ thể tại địa bàn; phần tham chiếu ngành/thế giới sẽ do thành viên khác bổ sung nguồn sau. Không tuyên bố thuật toán churn hoặc chatbot là phát minh mới.

Giá trị kỳ vọng là cải thiện tính kịp thời, sự phù hợp và khả năng theo dõi của hoạt động chăm sóc. Dự án chưa chứng minh mức giảm churn hoặc ROI. Không phải mọi trường hợp rời mạng đều có thể ngăn chặn; hiệu quả tăng thêm phải được đo trong pilot với nhóm so sánh phù hợp.

Chi tiết hệ thống xem [đặc tả](SYSTEM.md); phương pháp đo giá trị xem [business case](REPORT.md). Trọng tâm và bối cảnh đã được đồng bộ ở các tài liệu này; thiết kế kỹ thuật chi tiết vẫn ở trạng thái draft, cần hoàn thiện hợp đồng tích hợp trước khi triển khai.

## 8. Nguồn thông tin và dữ liệu cần bổ sung

### Nguồn của bản thảo này

- Thông tin và nhận định nội bộ do người thực hiện dự án cung cấp trong cuộc trao đổi ngày 17/10/2026; không coi toàn bộ bối cảnh là giả định.
- Người thực hiện dự án bổ sung bối cảnh toàn quốc: số churn lũy kế 2026 tăng 20% so với cùng kỳ 2025; model mới được áp dụng vài tháng gần đây; Bình Dương có mức gia tăng tỷ lệ rời mạng cao nhất và được chọn thí điểm.
- Quy mô khách đầu tháng khoảng 210.000 là của Bình Dương, được người thực hiện dự án cho phép sử dụng để ước tính churn rate địa phương.
- Mức cước 205.000 đồng là giá tham chiếu dùng trong phép tính, không phải ARPU đã được đối soát.
- Chưa có báo cáo vận hành, bảng số liệu nguồn hoặc biên bản phỏng vấn đính kèm để kiểm chứng độc lập.

### Bổ sung khi có điều kiện

| Dữ liệu | Mục đích |
|---|---|
| Định nghĩa churn nội bộ, đơn vị customer/thuê bao/hợp đồng và kỳ dự báo | Thay A01 bằng quy tắc thật; đối chiếu quan hệ tháng scoring và tháng outcome |
| Số churn lũy kế toàn quốc 2026/2025 và mốc chốt cùng kỳ | Đối soát mức tăng 20%; chưa quy đổi thành số khách hoặc doanh thu toàn quốc |
| Số khách đầu kỳ chính xác và bảng so sánh địa bàn | Tháng 8 đã có 1.300 churn; đối soát mẫu số và nhận định mức gia tăng tỷ lệ churn cao nhất. Không tạo bảng địa bàn giả dưới tên số liệu nội bộ |
| Các cột được bàn giao, calibration, phân bố risk và đối chiếu customer IDs theo kỳ | Đã xác nhận điểm = xác suất ×1.000 và danh sách tháng 9 khoảng 8.000 khách; cần thêm dữ liệu để đánh giá ranking, thời gian can thiệp và model quality |
| Số khách được cảnh báo, thời điểm cảnh báo và thời điểm rời mạng | Đánh giá độ sớm của cảnh báo và thời gian còn lại để can thiệp |
| Thời điểm phân công/liên hệ, số lần thử và kết quả | Xác định điểm nghẽn và năng lực xử lý thực tế |
| Vấn đề được khách xác nhận, hành động đã thực hiện và trạng thái xử lý | Phân tích sự phù hợp của can thiệp và nhu cầu phối hợp |
| Giá cước thực thu, biên lợi nhuận và chi phí can thiệp | Chuyển từ ước tính doanh thu sang business case có cơ sở |

Các dữ liệu này củng cố bằng chứng và phép đo; không cản trở việc dùng bản thảo hiện tại để trình bày Problem nội bộ. Phần tham chiếu vấn đề trên thế giới và các ngành khác nằm ngoài phạm vi file này, sẽ do thành viên khác bổ sung sau.
