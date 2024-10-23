---
- title: EntityのGroup化
- author: https://github.com/Kiikurage
- issue: https://github.com/Kiikurage/drawing2/issues/19
---

# EntityのGroup化

## 課題・要件・達成したいこと

- ２つ以上のEntityをGroup化して扱う
    - 変形操作
    - プロパティの指定
- Group化されたEntityは一括選択することができる
- Group化されたEntityの一部のみを操作することもできる
- Groupは入れ子にすることができる
- Group化を解除し、個別のEntityに戻すことができる
- 入れ子のGroupは一段階ずつ解除される
- Group内の一部のEntityが削除された結果Group内のEntityが１つになった場合、Group化を自動的に解除する
- Group全体を選択しCopy&Pasteした場合、Groupが複製され、複製されたEntityは新しいGroupに属する
- Group内の一部のEntityを選択してCopy&Pasteした場合、Entityは個別に複製され、Groupは複製されない

## 解決案

### A. GroupEntity with child entity IDs

- GroupはGroupEntityとして表す
- Group化されたEntityのIDを持つ

```
page.entities = {
    GroupEntity(id=0, children=[1,2]),
    PathEntity(id=1),
    PathEntity(id=2),
    PathEntity(id=3),
}
page.objectIds = [0, 1, 2, 3]
```

### B. Only GroupEntity in objectIds

- GroupはGroupEntityとして表す
- Group化されたEntityのIDを持つ
- Group化されたEntityはpage.entitiesから取り除かれる

```
page.entities = {
    GroupEntity(id=0, children=[1,2]),
    PathEntity(id=1),
    PathEntity(id=2),
    PathEntity(id=3),
}
page.objectIds = [0, 3]
```

### C. GroupEntity with child entities

- GroupはGroupEntityとして表す
- GroupEntityはGroup化されたEntityの実体を持ち、
  Group化されたEntityはpage.entitiesから取り除かれる

```
page.entities = {
    GroupEntity(id=0, children=[
        PathEntity(id=1),
        PathEntity(id=2),
    ]),
    PathEntity(id=3),
}
page.objectIds = [0, 3]
```

## 比較・評価

|                 | A | B | C |
|-----------------|---|---|---|
| グループの作成 | ✅ 容易 | ✅容易 | ✅容易 |
| グループの解除 | ✅ 容易 | ✅容易 | ✅容易 |
| 描画 | ⚠️ 表示の際にGroupEntityとそれ以外の表示の切り分け方が非自明 | ✅容易 | ✅容易 |
| グループの選択 | ⚠️ 選択したEntityがグループに属している場合、グループ全体を選択するなどの処理が必要 | ✅容易 | ✅容易 |
| グループ内のEntityの選択 | ✅容易 | ✅容易 | ✅容易 |
| グループの入れ子 | ✅容易 | ✅容易 | ✅容易 |
| グループの解除 | ✅容易 | ✅容易 | ✅容易 |
| グループ内のEntityの削除 | ⚠️ グループの逆引きが必要 | ⚠️ グループの逆引きが必要 | ⚠️ グループの逆引きが必要 |
| グループの自動解除 | ✅容易 | ✅容易 | ✅容易 | 
| グループの複製 | ✅容易 | ✅容易 | ✅容易 |
| グループ内のEntityの複製 | ✅容易 | ✅容易 | ✅容易 |
| EntityIDからのEntityの検索 | ✅容易 | ✅容易 | ⚠️トップレベル以外のEntityが検索できない |

- AはEntityがトップレベルかグループに属しているかの判定が別途必要となるため他よりも処理が複雑になる
- CはトップレベルのEntityしかPage.entitiesから検索できなくなるため一部の処理において複雑さが増す
- EntityIDから属しているグループを逆引きすることはどの解決策でも難しいため別途対応が必要

## 決定

- B. Only GroupEntity in objectIds を採用する
- 「EntityIDから属しているグループの逆引き」は愚直に全検索する
    - パフォーマンスに問題があれば例えばキャッシュなどで後から対応可能

