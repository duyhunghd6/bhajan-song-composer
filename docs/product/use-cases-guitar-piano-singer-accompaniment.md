# Use case — Đệm hát Guitar Classic và Piano
<!-- beads-id: br-usecase-singer-accompaniment | satisfies: br-prd01-s2, br-prd01-s31, br-prd01-s45, br-prd01-s57, br-prd01-s58, br-prd01-s62 -->

> **Trạng thái:** Nghiệp vụ đã chốt; tài liệu này là chuẩn hành vi cho lộ trình triển khai.
> **Phạm vi:** Guitar Classic và Piano là hai kết quả Layer 2 ngang hàng, tạo từ cùng một bản hòa âm đã được người dùng chọn. Đây không phải luồng Guitar Fingerstyle độc tấu hay Piano Solo.

## 1. Mục tiêu, tác nhân và điểm vào
<!-- beads-id: br-usecase-singer-accompaniment-s01 -->

Mục tiêu là giúp một người chơi nhạc đệm cho ca sĩ từ giai điệu ABC, lời ca và ngữ cảnh hòa âm đã cung cấp. Người dùng có thể chỉ tạo Guitar Classic, chỉ tạo Piano, hoặc tạo cả hai; mỗi kết quả có thể nghe, xem bản nhạc, xuất bản và dùng để luyện tập độc lập.

| Tác nhân | Vai trò |
|---|---|
| Người soạn/người chơi | Nhập hoặc chỉnh giai điệu, chọn hòa âm, chọn nhạc cụ và duyệt kết quả. |
| Ca sĩ | Là trung tâm âm nhạc: giai điệu và khoảng thở của ca sĩ quyết định mật độ phần đệm. |
| AI Theory Assistant (LLM) | Người đồng soạn chính: hiểu brief, vận dụng linh hoạt rule, tạo nhiều phương án ABC Guitar/Piano có chủ đích và sửa từng phương án theo phản hồi/diagnostic. Không được tự thay thế dữ liệu nguồn đã khóa. |
| Bộ tạo và kiểm tra tất định | Chuẩn hóa/parse ABC LLM tạo, kiểm tra nhịp/phách, hòa âm, quãng âm, khả năng chơi và tạo dữ liệu playback; không giới hạn LLM vào một pattern cố định. |
| Hệ thống xuất bản/luyện tập | Chỉ công bố layer được người dùng chọn; màn Practice chỉ đọc bản đã công bố. |

Điểm vào chính là Composer: `melody` → `harmony` → `accompaniment` → `review`. Nhánh `guitar-fingerstyle` là một nhánh độc lập từ Harmony Step 3, không phải một biến thể thay thế cho Guitar Classic đệm hát.

## 2. Quy tắc nghiệp vụ xuyên suốt
<!-- beads-id: br-usecase-singer-accompaniment-s02 -->

1. Chỉ bản ABC ở Harmony Step 3 (`voice-leading-validation`) mà người dùng đã chọn mới được dùng làm nguồn Layer 2.
2. Giai điệu, nhịp, ô nhịp, hợp âm theo thời điểm và ranh giới câu của nguồn được giữ nguyên. Sửa nguồn hoặc đổi lựa chọn Step 3 làm toàn bộ bản đệm hạ nguồn trở nên cũ và không được xuất bản.
3. Phần đệm phải nhường cho ca sĩ: không chen vào quãng giai điệu đang hoạt động; fill chỉ xuất hiện ở khoảng nghỉ hoặc nốt ngân hợp lệ và dừng trước khi ca sĩ vào lại.
4. Guitar Classic và Piano cùng dùng timeline hợp âm, nhưng có dữ liệu hiện thực, kiểm tra khả năng chơi, ABC và sự kiện playback riêng. Không chuyển thẳng event Guitar thành event Piano hoặc ngược lại.
5. Một kết quả chỉ được áp dụng/xuất bản khi các kiểm tra bắt buộc đạt. Cảnh báo có thể yêu cầu người dùng đổi profile, đổi voicing hoặc quay lại hòa âm; không được âm thầm sửa giai điệu.
6. Xuất bản là thao tác có chủ đích ở `review`; bản nháp cục bộ không xuất hiện trong Practice.
7. LLM được phép tạo ABC hoàn chỉnh, biến tấu texture, voicing, groove, fill và articulation trong phạm vi brief; rule engine cung cấp sự thật nguồn và cổng kiểm tra, không thay thế vai trò sáng tạo của LLM bằng một bộ pattern đơn lẻ.

## 3. Phối hợp LLM — tạo phương án, kiểm chứng và lựa chọn
<!-- beads-id: br-usecase-singer-accompaniment-s09 -->

LLM là **arranger tạo phương án**, không chỉ là giao diện gọi các profile có sẵn. Từ một `ApprovedHarmonySnapshot`, người dùng cung cấp brief (cảm xúc, mức năng lượng, mật độ, trình độ, style/nhạc cụ ưu tiên, phần cần yên tĩnh hoặc cần nâng đỡ), rồi LLM tạo một gói 3–5 phương án ABC có khác biệt nghe được. Ví dụ Guitar có thể khác về arpeggio/strum, nhịp bass, register, capo hoặc mức thưa/dày; Piano có thể khác về LH foundation, RH voicing/inversion, nhịp comping, fill và cách dùng pedal.

| Pha | LLM làm gì | Hệ thống tất định và người dùng làm gì |
|---|---|---|
| Lập brief | Diễn giải ý định âm nhạc thành chiến lược arrangement và tiêu chí khác biệt giữa các option. | Cung cấp snapshot khóa, giới hạn nhạc cụ/kỹ năng và hiển thị brief để người dùng sửa. |
| Tạo option | Trả rationale, decision map theo ô nhịp và ABC hoàn chỉnh cho từng option. Có thể dùng hoặc phá cách rule mềm nếu nêu rõ hiệu quả âm nhạc. | Parse/normalize ABC; kiểm tra hard constraints và gắn diagnostic theo option. |
| Sửa có phạm vi | Nhận diagnostics + feedback như “giữ mood B, mỏng 2 ô cuối câu”; chỉ viết lại phạm vi được yêu cầu. | Giữ nguyên source facts và phần đã pass; giới hạn số vòng sửa, lưu lineage của option. |
| Duyệt | Giải thích trade-off để người dùng so sánh thay vì tự chọn “phương án tốt nhất”. | Người dùng nghe/xem/so sánh và chọn; chỉ option valid/current được Apply/Publish. |

Hard constraints không phải là “gu âm nhạc” của LLM: Melody, meter, chord-window timeline, singer-yield, guitar one-player physics, piano hand-span/collision và ABC parseability không được vi phạm. Với rule mềm (mật độ, inversion, walking bass, fill vocabulary, pedal feel), LLM được quyền đề xuất phương án khác thường; báo cáo phải nêu ý đồ và validator đánh dấu review thay vì tự loại bỏ nếu không có lỗi cứng.

Người dùng luôn có thể chọn `Generate more variants`, `Refine this option`, hoặc đưa feedback bằng ngôn ngữ tự nhiên. Nếu LLM không tạo được một option hợp lệ sau số vòng sửa giới hạn, hệ thống giữ các option đã pass và hiển thị diagnostic; không bịa một ABC “valid” hay tự xuất bản fallback.

## 4. UC-01 — Chuẩn bị và chốt nền hòa âm chung
<!-- beads-id: br-usecase-singer-accompaniment-s03 -->

| Thuộc tính | Nội dung |
|---|---|
| Mục đích | Biến giai điệu ABC thành nền hòa âm đáng tin cậy cho cả hai nhạc cụ. |
| Tiền điều kiện | Có bài hát, Melody ABC hợp lệ và ít nhất một phương án Harmony có thể tạo. |
| Kích hoạt | Người soạn mở bước `harmony` và yêu cầu phân tích/tạo hòa âm. |
| Hậu điều kiện thành công | Một kết quả `voice-leading-validation` được chọn, có fingerprint nguồn và đủ dữ liệu nhịp/ô nhịp/hợp âm. |

Luồng chính:

1. Hệ thống phân tích giọng/scale, phách mạnh, chỗ ngắt câu và cadence từ Melody ABC, sau đó đưa các facts này cho LLM.
2. LLM tạo các phương án hòa âm có giải thích; người dùng so sánh các phương án.
3. Hệ thống kiểm tra giữ nguyên giai điệu, đủ số phách, căn chỉnh pitch và voice leading.
4. Người dùng chọn một phương án hợp lệ. Hệ thống khóa fingerprint của nó và mở bước `accompaniment`.

Ngoại lệ: nếu ABC không parse được hoặc không đủ số phách, hiển thị lỗi ở Melody/Harmony và không cho tạo đệm. Nếu phương án bị từ chối, người dùng chọn phương án khác hoặc sửa Melody; chưa có nền được chọn thì không mở nhánh Guitar/Piano.

## 5. UC-02 — Tạo Guitar Classic đệm hát
<!-- beads-id: br-usecase-singer-accompaniment-s04 -->

| Thuộc tính | Nội dung |
|---|---|
| Mục đích | Tạo một phần Guitar Classic chơi được bởi một người để nâng đỡ ca sĩ. |
| Tiền điều kiện | UC-01 thành công; Guitar Classic được bật trong lựa chọn Layer 2. |
| Kết quả | `V:GuitarSupport` ABC, bản đồ voicing/bass, báo cáo khả năng chơi, sự kiện playback và preview bản nhạc. |

Luồng chính:

1. Người dùng viết brief hoặc chọn điểm khởi đầu như PIMA devotional, pinch arpeggio, Bhajan strum, kỹ năng/capo; đây là gợi ý chứ không khóa LLM vào template.
2. LLM tạo nhiều phương án Guitar ABC, mỗi phương án nêu rõ texture, voicing/bass strategy và lý do phù hợp cho ca sĩ.
3. Hệ thống chuẩn hóa mỗi option thành event/voicing data, rồi kiểm tra một người chơi/một cây đàn: string, độ với tay, barre, số ngón, register, chord window và singer-yield.
4. LLM nhận diagnostics của option fail để sửa riêng các ô/beat bị nêu; một option pass không bị sửa lại trừ khi người dùng yêu cầu.
5. Người dùng A/B nghe/xem staff/fretboard, phản hồi tự nhiên hoặc chọn áp dụng một option valid/current.

Tiêu chí chấp nhận: nhịp của `V:GuitarSupport` khớp Melody theo từng ô; tất cả chord window được căn đúng; không có quá hai onset chỉ-bass liên tiếp trong vận hành thông thường; kết quả có thể được duyệt và xuất bản độc lập mà không cần Guitar Fingerstyle.

## 6. UC-03 — Tạo Piano đệm hát hai tay
<!-- beads-id: br-usecase-singer-accompaniment-s05 -->

| Thuộc tính | Nội dung |
|---|---|
| Mục đích | Tạo piano grand staff hai tay, có bass, voicing, comping và pedal rõ ràng để đệm ca sĩ. |
| Tiền điều kiện | UC-01 thành công; Piano được chọn là nhạc cụ Layer 2. |
| Kết quả | LH/RH maps, profile, fill map, báo cáo playability, pedal events, grand-staff ABC và piano-key highlights. |

Luồng chính:

1. Người dùng mô tả cảm xúc/texture và chọn Pop/Ballad, Rock/R&B hoặc Classical/Folk như điểm khởi đầu, kèm kỹ năng/độ rộng tay nếu có.
2. LLM tạo nhiều grand-staff ABC options với LH foundation, RH voicing, comping, fill/pedal plan và giải thích khác biệt.
3. Hệ thống kiểm tra LIL C2–C3, guide tone/RH tránh melody, đủ phách, hand span/collision và thời điểm fill/pedal; khi cần có thể đề xuất rolled/shift/thin rõ ràng.
4. LLM sửa option theo diagnostics hoặc feedback như “giữ option C nhưng bỏ fill ở Sthayi”; mọi thay đổi vẫn bị kiểm tra lại.
5. Người dùng so sánh grand staff, nghe LH/RH/cả hai, xem keyboard/pedal rồi áp dụng option valid/current.

Tiêu chí chấp nhận: hai tay đủ phách ở mọi ô; guide tone có mặt khi thực tế; không có LH/RH collision chưa giải quyết; fill không lấn vào câu hát; Piano được xuất bản/luyện tập mà không cần Piano Solo, ensemble hay Guitar.

## 7. UC-04 — Duyệt, xuất bản và luyện tập
<!-- beads-id: br-usecase-singer-accompaniment-s06 -->

| Thuộc tính | Nội dung |
|---|---|
| Mục đích | Biến kết quả đã duyệt thành tài nguyên luyện tập bền vững. |
| Tiền điều kiện | Ít nhất một layer Guitar Classic hoặc Piano đang current và đạt kiểm tra bắt buộc. |
| Kết quả | Notation đã chọn được công bố; Practice hiển thị đúng bản catalogue đã công bố. |

Luồng chính:

1. Tại `review`, người dùng thấy danh sách layer, nguồn của từng layer, trạng thái current/stale và preview playback.
2. Người dùng chọn Guitar Classic, Piano, hoặc cả hai để xuất bản; hệ thống xác nhận tên layer/định dạng ABC trước khi ghi.
3. Hệ thống upsert notation đã chọn và metadata catalogue, bảo toàn Markdown body của bài hát.
4. Ở `practice`, người dùng chọn bản đã công bố, điều khiển tempo/loop và xem staff cùng nhạc cụ trực quan phù hợp.

Nếu layer stale hoặc validation fail, checkbox xuất bản bị khóa và có liên kết quay lại đúng bước cần tạo lại. Practice không đọc localStorage hay preview nháp.

## 8. UC-05 — Chỉnh sửa nguồn và phục hồi trạng thái cũ
<!-- beads-id: br-usecase-singer-accompaniment-s07 -->

| Tình huống | Hành vi bắt buộc |
|---|---|
| Sửa Melody ABC | Invalidate Harmony, Guitar Classic và Piano phụ thuộc; giữ bản nháp để tham khảo nhưng gắn stale và chặn xuất bản. |
| Đổi lựa chọn Harmony Step 3 | Invalidate cả hai nhánh Layer 2; không tái dùng event map của lựa chọn cũ. |
| Đổi profile/voicing chỉ của Guitar | Chỉ Guitar draft stale; Piano current không đổi. |
| Đổi profile/voicing chỉ của Piano | Chỉ Piano draft stale; Guitar current không đổi. |
| Không đạt playability | Đưa nguyên nhân có thể hành động (ô, beat, tay/string, span/collision), rồi cho đổi profile, voicing hoặc trở về Harmony. |

Hệ thống luôn hiển thị nguồn đã dùng, fingerprint và thời điểm tạo để người dùng hiểu vì sao một kết quả bị stale.

## 9. Ma trận truy vết nghiệp vụ
<!-- beads-id: br-usecase-singer-accompaniment-s08 -->

| Use case | PRD liên quan | Thiết kế/UI liên quan |
|---|---|---|
| UC-01 Nền hòa âm | `br-prd01-s31`, `s57` | `br-design-singer-accompaniment-s04`–`s06`; `br-ds-lowfi-singer-accompaniment-s03` |
| UC-02 Guitar Classic | `br-prd01-s2`, `s31`, `s60` | `br-design-singer-accompaniment-s06`; `br-ds-lowfi-singer-accompaniment-s05` |
| UC-03 Piano | `br-prd01-s2`, `s31`, `s39`–`s46` | `br-design-singer-accompaniment-s07`; `br-ds-lowfi-singer-accompaniment-s06` |
| UC-04 Xuất bản/Luyện tập | `br-prd01-s58` | `br-design-singer-accompaniment-s08`; `br-ds-lowfi-singer-accompaniment-s07` |
| UC-05 Nguồn cũ | `br-prd01-s57` | `br-design-singer-accompaniment-s08`; `br-ds-lowfi-singer-accompaniment-s08` |
| Phối hợp LLM | `br-prd01-s2`, `s31`, `s45` | `br-design-singer-accompaniment-s11`; `br-ds-lowfi-singer-accompaniment-s10` |
| UC-06 Timeline / điệu / voicing | `br-prd01-s62` | `br-design-singer-accompaniment-s12`; `br-guide-singer-accompaniment-decision-model` |
| UC-07 Chỉnh voicing tại beat và lưu project | `br-prd01-s62`, `s57` | `br-design-singer-accompaniment-s13`; `br-ds-lowfi-singer-accompaniment-s11`; `br-guide-singer-accompaniment-decision-model-s08` |

## 10. UC-06 — Ra quyết định đệm hát theo timeline, điệu và voicing
<!-- beads-id: br-usecase-singer-accompaniment-s10 | satisfies: br-prd01-s62 -->

Mục đích là làm rõ ba quyết định không được gộp nhầm: hòa thanh theo thời điểm, điệu đệm và voicing. Người dùng không chọn “giai điệu đệm”; giai điệu là phần ca, còn điệu là profile nhịp/texture của phần đệm.

| Quyết định | Dữ liệu khóa/giới hạn | Hành vi bắt buộc |
|---|---|---|
| Harmony timeline | meter, tempo, chord windows, phrase/cadence | Mọi hợp âm phải có beat/subdivision bắt đầu và kết thúc; đổi chord rearticulate đúng window. |
| Comping profile | meter family, subdivision, tempo, style, energy, singer activity | Hệ thống lọc profile không tương thích nhịp trước; LLM chỉ so sánh 3–4 profile hợp lệ. |
| Voicing plan | melody register/activity, voice leading, chord quality, skill, physical limits | Chọn voicing theo phrase/section, giữ common tones và vùng tay; giữ third trước fifth khi cần làm mỏng. |

Luồng chính: (1) hệ thống tạo source facts và register map; (2) người dùng/LLM chọn một profile nền trong family nhịp hợp lệ; (3) hệ thống sinh các voicing chơi được, LLM giải thích/xếp hạng theo register và phrase; (4) renderer hiện thực phần đệm, validator kiểm tra lại; (5) người dùng nghe A/B và Apply option valid/current. Guitar/Piano dùng chung timeline nhưng không dùng chung event, shape/hand hoặc validator.

Ngoại lệ: voicing cao chỉ được dùng khi tách được contour/register khỏi giọng hát và đạt playability; không coi “cao cho đẹp” là lý do đủ. Với intentional sus/power/sparse color, việc không giữ third là soft-rule exception phải có rationale, không là lỗi bị che. Hợp đồng đầy đủ: [Singer-Accompaniment Decision Model](../guides/singer-accompaniment-decision-model.md).

## 11. UC-07 — Chỉnh voicing tại strong beat và lưu phiên làm việc thành Project
<!-- beads-id: br-usecase-singer-accompaniment-s11 | satisfies: br-prd01-s62, br-prd01-s57 -->

Mục đích là cho người soạn ra quyết định nghe được tại đúng vị trí đang nghe, mà không làm mơ hồ ranh giới giữa **đổi hợp âm**, **đổi điệu đệm** và **đổi cách hiện thực cùng một hợp âm**. Mọi phiên Composer là một Project nháp bền vững; đóng tab, đổi máy hoặc quay lại một bước không được làm mất brief, option, quyết định hay kết quả đã tạo.

### Luồng chỉnh voicing theo beat

1. Người dùng click một strong beat (hoặc chord-window marker) trên staff/timeline. Inspector đã biết `chordWindow`, chord hiện hành, melody activity/register, profile đang dùng, voicing hiện hành và các diagnostic tại vị trí đó.
2. Inspector mặc định mở danh sách **candidate cùng harmonic identity**: với Guitar là các thế tay/shape, inversion, bass note/capo hợp lệ; với Piano là các voicing LH/RH, inversion, spacing và octave placement hợp lệ. Không hiển thị một danh sách “Am” phẳng làm người dùng tưởng rằng mọi Am đều tương đương.
3. Người dùng nghe preview A/B trong loop ngắn bao quanh beat (mặc định 1 ô trước + 1 ô sau), rồi chọn một candidate. Mặc định chỉ áp dụng cho `chordWindow` đã chọn; menu scope cho phép mở rộng sang phrase/section khi người dùng chủ động chọn.
4. Renderer chỉ hiện thực lại phạm vi bị ảnh hưởng và validator chạy lại source/timing, singer-yield và physics của đúng nhạc cụ. Nếu voicing mới làm đứt continuity ở mép phạm vi, UI nêu rõ transition bị ảnh hưởng và đề nghị sửa beat kề hoặc mở rộng scope; không âm thầm đổi các ô khác.
5. Quyết định được lưu thành `VoicingOverride`, có `instrument`, `windowRange`, `baseChordIdentity`, `voicingId`, rationale/exception, validation report và revision nguồn. Nó không sửa `ApprovedHarmonySnapshot` và không đổi điệu/profile.

Ví dụ: tại strong beat đang là `Am`, Guitar có thể chọn `Am-open`, `Am-E-form-barre-f5`, hoặc một inversion hợp lệ. `Am-E-form-barre-f5` chỉ là candidate khi melodic register và lyric onset còn khoảng trống; chọn nó là thay đổi shape/register của Guitar, không phải đổi chord progression. Piano có thể giữ cùng Am nhưng chọn LH A2–E3 + RH C4–E4–A4, hoặc chuyển RH lên một octave/đổi inversion, miễn LH/RH, melody và hand span đều pass.

### Luồng đổi điệu/profile

Nút `Đổi điệu` là control độc lập, đặt ở section/timeline header chứ không lẫn vào chord inspector. Một click chọn profile hợp lệ theo meter sẽ render preview toàn section (hoặc whole song nếu chọn scope đó), giữ harmony timeline không đổi. Hệ thống phải cho nghe A/B trước/sau và hiển thị điều gì bị render lại. Các `VoicingOverride` còn phù hợp được giữ; override trở nên không hợp lệ phải được gắn review/stale có lý do, không bị xóa hay tự thay bằng voicing khác.

Không cho đổi profile chỉ tại một beat trong thao tác thường dùng, vì điều đó thường phá pulse của ca sĩ. Một điểm nhấn cục bộ thuộc density/accent/fill override và phải được gắn nhãn khác với `Đổi điệu`.

### Project nháp bền vững

Project lưu tối thiểu: song metadata/lyrics và Melody ABC; từng revision Harmony và snapshot đã chọn; brief/setup; input, raw output, normalized output, diagnostics và lựa chọn của từng run/step; profile plan, voicing plan/override, event/ABC/playback artefact của từng nhạc cụ; lineage và trạng thái current/stale/applied/published. Save phải có autosave có debounce, explicit checkpoint `Save version`, trạng thái `Saving/Saved/Offline changes`, và khôi phục từ revision đã chọn.

`localStorage` chỉ là cache/offline outbox và recovery nhanh, không phải nguồn duy nhất của Project hay nơi được phép prune input/output lịch sử. Publish vẫn là thao tác riêng: project draft có thể chứa mọi phương án và dữ liệu stale; Practice chỉ đọc artifact đã publish.
