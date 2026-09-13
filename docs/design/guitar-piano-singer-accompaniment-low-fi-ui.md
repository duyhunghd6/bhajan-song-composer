# Low-fi UI — Đệm hát Guitar Classic và Piano
<!-- beads-id: br-ds-lowfi-singer-accompaniment | satisfies: br-prd01-s2, br-prd01-s31, br-prd01-s45, br-prd01-s46, br-prd01-s57, br-prd01-s58, br-prd01-s62 -->

> **Mục đích:** wireframe định hướng triển khai và review nghiệp vụ; không phải thiết kế visual cuối cùng.
> **Trạng thái:** thiết kế đích cho Piano Composer branch và sự chuẩn hóa lại Guitar Classic/Piano thành hai lựa chọn Layer 2 ngang hàng.

## 1. Phạm vi màn hình
<!-- beads-id: br-ds-lowfi-singer-accompaniment-s01 -->

Các màn tối thiểu: (1) Harmony đã chọn, (2) chọn nhạc cụ Layer 2, (3) cấu hình/duyệt Guitar Classic, (4) cấu hình/duyệt Piano, (5) Review/Publish/Practice. Đây là phần bổ sung cho `design/UI.md`, không thay thế navigation hay các màn Fingerstyle đang có.

Nguyên tắc: luôn thấy nguồn Harmony đang dùng; Guitar và Piano là card/lane song song; người dùng không bị ép hoàn thành cả hai; tình trạng `current`, `stale`, `valid` phải dễ nhận biết hơn mọi control thứ cấp.

## 2. Widescreen tối thiểu và lưới layout
<!-- beads-id: br-ds-lowfi-singer-accompaniment-s02 -->

**Baseline widescreen tối thiểu: 1440 × 900 CSS px.** Nội dung không cần cuộn ngang ở chiều rộng 1280 px trở lên. Trên 1440 px, dùng lưới 12 cột, lề ngoài 48 px, gutter 24 px; sidebar trạng thái 3 cột, canvas chính 9 cột. Vùng staff/keyboard/fretboard được cuộn bên trong, không ép toàn trang rộng hơn viewport.

| Viewport | Bố cục |
|---|---|
| ≥ 1440 px | 3/9 cột; panel cấu hình và preview cạnh nhau khi cần. |
| 1280–1439 px | 3/9 cột, nhưng preview phụ chuyển xuống dưới canvas chính. |
| < 1280 px | Không phải baseline widescreen: stack theo thứ tự nguồn → cấu hình → validation → preview; giữ action bar sticky. |

Màu low-fi chỉ truyền trạng thái: xanh lá = valid/current, vàng = warning/review, đỏ = blocked, xám = disabled/stale. Không dùng màu làm dấu hiệu duy nhất; luôn có icon và nhãn chữ.

## 3. Màn Harmony — chọn nguồn được khóa
<!-- beads-id: br-ds-lowfi-singer-accompaniment-s03 -->

```text
1440 × 900  /compose/:slug/harmony
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Song title  /  Melody  ✓  /  HARMONY  ●  /  Accompaniment  ○  /  Export  ○                    │
├───────────────────────┬──────────────────────────────────────────────────────────────────────┤
│ STEP 2                │ HARMONY CANDIDATES                                                     │
│ Source melody         │ ┌──────────────────────────────────────────────────────────────────┐ │
│ [ABC summary]         │ │ (●) Option B  Key: G · 4/4 · I–IV–V–I · VALID                    │ │
│ fingerprint: 8e3…     │ │     [staff preview with chord symbols]                            │ │
│                       │ │     Voice leading: pass · melody preserved: pass                  │ │
│ [Analyze]             │ └──────────────────────────────────────────────────────────────────┘ │
│ [Generate options]    │ ┌──────────────────────────────────────────────────────────────────┐ │
│                       │ │ ( ) Option C  …                                                     │ │
│                       │ └──────────────────────────────────────────────────────────────────┘ │
│                       │                                      [Save selected harmony →]        │
└───────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

Sau khi chọn, header của tất cả màn Layer 2 phải hiện `Harmony source: Option B · fingerprint 8e3… · Change`. Nút `Change` đưa về Harmony và cảnh báo ảnh hưởng stale trước khi thay đổi.

## 4. Màn Accompaniment — chọn lane Guitar/Piano
<!-- beads-id: br-ds-lowfi-singer-accompaniment-s04 -->

```text
1440 × 900  /compose/:slug/accompaniment
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Melody ✓   Harmony ✓  [Option B · G · 4/4]    ACCOMPANIMENT ●     Export ○                   │
├───────────────────────┬──────────────────────────────────────────────────────────────────────┤
│ SOURCE (sticky)       │ LAYER 2 — choose one or both; each can be published independently    │
│ Staff mini-preview    │                                                                      │
│ Key G · 4/4           │ ┌──────────────────────┐  ┌───────────────────────────────────────┐ │
│ [Change harmony]      │ │ [✓] GUITAR CLASSIC   │  │ [ ] PIANO                             │ │
│                       │ │ Current · Valid       │  │ Not started                           │ │
│                       │ │ PIMA arpeggio         │  │ LH/RH grand staff                     │ │
│                       │ │ [Generate options]    │  │ [Generate options]                    │ │
│                       │ └──────────────────────┘  └───────────────────────────────────────┘ │
│                       │                                                                      │
│                       │ Other experimental/support instruments below this divider             │
│                       │ ───────────────────────────────────────────────────────────────────  │
│                       │ [Continue to review]                                                  │
└───────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

Hai card có cùng kích thước, cùng vị trí action và cùng cấp thị giác. Không đặt Piano dưới tiêu đề “more instruments”, và không gọi Guitar Fingerstyle trong màn này.

### LLM Arrangement Studio — tạo và so sánh phương án
<!-- beads-id: br-ds-lowfi-singer-accompaniment-s10 | satisfies: br-prd01-s62 -->

```text
1440 × 900  /compose/:slug/accompaniment?instrument=piano|guitar-classic
┌───────────────────────┬──────────────────────────────────────────────────────────────────────┐
│ MUSICAL BRIEF         │ LLM OPTIONS  [Generate 4 variants] [Refine selected]                  │
│ Feel: devotional      │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                    │
│ Energy: gentle → lift │ │ A · Sparse   │ │ B · Flowing  │ │ C · Cadential│                    │
│ Skill: Intermediate   │ │ VALID        │ │ VALID        │ │ REVIEW       │                    │
│ [Add feedback…]       │ │ [Play][View] │ │ [Play][View] │ │ [Play][View] │                    │
│                       │ └──────────────┘ └──────────────┘ └──────────────┘                    │
│ Constraints applied   │                                                                      │
│ ✓ source / meter      │ Selected B: rationale + measure decision map + full ABC preview      │
│ ✓ singer yield        │ Feedback: [Keep B; thinner under Antara______] [Send refinement]    │
│ ✓ guitar/piano rules  │ Validation: pass  |  lineage: B.2 ← B.1                              │
└───────────────────────┴──────────────────────────────────────────────────────────────────────┘
```

Studio phải cho thấy **brief, constraints đang áp dụng, khác biệt của mỗi option, diagnostics và lineage**; không chỉ hiện một spinner “AI generated”. `Generate variants` tạo option mới có diversity label; `Refine selected` chỉ sửa option đang chọn theo feedback/diagnostic, giữ các option đã pass để A/B. LLM không có CTA Publish.

Trước khi tạo option, sidebar phải hiện facts đã khóa: meter/tempo, chord windows theo measure-beat, phrase hiện tại, melody activity và register band. Profile picker chỉ hiện ứng viên cùng meter family; voicing review hiển thị section range và lý do đổi hoặc giữ vùng tay/register. Không cho UI diễn giải một `profileId` là voicing, hoặc cho một thay đổi voicing làm đổi profile mà không báo rõ.

## 5. Lane Guitar Classic — cấu hình và duyệt
<!-- beads-id: br-ds-lowfi-singer-accompaniment-s05 -->

```text
1440 × 900  /compose/:slug/accompaniment?instrument=guitar-classic
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [← Back to lanes]  Guitar Classic  ·  Source current  ·  Draft VALID                          │
├───────────────────────┬───────────────────────────────┬──────────────────────────────────────┤
│ PROFILE (3 cols)      │ VOICING & VALIDATION (3 cols) │ PREVIEW (6 cols)                     │
│ (●) PIMA devotional   │ Measure 4 beat 3  ✓           │ [Play] [Tempo] [Loop]                │
│ ( ) Pinch arpeggio    │ Treble-led policy ✓           │ ┌──────────────────────────────────┐ │
│ ( ) Bhajan strum      │ One guitarist ✓               │ │ Melody + V:GuitarSupport staff    │ │
│                       │ [View 2 warnings]             │ └──────────────────────────────────┘ │
│ Capo [Auto v]         │                               │ [Fretboard / Staff toggle]           │
│ Skill [Intermediate]  │ [Regenerate]                  │                                      │
│                       │                               │                                      │
│                       │                               │ [Apply Guitar layer]                 │
└───────────────────────┴───────────────────────────────┴──────────────────────────────────────┘
```

Warnings mở drawer có measure/beat, string/fret và cách sửa. Khi có lỗi blocked, `Apply Guitar layer` bị disable và nút primary đổi thành `Review validation`.

Panel Guitar cần thêm `Compare options` và `Refine selected`; brief như “ít bass hơn trong verse” hoặc “đẩy cadence ở Antara” được gửi cho LLM cùng diagnostics. Preview luôn nêu option đang xem và lineage, không đánh đồng kết quả LLM với layer đã Apply.

## 6. Lane Piano — cấu hình và duyệt
<!-- beads-id: br-ds-lowfi-singer-accompaniment-s06 -->

```text
1440 × 900  /compose/:slug/accompaniment?instrument=piano
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [← Back to lanes]  Piano  ·  Source current  ·  Draft VALID                                   │
├───────────────────────┬───────────────────────────────┬──────────────────────────────────────┤
│ PROFILE (3 cols)      │ VALIDATION & AUTOMATION       │ GRAND STAFF / PLAYBACK (6 cols)      │
│ (●) Pop / Ballad      │ LH bass C2–C3          ✓      │ [Play] [Tempo] [Loop]                │
│ ( ) Rock / R&B        │ Low Interval Limit     ✓      │ ┌──────────────────────────────────┐ │
│ ( ) Classical / Folk  │ RH below melody        ✓      │ │ Melody + RH / LH grand staff       │ │
│                       │ Hand span: 1 rolled    !      │ └──────────────────────────────────┘ │
│ Skill [Intermediate]  │ Collision: none        ✓      │ [Combined] [LH only] [RH only]       │
│ Hand span [Auto]      │ Pedal: 14 down/flush   ✓      │ ┌──────────────────────────────────┐ │
│                       │ [Open measure details]        │ │ Piano keyboard + pedal indicator    │ │
│ [Regenerate]          │                               │ └──────────────────────────────────┘ │
│                       │                               │ [Apply Piano layer]                  │
└───────────────────────┴───────────────────────────────┴──────────────────────────────────────┘
```

Rolled articulation là warning có thể duyệt, không bị che. Collision không được tự giấu: hiển thị quyết định `shift LH` hoặc `thin LH`, measure/beat và trước/sau trong drawer.

Panel Piano cần thêm `Compare options` và `Refine selected`; feedback như “giữ option C nhưng không fill ở Sthayi” chỉ sửa option C. Mỗi option phải hiển thị lý do lựa chọn LH/RH texture, fill/pedal và diagnostics để người dùng có thể so sánh bằng tai lẫn bằng bản nhạc.

## 7. Review, Publish và Practice
<!-- beads-id: br-ds-lowfi-singer-accompaniment-s07 -->

```text
1440 × 900  /compose/:slug/review
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Review & Publish                                           Source: Harmony Option B · 8e3…    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ PUBLISHABLE LAYERS                                                                    │
│ [✓] Guitar Classic   CURRENT · VALID  · generated 10:42  [Preview] [Remove selection] │
│ [✓] Piano            CURRENT · VALID  · generated 10:47  [Preview] [Remove selection] │
│ [ ] Fingerstyle      extension / separate workflow                              │
│                                                                                      │
│ ┌─────────────────────────────┐  ┌────────────────────────────────────────────────┐ │
│ │ Export summary              │  │ Selected preview / staff / playback            │ │
│ │ 2 notation files            │  │ [Guitar] [Piano]                               │ │
│ │ preserves song Markdown     │  │                                                │ │
│ └─────────────────────────────┘  └────────────────────────────────────────────────┘ │
│                                                   [Publish 2 selected layers]       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Sau publish, toast cung cấp `Open Practice`. Practice có sheet selector Guitar Classic/Piano, playback và visual phù hợp; không hiển thị draft local. Layer stale có nhãn đỏ, checkbox disabled và CTA `Regenerate from Harmony`.

## 8. Trạng thái, lỗi và khả năng tiếp cận
<!-- beads-id: br-ds-lowfi-singer-accompaniment-s08 -->

| Trạng thái | Biểu diễn tối thiểu | Hành động chính |
|---|---|---|
| Not started | badge xám + mô tả output | Configure |
| Generating | progress theo phase + Cancel | Wait / Cancel |
| Repairing option | option ID + measure/beat đang sửa + lineage | Review repair / Cancel |
| Valid/current | badge xanh + thời gian/fingerprint | Apply hoặc Publish |
| Warning/review | badge vàng + số diagnostic | Open details / Apply nếu policy cho phép |
| Blocked/invalid | badge đỏ + measure/beat/rule | Fix profile/voicing hoặc quay lại Harmony |
| Stale | badge đỏ xám + upstream thay đổi nào | Regenerate from current source |

Tất cả control dùng keyboard được; radio profile có label đầy đủ; bảng validation đọc được bằng screen reader; staff/keyboard không là nơi duy nhất truyền diagnostic. Không tự phát audio khi mở trang.

## 9. Handoff triển khai và tiêu chí review
<!-- beads-id: br-ds-lowfi-singer-accompaniment-s09 -->

Trước khi xây UI production, POC Piano phải render đúng màn ở mục 6 với sample data, validation và playback. Khi tích hợp Composer, test E2E tối thiểu phải kiểm tra: Guitar-only qua Publish/Practice, Piano-only qua Publish/Practice, hai lanes cùng current, source change tạo stale cho cả hai, lỗi piano hand collision chặn Apply, và LLM refine chỉ thay đổi option/mô tả phạm vi đã yêu cầu.

Các label/CTA quan trọng cần giữ nhất quán: `Harmony source`, `Generate variants`, `Compare options`, `Refine selected`, `Source current`, `Draft stale`, `Apply Guitar layer`, `Apply Piano layer`, `Publish selected layers`, `Regenerate from current source`. Điều này làm rõ ranh giới giữa đề xuất LLM, kết quả đã kiểm chứng/duyệt và artefact đã công bố.
