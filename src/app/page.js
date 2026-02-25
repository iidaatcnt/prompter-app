'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [scriptText, setScriptText] = useState('こんにちは。今日はInstagramのリール撮影で使える、\n新しいプロンプターアプリのテストを行っています。\n\nこのように、自分が読むべき文字がカラオケのようにハイライトされ、\n自動で上にスクロールしていきます。\n\n目線をカメラに固定したまま、自然な笑顔で話すことができるようになります！');
  const [speed, setSpeed] = useState(250);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const displayAreaRef = useRef(null);
  const activeWordRef = useRef(null);

  // 文字列を1文字ずつ分割。改行やスペースも要素として含む
  const words = scriptText.split('');

  useEffect(() => {
    let intervalId = null;
    if (isRunning && words.length > 0) {
      const intervalMs = 60000 / speed; // 1文字あたりのミリ秒

      intervalId = setInterval(() => {
        setCurrentIndex((prevCount) => {
          if (prevCount < words.length - 1) {
            return prevCount + 1;
          } else {
            setIsRunning(false); // 最後まで来たらストップ
            return prevCount;
          }
        });
      }, intervalMs);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRunning, speed, words.length]);

  // 今読んでいる文字（currentIndex）が変わるたびにスクロールを調整する
  useEffect(() => {
    if (activeWordRef.current && displayAreaRef.current) {
      const container = displayAreaRef.current;
      const activeWord = activeWordRef.current;

      // 目線を中央〜少し上あたりに固定するための計算
      // activeWordのY座標 - コンテナの高さの半分の位置
      const targetScrollTop = activeWord.offsetTop - (container.clientHeight / 2 - 50);

      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    } else if (currentIndex === 0 && displayAreaRef.current) {
      // リセット時はトップに戻す
      displayAreaRef.current.scrollTo(0, 0);
    }
  }, [currentIndex]);

  const handleStart = () => {
    if (words.length > 0) {
      if (currentIndex >= words.length - 1) {
        // 読み終わっていたら最初から
        setCurrentIndex(0);
      }
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentIndex(0);
  };

  const handleTextChange = (e) => {
    setScriptText(e.target.value);
    setCurrentIndex(0);
    setIsRunning(false);
  };

  return (
    <div className="app">
      <h1 className="title">Reels Prompter 😎</h1>

      <section className="control-panel">
        <textarea
          className="scriptInput"
          placeholder="ここにセリフを貼り付けてください..."
          rows={4}
          value={scriptText}
          onChange={handleTextChange}
        ></textarea>

        <div className="settings">
          <label htmlFor="speedRange">スピード（CPM）: <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{speed}</span> 文字/分</label>
          <input
            type="range"
            id="speedRange"
            min="100"
            max="600"
            step="10"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </div>

        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
          <button className="btn btn-primary" onClick={handleStart} disabled={isRunning} style={{ flex: 2 }}>
            ▶ スタートする
          </button>
          <button className="btn btn-secondary" onClick={handlePause} disabled={!isRunning} style={{ flex: 1 }}>
            ⏸ 一時停止
          </button>
          <button className="btn btn-secondary" onClick={handleReset} style={{ flex: 1 }}>
            🔄 リセット
          </button>
        </div>
      </section>

      <section className="display-area" ref={displayAreaRef}>
        <div className="text-container">
          {words.map((char, i) => {
            if (char === '\n') {
              return <br key={i} />;
            }
            return (
              <span
                key={i}
                ref={i === currentIndex ? activeWordRef : null}
                className={`word ${i === currentIndex ? 'active' : ''}`}
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
