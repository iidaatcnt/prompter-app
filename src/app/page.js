'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

export default function Home() {
  const [scriptText, setScriptText] = useState('皆様こんにちは！\n今日はお知らせがありまして、動画を回しています。\n実は、私がずっと開発を続けてきた新しいアプリが、ついに完成しました。\nこのアプリを使えば、毎日の面倒な作業が、驚くほど簡単になります。\n詳しくはキャプションに書いているので、ぜひチェックしてみてくださいね。\n最後はスペースキーを押して終了してください。');
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [mode, setMode] = useState('voice'); // 'voice' or 'auto'
  const [autoSpeed, setAutoSpeed] = useState('normal'); // 'slow', 'normal', 'fast'
  const [isPausedByMouse, setIsPausedByMouse] = useState(false);

  const displayAreaRef = useRef(null);
  const activeWordRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastProcessedTranscriptRef = useRef('');

  // Intl.Segmenter を使って文を単語レベルで分割（対応していないブラウザは1文字ずつ）
  // これにより「文字単位のハイライト」から「単語・フレーズ単位のハイライト」になります
  const words = useMemo(() => {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('ja-JP', { granularity: 'word' });
      return Array.from(segmenter.segment(scriptText)).map(s => s.segment);
    }
    return scriptText.split('');
  }, [scriptText]);

  // 音声認識のセットアップ
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ja-JP';

        recognition.onresult = (event) => {
          if (!isRunning || mode !== 'voice') return;

          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }

          // 句読点や空白を除去して純粋な文字だけにする
          const cleanTranscript = transcript.replace(/[\s、。！？\n]/g, "");

          if (cleanTranscript.length > 0) {
            setCurrentIndex((prev) => {
              // 少し長めのフレーズ（直近の3〜4文字以上）で検索し、「してください」などでの飛びすぎを防ぐ
              const searchStr = cleanTranscript.length >= 4
                ? cleanTranscript.slice(-4)
                : cleanTranscript.length >= 3
                  ? cleanTranscript.slice(-3)
                  : cleanTranscript.slice(-2);

              // 検索する範囲を現在地から「30文字先まで」に限定することで、
              // 文章のずっと後ろにある同じ言葉（してください 等）に突然ジャンプするのを防ぎます
              const lookAheadChars = 30;

              let foundIdx = -1;
              let tempStr = "";
              let charCount = 0;
              let parenDepth = 0;

              for (let i = prev; i < words.length; i++) {
                const word = words[i];
                charCount += word.length;
                if (charCount > lookAheadChars) break; // 遠すぎる場合は検索を打ち切る

                for (let char of word) {
                  if (char === '(' || char === '（' || char === '【' || char === '［' || char === '[') parenDepth++;
                  if (parenDepth === 0 && !/[\s、。！？\n]/.test(char)) tempStr += char;
                  if (char === ')' || char === '）' || char === '】' || char === '］' || char === ']') {
                    if (parenDepth > 0) parenDepth--;
                  }
                }

                if (tempStr.includes(searchStr) && searchStr.length > 0) {
                  foundIdx = i;
                  break;
                }
              }

              if (foundIdx !== -1 && foundIdx > prev) {
                lastProcessedTranscriptRef.current = cleanTranscript;
                return foundIdx;
              }

              return prev;
            });
          }
        };

        recognition.onend = () => {
          // 音声認識が勝手に途切れた場合は再開する（実行中かつ音声モードの場合）
          if (isRunning && mode === 'voice') {
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
  }, [isRunning, mode, words]);

  // モードごとの実行管理（マイクの起動/停止など）
  useEffect(() => {
    if (isRunning) {
      if (mode === 'voice') {
        lastProcessedTranscriptRef.current = '';
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) { console.log(e); }
        }
      }
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) { console.log(e); }
      }
    }
  }, [isRunning, mode]);

  // 自動スクロールモードのタイマー処理
  useEffect(() => {
    if (!isRunning || mode !== 'auto' || isPausedByMouse) return;

    // スピードに応じた1分あたりの読字数（CPM）
    const cpm = autoSpeed === 'slow' ? 200 : autoSpeed === 'fast' ? 450 : 300;
    const msPerChar = 60000 / cpm; // 1文字あたりの待機ミリ秒

    if (currentIndex >= words.length) {
      handleStop();
      return;
    }

    const currentWord = words[currentIndex];
    const charCount = currentWord.trim().length === 0 ? 1 : currentWord.length;

    // 単語の文字数 × 1文字の待機時間 の分だけ停止してから次の単語へ
    const delay = Math.max(msPerChar * charCount, 50);

    const timer = setTimeout(() => {
      setCurrentIndex(prev => Math.min(prev + 1, words.length));
    }, delay);

    return () => clearTimeout(timer);
  }, [isRunning, mode, autoSpeed, currentIndex, words, isPausedByMouse]);


  // 今読んでいる単語（currentIndex）が変わるたびにスクロールを調整する
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
      if (currentIndex >= words.length - 1) {
        setCurrentIndex(0);
      }
      setIsRunning(true);

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
    e.stopPropagation();
    setCurrentIndex(index);
    lastProcessedTranscriptRef.current = '';
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName.toLowerCase() === 'textarea') return;

      if (e.code === 'Space') {
        e.preventDefault();

        if (showHelp) {
          setShowHelp(false);
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
      {!isRunning && <h1 className="title">べしゃりのカンペ君</h1>}

      {!isRunning && (
        <section className="control-panel">
          <textarea
            className="scriptInput"
            placeholder="ここにセリフを貼り付けてください..."
            rows={5}
            value={scriptText}
            onChange={handleTextChange}
          ></textarea>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button className="btn btn-primary" onClick={handleStart} style={{ flex: 3, padding: '15px', fontSize: '1.2rem' }}>
                ▶ スタートする
              </button>
              <button className="btn btn-secondary" onClick={() => setShowHelp(true)} style={{ flex: 1 }}>
                ヘルプ
              </button>
            </div>

            <div style={{ padding: '10px 15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem', color: '#333' }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '0.85rem', color: '#666' }}>スクロール設定</div>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="scrollSetting"
                    checked={mode === 'voice'}
                    onChange={() => setMode('voice')}
                    style={{ marginRight: '5px' }}
                  />
                  🎤 自動(AI音声追従)
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="scrollSetting"
                    checked={mode === 'auto' && autoSpeed === 'fast'}
                    onChange={() => { setMode('auto'); setAutoSpeed('fast'); }}
                    style={{ marginRight: '5px' }}
                  />
                  ⏱️ 早口
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="scrollSetting"
                    checked={mode === 'auto' && autoSpeed === 'normal'}
                    onChange={() => { setMode('auto'); setAutoSpeed('normal'); }}
                    style={{ marginRight: '5px' }}
                  />
                  ⏱️ 普通
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="scrollSetting"
                    checked={mode === 'auto' && autoSpeed === 'slow'}
                    onChange={() => { setMode('auto'); setAutoSpeed('slow'); }}
                    style={{ marginRight: '5px' }}
                  />
                  ⏱️ ゆっくり
                </label>
              </div>
            </div>
          </div>

          {mode === 'voice' && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffeeba', color: '#856404', textAlign: 'center' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>🎙️ マイクへのアクセス許可が必要です</p>
              <p style={{ fontSize: '0.9rem' }}>
                ※ 初回開始時にブラウザからマイクの許可を求められますので「許可」をお願いします。<br />
                【スペースキー】で素早くスタート・終了ができます。
              </p>
            </div>
          )}
        </section>
      )}

      {/* 実行中のみプロンプター画面を表示 */}
      {isRunning && (
        <section
          className={`display-area ${isPausedByMouse ? 'paused' : ''}`}
          ref={displayAreaRef}
          onMouseDown={() => setIsPausedByMouse(true)}
          onMouseUp={() => setIsPausedByMouse(false)}
          onMouseLeave={() => setIsPausedByMouse(false)}
          onTouchStart={() => setIsPausedByMouse(true)}
          onTouchEnd={() => setIsPausedByMouse(false)}
        >
          <div className="fullscreen-hint">
            【スペースキー: 終了】 / 【テキスト外を長押し: 一時停止】 / 【文字をタップ: ジャンプ】
          </div>

          <div className="text-container">
            {words.map((chunk, i) => {
              if (chunk === '\n') {
                return <br key={i} />;
              }
              return (
                <span
                  key={i}
                  ref={i === currentIndex ? activeWordRef : null}
                  className={`word ${i === currentIndex ? 'active' : ''} ${i < currentIndex ? 'past' : ''}`}
                  onClick={(e) => handleWordClick(e, i)}
                  style={{ cursor: 'pointer', display: 'inline-block' }}
                >
                  {chunk.replace(/ /g, '\u00A0')}
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
              <li><strong> モード選択について:</strong> <br />【声で進める】はマイクを利用してあなたの速度に合わせます。【自動一定スクロール】は話すスピードとは無関係に、「ゆっくり・普通・早め」の一定速度で流れます（話すのが苦手な方におすすめです）。</li>
              <li><strong> 実行中のクリック・タップ機能:</strong> <br />プロンプター実行中に、画面上の任意の単語をマウスでクリックまたはタップすると、現在地が一瞬でジャンプします（言い直す時などに便利です）。</li>
              <li><strong> 演出メモの記載テクニック:</strong> <br />原稿内の「（笑顔で）」や「【ゆっくり】」などの括弧書きは、AIが音声認識の対象外として賢く無視します。</li>
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
