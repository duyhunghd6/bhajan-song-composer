# Phân tích thiết kế hệ thống — Đệm hát Guitar Classic và Piano
<!-- beads-id: br-design-singer-accompaniment | satisfies: br-prd01-s2, br-prd01-s31, br-prd01-s39, br-prd01-s40, br-prd01-s41, br-prd01-s42, br-prd01-s43, br-prd01-s44, br-prd01-s45, br-prd01-s46, br-prd01-s57, br-prd01-s58 -->

> **Loại tài liệu:** thiết kế đích để hoàn thiện nghiệp vụ đã chốt, không phải tuyên bố mọi thành phần bên dưới đã ở production.
> **Quyết định cốt lõi:** Guitar Classic và Piano là hai nhánh Layer 2 ngang hàng, cùng tiêu thụ Harmony Step 3 đã chọn, nhưng không dùng chung hiện thực nhạc cụ, validation hay artefact đầu ra.

## 1. Bối cảnh, phạm vi và nguyên tắc thiết kế
<!-- beads-id: br-design-singer-accompaniment-s01 -->

Phạm vi là luồng từ Melody ABC đến phần đệm cho ca sĩ, sau đó xuất bản/luyện tập. Không đưa Guitar Fingerstyle độc tấu, Piano Solo hoặc Ensemble vào critical path. Các mở rộng này có thể tái sử dụng harmony foundation, nhưng không được làm chậm Guitar Classic/Piano.

Nguyên tắc thiết kế:

1. **Singer-first:** melody là nguồn khóa; mọi mật độ, register và fill phải nhường cho ca sĩ.
2. **Một nguồn hòa âm, hai projection:** chung timeline/chord/measure facts; riêng event model, physical model và ABC.
3. **LLM-led, validator-governed:** LLM là arranger tạo ABC và nhiều phương án có ý đồ; parser, validator và renderer tất định khóa facts, chứng minh hard constraints và quyết định eligibility phát hành — không thay thế sự sáng tạo bằng pattern cố định.
4. **Provenance trước tiện lợi:** mọi draft lưu fingerprint nguồn; bất kỳ thay đổi upstream nào cũng đánh stale rõ ràng.
5. **Review trước publish:** không có auto-publish, không dùng preview nháp cho Practice.

## 2. Hiện trạng và khoảng cách cần khép lại
<!-- beads-id: br-design-singer-accompaniment-s02 -->

| Năng lực | Hiện trạng đã kiểm tra | Thiết kế đích cần có |
|---|---|---|
| Harmony Step 1–3 | Đang có trong `src/lib/theory/accompaniment-workflow/definition.ts`. | Giữ là nguồn duy nhất được chọn cho hai nhánh. |
| Guitar Classic | Là nhánh Composer hoạt động; có profile, voicing/bass và hiện thực `V:GuitarSupport`. | Giữ hợp đồng hiện hữu, bổ sung trạng thái/provenance chung với Piano. |
| Piano engine | Có các module `piano-accompaniment.ts`, `piano-comping-profiles.ts`, `piano-playability.ts` và output/pedal helpers. | Đưa thành nhánh Composer hoạt động, có UI, source invalidation, output và test chuyên biệt. |
| Workflow setup | Hiện chỉ có Guitar Classic, Harmonium, Djembe; test còn xác nhận Piano không được khôi phục. | Thêm Piano như lựa chọn Layer 2 ngang hàng và các bước riêng của Piano. |
| POC Piano | RTM ghi nhận trang Piano mockup chưa tồn tại. | Hoàn thành POC và Playwright gate trước khi tích hợp Composer. |
| Publish/Practice | Có cơ chế chung nhưng coverage cho publication/Practice còn thiếu. | Bảo đảm chọn/lưu/đọc riêng Guitar và Piano, có test tích hợp. |

## 3. Kiến trúc logic và quyền sở hữu dữ liệu
<!-- beads-id: br-design-singer-accompaniment-s03 -->

```text
Melody ABC (editable root)
        │  fingerprint thay đổi → invalidation hạ nguồn
        ▼
Harmony Steps 1–3
        │  chỉ một voice-leading-validation được người dùng chọn
        ▼
ApprovedHarmonySnapshot
        ├───────────────────────────────────────┐
        ▼                                       ▼
LLM Guitar candidate pack                  LLM Piano candidate pack
→ normalize/validate →                     → normalize/validate →
GuitarSupport options                       grand-staff options
        │                                       │
        └──────── current validated layer ──────┘
                          │
                          ▼
               Review → explicit Publish → Practice catalogue
```

`ApprovedHarmonySnapshot` là hợp đồng chia sẻ tối thiểu: `sourceAbc`, `sourceFingerprint`, key/scale, meter, measure timeline, chord windows, cadence/phrase boundaries, melody activity/gap facts và lựa chọn Step 3. Hai nhánh chỉ đọc snapshot này; không branch nào được sửa snapshot hoặc giai điệu để tự “làm cho dễ chơi”.

## 4. Hợp đồng domain và mô hình trạng thái
<!-- beads-id: br-design-singer-accompaniment-s04 -->

Đề xuất thêm một `AccompanimentSession` bao quanh các session branch hiện có. Đây là orchestration/state contract, không thay thế các engine nhạc lý.

| Thực thể | Chủ sở hữu | Dữ liệu tối thiểu | Bất biến |
|---|---|---|---|
| `ApprovedHarmonySnapshot` | Harmony workflow | ABC, fingerprint, meter, chord windows, melody activity | Chỉ tạo từ Step 3 đã chọn. |
| `GuitarClassicDraft` | Guitar branch | profile, voicings, bass anchors, support events, report, ABC | `sourceFingerprint` phải bằng snapshot khi current. |
| `PianoDraft` | Piano branch | profile, LH/RH events, fills, pedal, report, grand-staff ABC | `sourceFingerprint` phải bằng snapshot khi current. |
| `ArrangementCandidate` | LLM orchestration | brief, rationale, decision map, raw ABC, option lineage, suggested profile/techniques | Không được thay đổi `ApprovedHarmonySnapshot`; chưa có quyền `valid` hay `publishable`. |
| `ValidatedCandidate` | Validation orchestrator | normalized events, ABC, diagnostics, pass/review/block state, source fingerprint | Chỉ validator được gán `valid`; repair phải kế thừa lineage của candidate gốc. |
| `LayerPublication` | Review/publish | layer type, source fingerprint, artifact version, publish time | Chỉ nhận current + valid draft. |

Trạng thái chuẩn cho mỗi branch là `not-started` → `configuring` → `generated` → `valid` → `applied`; mọi thay đổi nguồn đưa trạng thái về `stale`. `validation-failed` giữ diagnostics có cấu trúc và không được coi là `valid`.

## 5. Luồng tạo chung trước khi phân nhánh
<!-- beads-id: br-design-singer-accompaniment-s05 -->

1. Parse Melody ABC và tạo measure/timing facts; từ chối nguồn sai cú pháp hay không cân phách.
2. Chạy key/scale, strong beat, chord roles và voice-leading validation.
3. Người dùng chọn đúng một kết quả Harmony Step 3. Server/client tạo `ApprovedHarmonySnapshot` có fingerprint.
4. UI cho phép bật Guitar Classic, Piano hoặc cả hai. Lựa chọn một branch không làm branch kia thành dependency.
5. LLM tạo candidate pack cho mỗi branch, hệ thống chạy validator và trả `validated options + diagnostics`; chỉ candidate hợp lệ mới có nút Apply.

## 6. LLM orchestration — tạo ABC linh hoạt trong cổng kiểm chứng
<!-- beads-id: br-design-singer-accompaniment-s11 -->

LLM là tầng ra quyết định và hiện thực âm nhạc: nó có thể chọn/pha trộn pattern, voicing, inversion, register, density, articulation, bass motion, fill, cadence treatment và pedal theo brief, thay vì chỉ chọn từ một danh sách template. Mỗi lần tạo trả về **candidate pack** gồm 3–5 option có khác biệt có chủ đích, không phải 5 bản sao ngẫu nhiên.

```text
ApprovedHarmonySnapshot + user brief + branch constraints
                         │
                         ▼
                LLM: plan + ABC candidate pack
                         │ raw ABC, rationale, measure decisions
                         ▼
        parser/normalizer → harmonic & timing checks → instrument validator
                         │                 │                    │
                 parse error           singer-yield        physics diagnostics
                         └─────────────────┴──────────┬─────────┘
                                                       ▼
                   LLM scoped repair (only flagged measures / user feedback)
                                                       │
                                                       ▼
                    valid/review options → human compare → Apply → Publish
```

| Hợp đồng | Nội dung bắt buộc |
|---|---|
| LLM input | Snapshot khóa; instrument target; user brief; skill/range/capo preferences; hard-constraint summary; các option/diagnostic trước đó khi refine. Không gửi mutable session không liên quan. |
| LLM output | `optionId`, musical rationale, diversity label, measure-level decision map, complete instrument ABC, event hints (voicing/hand/string/fill/pedal) và declared trade-offs. |
| Diversity contract | Ít nhất hai chiều khác nhau giữa các option: texture/rhythm, register/voicing, bass strategy, density/fill policy hoặc cadence treatment. Không chỉ đổi tên profile. |
| Validation contract | ABC parseability; source/meter/chord-window alignment; singer-yield; riêng Guitar: one-player physics; riêng Piano: LIL, two-hand span/collision và pedal coherence. |
| Repair contract | Validator trả measure/beat/rule/facts. LLM chỉ sửa phạm vi lỗi hoặc phạm vi người dùng yêu cầu, giữ source facts và pass measures; chạy lại toàn bộ validation sau mỗi vòng. |

Soft rules là vocabulary để LLM suy luận, không là rào chắn sáng tạo: LLM có thể chọn tension, syncopation, inversion bất thường, thưa/dày, fill hoặc cadence khác nếu còn singer-first. Hard rules luôn do code kiểm tra. LLM không tự chứng nhận `valid`, không tự gán fingerprint, không tự giữ state canonical và không tự publish.

## 7. Nhánh Guitar Classic
<!-- beads-id: br-design-singer-accompaniment-s06 -->

Nhánh Guitar sử dụng các bước hiện hữu `guitar-comping-profile`, `guitar-voicing-bass`, `guitar-classic-abc-notation`, sau Harmony Steps 1–3.

| Pha | Input | Output/kiểm tra bắt buộc |
|---|---|---|
| LLM plan/ABC | Snapshot + brief + option diversity brief | 3–5 `V:GuitarSupport` option có texture, voicing/bass, cadence/fill và rationale riêng. |
| Normalize | raw candidate ABC + decision hints | voicing/bass events và duration khớp từng measure, standard notation/playback. |
| Physical validation | merged Guitar events | 1 pitch/string, 1 string/pitch đồng thời, stretch, fret range, barre, one left hand. |
| Review | ABC + diagnostics | staff, audio, guitar visual nếu có; Apply chỉ khi valid/current. |

Không tái sử dụng TimeGrid/Fingerstyle hoặc đòi TAB solo như điều kiện thành công của Guitar Classic. Các yêu cầu này thuộc route Fingerstyle riêng.

## 8. Nhánh Piano
<!-- beads-id: br-design-singer-accompaniment-s07 -->

Nhánh Piano phải được tích hợp qua adapter Composer bọc các module hiện có, với bốn bước UI/domain rõ ràng: `piano-comping-profile`, `piano-lh-rh-voicing`, `piano-fill-pedal`, `piano-grand-staff-validation`.

| Pha | Quy tắc đầu ra |
|---|---|
| LLM plan/ABC | 3–5 grand-staff option từ brief; profile là điểm khởi đầu, LLM được pha trộn texture khi giải thích được trade-off. |
| LH bass | Root/octave/fifth/1-5-8 C2–C3; Low Interval Limit cấm 3rd/7th/cluster thấp. |
| RH voicing | Guide tone 3rd/7th trong C3–C5, dưới melody; common-tone retention và shortest-path inversions. |
| Fill/pedal | LLM đặt fill/pedal theo câu hát; fill chỉ ở `MelodicGapEvent` an toàn, yield trước melody re-entry; pedal phải có timing nhất quán. |
| Physical validation | Mỗi tay ≤ major 10th hoặc chuyển rolled; phát hiện key/range collision, shift-down/thin LH; đồng bộ playback/highlights. |
| Projection | Grand staff `RH` + `LH`, MIDI/pedal events, hand-aware key highlights và diagnostics. |

Đầu ra piano không được bị “rút gọn” thành một staff GuitarSupport. Grand staff và hand metadata là artifact chuẩn cho review, publish và Practice.

## 9. Validation, lỗi và khả năng quan sát
<!-- beads-id: br-design-singer-accompaniment-s08 -->

Validation được xếp theo thứ tự: parse/timing → source freshness → harmonic alignment → singer-yield/register → instrument physics → artifact/render → publication eligibility. Một lỗi phải trả về branch, measure, beat, rule, severity và gợi ý phục hồi.

| Lỗi | Phản hồi UX/hệ thống |
|---|---|
| Nguồn cũ | Chặn Apply/Publish; chỉ rõ Melody hoặc Harmony selection đã thay đổi. |
| Guitar không chơi được | Nêu string/fret/shape/beat; gợi ý voicing hoặc profile khác. |
| Piano quá span/chồng tay | Ghi rõ hand/beat; rolled hoặc shift/thin phải hiện trong report để người dùng duyệt. |
| Fill che ca sĩ | Bỏ fill tất định, giữ comping nền; không hạ giai điệu. |
| Renderer ABC lỗi | Không tạo artifact publishable; giữ input và diagnostics để sửa. |

Repair loop tối đa phải có giới hạn cấu hình và lưu lại candidate lineage. Nếu hết lượt mà vẫn invalid, UI hiển thị option bị chặn cùng diagnostic và các option khác đã pass; không ép LLM “sửa” bằng cách đổi melody/chord window hoặc ẩn lỗi.

Tối thiểu cần log trace gồm snapshot ID/fingerprint, branch/profile, version generator, validation report và artifact ID. Điều này làm debugging và tái tạo kết quả có thể kiểm chứng.

## 10. Persistence, publication và Practice
<!-- beads-id: br-design-singer-accompaniment-s09 -->

Draft cục bộ có thể giữ hai branch song song nhưng phải version theo fingerprint nguồn. Preview controls (mute/volume/visible hand) chỉ là projection UI và không thay đổi artifact. Khi publish, người dùng chọn rõ Guitar Classic và/hoặc Piano; mỗi artifact có type phân biệt, ABC hợp lệ và metadata phù hợp.

Practice chỉ truy vấn artefact catalogue đã publish. Với Piano, Practice cần chọn hands combined/LH/RH và hiển thị pedal khi metadata có mặt; với Guitar, hiển thị staff và guitar visualization nếu event map sẵn có. Không suy diễn từ draft đang mở.

## 11. Lộ trình hoàn thiện và cổng chấp nhận
<!-- beads-id: br-design-singer-accompaniment-s10 -->

1. **Cổng POC Piano:** hoàn thành mockup end-to-end gồm input, intermediate decisions, grand staff, playback/highlights, pedal và validation report; thêm Playwright.
2. **LLM candidate orchestration:** tạo hợp đồng candidate/repair, parser-normalizer, diversity checks, prompt/evaluation fixtures và lưu lineage trước khi cho LLM tạo ABC ở Composer.
3. **Hợp đồng nhánh Piano:** thêm step IDs, setup panel, session transitions, source fingerprint/invalidation và adapter output; cập nhật tài liệu workflow/source flow cùng code.
4. **Composer UI:** tích hợp Guitar/Piano selector ngang hàng, candidate compare/refine và state current/stale; không đổi route Fingerstyle.
5. **Review/Practice:** chọn riêng từng artifact, publish mapping và hand-aware Practice.
6. **Test gate:** unit cho piano generation/playability/pedal; integration cho branch transitions/stale; prompt tests kiểm tra ABC/different-option/repair boundaries; E2E cho Guitar-only, Piano-only, cả hai, validation failure và publish/practice isolation.

Một release chỉ đạt nghiệp vụ khi người dùng có thể hoàn tất UC-01 + UC-02 hoặc UC-01 + UC-03 từ đầu đến Practice, không cần hoàn tất nhánh nhạc cụ còn lại hay bất kỳ extension nào.
