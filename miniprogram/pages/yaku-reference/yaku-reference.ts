import {
  YAKU_GROUPS,
  yakuGroupOf,
  yakuTable,
  YakuGroupTitle,
  YakuTableItem
} from "../../utils/yakuTable";

interface YakuExampleTile {
  key: string;
  code: string;
  winning: boolean;
}

interface YakuReferenceRow extends YakuTableItem {
  key: string;
  exampleTiles: YakuExampleTile[];
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
      key: item.id,
      exampleTiles: item.example.map((code, index) => ({
        key: `${item.id}_${index}_${code}`,
        code,
        winning: index === item.example.length - 1
      }))
    }))
})).filter((group) => group.items.length > 0);

Page({
  data: {
    groups
  }
});

export {};
