---
name: gmind-universal-id-agentmem
description: "Kỹ năng chuyên gia xử lý Universal Tracking (Beads ID) và Requirements Traceability Matrix (RTM). Master of 'br-prd', 'br-plan', 'bd-xxx', 'br-ds', and metadata connections."
---

# SKILL: Gmind Universal ID & Agent Memory (gmind-universal-id-agentmem)

## Tóm tắt Kỹ năng

Skill này định nghĩa bạn là một **Agent Memory Specialist**. Nhiệm vụ của bạn là hiểu, triển khai, và duy trì hệ thống **Universal Tracking (Beads ID)** của nền tảng Gmind. Bạn chịu trách nhiệm quét, kết nối, và đảm bảo tính toàn vẹn của Ma trận truy vết yêu cầu (Requirement Traceability Matrix - RTM) giữa các tầng: PRD (Yêu cầu) → Plan (Kế hoạch) → Task (Thực thi) → Design System (Giao diện) → Code.

## 1. Cấu trúc Universal ID

Mọi thực thể trong hệ thống Gmind được liên kết thông qua một mã định danh duy nhất (Universal ID).

### Bảng tra cứu ID (ID Registry)

| Loại Thực thể     | Định dạng ID  | Ví dụ          | Ý nghĩa                                      |
| :---------------- | :------------ | :------------- | :------------------------------------------- |
| **PRD Document**  | `br-prdXX`    | `br-prd01`     | Toàn bộ một file PRD.                        |
| **PRD Section**   | `br-prdXX-sY` | `br-prd01-s2`  | Một nhánh/mục cụ thể trong PRD.              |
| **Plan Element**  | `br-plan-XX`  | `br-plan-04`   | Một thành phần thiết kế trong file Plan.     |
| **Design System** | `br-ds-XXX`   | `br-ds-button` | Một component UI/UX trên Design System.      |
| **Task / Issue**  | `bd-[hash]`   | `bd-a1b2`      | Thực thể công việc trên `beads_rust` (SSOT). |

> **Quy tắc vàng:** ID của File Markdown luôn bắt đầu bằng `br-` (Beads Requirement/Resource). ID của Task do cơ sở dữ liệu sinh ra luôn bắt đầu bằng `bd-` (Beads Database).

---

## 2. Liên kết 3 Tầng & Annotation

Hệ thống RTM yêu cầu các ID phải trỏ (link) tới nhau thông qua các **dependency tags**.

- **`satisfies` (Đáp ứng):** Dùng để biểu thị tầng dưới đã đáp ứng (cover) yêu cầu của tầng trên.
  - _Ví dụ:_ Một Plan Element (`br-plan-01`) sẽ `satisfies` một PRD Section (`br-prd01-s1`).
  - _Ví dụ 2:_ Một Design Component (`br-ds-button`) sẽ `satisfies` một PRD Section (`br-prd01-s4`).
- **`implements` (Thực thi):** Dùng để biểu thị Code Task thực thi Kế hoạch.
  - _Ví dụ:_ Task (`bd-a1b2`) sẽ `implements` Plan Element (`br-plan-01`).

### Cách lưu trữ IDs trong nội dung File (Inline Markdown)

Chúng ta KHÔNG dùng YAML Frontmatter ở từng dòng, mà dùng **HTML Comments** ngay bên dưới các Heading.

**File PRD:**

```markdown
## 1. Yêu cầu Hệ thống

<!-- beads-id: br-prd01-s1 -->
```

**File Plan / Design System (Kèm liên kết ngược `satisfies`):**

```markdown
### PLAN-01: Tích hợp FrankenSQLite

<!-- beads-id: br-plan-01 | satisfies: br-prd02-s1 -->
```

> **Quy tắc quan trọng (Single-Line Rule):** Toàn bộ metadata HTML comment (ở dạng `<!-- beads-id: ... | satisfies: ... -->`) **BẮT BUỘC** phải nằm trên 1 dòng duy nhất. Một `beads-id` có thể `satisfies` một hoặc nhiều `beads-id` khác (ví dụ: `satisfies: br-prd01-s1, br-prd01-s2`). Cấm tuyệt đối việc sử dụng multi-line comment cho các thẻ metadata này.

---

## 3. Automation Scripts (Chiết xuất & Đồng bộ)

Kỹ năng này đi kèm các công cụ tự động hóa tại thư mục `scripts/`. Các script này được dùng để parse (phân tích) các cấu trúc Markdown, trích xuất ID, chuẩn bị dữ liệu đẩy vào Zvec (Vector DB) để indexing.

### `scripts/extract_ids.py`

Script Python này duyệt qua đệ quy thư mục `docs/` để tìm toàn bộ các tags `<!-- beads-id: ... -->`.

- **Output:** Dữ liệu JSONL gồm các cặp `[Beads ID] -> [Metadata / File Path / Satisfies]`.
- **Chức năng:** Hỗ trợ Agent kiểm tra xem ID nào đang bị "mồ côi" (không có con trỏ `satisfies` trỏ tới), phục vụ lập State Matrix.

**Cách sử dụng (Agent thực thi trực tiếp):**

```bash
python packages/agenticse-gmind-universal-id-agentmem/scripts/extract_ids.py docs/PRDs/
```

> **BẮT BUỘC (Verification Gate & Proactive Checking):** Bất cứ khi nào bạn **thay đổi (change), thêm mới (add new), hoặc xóa (delete)** metadata `beads-id` (universal metadata) trong các tệp tài liệu, bạn PHẢI chạy script `extract_ids.py` vào tệp (hoặc thư mục) đó để xác minh lại rằng định dạng không bị lỗi. Agent được khuyến khích chạy script này chủ động bất cứ lúc nào để linter báo chính xác số dòng (line number) bị sai format (nếu có). Nếu script báo lỗi `[LINT ERROR]`, bạn phải dựa vào dòng báo lỗi để tiến hành sửa và thử lại cho tới khi PASSED.

---

## 4. Trách nhiệm của Agent

Khi được gán Skill này, nạp nó vào Context của bạn và thực hiện các quy trình sau:

1. **Quét Gaps:** Khi User yêu cầu kiểm tra PRD, bạn gọi script `extract_ids.py`, phân tích JSONL trả về và lập bảng PRD nào chưa có Design Component/Plan Element.
2. **Review Catch:** Trong các Workflow khác (như `/arch-review-docs-add-beads`), bạn đóng vai trò là Linter (Người kiểm tra) đảm bảo Agent Code đã chèn đủ HTML tags cho Beads ID.
3. **Zvec Sync Readiness:** Bạn đảm bảo tài liệu Markdown có cấu trúc thẻ HTML Comment đủ "sạch" để `gmind reindex` có thể bóc tách làm Metadata đưa vào Zvec. Đảm bảo RTM Dashboard trên Web UI có cấu trúc Graph chính xác.
