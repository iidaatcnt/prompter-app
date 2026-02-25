'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [scriptText, setScriptText] = useState('こんにちは。\n今日はInstagramのリール撮影で使える、\n新しいプロンプターアプリのテストを行っています。\n\n音声認識モードを搭載し、話すスピードに合わせて\nアプリが自動的に読む場所を追いかけてくれます。\n\n実行中はフルスクリーンになり、\n目線を上げたままで自然に話せます。\n画面をタップ（またはクリック）すると終了します。');
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

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
              const lookAhead = Math.min(prev + 40, words.length); // 40文字先まで探す

              let foundIdx = -1;
              for (let i = prev; i < lookAhead; i++) {
                // スクリプトから空白・改行を除外した文字列のかたまりを作る
                const sliceFromWords = words.slice(i, i + searchStr.length).join('').replace(/[\s、。！？\n]/g, "");
                // そのかたまりと認識した2文字を雑に突き合わせる
                if (sliceFromWords === searchStr && searchStr.length > 0) {
                  foundIdx = i + searchStr.length - 1;
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

  return (
    <div className="app">
      {!isRunning && <h1 className="title">Reels Prompter 😎</h1>}

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
            <button className="btn btn-primary" onClick={handleStart} style={{ flex: 2, padding: '15px', fontSize: '1.2rem' }}>
              🎤 音声認識でスタートする
            </button>
            <button className="btn btn-secondary" onClick={() => setCurrentIndex(0)} style={{ flex: 1 }}>
              🔄 リセット
            </button>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '15px', textAlign: 'center' }}>
            ※ Google Chrome または Safari でご利用ください。マイクへのアクセス許可が必要です。<br />
            実行中は文字のエリアが全画面表示になります。
          </p>
        </section>
      )}

      {/* 実行中は display-area を全画面化するクラスを付与 */}
      <section
        className={`display-area ${isRunning ? 'fullscreen' : ''}`}
        ref={displayAreaRef}
        onClick={isRunning ? handleStop : undefined}
      >
        {isRunning && (
          <div className="fullscreen-hint">文字をタップでジャンプ / 何もない所をタップで終了</div>
        )}
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
                onClick={isRunning ? (e) => handleWordClick(e, i) : undefined}
                style={isRunning ? { cursor: 'pointer' } : {}}
              >
                {char}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
