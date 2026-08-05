/**
 * mockLarkData — Lark-record fixtures mirroring the real Lark base.
 *
 * **Schema (2026-08-05, "no DS Master" revision):** occupancy/staff/color
 * come from `Master` (`indexMasterByDeskCode`), per-desk waiting count comes
 * from `Master Điều phối` (`indexDispatchByDeskCode`) — no more `DS *`
 * registry table. See `larkMapper.ts`'s module doc for the full pipeline
 * (check-in → dispatch → master receive) and `larkConfig.ts` for field names.
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

const IN_FLOW = 'In flow';
const END_FLOW = 'End flow';
const TIEP_NHAN = 'Tiếp nhận';
// Khách vừa xong khâu đó — nguồn cho "Chờ điều phối" (quét theo Check-in).
const HOAN_TAT = 'Hoàn tất';

// "Thời gian" là mốc check-in (ms) — dùng để sắp khách trước/sau khi 1 NV
// phục vụ nhiều người cùng lúc. Khách checkin trước phải hiện trước.
const checkin: LarkRecord[] = [
  { record_id: 'ci_1', fields: { STT: 1, 'Họ và tên': 'Nguyễn Minh Long', 'SP 1': 'iPhone 17 Pro 512GB | Bạc', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'Thu cũ check': CO_THU_CU, 'End flow': IN_FLOW, 'Thời gian': 1000 } },
  { record_id: 'ci_2', fields: { STT: 2, 'Họ và tên': 'Huỳnh Ngọc Linh', 'SP 1': 'iPhone 17 Pro Max 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'Thu cũ check': CO_THU_CU, 'End flow': END_FLOW, 'Thời gian': 2000 } },
  { record_id: 'ci_3', fields: { STT: 3, 'Họ và tên': 'Phạm Đức Dũng', 'SP 1': 'iPhone 17 Pro 512GB | Xanh Đậm', 'Note UDTT': 'VIB 1254', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'Thu cũ check': KHONG_THU_CU, 'End flow': IN_FLOW, 'Thời gian': 3000 } },
  { record_id: 'ci_4', fields: { STT: 4, 'Họ và tên': 'Dương Xuân Long', 'SP 1': 'iPhone 17 Pro 256GB | Cam', 'Note UDTT': 'TCB 998434', 'Check nghiệm thu': DA_NGHIEM_THU, 'Thu cũ check': THU_CU_SAU, 'End flow': IN_FLOW, 'Thời gian': 4000 } },
  { record_id: 'ci_5', fields: { STT: 5, 'Họ và tên': 'Võ Xuân Phong', 'SP 1': 'iPhone 17 Pro Max 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 5000 } },
  { record_id: 'ci_6', fields: { STT: 6, 'Họ và tên': 'Vũ Xuân Phong', 'SP 1': 'iPhone 17 Pro 1TB | Xanh Đậm', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'Done in Flow': 'Thu cũ', 'End flow': IN_FLOW, 'Thời gian': 6000,
    // Demo "Chờ điều phối" (khu chung) — vừa hoàn tất Thu cũ, chưa được điều phối vào bàn nào cả (không có dòng ở `dispatch` bên dưới).
    'Status in thu cũ': HOAN_TAT } },
  { record_id: 'ci_7', fields: { STT: 7, 'Họ và tên': 'Lê Thanh My', 'SP 1': 'iPhone 17 Pro 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 7000 } },
  { record_id: 'ci_8', fields: { STT: 8, 'Họ và tên': 'Võ Thu Trang', 'SP 1': 'iPhone 17 Pro 512GB | Bạc', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 8000 } },
  // ci_9 / ci_10 — "bạn đồng hành", check-in SAU anchor nên phải hiện SAU trong danh sách (xem `master` bên dưới).
  { record_id: 'ci_9', fields: { STT: 9, 'Họ và tên': 'Hoàng Anh Tú', 'SP 1': 'iPhone 17 Pro 256GB | Đen', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 9000 } },
  { record_id: 'ci_10', fields: { STT: 10, 'Họ và tên': 'Bùi Thanh Hà', 'SP 1': 'iPhone 17 Pro Max 512GB | Titan', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 10000 } },
  { record_id: 'ci_11', fields: { STT: 11, 'Họ và tên': 'Đặng Gia Hân', 'SP 1': 'iPhone 17 Pro 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 11000 } },
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
const master: LarkRecord[] = [
  { record_id: 'ma_1', fields: { 'TV_MãNV': 'TC1', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Nguyễn Minh Long', 'Người': 'Thịnh_OPs', 'Thời gian': 1000 } },
  { record_id: 'ma_2', fields: { 'TV_MãNV': 'TC1', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Hoàng Anh Tú', 'Người': 'Thịnh_OPs', 'Thời gian': 9000 } },
  { record_id: 'ma_3', fields: { 'TV_MãNV': 'TC2', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Huỳnh Ngọc Linh', 'Người': 'SơnTrà_AppleMaster_AM&WS', 'Thời gian': 2000 } },
  { record_id: 'ma_4', fields: { 'TV_MãNV': 'TC3', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Dương Xuân Long', 'Người': 'LONG NHÂN_NV_AM&WS', 'Thời gian': 4000 } },
  { record_id: 'ma_5', fields: { 'TV_MãNV': 'TV2', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Phạm Đức Dũng', 'Người': 'TIẾN THÀNH_NV_VHWS', 'Thời gian': 3000 } },
  { record_id: 'ma_6', fields: { 'TV_MãNV': 'TV2', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Bùi Thanh Hà', 'Người': 'TIẾN THÀNH_NV_VHWS', 'Thời gian': 10000 } },
  { record_id: 'ma_7', fields: { 'TV_MãNV': 'TV4', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Võ Xuân Phong', 'Người': 'M Thành_CV_VHWS&AM', 'Thời gian': 5000 } },
  // Vũ Xuân Phong (STT6) đã được tiếp nhận & xong ở TC1 trước đó (Trạng thái
  // "Hoàn tất" — không tính vào occupancy) — bắt buộc phải có dòng này thì
  // "everSeenNames" mới nhận ra đã từng xuất hiện, tránh hiện trùng ở cả khu
  // "Chờ check-in" lẫn "Chờ điều phối" cùng lúc (đây là invariant thật: 1
  // khách "Hoàn tất" 1 khâu luôn có ít nhất 1 dòng Master trước đó).
  { record_id: 'ma_8', fields: { 'TV_MãNV': 'TC1', 'Trạng thái': HOAN_TAT, 'Họ và tên': 'Vũ Xuân Phong', 'Người': 'Thịnh_OPs', 'Thời gian': 5500 } },
];

// "Master Điều phối" — khách đã được gán vào 1 bàn cụ thể, CHƯA có dòng
// "Tiếp nhận" tương ứng trong `master` ở trên → đếm vào badge "khách đang
// chờ" của đúng bàn đó. Demo 2 trường hợp: TV4 (đã có 1 khách đang tiếp nhận
// + 1 khách nữa đang chờ) và TV6 (bàn trống nhưng đã có người được gán, chờ
// NV nhận).
const dispatch: LarkRecord[] = [
  { record_id: 'dp_1', fields: { 'DS Tư vấn': 'TV4', 'Họ và tên': 'Lê Thanh My' } },
  { record_id: 'dp_2', fields: { 'DS Tư vấn': 'TV6', 'Họ và tên': 'Võ Thu Trang' } },
];

export const mockLarkTables: LarkTables = { checkin, orders, master, dispatch };
