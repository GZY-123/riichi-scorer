import {
  YAKU_GROUPS,
  yakuGroupOf,
  yakuTable,
  YakuGroupTitle,
  YakuTableItem
} from "../../utils/yakuTable";

interface YakuReferenceRow extends YakuTableItem {
  key: string;
}

interface YakuReferenceGroup {
  title: YakuGroupTitle;
  items: YakuReferenceRow[];
}

const groups: YakuReferenceGroup[] = YAKU_GROUPS.map((title) => ({
  title,
  items: yakuTable
    .filter((item) => yakuGroupOf(item) === title)
    .map((item) => ({
      ...item,
      key: item.id
    }))
})).filter((group) => group.items.length > 0);

Page({
  data: {
    groups
  }
});

export {};
