# べしゃりのカンペ君 開発者向け仕様書 (SPEC.md)

本ドキュメントは「べしゃりのカンペ君（Reels Prompter / Prompter App）」のアーキテクチャや機能の内部仕様についてまとめたものです。開発や機能追加の際の参考にしてください。

## ⚙️ テックスタック

- **Framework**: Next.js (React 18以降) App Router環境 (Client Componentとして動作: `'use client'`)
- **Speech API**: `window.SpeechRecognition` (Web Speech API)
- **Text Analysis**: `Intl.Segmenter` (日本語の単語レベルでのセグメンテーション)
- **Styling**: `globals.css` によるVanilla CSS (一部インラインスタイル使用)
- **Deploy**: Vercel

---

## 🛠️ 主な機能と要素技術

### 1. 音声追従ロジック (AI Speech Tracking)
Webブラウザに標準搭載されている `SpeechRecognition`（Chrome向けは `webkitSpeechRecognition`）を利用し、マイクから入力された音声を連続的にテキスト変換して照合します。

**具体的なマッチングアルゴリズム**:
1. `Intl.Segmenter` で入力されたスクリプトを「単語」ごとに分割。
2. 返却された `transcript`（認識結果の文字列）から、空白や句読点(`[\s、。！？\n]`)を除去し、純粋な文字列化(`cleanTranscript`)を行う。
3. `cleanTranscript` の末尾数文字（3〜4文字）を検索ワードとして使用。
4. 現在のハイライト位置(`currentIndex`) から前方約30文字の範囲内で検索を実行。
   - **ポイント**: 同じ言葉（「ぜひ」「です」など）があとから登場したときに突然末尾にジャンプしてしまう誤動作（飛びすぎ）を防ぐため、照合する文字範囲の「LookAhead」制限を意図的に設けています。
5. カッコ書き`( ) [ ] 【 】`に囲まれた文字（演技指導や演出メモ等）は、検索用テキストを作る際にスキップされ、音声認識では完全に無視される仕様です。

### 2. スクロールおよび速度制御モード (Auto Scrolling)
`useEffect` と `setTimeout` を使用して、指定したCPM（1分あたりの読字数：Characters Per Minute）に基づいて次の文字までの待機時間を動的計算しています。

- **[ゆっくり: slow]**: 200 CPM
- **[普通: normal]**: 300 CPM
- **[早め: fast]**: 450 CPM
- 各文字の描画待機時間は `60000ms / CPM * 単語の文字数` にて計算されます。
- `isPausedByMouse` ステートを挟み、`onMouseDown/Up/Leave` やタップ系イベントと連動させることで、利用者が画面を触っている間だけタイマー進行を停止（ピン留め機能）させています。

### 3. オートスクロール（追従追尾）の仕組み
`currentIndex`（現在発話中、またはハイライトされている要素のインデックス）が変化するたびに、対象となる DOM 要素の `offsetTop` の位置を取得し、画面中央(やや上寄り)に常に位置するように `displayAreaRef.current.scrollTo` にて `smooth` 移動させています。

### 4. フルスリーンとショートカットキー
- **【スペースキー】**:
  - 設定画面・ヘルプ画面では即座にフルスクリーン＆開始（`handleStart`またはモーダル閉じる）
  - 実行画面（プロンプター動作中）では即座にフルスクリーン解除＆終了（`handleStop`）
  - `document.addEventListener('keydown')` でリッスンし、`textarea` への入力中は無視されます。
- **フルスケール実行**:
  - `displayAreaRef.current.requestFullscreen()` を使用して、ブラウザの邪魔なUIを消し、カメラの真下に集中できるようにしています。

---

## 📂 状態管理（State Management）
主に `src/app/page.js` にて以下の `useState` と `useRef` を管理する単一ページ（SPAライク）構造です。

- **state**:
  - `scriptText`: ユーザーが入力した原稿データ（デフォルト文字列あり）
  - `isRunning`: プロンプターが起動中（フルスクリーン表示）かどうかのフラグ
  - `currentIndex`: 現在フォーカスが当たっている単語（配列 `words` のインデックス）
  - `mode`: `'voice'` (音声認識) または `'auto'` (等速自動スクロール)
  - `autoSpeed`: `'slow'`, `'normal'`, `'fast'` のいずれか
  - `isPausedByMouse`: クリック/タップの長押しによる一時停止状態
  - `showHelp`: ヘルプモーダルの表示フラグ

- **refs**:
  - `displayAreaRef`: スクロールコンテナ要素への参照（スクロール操作やフルスクリーン化で使用）
  - `activeWordRef`: 現在ハイライトされている単語の span 要素への参照（位置計算に用いる）
  - `recognitionRef`: `SpeechRecognition` インスタンス（予期せぬ停止時の再起動制御用）

---

## 📝 今後の拡張・方針等
- 現在は `Intl.Segmenter` による簡易的なパースを行なっていますが、カタカナや英単語が連続するスクリプトでの精度向上などの余地があります。
- `localStorage` を使用して、再訪問時に前に書いていた原稿（`scriptText`）を永続化する機能を追加すると、ユーザー体験がさらに向上します。
- Next.js側の不要なバックエンド機能は使っておらず、完全なStatic Client Appとして動作するため、どのような静的ホスティング基盤にも容易に移行可能です。
