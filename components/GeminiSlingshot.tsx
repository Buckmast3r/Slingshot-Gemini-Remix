
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getStrategicHint, TargetCandidate } from '../services/geminiService';
import { Point, Bubble, Particle, BubbleColor, DebugInfo, GameMode, StrategicHint } from '../types';
import { 
  Loader2, Zap, BrainCircuit, Play, MousePointerClick, Wallet, Terminal, 
  Coins, AlertTriangle, Target, Lightbulb, TrendingUp, Sparkles, Flame, 
  Info, CheckCircle2, XCircle, ChevronRight, Hand
} from 'lucide-react';

// Threshold for detection
const PINCH_THRESHOLD = 0.08; 
const BUBBLE_RADIUS = 22;
const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3);
const GRID_COLS = 12;
const GRID_ROWS = 8;
const SLINGSHOT_BOTTOM_OFFSET = 220;
const MAX_DRAG_DIST = 180;

const MULTIPLIERS: Record<BubbleColor, { hex: string, mult: number, label: string }> = {
  red:    { hex: '#ff5252', mult: 1.2, label: 'Standard' },
  blue:   { hex: '#2196f3', mult: 2.0, label: 'Premium' },
  green:  { hex: '#4caf50', mult: 3.5, label: 'Elite' },
  yellow: { hex: '#ffeb3b', mult: 5.0, label: 'VIP' },
  purple: { hex: '#e040fb', mult: 10.0, label: 'Grand' },
  orange: { hex: '#ff9100', mult: 25.0, label: 'JACKPOT' }
};

const COLOR_KEYS: BubbleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

const GeminiSlingshot: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  const ballPos = useRef<Point>({ x: 0, y: 0 });
  const ballVel = useRef<Point>({ x: 0, y: 0 });
  const anchorPos = useRef<Point>({ x: 0, y: 0 });
  const isPinching = useRef<boolean>(false);
  const isFlying = useRef<boolean>(false);
  const bubbles = useRef<Bubble[]>([]);
  const particles = useRef<Particle[]>([]);
  
  // Casino State
  const [balance, setBalance] = useState(1000);
  const [currentBet, setCurrentBet] = useState(10);
  const [gameMode, setGameMode] = useState<GameMode>('BETTING');
  const [bonusTimer, setBonusTimer] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);

  // Interaction Feedback
  const [handDetected, setHandDetected] = useState(false);

  // Sync refs for the game loop
  const balanceRef = useRef(balance);
  const currentBetRef = useRef(currentBet);
  const bonusTimerRef = useRef(bonusTimer);
  const isLoadedRef = useRef(isLoaded);
  const showTutorialRef = useRef(showTutorial);
  
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { currentBetRef.current = currentBet; }, [currentBet]);
  useEffect(() => { bonusTimerRef.current = bonusTimer; }, [bonusTimer]);
  useEffect(() => { isLoadedRef.current = isLoaded; }, [isLoaded]);
  useEffect(() => { showTutorialRef.current = showTutorial; }, [showTutorial]);

  // AI State
  const [aiHint, setAiHint] = useState<StrategicHint | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [selectedColor, setSelectedColor] = useState<BubbleColor>('red');
  const [availableColors, setAvailableColors] = useState<BubbleColor[]>([]);

  const selectedColorRef = useRef<BubbleColor>('red');
  const captureRequestRef = useRef<boolean>(false);

  useEffect(() => { selectedColorRef.current = selectedColor; }, [selectedColor]);

  const initGrid = useCallback((width: number) => {
    const newBubbles: Bubble[] = [];
    for (let r = 0; r < 5; r++) { 
      for (let c = 0; c < (r % 2 !== 0 ? GRID_COLS - 1 : GRID_COLS); c++) {
        if (Math.random() > 0.15) {
            const xOffset = (width - (GRID_COLS * BUBBLE_RADIUS * 2)) / 2 + BUBBLE_RADIUS;
            const isOdd = r % 2 !== 0;
            const x = xOffset + c * (BUBBLE_RADIUS * 2) + (isOdd ? BUBBLE_RADIUS : 0);
            const y = BUBBLE_RADIUS + r * ROW_HEIGHT;
            newBubbles.push({
              id: `${r}-${c}`, row: r, col: c, x, y,
              color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
              active: true
            });
        }
      }
    }
    bubbles.current = newBubbles;
    updateAvailableColors();
  }, []);

  const updateAvailableColors = () => {
    const activeColors = new Set<BubbleColor>();
    bubbles.current.forEach(b => { if (b.active) activeColors.add(b.color); });
    setAvailableColors(Array.from(activeColors) as BubbleColor[]);
  };

  const handleBet = () => {
    if (balance >= currentBet) {
      setBalance(prev => prev - currentBet);
      setIsLoaded(true);
      setGameMode('PLAYING');
      captureRequestRef.current = true;
    }
  };

  const handleBonusBuy = () => {
    const cost = currentBet * 100;
    if (balance >= cost) {
      setBalance(prev => prev - cost);
      setBonusTimer(15);
      setLastWin(0); 
    } else {
        alert("Insufficient balance for Feature Buy!");
    }
  };

  const performAiAnalysis = async (screenshot: string) => {
    setIsAiThinking(true);
    const maxRow = bubbles.current.reduce((max, b) => b.active ? Math.max(max, b.row) : max, 0);
    const targets: TargetCandidate[] = bubbles.current
        .filter(b => b.active)
        .map(b => ({
            id: b.id, color: b.color, size: 3, row: b.row, col: b.col,
            multiplier: MULTIPLIERS[b.color].mult, description: `Row ${b.row}`
        }));

    const result = await getStrategicHint(screenshot, targets, maxRow, bonusTimerRef.current > 0);
    setAiHint(result.hint);
    if (result.hint.recommendedColor) {
        setSelectedColor(result.hint.recommendedColor);
    }
    setIsAiThinking(false);
  };

  const checkMatches = (startBubble: Bubble) => {
    const toCheck = [startBubble];
    const visited = new Set<string>();
    const matches: Bubble[] = [];
    const targetColor = startBubble.color;

    while (toCheck.length > 0) {
      const current = toCheck.pop()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      if (current.color === targetColor) {
        matches.push(current);
        const neighbors = bubbles.current.filter(b => b.active && !visited.has(b.id) && isNeighbor(current, b));
        toCheck.push(...neighbors);
      }
    }

    if (matches.length >= 3) {
      const baseMult = MULTIPLIERS[targetColor].mult;
      const bonusMult = bonusTimerRef.current > 0 ? 2 : 1;
      const winAmount = Math.floor(currentBetRef.current * baseMult * bonusMult * (matches.length / 3));
      
      matches.forEach(b => {
        b.active = false;
        createExplosion(b.x, b.y, MULTIPLIERS[b.color].hex);
      });

      if (targetColor === 'orange') {
        setBonusTimer(15);
      }

      setBalance(prev => prev + winAmount);
      setLastWin(winAmount);
      updateAvailableColors();
      return true;
    }
    return false;
  };

  const isNeighbor = (a: Bubble, b: Bubble) => {
    const dr = Math.abs(b.row - a.row);
    const dc = Math.abs(b.col - a.col);
    return dr <= 1 && dc <= 1;
  };

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 20; i++) {
      particles.current.push({
        x, y, vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15,
        life: 1.0, color
      });
    }
  };

  useEffect(() => {
    if (bonusTimer > 0) {
        const timer = setInterval(() => setBonusTimer(p => Math.max(0, p - 1)), 1000);
        return () => clearInterval(timer);
    }
  }, [bonusTimer]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !gameContainerRef.current) return;
    const canvas = canvasRef.current;
    const container = gameContainerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    anchorPos.current = { x: canvas.width / 2, y: canvas.height - SLINGSHOT_BOTTOM_OFFSET };
    ballPos.current = { ...anchorPos.current };
    initGrid(canvas.width);

    let hands: any = null;
    let camera: any = null;
    let isActive = true;

    const onResults = (results: any) => {
      if (!isActive) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Slingshot Frame
      const forkWidth = 70;
      const forkHeight = 100;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Slingshot "Y" Frame
      ctx.strokeStyle = '#2d2d4d';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(anchorPos.current.x, anchorPos.current.y + 160);
      ctx.lineTo(anchorPos.current.x, anchorPos.current.y + 60);
      ctx.lineTo(anchorPos.current.x - forkWidth, anchorPos.current.y - forkHeight);
      ctx.moveTo(anchorPos.current.x, anchorPos.current.y + 60);
      ctx.lineTo(anchorPos.current.x + forkWidth, anchorPos.current.y - forkHeight);
      ctx.stroke();

      // Slingshot Neon Glow
      ctx.strokeStyle = isLoadedRef.current ? '#8b5cf6' : '#4b4b7a';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw Grid
      bubbles.current.forEach(b => {
        if (!b.active) return;
        const conf = MULTIPLIERS[b.color];
        const grad = ctx.createRadialGradient(b.x-5, b.y-5, 2, b.x, b.y, BUBBLE_RADIUS);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, conf.hex);
        grad.addColorStop(1, '#000');
        ctx.beginPath(); ctx.arc(b.x, b.y, BUBBLE_RADIUS-1, 0, Math.PI*2);
        ctx.fillStyle = grad; ctx.fill();
        
        if (b.color === 'orange') {
            ctx.shadowBlur = 10; ctx.shadowColor = '#ff9100';
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            ctx.shadowBlur = 0;
        }
      });

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0 && !showTutorialRef.current) {
        setHandDetected(true);
        const lm = results.multiHandLandmarks[0];
        
        // CORRECTION: Use lm.x directly because CSS mirror already handles the horizontal flip.
        // If the user's hand is physically right, camera x is 0, canvas x is 0, which is visually right on mirrored canvas.
        const pX = lm[8].x * canvas.width;
        const pY = lm[8].y * canvas.height;
        
        // Distance between index (8) and thumb (4)
        const dist = Math.sqrt((lm[8].x-lm[4].x)**2 + (lm[8].y-lm[4].y)**2 + (lm[8].z-lm[4].z)**2);

        // Visual feedback for fingertips
        const drawFinger = (idx: number, isPinching: boolean) => {
            const fX = lm[idx].x * canvas.width;
            const fY = lm[idx].y * canvas.height;
            ctx.shadowBlur = 15;
            ctx.shadowColor = isPinching ? '#fff' : '#8b5cf6';
            ctx.fillStyle = isPinching ? '#fff' : 'rgba(139, 92, 246, 0.6)';
            ctx.beginPath(); ctx.arc(fX, fY, isPinching ? 8 : 12, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
        };

        const currentlyPinching = dist < PINCH_THRESHOLD;
        drawFinger(4, currentlyPinching); // Thumb
        drawFinger(8, currentlyPinching); // Index

        if (currentlyPinching && isLoadedRef.current && !isFlying.current) {
            isPinching.current = true;
            const dx = pX - anchorPos.current.x;
            const dy = pY - anchorPos.current.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            const scale = Math.min(d, MAX_DRAG_DIST) / (d || 1);
            ballPos.current = { x: anchorPos.current.x + dx*scale, y: anchorPos.current.y + dy*scale };
        } else if (isPinching.current) {
            isPinching.current = false;
            isFlying.current = true;
            setIsLoaded(false);
            const dx = anchorPos.current.x - ballPos.current.x;
            const dy = anchorPos.current.y - ballPos.current.y;
            ballVel.current = { x: dx * 0.22, y: dy * 0.22 }; // Slightly snappier
        }
      } else {
          setHandDetected(false);
          // Auto-return if hand lost during pinch
          if (isPinching.current) {
            isPinching.current = false;
            ballPos.current = { ...anchorPos.current };
          }
      }

      if (isFlying.current) {
          ballPos.current.x += ballVel.current.x;
          ballPos.current.y += ballVel.current.y;
          
          let hit = false;
          bubbles.current.forEach(b => {
              if (!b.active) return;
              if (Math.sqrt((ballPos.current.x-b.x)**2 + (ballPos.current.y-b.y)**2) < BUBBLE_RADIUS*1.8) hit = true;
          });
          if (ballPos.current.y < 0 || ballPos.current.x < 0 || ballPos.current.x > canvas.width) hit = true;

          if (hit) {
              isFlying.current = false;
              const newB: Bubble = { id: Date.now().toString(), row: 0, col: 0, x: ballPos.current.x, y: ballPos.current.y, color: selectedColorRef.current, active: true };
              bubbles.current.push(newB);
              checkMatches(newB);
              ballPos.current = { ...anchorPos.current };
              setGameMode('BETTING');
          }
      }

      // Draw Slingshot Bands
      if (!isFlying.current) {
        ctx.strokeStyle = isLoadedRef.current ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = isPinching.current ? 4 : 8;
        ctx.beginPath(); 
        ctx.moveTo(anchorPos.current.x - forkWidth, anchorPos.current.y - forkHeight); 
        ctx.lineTo(ballPos.current.x, ballPos.current.y); 
        ctx.lineTo(anchorPos.current.x + forkWidth, anchorPos.current.y - forkHeight); 
        ctx.stroke();
      }
      
      // Slingshot Ball
      const ballConf = MULTIPLIERS[selectedColorRef.current];
      ctx.shadowBlur = isPinching.current ? 30 : 0;
      ctx.shadowColor = ballConf.hex;
      ctx.fillStyle = isLoadedRef.current ? ballConf.hex : 'rgba(100,100,100,0.2)';
      ctx.beginPath(); ctx.arc(ballPos.current.x, ballPos.current.y, BUBBLE_RADIUS, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;

      if (captureRequestRef.current) {
          captureRequestRef.current = false;
          const shot = canvas.toDataURL('image/jpeg', 0.5);
          performAiAnalysis(shot);
      }
    };

    if (window.Hands) {
      hands = new window.Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
      camera = new window.Camera(videoRef.current, { 
        onFrame: async () => { 
          if (isActive && videoRef.current) {
            try {
              await hands.send({ image: videoRef.current }); 
            } catch (e) {
              console.warn("Hand tracking frame dropped during stabilization", e);
            }
          }
        }, 
        width: 1280, 
        height: 720 
      });
      camera.start();
    }

    return () => { 
      isActive = false;
      camera?.stop(); 
      hands?.close(); 
    };
  }, []); 

  return (
    <div className="flex w-full h-screen bg-[#05050a] text-[#f0f0f0] font-sans overflow-hidden">
      
      {/* HOW TO PLAY OVERLAY */}
      {showTutorial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl">
            <div className="max-w-2xl w-full bg-[#0f0f1b] border border-violet-500/30 p-10 rounded-[3rem] shadow-[0_0_100px_rgba(139,92,246,0.3)]">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-violet-500/20 rounded-2xl">
                        <Sparkles className="w-8 h-8 text-violet-400" />
                    </div>
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Initialize Systems</h1>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10">
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 text-violet-400 font-bold">1</div>
                            <div>
                                <h4 className="font-bold text-white mb-1">Load the Ball</h4>
                                <p className="text-sm text-gray-400">Click <span className="text-yellow-400">LOAD</span> to pay your bet and enable the slingshot.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 text-violet-400 font-bold">2</div>
                            <div>
                                <h4 className="font-bold text-white mb-1">Pinch to Grab</h4>
                                <p className="text-sm text-gray-400">Pinch your index and thumb together over the ball to pull back.</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 text-violet-400 font-bold">3</div>
                            <div>
                                <h4 className="font-bold text-white mb-1">Un-mirroring</h4>
                                <p className="text-sm text-gray-400">Tracking is mirrored for comfort. Moving right physically moves your cursor right.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 text-violet-400 font-bold">4</div>
                            <div>
                                <h4 className="font-bold text-white mb-1">Gemini Ops</h4>
                                <p className="text-sm text-gray-400">The Sentinel scans your board after every bet to find high-ROI shots.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => setShowTutorial(false)}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_10px_30px_rgba(124,58,237,0.4)] flex items-center justify-center gap-3"
                >
                    Start Game <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
      )}

      {/* GAME VIEWPORT */}
      <div ref={gameContainerRef} className="flex-1 relative border-r border-[#1a1a2e]">
        <video ref={videoRef} className="hidden" />
        <canvas ref={canvasRef} className="w-full h-full" />

        <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
            <div className="bg-[#0f0f1b]/80 border border-[#2a2a4a] p-4 rounded-2xl backdrop-blur-md shadow-2xl flex items-center gap-4">
                <div className="bg-yellow-500/20 p-2 rounded-lg">
                    <Coins className="text-yellow-500 w-6 h-6" />
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Balance</p>
                    <p className="text-2xl font-mono text-white">{balance.toLocaleString()} <span className="text-xs text-yellow-500">CR</span></p>
                </div>
            </div>

            {lastWin > 0 && (
                <div className="bg-green-500/10 border border-green-500/30 px-6 py-3 rounded-full animate-bounce backdrop-blur-md">
                    <p className="text-green-400 font-black text-xl">+ {lastWin} CR</p>
                </div>
            )}
        </div>

        {bonusTimer > 0 && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-orange-600 px-8 py-2 rounded-full shadow-[0_0_30px_rgba(234,88,12,0.6)] animate-pulse">
                <Flame className="w-6 h-6 text-white fill-current" />
                <p className="text-white font-black text-lg tracking-tighter italic uppercase">Nebula Frenzy x2! ({bonusTimer}s)</p>
            </div>
        )}

        {/* TRACKING STATUS */}
        <div className="absolute bottom-[320px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
            <div className={`w-3 h-3 rounded-full ${handDetected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 animate-pulse'}`} />
            <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] bg-black/40 px-3 py-1 rounded-full">
                {handDetected ? 'Sensor Locked' : 'Searching for Signal...'}
            </p>
        </div>

        {/* BETTING CONTROLS */}
        {gameMode === 'BETTING' && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-[520px] flex gap-4">
                <div className="flex-1 bg-[#0f0f1b]/95 border border-[#2a2a4a] p-6 rounded-[2.5rem] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
                    <div className="flex justify-between mb-4">
                        <button onClick={() => setCurrentBet(Math.max(10, currentBet - 10))} className="w-12 h-12 rounded-full border border-[#2a2a4a] flex items-center justify-center hover:bg-white/10 text-xl font-bold transition-all">-</button>
                        <div className="text-center">
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1 tracking-widest">Stake</p>
                            <p className="text-4xl font-mono font-black text-white">{currentBet}</p>
                        </div>
                        <button onClick={() => setCurrentBet(currentBet + 10)} className="w-12 h-12 rounded-full border border-[#2a2a4a] flex items-center justify-center hover:bg-white/10 text-xl font-bold transition-all">+</button>
                    </div>
                    <button 
                        onClick={handleBet}
                        className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 py-5 rounded-2xl text-black font-black uppercase tracking-widest hover:scale-[1.03] active:scale-95 transition-all shadow-[0_15px_30px_rgba(251,191,36,0.4)]"
                    >
                        Load & Arm
                    </button>
                </div>

                <button 
                    onClick={handleBonusBuy}
                    disabled={bonusTimer > 0}
                    className={`w-[180px] group relative bg-[#1a0b2e] border-2 border-violet-500/30 rounded-[2.5rem] overflow-hidden transition-all hover:border-violet-500 ${bonusTimer > 0 ? 'opacity-50 grayscale' : 'hover:scale-[1.03]'}`}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-violet-600/30 to-transparent group-hover:from-violet-600/50 transition-all" />
                    <div className="relative z-10 p-5 flex flex-col items-center justify-center text-center">
                        <Flame className="w-6 h-6 text-violet-400 mb-2" />
                        <p className="text-[9px] font-black uppercase tracking-tighter text-violet-300 mb-1">Feature Buy</p>
                        <p className="text-2xl font-mono font-black text-white">{(currentBet * 100).toLocaleString()}</p>
                        <p className="text-[8px] font-bold text-violet-400/60 mt-2">15S FRENZY</p>
                    </div>
                </button>
            </div>
        )}

        {isLoaded && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4 p-5 bg-[#0f0f1b]/90 border border-[#2a2a4a] rounded-full backdrop-blur-xl shadow-2xl">
                {availableColors.map(c => (
                    <button 
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        className={`w-12 h-12 rounded-full transition-all duration-300 relative ${selectedColor === c ? 'scale-125 ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'opacity-30 hover:opacity-60'}`}
                        style={{ backgroundColor: MULTIPLIERS[c].hex }}
                    >
                        {selectedColor === c && <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-md"><CheckCircle2 className="w-3 h-3 text-black" /></div>}
                    </button>
                ))}
            </div>
        )}
      </div>

      {/* SIDEBAR */}
      <div className="w-[380px] bg-[#0a0a0f] p-8 flex flex-col gap-8 shadow-[-20px_0_60px_rgba(0,0,0,0.8)] border-l border-white/5">
        <div className="flex items-center gap-4 border-b border-[#1a1a2e] pb-6">
            <div className="p-3 bg-blue-500/20 rounded-2xl">
                <BrainCircuit className="w-7 h-7 text-blue-400" />
            </div>
            <div>
                <h2 className="text-xl font-black tracking-tighter uppercase italic text-white">Nebula Ops</h2>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Sentinel Online</p>
                </div>
            </div>
        </div>

        <div className="bg-[#0f0f1b] border-l-4 border-blue-500 p-6 rounded-r-2xl shadow-2xl relative overflow-hidden group">
            <TrendingUp className="absolute -right-4 -bottom-4 w-28 h-28 text-blue-500/5 group-hover:text-blue-500/10 transition-all duration-700" />
            <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Zap className="w-3 h-3" /> Directive
            </h3>
            {isAiThinking ? (
                <div className="flex items-center gap-3 py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <p className="text-sm text-gray-400 font-bold italic">Analyzing cosmic probabilities...</p>
                </div>
            ) : (
                <>
                    <p className="text-xl font-black leading-tight mb-3 text-white tracking-tight">{aiHint?.message || "Scanning board..."}</p>
                    <p className="text-xs text-gray-400 leading-relaxed italic mb-6">{aiHint?.rationale}</p>
                    
                    {aiHint?.payoutPotential && (
                        <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                            <p className="text-[10px] text-blue-300 font-black uppercase mb-1 tracking-widest">Est. Return</p>
                            <p className="text-2xl font-mono text-blue-400 font-black tracking-tighter">{aiHint.payoutPotential}</p>
                        </div>
                    )}
                </>
            )}
        </div>

        <div className="bg-[#0f0f1b] p-6 rounded-3xl border border-[#1a1a2e]">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-5">Payout Matrix</h3>
            <div className="space-y-4">
                {COLOR_KEYS.map(k => (
                    <div key={k} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: MULTIPLIERS[k].hex }} />
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">{MULTIPLIERS[k].label}</span>
                        </div>
                        <span className="text-sm font-mono font-black text-white bg-white/5 px-3 py-1 rounded-lg">{MULTIPLIERS[k].mult}x</span>
                    </div>
                ))}
            </div>
        </div>

        <div className="mt-auto flex flex-col gap-6">
             <div className="p-5 bg-orange-500/5 border border-orange-500/10 rounded-2xl relative">
                 <div className="flex items-center gap-2 text-orange-400 mb-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Intelligence</span>
                 </div>
                 <p className="text-[11px] text-gray-400 leading-tight">Popping <span className="text-orange-400 font-black uppercase italic">Orange</span> triggers frenzy. Sentinel will prioritize these when available.</p>
             </div>
             
             <button 
                onClick={() => setShowTutorial(true)}
                className="flex items-center justify-center gap-2 text-[10px] text-gray-500 hover:text-white uppercase font-black tracking-[0.3em] transition-all"
             >
                <Info className="w-3 h-3" /> System Specs
             </button>
        </div>
      </div>
    </div>
  );
};

export default GeminiSlingshot;
