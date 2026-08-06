/**
 * mockLarkData — Lark-record fixtures mirroring the real Lark base.
 *
 * **Schema (2026-08-05, "no DS Master" revision):** occupancy/staff/color +
 * "Chờ điều phối" all come from `Master` (`Trạng thái` = Tiếp nhận/Hoàn tất),
 * per-desk waiting count comes from `Master Điều phối`. `DS Master` is back
 * for exactly 1 field ("STT tiếp theo" per desk, tiếp theo 2026-08-05) — no
 * other field from it is used. See `larkMapper.ts`'s module doc for the full
 * pipeline (check-in → dispatch → master receive) and `larkConfig.ts` for
 * field names.
 *
 * Every OCCUPIED desk needs an explicit `master` row now — there's no DS
 * fallback anymore, so a desk with no `master` row is simply available.
 */
import type { LarkRecord, LarkTables } from '@/services/larkTypes';

// "Check nghiệm thu" là formula field bên Lark, trả về text dạng tag màu —
// "✅ Đã nghiệm thu (n) máy" / "❌ Chưa nghiệm thu máy" — không phải boolean thô.
const DA_NGHIEM_THU = '✅ Đã nghiệm thu (1) máy';
const CHUA_NGHIEM_THU = '❌ Chưa nghiệm thu máy';
// "Thu cũ check" là single-select (KHÁC với "Check nghiệm thu" ở trên — đã
// hay chưa nghiệm thu máy cũ ĐÓ, việc khác) — options tuỳ event, sự kiện này
// có 3: không thu / có thu / thu sau. Hiển thị nguyên văn, không rút gọn.
const KHONG_THU_CU = '❌ KHÔNG THU CŨ ❌';
const CO_THU_CU = '✅ CÓ THU CŨ ✅';
const THU_CU_SAU = '♻️ THU CŨ SAU ♻️';
// "Backup check" — cùng dạng single-select, hiển thị ngay dưới "Thu cũ check".
const KHONG_BACKUP = '❌ KHÔNG BACKUP ❌';
const CO_BACKUP = '✅ CÓ BACKUP ✅';

const IN_FLOW = 'In flow';
const END_FLOW = 'End flow';
const TIEP_NHAN = 'Tiếp nhận';
// Khách vừa xong khâu đó — nguồn cho "Chờ điều phối" (quét theo Check-in).
const HOAN_TAT = 'Hoàn tất';

// "Thời gian" là mốc check-in (ms) — dùng để sắp khách trước/sau khi 1 NV
// phục vụ nhiều người cùng lúc. Khách checkin trước phải hiện trước.
const checkin: LarkRecord[] = [
  { record_id: 'ci_1', fields: { STT: 1, 'Họ và tên': 'Nguyễn Minh Long', 'SP 1': 'iPhone 17 Pro 512GB | Bạc', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'Thu cũ check': CO_THU_CU, 'Backup check': KHONG_BACKUP, 'End flow': IN_FLOW, 'Thời gian': 1000 } },
  { record_id: 'ci_2', fields: { STT: 2, 'Họ và tên': 'Huỳnh Ngọc Linh', 'SP 1': 'iPhone 17 Pro Max 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'Thu cũ check': CO_THU_CU, 'Backup check': CO_BACKUP, 'End flow': END_FLOW, 'Thời gian': 2000 } },
  { record_id: 'ci_3', fields: { STT: 3, 'Họ và tên': 'Phạm Đức Dũng', 'SP 1': 'iPhone 17 Pro 512GB | Xanh Đậm', 'Note UDTT': 'VIB 1254', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'Thu cũ check': KHONG_THU_CU, 'Backup check': KHONG_BACKUP, 'End flow': IN_FLOW, 'Thời gian': 3000 } },
  { record_id: 'ci_4', fields: { STT: 4, 'Họ và tên': 'Dương Xuân Long', 'SP 1': 'iPhone 17 Pro 256GB | Cam', 'Note UDTT': 'TCB 998434', 'Check nghiệm thu': DA_NGHIEM_THU, 'Thu cũ check': THU_CU_SAU, 'End flow': IN_FLOW, 'Thời gian': 4000 } },
  { record_id: 'ci_5', fields: { STT: 5, 'Họ và tên': 'Võ Xuân Phong', 'SP 1': 'iPhone 17 Pro Max 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 5000 } },
  { record_id: 'ci_6', fields: { STT: 6, 'Họ và tên': 'Vũ Xuân Phong', 'SP 1': 'iPhone 17 Pro 1TB | Xanh Đậm', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'Done in Flow': 'Thu cũ', 'End flow': IN_FLOW, 'Thời gian': 6000 } },
  // Demo "Chờ điều phối" (khu chung) — vừa hoàn tất Thu cũ (xem dòng "Hoàn
  // tất" cho khách này trong `master` bên dưới), chưa được điều phối vào bàn
  // nào cả (không có dòng ở `dispatch` bên dưới).
  { record_id: 'ci_7', fields: { STT: 7, 'Họ và tên': 'Lê Thanh My', 'SP 1': 'iPhone 17 Pro 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 7000 } },
  { record_id: 'ci_8', fields: { STT: 8, 'Họ và tên': 'Võ Thu Trang', 'SP 1': 'iPhone 17 Pro 512GB | Bạc', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 8000 } },
  // ci_9 / ci_10 — "bạn đồng hành", check-in SAU anchor nên phải hiện SAU trong danh sách (xem `master` bên dưới).
  { record_id: 'ci_9', fields: { STT: 9, 'Họ và tên': 'Hoàng Anh Tú', 'SP 1': 'iPhone 17 Pro 256GB | Đen', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 9000 } },
  { record_id: 'ci_10', fields: { STT: 10, 'Họ và tên': 'Bùi Thanh Hà', 'SP 1': 'iPhone 17 Pro Max 512GB | Titan', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 10000 } },
  { record_id: 'ci_11', fields: { STT: 11, 'Họ và tên': 'Đặng Gia Hân', 'SP 1': 'iPhone 17 Pro 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'Done in Flow': 'Tư vấn', 'End flow': IN_FLOW, 'Thời gian': 11000 } },
  // Demo bug thật user báo 2026-08-06: dòng "Hoàn tất" trong `master` bị bỏ
  // trống "TV_MãNV" — xem `ma_11` bên dưới, phải suy mã bàn qua "Người" +
  // `dsMaster`'s "NV Tư vấn" mới hiện đúng ở "Chờ điều phối" (TV8).
  { record_id: 'ci_12', fields: { STT: 12, 'Họ và tên': 'Lâm Bảo Ngọc', 'SP 1': 'iPhone 17 Pro 256GB | Titan', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'Done in Flow': 'Tư vấn', 'End flow': IN_FLOW, 'Thời gian': 12500 } },
  // Demo bug thật user báo 2026-08-06 (tiếp): "TV_MãNV" KHÔNG rỗng nhưng trả
  // về mã option Lark thô ("opt...") thay vì "TV5" — xem `ma_12` bên dưới.
  { record_id: 'ci_13', fields: { STT: 13, 'Họ và tên': 'Trịnh Bảo Châu', 'SP 1': 'iPhone 17 Pro 512GB | Bạc', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 13000 } },
  // Demo bug thật user báo 2026-08-06 (tiếp): "TV_MãNV" là mã option thô
  // NHƯNG NV đó có ≥ 2 dòng trong `dsMaster` (Thu cũ + Backup) — phải lấy
  // đúng dòng Thu cũ, không lấy nhầm dòng Backup — xem `ma_13` bên dưới.
  { record_id: 'ci_14', fields: { STT: 14, 'Họ và tên': 'Lý Gia Bảo', 'SP 1': 'iPhone 17 Pro 256GB | Đen', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 14000 } },
];

// "Danh sách đơn hàng" — 20 đơn đã đăng ký (Số tổng). 8 người trong số đó đã
// check-in (bảng Check in). Chỉ cần số dòng để tính tỉ lệ.
const orders: LarkRecord[] = Array.from({ length: 20 }, (_, i) => ({
  record_id: `dh_${i + 1}`,
  fields: { 'Mã đơn hàng': `DH${1000 + i + 1}` },
}));

// "Master" — log NV tiếp nhận khách theo bàn (nguồn xác định khách đang ở
// bàn nào + tên NV, xem larkMapper.ts's `indexMasterByDeskCode`). Demo "1
// NV/bàn phục vụ 2 khách cùng lúc": TC1 (Nguyễn Minh Long + Hoàng Anh Tú) và
// TV2 (Phạm Đức Dũng + Bùi Thanh Hà) — sắp đúng thứ tự theo "Thời gian".
//
// Demo "Backup giao cho cả Tư vấn lẫn Thu cũ" (2026-08-06, 2 lớp):
//   1. `ma_4` — user cho biết quy ước CỐ ĐỊNH: BK1..8 = TV1..8, BK11..13 =
//      TC1..3 (NV Tư vấn/Thu cũ làm Backup vẫn NGỒI ĐÚNG bàn của mình). Mã
//      "BK3" map TRỰC TIẾP → TV3 (`BK_TO_DESK`), KHÔNG qua NV nữa (dù NV phụ
//      trách "SơnTrà_AppleMaster_AM&WS" có bàn chính là TC2 — không liên
//      quan, vì đã có map trực tiếp từ chính mã bàn).
//   2. `ma_13` — trường hợp THỰC TẾ hơn: API trả mã option THÔ (không phải
//      chữ "BK..." thật, xem `isUnresolvedOptionId`) nên không map trực tiếp
//      được, phải rơi về fallback qua NV — cùng NV "SơnTrà_AppleMaster_AM&WS"
//      nhưng lần này phải lấy đúng dòng Thu cũ (TC2, `dsm_5`) trong `DS
//      Master`, KHÔNG lấy dòng Backup (`dsm_6`) — xác nhận bộ lọc "Loại"
//      vẫn hoạt động đúng dù `BK_TO_DESK` đã có ở trên.
const master: LarkRecord[] = [
  { record_id: 'ma_1', fields: { 'TV_MãNV': 'TC1', 'Trạng thái': TIEP_NHAN, 'Loại 2': 'Thu cũ', 'Họ và tên': 'Nguyễn Minh Long', 'Người': 'Thịnh_OPs', 'Thời gian': 1000 } },
  { record_id: 'ma_2', fields: { 'TV_MãNV': 'TC1', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Hoàng Anh Tú', 'Người': 'Thịnh_OPs', 'Thời gian': 9000 } },
  { record_id: 'ma_3', fields: { 'TV_MãNV': 'TC2', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Huỳnh Ngọc Linh', 'Người': 'SơnTrà_AppleMaster_AM&WS', 'Thời gian': 2000 } },
  { record_id: 'ma_4', fields: { 'TV_MãNV': 'BK3', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Dương Xuân Long', 'Người': 'SơnTrà_AppleMaster_AM&WS', 'Thời gian': 4000 } },
  { record_id: 'ma_13', fields: { 'TV_MãNV': 'optZ9fQwLk', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Lý Gia Bảo', 'Người': 'SơnTrà_AppleMaster_AM&WS', 'Thời gian': 14500 } },
  { record_id: 'ma_5', fields: { 'TV_MãNV': 'TV2', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Phạm Đức Dũng', 'Người': 'TIẾN THÀNH_NV_VHWS', 'Thời gian': 3000 } },
  { record_id: 'ma_6', fields: { 'TV_MãNV': 'TV2', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Bùi Thanh Hà', 'Người': 'TIẾN THÀNH_NV_VHWS', 'Thời gian': 10000 } },
  { record_id: 'ma_7', fields: { 'TV_MãNV': 'TV4', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Võ Xuân Phong', 'Người': 'M Thành_CV_VHWS&AM', 'Thời gian': 5000 } },
  // Vũ Xuân Phong (STT6) đã được tiếp nhận & xong ở TC1 trước đó (Trạng thái
  // "Hoàn tất" — không tính vào occupancy) — bắt buộc phải có dòng này thì
  // "everSeenNames" mới nhận ra đã từng xuất hiện, tránh hiện trùng ở cả khu
  // "Chờ check-in" lẫn "Chờ điều phối" cùng lúc (đây là invariant thật: 1
  // khách "Hoàn tất" 1 khâu luôn có ít nhất 1 dòng Master trước đó).
  { record_id: 'ma_8', fields: { 'TV_MãNV': 'TC1', 'Trạng thái': HOAN_TAT, 'Họ và tên': 'Vũ Xuân Phong', 'Người': 'Thịnh_OPs', 'Thời gian': 5500 } },
  // Demo bug thật user báo 2026-08-05: Đặng Gia Hân (STT11) được NV tại TV1
  // tiếp nhận (dòng "Tiếp nhận" cũ, KHÔNG bị xoá khi xong việc), rồi sau đó
  // được ghi nhận Hoàn tất bằng 1 DÒNG MỚI (không phải sửa lại dòng cũ) —
  // đúng cách Lark của user ghi dữ liệu. Nếu chỉ lọc "có dòng nào Tiếp nhận"
  // (logic cũ) thì TV1 sẽ hiện nhầm là đang bận với khách đã xong từ lâu.
  { record_id: 'ma_9', fields: { 'TV_MãNV': 'TV1', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Đặng Gia Hân', 'Người': 'Dương Đình Hưng', 'Thời gian': 11500 } },
  { record_id: 'ma_10', fields: { 'TV_MãNV': 'TV1', 'Trạng thái': HOAN_TAT, 'Họ và tên': 'Đặng Gia Hân', 'Người': 'Dương Đình Hưng', 'Thời gian': 12000 } },
  // Demo bug thật user báo 2026-08-06: NV ghi "Hoàn tất" nhưng bỏ trống cột
  // "TV_MãNV" (không có key này luôn, giống hệt JSON thật user gửi) — CHỈ có
  // "Người". Phải suy mã bàn qua `dsMaster` (staff "Đình Bảo_NV_VHWS" → TV8).
  { record_id: 'ma_11', fields: { 'Trạng thái': HOAN_TAT, 'Họ và tên': 'Lâm Bảo Ngọc', 'Người': 'Đình Bảo_NV_VHWS', 'Thời gian': 12800 } },
  // Demo bug thật user báo 2026-08-06 (tiếp): NV ghi nhận đầy đủ, "TV_MãNV"
  // CÓ giá trị nhưng là mã option Lark thô (field single-select dùng options
  // ĐỘNG, xem `larkMapper.ts`'s `isUnresolvedOptionId`) — phải coi như KHÔNG
  // có giá trị rồi rơi về fallback qua NV "THIỆU NHÂN_NV_VHWS" → TV5
  // (`dsm_4` bên dưới), KHÔNG được dùng thẳng "opt6TDHxPP" làm khoá bàn.
  { record_id: 'ma_12', fields: { 'TV_MãNV': 'opt6TDHxPP', 'Trạng thái': TIEP_NHAN, 'Loại 2': 'Backup', 'Họ và tên': 'Trịnh Bảo Châu', 'Người': 'THIỆU NHÂN_NV_VHWS', 'Thời gian': 13500 } },
];

// "Master Điều phối" — khách đã được gán vào 1 bàn cụ thể, CHƯA có dòng
// "Tiếp nhận" tương ứng trong `master` ở trên → đếm vào badge "khách đang
// chờ" của đúng bàn đó. Demo 2 trường hợp: TV4 (đã có 1 khách đang tiếp nhận
// + 1 khách nữa đang chờ) và TV6 (bàn trống nhưng đã có người được gán, chờ
// NV nhận). `dp_3` demo cột "DS Backup" (2026-08-06) — hiện ở dòng "Nhân sự"
// trong popover khách (Hoàng Anh Tú, đang ngồi TC1) dù không liên quan tới
// đếm "khách đang chờ" (chỉ đọc DS Tư vấn/DS Thu cũ cho việc đó).
// `dp_4` demo bug thật user báo 2026-08-06: Huỳnh Ngọc Linh (STT2) đã "End
// flow" (xong toàn bộ, xem `ci_2`) nhưng dòng điều phối vào TV7 chưa/không
// bị xoá — TV7 KHÔNG được tính "khách đang chờ" nữa (cả badge trên sơ đồ
// lẫn "STT tiếp theo" ở QueueBoard /tuvanview), xem larkMapper.ts + queueMapper.ts.
const dispatch: LarkRecord[] = [
  { record_id: 'dp_1', fields: { 'DS Tư vấn': 'TV4', 'Họ và tên': 'Lê Thanh My' } },
  { record_id: 'dp_2', fields: { 'DS Tư vấn': 'TV6', 'Họ và tên': 'Võ Thu Trang' } },
  { record_id: 'dp_3', fields: { 'DS Backup': 'BK2', 'Họ và tên': 'Hoàng Anh Tú' } },
  { record_id: 'dp_4', fields: { 'DS Tư vấn': 'TV7', 'Họ và tên': 'Huỳnh Ngọc Linh' } },
  // Cùng khách qua 3 dòng/3 khâu: mapper phải cộng dồn thành
  // (TV1)(TC2)(BK1), không để dòng cuối ghi đè mất hai khâu trước. DS Backup
  // dùng mã bàn chính TV1 để kiểm tra bước chuẩn hoá hiển thị TV1 → BK1.
  { record_id: 'dp_5', fields: { 'DS Tư vấn': 'TV1', 'Họ và tên': 'Nguyễn Minh Long' } },
  { record_id: 'dp_6', fields: { 'DS Thu cũ': 'TC2', 'Họ và tên': 'Nguyễn Minh Long' } },
  { record_id: 'dp_7', fields: { 'DS Backup': 'TV1', 'Họ và tên': 'Nguyễn Minh Long' } },
];

// "DS Master" — CHỈ đọc 3 field: "STT tiếp theo" mỗi bàn, "NV Tư vấn" +
// "Loại" (dự phòng suy mã bàn CHÍNH — 2026-08-06, xem larkMapper.ts's
// `indexDeskCodeByStaffName`, CHỈ lấy dòng "Loại"="Tư vấn"/"Thu cũ", bỏ qua
// "Backup"). Mọi field khác của bảng này không dùng, xem larkConfig.ts's
// module doc. Demo đúng 2 bàn đang có khách chờ (TV4/TV6) — giá trị khớp STT
// của khách đang chờ ở `dispatch`. `dsm_3`/`dsm_4` demo NV↔bàn chính dùng cho
// `ma_11`/`ma_12` ở trên. `dsm_5`+`dsm_6` demo ĐÚNG 1 NV có CẢ bàn chính (Thu
// cũ, TC2) lẫn 1 dòng Backup riêng (BK2) — dùng cho `ma_13` (Lý Gia Bảo, mã
// option thô) phải quy về TC2 (dòng Thu cũ), TUYỆT ĐỐI không lấy "BK2" — xác
// nhận đúng cơ chế lọc "Loại", không phải trùng hợp do chỉ có 1 dòng.
const dsMaster: LarkRecord[] = [
  { record_id: 'dsm_1', fields: { 'STT bàn': 'TV4', 'STT tiếp theo': '7' } },
  { record_id: 'dsm_2', fields: { 'STT bàn': 'TV6', 'STT tiếp theo': '8' } },
  { record_id: 'dsm_3', fields: { 'STT bàn': 'TV8', 'NV Tư vấn': 'Đình Bảo_NV_VHWS', 'Loại': 'Tư vấn' } },
  { record_id: 'dsm_4', fields: { 'STT bàn': 'TV5', 'NV Tư vấn': 'THIỆU NHÂN_NV_VHWS', 'Loại': 'Tư vấn' } },
  { record_id: 'dsm_5', fields: { 'STT bàn': 'TC2', 'NV Tư vấn': 'SơnTrà_AppleMaster_AM&WS', 'Loại': 'Thu cũ' } },
  { record_id: 'dsm_6', fields: { 'STT bàn': 'BK2', 'NV Tư vấn': 'SơnTrà_AppleMaster_AM&WS', 'Loại': 'Backup' } },
];

export const mockLarkTables: LarkTables = { checkin, orders, master, dispatch, dsMaster };
