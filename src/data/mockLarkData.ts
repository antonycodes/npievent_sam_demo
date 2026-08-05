/**
 * mockLarkData — Lark-record fixtures mirroring the real Lark base.
 *
 * **Master schema (2026-08-05):** the real base now consolidates `DS Tư vấn`/
 * `DS thu cũ`/`DS backup`/`DS Kho` into one `DS Master` table (a `Loại` column
 * distinguishes the type) and `Check in` → `Master_Check in` (same column
 * names). These fixtures use the new shared column names + `Loại` value so
 * mock mode matches `DEFAULT_DS_FIELDS`/`DEFAULT_DS_TYPE_FIELD` in
 * larkConfig.ts — see that file's module doc for the full picture.
 *
 * The DS registry tables include the "Status" block (STT/Trạng thái/Khách
 * gần nhất + Trạng thái hiện tại), which drives desk color and the popover.
 * Check in supplies product + payment note (joined by customer name).
 */
import type { LarkRecord, LarkTables } from '@/services/larkTypes';

interface DsRow {
  staff: string;
  received?: number;
  completed?: number;
  waiting?: number;
  sttRecent?: string;
  statusRecent?: string;
  customerRecent?: string;
  currentStatus: string; // "Đang tư vấn" | "Rảnh" | "Chưa có dữ liệu"
}

/** Build DS Master records for one cluster (`loai` = giá trị cột "Loại"). */
function dsRecords(prefix: string, loai: string, rows: DsRow[]): LarkRecord[] {
  return rows.map((r, i) => {
    const n = i + 1;
    return {
      record_id: `ds_${prefix}${n}`,
      fields: {
        'STT bàn': `${prefix}${n}`,
        Loại: loai,
        'NV Tư vấn': r.staff,
        'Sl TV đang tiếp nhận': r.received ?? 0,
        'Sl TV hoàn tất': r.completed ?? 0,
        'Sl khách chờ': r.waiting ?? 0,
        'STT gần nhất (helper)': r.sttRecent ?? '',
        'Trạng thái gần nhất (helper)': r.statusRecent ?? '',
        'Khách gần nhất (helper)': r.customerRecent ?? '',
        'Trạng thái hiện tại (kết quả chính)': r.currentStatus,
      },
    };
  });
}

// Cụm "Kỹ thuật" (KT) — vẫn đọc mã TC1-3 (nhãn hiển thị đổi thành KT), giờ là
// các dòng Loại="Thu cũ" trong DS Master.
const dsKythuat = dsRecords('TC', 'Thu cũ', [
  { staff: 'Thịnh_OPs', received: 1, sttRecent: '1', statusRecent: 'Tiếp nhận', customerRecent: 'Nguyễn Minh Long', currentStatus: 'Đang tư vấn' },
  { staff: 'SơnTrà_AppleMaster_AM&WS', received: 1, sttRecent: '2', statusRecent: 'Tiếp nhận', customerRecent: 'Huỳnh Ngọc Linh', currentStatus: 'Đang tư vấn' },
  { staff: 'LONG NHÂN_NV_AM&WS', received: 1, sttRecent: '3', statusRecent: 'Tiếp nhận', customerRecent: 'Phạm Đức Dũng', currentStatus: 'Đang tư vấn' },
  { staff: 'TIẾN THÀNH_NV_VHWS', received: 1, sttRecent: '4', statusRecent: 'Tiếp nhận', customerRecent: 'Dương Xuân Long', currentStatus: 'Đang tư vấn' },
  { staff: 'M Thành_CV_VHWS&AM', received: 1, sttRecent: '5', statusRecent: 'Tiếp nhận', customerRecent: 'Võ Xuân Phong', currentStatus: 'Đang tư vấn' },
  { staff: 'ĐLâm_AppleMaster_AM&WS', received: 1, completed: 1, waiting: -1, sttRecent: '7', statusRecent: 'Hoàn tất', customerRecent: 'Vũ Xuân Phong', currentStatus: 'Rảnh' },
]);

const dsConsult = dsRecords('TV', 'Tư vấn', [
  { staff: 'Dương Đình Hưng', sttRecent: '14', statusRecent: 'Hoàn tất', customerRecent: 'Huỳnh Ngọc Linh', currentStatus: 'Rảnh' },
  { staff: 'SơnTrà_AppleMaster_AM&WS', sttRecent: '10', statusRecent: 'Tiếp nhận', customerRecent: 'Phạm Đức Dũng', currentStatus: 'Đang tư vấn' },
  { staff: 'LONG NHÂN_NV_AM&WS', sttRecent: '12', statusRecent: 'Hoàn tất', customerRecent: 'Dương Xuân Long', currentStatus: 'Rảnh' },
  { staff: 'TIẾN THÀNH_NV_VHWS', sttRecent: '13', statusRecent: 'Tiếp nhận', customerRecent: 'Võ Xuân Phong', currentStatus: 'Đang tư vấn' },
  { staff: 'M Thành_CV_VHWS&AM', currentStatus: 'Chưa có dữ liệu' },
  { staff: 'ĐLâm_AppleMaster_AM&WS', currentStatus: 'Chưa có dữ liệu' },
]);

// Check-in master (8 customers) — product + payment note, joined by name.
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
// Giá trị "Status in <cụm>" nghĩa là đang được phục vụ ở cụm đó (khách không
// liên quan thì bỏ trống field — tương đương "Chưa tiếp nhận").
const TIEP_NHAN = 'Tiếp nhận';
// Khách vừa xong khâu đó — nguồn cho "Chờ điều phối" (quét theo Check-in).
const HOAN_TAT = 'Hoàn tất';

// "Thời gian" là mốc check-in (ms) — dùng để sắp khách trước/sau khi 1 NV
// phục vụ nhiều người cùng lúc. Khách checkin trước phải hiện trước.
const checkin: LarkRecord[] = [
  { record_id: 'ci_1', fields: { STT: 1, 'Họ và tên': 'Nguyễn Minh Long', 'SP 1': 'iPhone 17 Pro 512GB | Bạc', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'Thu cũ check': CO_THU_CU, 'End flow': IN_FLOW, 'Thời gian': 1000,
    'Status in thu cũ': TIEP_NHAN } },
  { record_id: 'ci_2', fields: { STT: 2, 'Họ và tên': 'Huỳnh Ngọc Linh', 'SP 1': 'iPhone 17 Pro Max 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'Thu cũ check': CO_THU_CU, 'End flow': END_FLOW, 'Thời gian': 2000 } },
  { record_id: 'ci_3', fields: { STT: 3, 'Họ và tên': 'Phạm Đức Dũng', 'SP 1': 'iPhone 17 Pro 512GB | Xanh Đậm', 'Note UDTT': 'VIB 1254', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'Thu cũ check': KHONG_THU_CU, 'End flow': IN_FLOW, 'Thời gian': 3000,
    'Status in tư vấn': TIEP_NHAN } },
  { record_id: 'ci_4', fields: { STT: 4, 'Họ và tên': 'Dương Xuân Long', 'SP 1': 'iPhone 17 Pro 256GB | Cam', 'Note UDTT': 'TCB 998434', 'Check nghiệm thu': DA_NGHIEM_THU, 'Thu cũ check': THU_CU_SAU, 'End flow': IN_FLOW, 'Thời gian': 4000 } },
  { record_id: 'ci_5', fields: { STT: 5, 'Họ và tên': 'Võ Xuân Phong', 'SP 1': 'iPhone 17 Pro Max 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 5000 } },
  { record_id: 'ci_6', fields: { STT: 6, 'Họ và tên': 'Vũ Xuân Phong', 'SP 1': 'iPhone 17 Pro 1TB | Xanh Đậm', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'Done in Flow': 'Thu cũ', 'End flow': IN_FLOW, 'Thời gian': 6000,
    // Demo "Chờ điều phối" — vừa hoàn tất Thu cũ, chưa được điều phối tiếp.
    'Status in thu cũ': HOAN_TAT } },
  { record_id: 'ci_7', fields: { STT: 7, 'Họ và tên': 'Lê Thanh My', 'SP 1': 'iPhone 17 Pro 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 7000 } },
  { record_id: 'ci_8', fields: { STT: 8, 'Họ và tên': 'Võ Thu Trang', 'SP 1': 'iPhone 17 Pro 512GB | Bạc', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 8000 } },
  // ci_9 / ci_10 — "bạn đồng hành", check-in SAU anchor nên phải hiện SAU trong danh sách (xem `master` bên dưới).
  { record_id: 'ci_9', fields: { STT: 9, 'Họ và tên': 'Hoàng Anh Tú', 'SP 1': 'iPhone 17 Pro 256GB | Đen', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 9000,
    'Status in thu cũ': TIEP_NHAN } },
  { record_id: 'ci_10', fields: { STT: 10, 'Họ và tên': 'Bùi Thanh Hà', 'SP 1': 'iPhone 17 Pro Max 512GB | Titan', 'Note UDTT': '', 'Check nghiệm thu': DA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 10000,
    'Status in tư vấn': TIEP_NHAN } },
  { record_id: 'ci_11', fields: { STT: 11, 'Họ và tên': 'Đặng Gia Hân', 'SP 1': 'iPhone 17 Pro 256GB | Cam', 'Note UDTT': '', 'Check nghiệm thu': CHUA_NGHIEM_THU, 'End flow': IN_FLOW, 'Thời gian': 11000 } },
];

// "Danh sách đơn hàng" — 20 đơn đã đăng ký (Số tổng). 8 người trong số đó đã
// check-in (bảng Check in). Chỉ cần số dòng để tính tỉ lệ.
const orders: LarkRecord[] = Array.from({ length: 20 }, (_, i) => ({
  record_id: `dh_${i + 1}`,
  fields: { 'Mã đơn hàng': `DH${1000 + i + 1}` },
}));

// "Master" — log NV tiếp nhận khách theo bàn (nguồn xác định khách đang ở bàn
// nào, xem larkMapper.ts's `indexMasterByDeskCode`). Demo "1 NV/bàn phục vụ 2
// khách cùng lúc": TC1 (Nguyễn Minh Long + Hoàng Anh Tú, check-in sau nên phải
// hiện sau) và TV2 (Phạm Đức Dũng + Bùi Thanh Hà). Các bàn khác (TC2/TC3/TV4)
// KHÔNG có dòng ở đây — cố tình, để verify nhánh fallback (DS "Khách gần
// nhất") vẫn hoạt động khi Master chưa kịp có dữ liệu cho bàn đó.
const master: LarkRecord[] = [
  { record_id: 'ma_1', fields: { 'TV_MãNV': 'TC1', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Nguyễn Minh Long', 'Thời gian': 1000 } },
  { record_id: 'ma_2', fields: { 'TV_MãNV': 'TC1', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Hoàng Anh Tú', 'Thời gian': 9000 } },
  { record_id: 'ma_3', fields: { 'TV_MãNV': 'TV2', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Phạm Đức Dũng', 'Thời gian': 3000 } },
  { record_id: 'ma_4', fields: { 'TV_MãNV': 'TV2', 'Trạng thái': TIEP_NHAN, 'Họ và tên': 'Bùi Thanh Hà', 'Thời gian': 10000 } },
];

export const mockLarkTables: LarkTables = { dsTradein: dsKythuat, dsConsult, checkin, orders, master };
