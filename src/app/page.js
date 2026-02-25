'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [scriptText, setScriptText] = useState('皆様こんにちは！\n今日はお知らせがありまして、動画を回しています。\n実は、私がずっと開発を続けてきた新しいアプリが、ついに完成しました。\nこのアプリを使えば、毎日の面倒な作業が、驚くほど簡単になります。\n詳しくはキャプションに書いているので、ぜひチェックしてみてくださいね。\n最後はスペースキーを押して終了してください。');
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const displayAreaRef = useRef(null);
  const activeWordRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastProcessedTranscriptRef = useRef('');

  // 文字列を1文字ずつ分割。改行やスペースも要素として含む
  const words = scriptText.split('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ja-JP';

        recognition.onresult = (event) => {
          if (!isRunning) return;

          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }

          // 句読点や空白を除去して純粋な文字だけにする
          const cleanTranscript = transcript.replace(/[\s、。！？\n]/g, "");

          if (cleanTranscript.length > 0) {
            setCurrentIndex((prev) => {
              // 簡易的なトラッキング：
              // 直近で認識した最後の2文字を取得し、現在地から先にあるか探す
              const searchStr = cleanTranscript.length >= 2 ? cleanTranscript.slice(-2) : cleanTranscript;
              const lookAhead = Math.min(prev + 50, words.length); // 50文字先まで探す

              let foundIdx = -1;
              for (let i = prev; i < lookAhead; i++) {
                let tempStr = "";
                let parenDepth = 0;
                let j = i;

                // searchStrの長さ分だけ、意味のある文字（括弧外）を取得する
                while (j < words.length && tempStr.length < searchStr.length) {
                  const char = words[j];
                  // 括弧の開始判定
                  if (char === '(' || char === '（' || char === '【' || char === '［' || char === '[') {
                    parenDepth++;
                  }

                  // 括弧の外で、かつ無視する記号でなければ追加
                  if (parenDepth === 0 && !/[\s、。！？\n]/.test(char)) {
                    tempStr += char;
                  }

                  // 括弧の終了判定 (追加処理の後に判定することで、閉じ括弧自体も追加されないようにする)
                  if (char === ')' || char === '）' || char === '】' || char === '］' || char === ']') {
                    if (parenDepth > 0) parenDepth--;
                  }
                  j++;
                }

                if (tempStr === searchStr && searchStr.length > 0) {
                  foundIdx = j - 1;
                  break;
                }
              }

              if (foundIdx !== -1 && foundIdx > prev) {
                lastProcessedTranscriptRef.current = cleanTranscript;
                return foundIdx;
              }

              // 見つからなかったら、シンプルに認識された文字数分だけ進める
              const newlyRecognizedCount = Math.max(0, cleanTranscript.length - lastProcessedTranscriptRef.current.length);
              lastProcessedTranscriptRef.current = cleanTranscript;

              // 誤認識で一気に飛びすぎないように、1回のジャンプを制限
              if (newlyRecognizedCount > 0 && newlyRecognizedCount <= 12) {
                return Math.min(prev + newlyRecognizedCount, words.length - 1);
              }
              return prev;
            });
          }
        };

        recognition.onend = () => {
          // 音声認識が勝手に途切れた場合は再開する（実行中の場合）
          if (isRunning) {
            setTimeout(() => {
              try {
                if (recognitionRef.current) recognitionRef.current.start();
              } catch (e) { console.error("音声認識の再起失敗", e); }
            }, 300);
          }
        };

        recognitionRef.current = recognition;
      } else {
        console.error("このブラウザは音声認識APIに対応していません");
      }
    }
  }, [isRunning, words]);

  useEffect(() => {
    if (isRunning) {
      lastProcessedTranscriptRef.current = '';
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) { console.log(e); }
      }
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) { console.log(e); }
      }
    }
  }, [isRunning]);

  // 今読んでいる文字（currentIndex）が変わるたびにスクロールを調整する
  useEffect(() => {
    if (activeWordRef.current && displayAreaRef.current) {
      const container = displayAreaRef.current;
      const activeWord = activeWordRef.current;

      const targetScrollTop = activeWord.offsetTop - (container.clientHeight / 2 - 50);

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    } else if (currentIndex === 0 && displayAreaRef.current) {
      displayAreaRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [currentIndex]);

  const handleStart = () => {
    if (words.length > 0) {
      // 読み終わっていたら最初から
      if (currentIndex >= words.length - 1) {
        setCurrentIndex(0);
      }
      setIsRunning(true);

      // おまけ：ブラウザのフルスクリーン機能を呼び出す（対応している場合）
      try {
        if (displayAreaRef.current?.requestFullscreen && !document.fullscreenElement) {
          displayAreaRef.current.requestFullscreen().catch(err => console.log(err));
        }
      } catch (e) { }
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
      }
    } catch (e) { }
  };

  const handleTextChange = (e) => {
    setScriptText(e.target.value);
    setCurrentIndex(0);
    setIsRunning(false);
  };

  const handleWordClick = (e, index) => {
    e.stopPropagation(); // 画面全体のタップ（終了）イベントが発火するのを防ぐ
    setCurrentIndex(index); // クリックした文字のインデックスに強制ジャンプ
    lastProcessedTranscriptRef.current = ''; // 音声認識のバッファをクリアして再スタート
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // テキストエリアに入力中はスペースキーを無視する
      if (e.target.tagName.toLowerCase() === 'textarea') return;

      if (e.code === 'Space') {
        e.preventDefault(); // 画面がスクロールしてしまうのを防ぐ

        if (showHelp) {
          setShowHelp(false); // ヘルプが開いている場合は閉じる
          return;
        }

        if (isRunning) {
          handleStop();
        } else {
          handleStart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, currentIndex, words.length, showHelp]);

  return (
    <div className="app">
      {!isRunning && <h1 className="title">Reels Prompter</h1>}

      {!isRunning && (
        <section className="control-panel">
          <textarea
            className="scriptInput"
            placeholder="ここにセリフを貼り付けてください..."
            rows={5}
            value={scriptText}
            onChange={handleTextChange}
          ></textarea>

          <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
            <button className="btn btn-primary" onClick={handleStart} style={{ flex: 3, padding: '15px', fontSize: '1.2rem' }}>
              ▶ スタートする
            </button>
            <button className="btn btn-secondary" onClick={() => setShowHelp(true)} style={{ flex: 1 }}>
              ヘルプ
            </button>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '15px', textAlign: 'center' }}>
            ※ Google Chrome または Safari でご利用ください。マイクへのアクセス許可が必要です。<br />
            【スペースキー】で素早くスタート・終了ができます。
          </p>
        </section>
      )}

      {/* 実行中のみプロンプター画面を表示 */}
      {isRunning && (
        <section
          className="display-area"
          ref={displayAreaRef}
        >
          <div className="fullscreen-hint">【スペースキー】で一時停止・終了 / 文字をタップでジャンプ</div>

          <div className="text-container">
            {words.map((char, i) => {
              if (char === '\n') {
                return <br key={i} />;
              }
              return (
                <span
                  key={i}
                  ref={i === currentIndex ? activeWordRef : null}
                  className={`word ${i === currentIndex ? 'active' : ''} ${i < currentIndex ? 'past' : ''}`}
                  onClick={(e) => handleWordClick(e, i)}
                  style={{ cursor: 'pointer' }}
                >
                  {char}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* ヘルプモーダル */}
      {showHelp && (
        <div className="help-modal" onClick={() => setShowHelp(false)}>
          <div className="help-content" onClick={(e) => e.stopPropagation()}>
            <h2>📖 使い方ヘルプ</h2>
            <ul>
              <li><strong>【スペースキー】で開始・停止・閉じる:</strong> <br />設定画面やヘルプ画面でスペースキーを押すと即座に開始・終了（閉じる）ができます。</li>
              <li><strong> AI音声自動追従:</strong> <br />あなたが話すスピードをAIがリアルタイムに聞き取り、文字のハイライト（黄色）と自動スクロールを行います。</li>
              <li><strong> 文字タップでジャンプ機能:</strong> <br />アドリブ等でAIが迷子になった時は、画面上の任意の文字をタップしてください。一瞬でその場所にジャンプしてAIが追従を復帰します。最初からやり直したい時も、先頭の文字をタップすればOKです。</li>
              <li><strong> 演出メモの記載テクニック:</strong> <br />原稿内の「（笑顔で）」や「【ゆっくり】」などの括弧書きは、AIが音声認識の対象外として賢く無視します。画面越しに見る自分への注釈・演技メモとして活用してください。</li>
              <li><strong> 推奨される文字数:</strong> <br />Instagramリール（約1分間）の撮影の場合、大体<strong>300文字〜400文字程度</strong>を目安に原稿（テキスト）を入力するのが丁度よい分量でおすすめです。</li>
            </ul>
            <div style={{ textAlign: 'center' }}>
              <button className="btn btn-primary" onClick={() => setShowHelp(false)} style={{ padding: '10px 40px', fontSize: '1.2rem' }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
