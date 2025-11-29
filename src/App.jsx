import React, { useState, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Settings, RefreshCw, Trophy, Music, Check, X } from 'lucide-react';

// --- Constants & Data ---

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const FREQUENCIES = {
  'E2': 82.41,  'F2': 87.31,  'F#2': 92.50, 'G2': 98.00,  'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
};

const GAME_MODES = {
  TREBLE: { name: 'Treble Clef', min: 'C4', max: 'A5', clefType: 'treble' },
  BASS:   { name: 'Bass Clef',   min: 'E2', max: 'E4', clefType: 'bass' },
};

// --- Audio Engine ---
const AudioEngine = {
  ctx: null,
  
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  playTone(freq, type = 'triangle', duration = 0.5) {
    if (!this.ctx) this.init();
    if (!freq) return;

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      gainNode.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.error("Audio Playback Error:", e);
    }
  },

  playSuccess() {
    this.playTone(880, 'sine', 0.1); 
    setTimeout(() => this.playTone(1108.73, 'sine', 0.2), 100);
  },
};

// --- Helper: Note parsing (Safe) ---
const parseNote = (noteStr) => {
  if (!noteStr || typeof noteStr !== 'string') return null;
  const isSharp = noteStr.includes('#');
  const name = noteStr.charAt(0);
  // Ensure we get a valid integer for octave
  const octaveStr = noteStr.slice(isSharp ? 2 : 1);
  const octave = parseInt(octaveStr);
  
  if (isNaN(octave)) return null;

  return { name, isSharp, octave, full: noteStr };
};

const getNoteValue = (noteStr) => {
  const parsed = parseNote(noteStr);
  if (!parsed) return -1000; // Return safe default if parsing fails
  const { name, octave, isSharp } = parsed;
  const diatonic = NOTE_NAMES.indexOf(name);
  if (diatonic === -1) return -1000;
  return octave * 12 + diatonic + (isSharp ? 0.5 : 0);
};

// --- Components ---

const Staff = ({ currentNote, guessedNote, feedbackState, clef }) => {
  const width = 300;
  const height = 240;
  const lineSpacing = 20;
  const middleY = height / 2;
  
  const getNoteY = (noteStr) => {
    const parsed = parseNote(noteStr);
    if (!parsed) return middleY;
    
    const { name, octave } = parsed;
    const diatonicIndices = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };
    const absIndex = (octave * 7) + diatonicIndices[name];
    
    let topLineNoteIndex;
    if (clef === 'treble') {
        topLineNoteIndex = (5 * 7) + 3; // F5
    } else {
        topLineNoteIndex = (3 * 7) + 5; // A3
    }

    const stepsFromTopLine = topLineNoteIndex - absIndex;
    const staffTopY = middleY - (2 * lineSpacing);
    return staffTopY + (stepsFromTopLine * (lineSpacing / 2));
  };

  const renderNoteVisuals = (noteStr, color, keySuffix) => {
    if (!noteStr) return null;
    const y = getNoteY(noteStr);
    const staffTopY = middleY - (2 * lineSpacing);
    const staffBottomY = middleY + (2 * lineSpacing);
    
    const ledgers = [];
    if (y < staffTopY) { 
      for (let ly = staffTopY - lineSpacing; ly >= y; ly -= lineSpacing) {
        ledgers.push(<line key={`l-up-${ly}-${keySuffix}`} x1={width/2 - 20} y1={ly} x2={width/2 + 20} y2={ly} stroke={color} strokeWidth="2" opacity="0.5" />);
      }
    }
    if (y > staffBottomY) { 
      for (let ly = staffBottomY + lineSpacing; ly <= y; ly += lineSpacing) {
        ledgers.push(<line key={`l-down-${ly}-${keySuffix}`} x1={width/2 - 20} y1={ly} x2={width/2 + 20} y2={ly} stroke={color} strokeWidth="2" opacity="0.5" />);
      }
    }

    return (
      <g key={keySuffix} transform={`translate(${width/2}, ${y})`}>
         {ledgers.map(l => React.cloneElement(l, { transform: `translate(-${width/2}, -${y})` }))}
        <ellipse cx="0" cy="0" rx="14" ry="10" fill={color} transform="rotate(-15)"/>
        { y < middleY ? (
           <line x1="-13" y1="2" x2="-13" y2="55" stroke={color} strokeWidth="2" />
        ) : (
           <line x1="13" y1="-2" x2="13" y2="-55" stroke={color} strokeWidth="2" />
        )}
      </g>
    );
  };

  return (
    <div className="flex justify-center items-center py-4 bg-white rounded-xl shadow-inner border border-stone-200 w-full max-w-sm mx-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {clef === 'treble' ? (
             <g transform="translate(60, 130) scale(1.6)">
                <path d="M15.9,34.9C16.6,37.3,18.8,38.5,21.5,38.5C25.4,38.5,28.7,35.6,28.7,30.3C28.7,24.4,24.3,21.1,19.9,21.1C16.9,21.1,15.1,22.6,15.1,22.6C15.1,22.6,15.3,21.7,15.5,21.1C17.6,13.7,25.9,8.7,25.9,4.4C25.9,2.6,24.8,0.7,22.2,0.7C18.6,0.7,17.2,4.8,16.5,8.8C16.1,11.3,15.8,12.7,15.8,12.7L14.7,18.6L14.4,20.3C14.4,20.3,10.6,18.6,8.2,18.6C4.1,18.6,0.7,21.9,0.7,26.4C0.7,31.4,4.9,35.1,9.8,35.1C13.4,35.1,15.4,33.1,15.4,33.1L14.8,36.5C14,40.9,12.1,43.2,9.8,43.2C8.6,43.2,7.7,42.5,7.7,42.5C7.7,42.5,7.5,43.4,7.5,43.7C7.5,45.6,9.5,46.7,11.9,46.7C17.3,46.7,20.6,41.9,21.5,37.6C21.7,36.9,21.8,36.1,21.9,35.7C21.9,35.7,16.8,35.7,15.9,34.9ZM21.3,31.8C19.6,31.8,18.5,30.5,18.5,28.8C18.5,27.1,19.7,25.4,21.6,25.4C23.3,25.4,24.4,26.8,24.4,28.5C24.4,30.4,23.1,31.8,21.3,31.8ZM13.8,30.7C13.8,30.7,11.9,32.3,10,32.3C7.4,32.3,5.4,30.2,5.4,26.9C5.4,23.9,7.6,21.5,10.6,21.5C11.9,21.5,14.2,22.3,14.2,22.3L13.8,30.7ZM21.7,3.5C22.6,3.5,23.1,4.2,23.1,5.1C23.1,8.3,17.3,13.8,16.2,18.4L16.7,15.6C17.5,11.3,19.2,3.5,21.7,3.5Z" 
                      fill="black" transform="translate(-15, -45)"/>
             </g>
        ) : (
             <g transform="translate(60, 120) scale(1.5)">
               <path d="M12.6,0.6C8,0.6,3.4,3.2,1.5,7.6C0,11.1,0.6,15,3,17.9C4.9,20.3,8,21.7,11.1,21.7C16.9,21.7,21.6,17,21.6,11.2C21.6,5.4,17.6,0.6,12.6,0.6ZM11.1,18.6C9.1,18.6,7.1,17.7,5.9,16.1C4.3,14.1,4,11.4,5,9.1C6.2,6.3,9.2,4.6,12.2,4.6C15.9,4.6,17.9,8.3,17.9,11.1C17.9,15.3,14.8,18.6,11.1,18.6Z" fill="black" transform="translate(0, -11)" />
               <circle cx="28" cy="-5" r="2.5" fill="black" />
               <circle cx="28" cy="7" r="2.5" fill="black" />
             </g>
        )}

        {[0, 1, 2, 3, 4].map(i => {
           const y = middleY - (2 * lineSpacing) + (i * lineSpacing);
           return <line key={i} x1="20" y1={y} x2={width - 20} y2={y} stroke="#333" strokeWidth="2" />;
        })}
        
        {renderNoteVisuals(currentNote, feedbackState === 'correct' ? '#22c55e' : 'black', 'target')}
        {feedbackState === 'wrong' && guessedNote && renderNoteVisuals(guessedNote, '#ef4444', 'guess')}
      </svg>
    </div>
  );
};

// --- Responsive SVG Piano Component ---
const Piano = ({ minNote, maxNote, currentNote, lastGuessedNote, feedbackState, onPlay }) => {
  const [keys, setKeys] = useState({ white: [], black: [] });
  const [viewBoxWidth, setViewBoxWidth] = useState(100);

  useEffect(() => {
    // Safety check for inputs
    if (!minNote || !maxNote) return;

    const white = [];
    const black = [];
    
    const startVal = getNoteValue(minNote);
    const endVal = getNoteValue(maxNote);
    
    const startOctave = parseNote(minNote)?.octave || 0;
    const endOctave = parseNote(maxNote)?.octave || 8;
    
    let whiteKeyIndex = 0;
    
    for (let o = startOctave; o <= endOctave + 1; o++) {
        NOTE_NAMES.forEach(n => {
            const noteStr = `${n}${o}`;
            const val = getNoteValue(noteStr);
            
            // Only add keys within range
            if (val >= startVal && val <= endVal) {
                // White key
                white.push({ note: noteStr, x: whiteKeyIndex, type: 'white' });
                
                // Check if this white key has a sharp (black key) after it
                const hasSharp = ['C', 'D', 'F', 'G', 'A'].includes(n);
                if (hasSharp) {
                    const sharpNote = `${n}#${o}`;
                    // Only add if sharp is also within valid range
                    if (getNoteValue(sharpNote) <= endVal) {
                        black.push({ 
                            note: sharpNote, 
                            x: whiteKeyIndex + 0.5, 
                            type: 'black' 
                        });
                    }
                }
                whiteKeyIndex++;
            }
        });
    }

    setKeys({ white, black });
    setViewBoxWidth(Math.max(100, whiteKeyIndex * 40));
  }, [minNote, maxNote]);

  const getKeyColor = (note, type) => {
    const isTarget = currentNote === note;
    const isGuessed = lastGuessedNote === note;
    const isCorrect = feedbackState === 'correct';
    const isWrong = feedbackState === 'wrong';

    if (isCorrect && isTarget) return '#22c55e'; // Green
    if (isWrong && isGuessed) return '#ef4444';   // Red
    if (isWrong && isTarget && feedbackState === 'wrong') return '#22c55e'; // Show correct answer in green even if wrong? (Optional, kept simpler for now)
    
    return type === 'white' ? 'white' : '#1c1917';
  };

  const keyWidth = 40;
  const keyHeight = 160;
  const blackKeyWidth = 24;
  const blackKeyHeight = 100;

  return (
    <div className="w-full max-w-full overflow-hidden rounded-lg shadow-xl bg-stone-900 p-1">
      <svg viewBox={`0 0 ${viewBoxWidth} ${keyHeight}`} className="w-full h-auto block touch-manipulation select-none">
        {/* Render White Keys */}
        {keys.white.map((k) => (
          <rect
            key={k.note}
            x={k.x * keyWidth}
            y={0}
            width={keyWidth}
            height={keyHeight}
            fill={getKeyColor(k.note, 'white')}
            stroke="#d6d3d1"
            strokeWidth="1"
            className="cursor-pointer active:opacity-90 transition-colors duration-150"
            rx="4"
            onMouseDown={(e) => { e.preventDefault(); onPlay(k.note); }}
            onTouchStart={(e) => { e.preventDefault(); onPlay(k.note); }}
          />
        ))}
        {/* Render Labels on C keys */}
        {keys.white.map((k) => k.note.startsWith('C') && (
            <text key={`label-${k.note}`} x={k.x * keyWidth + keyWidth/2} y={keyHeight - 10} textAnchor="middle" fontSize="12" fill="#a8a29e" className="pointer-events-none select-none">
                {k.note}
            </text>
        ))}

        {/* Render Black Keys */}
        {keys.black.map((k) => (
          <rect
            key={k.note}
            x={(k.x + 0.5) * keyWidth - (blackKeyWidth / 2)} 
            y={0}
            width={blackKeyWidth}
            height={blackKeyHeight}
            fill={getKeyColor(k.note, 'black')}
            className="cursor-pointer hover:fill-stone-700 active:fill-stone-600 transition-colors duration-150"
            rx="2"
            onMouseDown={(e) => { e.preventDefault(); onPlay(k.note); }}
            onTouchStart={(e) => { e.preventDefault(); onPlay(k.note); }}
          />
        ))}
      </svg>
    </div>
  );
};

export default function SightReadingApp() {
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState('TREBLE');
  const [currentNote, setCurrentNote] = useState(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedbackState, setFeedbackState] = useState(null); 
  const [lastGuessedNote, setLastGuessedNote] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [volumeOn, setVolumeOn] = useState(true);

  // --- Logic ---

  const generateNote = useCallback(() => {
    const config = GAME_MODES[mode];
    const notes = [];
    const startVal = getNoteValue(config.min);
    const endVal = getNoteValue(config.max);
    
    const startOctave = parseNote(config.min)?.octave || 3;
    const endOctave = parseNote(config.max)?.octave || 5;
    
    for (let o = startOctave; o <= endOctave + 1; o++) {
        NOTE_NAMES.forEach(n => {
            const noteStr = `${n}${o}`;
            const val = getNoteValue(noteStr);
            if (val >= startVal && val <= endVal) {
                notes.push(noteStr);
            }
        });
    }

    if (notes.length === 0) return; // Safety

    let newNote;
    // Attempt to find a new note, but don't loop forever if only 1 note exists
    let attempts = 0;
    do {
      newNote = notes[Math.floor(Math.random() * notes.length)];
      attempts++;
    } while (notes.length > 1 && newNote === currentNote && attempts < 5);

    setCurrentNote(newNote);
    setFeedbackState(null);
    setLastGuessedNote(null);
  }, [mode, currentNote]);

  const startGame = () => {
    AudioEngine.init();
    setStarted(true);
    setScore(0);
    setTotal(0);
    setStreak(0);
    generateNote();
  };

  const handleKeyClick = (noteName) => {
    if (!started || feedbackState) return;

    const isCorrect = noteName === currentNote;
    setLastGuessedNote(noteName);

    if (volumeOn) {
        if (FREQUENCIES[noteName]) AudioEngine.playTone(FREQUENCIES[noteName], 'triangle', 0.4);
        if (isCorrect) setTimeout(() => AudioEngine.playSuccess(), 100);
    }

    if (isCorrect) {
      setFeedbackState('correct');
      setScore(s => s + 1);
      setStreak(s => s + 1);
      setTimeout(() => generateNote(), 1000);
    } else {
      setFeedbackState('wrong');
      setStreak(0);
      setTimeout(() => {
         setFeedbackState(null);
         setLastGuessedNote(null);
      }, 1200);
    }
    setTotal(t => t + 1);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans flex flex-col items-center">
      
      {/* Header */}
      <header className="w-full p-4 bg-white shadow-sm flex justify-between items-center z-20 sticky top-0">
        <div className="flex items-center gap-2">
          <Music className="text-indigo-600" size={24} />
          <h1 className="text-xl font-bold tracking-tight text-stone-800">SightRead<span className="text-indigo-600">Pro</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-4 text-sm font-medium text-stone-500">
             <div className="flex items-center gap-1">
                <Check size={16} className="text-green-500"/> {score}/{total}
             </div>
             <div className="flex items-center gap-1">
                <Trophy size={16} className="text-amber-500"/> Streak: {streak}
             </div>
          </div>
          <button onClick={() => setVolumeOn(!volumeOn)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            {volumeOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl p-4 flex flex-col items-center gap-6 relative">
        
        {/* Settings Modal */}
        {showSettings && (
          <div className="absolute top-16 right-4 bg-white shadow-xl border border-stone-200 rounded-xl p-4 z-30 w-64 animate-in fade-in slide-in-from-top-4">
             <h3 className="font-bold mb-3 text-stone-700">Settings</h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Clef Mode</label>
                 <div className="flex gap-2 mt-2">
                   <button 
                     onClick={() => { setMode('TREBLE'); setStarted(false); setShowSettings(false); }}
                     className={`flex-1 py-2 px-3 text-sm rounded-lg border ${mode === 'TREBLE' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white border-stone-300 hover:bg-stone-50'}`}
                   >
                     Treble
                   </button>
                   <button 
                     onClick={() => { setMode('BASS'); setStarted(false); setShowSettings(false); }}
                     className={`flex-1 py-2 px-3 text-sm rounded-lg border ${mode === 'BASS' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white border-stone-300 hover:bg-stone-50'}`}
                   >
                     Bass
                   </button>
                 </div>
               </div>
               <button 
                onClick={() => { setStarted(false); setShowSettings(false); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
               >
                 <RefreshCw size={14}/> Reset Progress
               </button>
             </div>
          </div>
        )}

        {/* Mobile Stats */}
        <div className="md:hidden flex w-full justify-between px-4 py-2 bg-stone-100 rounded-lg text-sm font-medium text-stone-600">
             <div className="flex items-center gap-1">
                <Check size={16} className="text-green-500"/> {score}/{total}
             </div>
             <div className="flex items-center gap-1">
                <Trophy size={16} className="text-amber-500"/> Streak: {streak}
             </div>
        </div>

        {/* Game Area */}
        <div className="w-full flex-1 flex flex-col items-center justify-start mt-4 min-h-[400px]">
           
           {!started ? (
             <div className="text-center space-y-6 animate-in zoom-in-95 duration-300 mt-12">
               <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600">
                 <Music size={48} />
               </div>
               <div>
                 <h2 className="text-2xl font-bold text-stone-800">Ready to Practice?</h2>
                 <p className="text-stone-500 mt-2">Identify notes on the {GAME_MODES[mode].name}.</p>
               </div>
               <button 
                 onClick={startGame}
                 className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
               >
                 Start Practice
               </button>
             </div>
           ) : (
             <div className="w-full flex flex-col items-center gap-6 animate-in fade-in duration-500">
                
                {/* Feedback Indicator */}
                <div className={`h-8 px-4 rounded-full flex items-center gap-2 font-bold text-sm transition-all duration-300 ${
                  feedbackState === 'correct' ? 'bg-green-100 text-green-700 opacity-100 translate-y-0' : 
                  feedbackState === 'wrong' ? 'bg-red-100 text-red-700 opacity-100 translate-y-0' : 
                  'opacity-0 -translate-y-4'
                }`}>
                  {feedbackState === 'correct' ? <><Check size={16}/> Correct!</> : <><X size={16}/> Oops!</>}
                </div>

                <Staff 
                    currentNote={currentNote} 
                    guessedNote={lastGuessedNote}
                    feedbackState={feedbackState}
                    clef={GAME_MODES[mode].clefType} 
                />
                
                {/* Responsive Piano Container */}
                <div className="w-full">
                  <Piano 
                    minNote={GAME_MODES[mode].min}
                    maxNote={GAME_MODES[mode].max}
                    currentNote={currentNote}
                    lastGuessedNote={lastGuessedNote}
                    feedbackState={feedbackState}
                    onPlay={handleKeyClick}
                  />
                  <p className="text-stone-400 text-sm mt-4 text-center">
                    Tap the piano keys to identify the note.
                  </p>
                </div>

             </div>
           )}

        </div>
      </main>
      
      <footer className="w-full py-4 text-center text-stone-400 text-xs border-t border-stone-100">
        SightReadPro &copy; 2025
      </footer>
    </div>
  );
}