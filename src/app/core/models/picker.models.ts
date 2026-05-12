/**
 * Mirrors the C# `PickerItemDto` returned by every
 * `/api/FilterPickers/*` endpoint. Bilingual name + opaque secondary
 * label so each picker can show role / phone / etc. next to the row.
 */
export interface PickerItem {
  id: string;
  nameEn: string;
  nameAr: string;
  extra: string;
}
