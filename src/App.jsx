import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RefreshCw, Zap, X, Download, PackageOpen, PackagePlus } from 'lucide-react';

const createAudioContext = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(e => console.error("Could not resume AudioContext:", e));
  }
  return ctx;
};

let masterGainNode = null;

const bufferToWav = (audioBuffer) => {
    const audioData = audioBuffer.getChannelData(0); 
    const numChannels = 1; 
    const sampleRate = audioBuffer.sampleRate;
    const totalLength = audioData.length;

    const buffer = new ArrayBuffer(44 + totalLength * 2);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF'); 
    view.setUint32(4, 36 + totalLength * 2, true); 
    writeString(view, 8, 'WAVE'); 
    writeString(view, 12, 'fmt '); 
    view.setUint32(16, 16, true); 
    view.setUint16(20, 1, true); 
    view.setUint16(22, numChannels, true); 
    view.setUint32(24, sampleRate, true); 
    view.setUint32(28, sampleRate * numChannels * 2, true); 
    view.setUint16(32, numChannels * 2, true); 
    view.setUint16(34, 16, true); 

    writeString(view, 36, 'data');
    view.setUint32(40, totalLength * 2, true);

    const dataOffset = 44;
    for (let i = 0; i < totalLength; i++) {
        let s = Math.max(-1, Math.min(1, audioData[i])); 
        view.setInt16(dataOffset + i * 2, s * 0x7FFF, true); 
    }

    return new Blob([view], { type: 'audio/wav' });
};


const synthesizeSound = (ctx, type, time, destinationNode) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(destinationNode); 

  const t = time || ctx.currentTime;

  switch (type) {
    case 'kick':
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(0.001, t + 0.5);
      gain.gain.setValueAtTime(1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
      break;
      
    case 'snare':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(100, t);
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
      break;
      
    case 'hihat':
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, t);
      osc.detune.setValueAtTime(Math.random() * 100, t); 
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
      break;
      
    case 'synth':
      osc.type = 'sine';
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00]; 
      const note = notes[Math.floor(Math.random() * notes.length)];
      osc.frequency.setValueAtTime(note, t);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
      break;

    case 'bass':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(82.41, t); 
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.start(t);
      osc.stop(t + 0.8);
      break;

    case 'click':
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, t);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.start(t);
      osc.stop(t + 0.05);
      break;
      
    default:
      break;
  }
};

const Visualizer = React.memo(({ activeTracks, trigger }) => {
  const canvasRef = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    if (trigger > 0) {
      createExplosion();
    }
  }, [trigger]);

  const createExplosion = () => {
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#D4D4D8']; 
    
    let activeColors = [];
    if (activeTracks.kick) activeColors.push(colors[0]);
    if (activeTracks.snare) activeColors.push(colors[1]);
    if (activeTracks.hihat) activeColors.push(colors[2]);
    if (activeTracks.synth) activeColors.push(colors[3]);
    if (activeTracks.bass) activeColors.push(colors[4]);
    if (activeTracks.click) activeColors.push(colors[5]);
    
    if (activeColors.length === 0) return;

    for (let i = 0; i < 20; i++) {
      const color = activeColors[Math.floor(Math.random() * activeColors.length)];
      particles.current.push({
        x: canvasRef.current.width / 2,
        y: canvasRef.current.height / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color: color,
        size: Math.random() * 4 + 1
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    const render = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.current.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        p.size *= 0.95;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.life <= 0) {
          particles.current.splice(index, 1);
        }
      });

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, Math.PI * 2);
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-64 bg-black rounded-xl border border-gray-800 shadow-[inset_0_0_20px_rgba(0,0,0,1)]" />;
});


export default function App() {
  const INITIAL_TRACK_COUNT = 6;
  const DEFAULT_SEQUENCE_LENGTH = 16;
  const MIN_LENGTH = 4;
  const MAX_LENGTH = 128;
  
  const [sequenceLength, setSequenceLength] = useState(DEFAULT_SEQUENCE_LENGTH); 

  const [grid, setGrid] = useState(() => 
    Array.from({ length: INITIAL_TRACK_COUNT }, () => Array(DEFAULT_SEQUENCE_LENGTH).fill(false))
  );
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);
  
  const [triggerVisuals, setTriggerVisuals] = useState(0);
  const [activeTracksForVisuals, setActiveTracksForVisuals] = useState({});

  const [exportImportModal, setExportImportModal] = useState(null); 
  const [clipboardData, setClipboardData] = useState('');
  const [importError, setImportError] = useState('');
  const [exportStatus, setExportStatus] = useState(null); 
  const [downloadUrl, setDownloadUrl] = useState('');

  const audioCtxRef = useRef(null);
  const nextNoteTimeRef = useRef(0.0);
  const currentStepRef = useRef(0);
  const timerIDRef = useRef(null);
  const lookahead = 25.0; 
  const scheduleAheadTime = 0.1; 

  useEffect(() => {
    const initialGrid = Array.from({ length: INITIAL_TRACK_COUNT }, () => Array(DEFAULT_SEQUENCE_LENGTH).fill(false));
    [0, 4, 8, 12].forEach(i => initialGrid[0][i] = true);
    [4, 12].forEach(i => initialGrid[1][i] = true);
    for(let i=0; i<16; i+=2) initialGrid[2][i] = true;
    [0, 3, 7, 10, 15].forEach(i => initialGrid[3][i] = true);
    [0, 8].forEach(i => initialGrid[4][i] = true);
    setGrid(initialGrid);
  }, []);
  
  const handleSequenceLengthChange = (e) => {
    let newLength = Number(e.target.value);
    
    if (e.target.value === '') {
        setSequenceLength('');
        return;
    }

    if (isNaN(newLength) || newLength < MIN_LENGTH || newLength > MAX_LENGTH) {
        setSequenceLength(sequenceLength);
        return;
    }
    
    newLength = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, newLength));

    if (isPlaying) togglePlay(); 

    setGrid(prevGrid => prevGrid.map(row => {
      const newRow = Array(newLength).fill(false);
      for (let i = 0; i < Math.min(row.length, newLength); i++) {
        newRow[i] = row[i];
      }
      return newRow;
    }));
    setSequenceLength(newLength);
    setCurrentStep(0);
  };


  const nextNote = () => {
    const secondsPerBeat = 60.0 / bpm;
    nextNoteTimeRef.current += 0.25 * secondsPerBeat;
    currentStepRef.current = (currentStepRef.current + 1) % sequenceLength;
  };

  const scheduleNote = (stepNumber, time) => {
    requestAnimationFrame(() => {
      setCurrentStep(stepNumber);
    });

    const tracks = ['kick', 'snare', 'hihat', 'synth', 'bass', 'click'];
    let tracksPlayingNow = {};
    let soundTriggered = false;

    grid.forEach((row, trackIndex) => {
      if (row[stepNumber] && trackIndex < row.length) {
        synthesizeSound(audioCtxRef.current, tracks[trackIndex], time, masterGainNode);
        tracksPlayingNow[tracks[trackIndex]] = true;
        soundTriggered = true;
      }
    });

    if (soundTriggered) {
      setActiveTracksForVisuals(tracksPlayingNow);
      setTriggerVisuals(prev => prev + 1);
    }
  };

  const scheduler = () => {
    while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + scheduleAheadTime) {
      scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
      nextNote();
    }
    
    timerIDRef.current = window.setTimeout(scheduler, lookahead);
  };

  const togglePlay = () => {
    if (!isPlaying) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = createAudioContext();
        masterGainNode = audioCtxRef.current.createGain();
        masterGainNode.connect(audioCtxRef.current.destination);
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      
      currentStepRef.current = 0;
      nextNoteTimeRef.current = audioCtxRef.current.currentTime;
      scheduler();
      setIsPlaying(true);
    } else {
      window.clearTimeout(timerIDRef.current);
      setIsPlaying(false);
      setCurrentStep(0); 
    }
  };

  const exportAudioTimeline = () => {
    if (isPlaying) togglePlay(); 
    setExportStatus('processing');
    setDownloadUrl('');
    setExportImportModal('audio');
    setImportError('');
    
    const tracks = ['kick', 'snare', 'hihat', 'synth', 'bass', 'click'];

    const steps = sequenceLength;
    const secondsPer16th = (60 / bpm) / 4;
    const durationInSeconds = steps * secondsPer16th;

    const sampleRate = audioCtxRef.current ? audioCtxRef.current.sampleRate : 44100;
    
    const offlineCtx = new OfflineAudioContext(1, durationInSeconds * sampleRate, sampleRate);
    
    const offlineMasterGain = offlineCtx.createGain();
    offlineMasterGain.connect(offlineCtx.destination);
    
    for (let step = 0; step < steps; step++) {
        const time = step * secondsPer16th;
        
        grid.forEach((row, trackIndex) => {
            if (row[step]) {
                synthesizeSound(offlineCtx, tracks[trackIndex], time, offlineMasterGain);
            }
        });
    }

    offlineCtx.startRendering().then(renderedBuffer => {
        const wavBlob = bufferToWav(renderedBuffer);
        const url = URL.createObjectURL(wavBlob);
        
        setDownloadUrl(url);
        setExportStatus('download'); 
        setImportError('');
        
    }).catch(e => {
        console.error("Offline Rendering Error:", e);
        setImportError('Audio Export failed: ' + e.message);
        setExportStatus('idle');
    });
  };

  const toggleCell = (trackIndex, stepIndex) => {
    const newGrid = [...grid];
    if (trackIndex < newGrid.length) {
        if (newGrid[trackIndex].length < sequenceLength) {
            newGrid[trackIndex] = newGrid[trackIndex].concat(Array(sequenceLength - newGrid[trackIndex].length).fill(false));
        }
        
        if (stepIndex < sequenceLength) {
            newGrid[trackIndex][stepIndex] = !newGrid[trackIndex][stepIndex];
        }
    }
    setGrid(newGrid);
  };

  const clearGrid = () => {
    setGrid(Array.from({ length: INITIAL_TRACK_COUNT }, () => Array(sequenceLength).fill(false)));
  };

  const exportCombination = () => {
    const data = JSON.stringify({ grid, sequenceLength, bpm });
    setClipboardData(data);
    setExportImportModal('export');
    setImportError('');
    try {
      const tempInput = document.createElement('textarea');
      tempInput.value = data;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
    } catch (err) {
      console.warn('Could not copy to clipboard automatically.');
    }
  };

  const importCombination = () => {
    if (isPlaying) togglePlay();
    try {
      const importedData = JSON.parse(clipboardData);
      const importedGrid = importedData.grid;
      let importedLength = importedData.sequenceLength || DEFAULT_SEQUENCE_LENGTH;
      const importedBPM = importedData.bpm || 120;
      
      importedLength = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, importedLength));

      if (!Array.isArray(importedGrid) || importedGrid.length !== INITIAL_TRACK_COUNT) {
        throw new Error(`Invalid track count. Expected ${INITIAL_TRACK_COUNT} tracks.`);
      }
      
      for (const track of importedGrid) {
        if (!Array.isArray(track)) {
          throw new Error('Invalid track structure.');
        }
      }

      setGrid(importedGrid);
      setSequenceLength(importedLength);
      setBpm(importedBPM);
      setExportImportModal(null);
      setClipboardData('');
      setImportError('');
    } catch (e) {
      console.error("Import Error:", e);
      setImportError(`Import failed: ${e.message}. Please check the JSON format.`);
    }
  };

  const trackNames = [
    { name: 'KICK', color: 'bg-red-500' },
    { name: 'SNAR', color: 'bg-blue-500' },
    { name: 'HAT', color: 'bg-emerald-500' },
    { name: 'SYNT', color: 'bg-amber-500' },
    { name: 'BASS', color: 'bg-purple-500' },
    { name: 'CLCK', color: 'bg-zinc-300' },
  ];

  const stepTotalWidth = 52; 
  const trackLabelWidth = 80; 
  const minScrollWidth = sequenceLength * stepTotalWidth + trackLabelWidth + 20; 

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-mono p-4 md:p-8 flex flex-col items-center justify-center selection:bg-purple-500 selection:text-white">
      
      <div className="max-w-4xl w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-800 pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter italic flex items-center gap-2">
              <Zap className="text-purple-500 fill-purple-500" />
              MOORI LOOP
            </h1>
          </div>

          <div className="flex items-center gap-4 bg-gray-900 p-2 rounded-lg border border-gray-800">
             
             <div className="flex flex-col">
               <span className="text-[10px] text-gray-500 font-bold uppercase">Tempo</span>
               <div className="flex items-center gap-2">
                 <input 
                  type="range" 
                  min="60" 
                  max="200" 
                  value={bpm} 
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-20 accent-purple-500 h-1"
                 />
                 <span className="text-xl font-bold w-12 text-center">{bpm}</span>
               </div>
             </div>

             <div className="w-px h-8 bg-gray-800 hidden md:block"></div>

             <div className="flex flex-col w-20">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Steps</span>
                <input
                    type="number"
                    min={MIN_LENGTH}
                    max={MAX_LENGTH}
                    value={sequenceLength === '' ? '' : sequenceLength} 
                    onChange={handleSequenceLengthChange}
                    className="bg-gray-800 text-white text-sm py-1 px-2 rounded font-bold border border-gray-700 text-center [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                />
             </div>
             
             <div className="w-px h-8 bg-gray-800 hidden md:block"></div>

             <button onClick={exportCombination} className="p-3 hover:bg-gray-800 rounded-full transition-colors" title="Export Timeline (JSON)">
               <PackageOpen size={18} className="text-gray-400" />
             </button>
             <button onClick={() => { setClipboardData(''); setImportError(''); setExportImportModal('import'); }} className="p-3 hover:bg-gray-800 rounded-full transition-colors" title="Import Timeline (JSON)">
               <PackagePlus size={18} className="text-gray-400" />
             </button>
             <button 
                onClick={exportAudioTimeline} 
                className={`p-3 rounded-full transition-colors ${exportStatus === 'processing' ? 'bg-purple-500 hover:bg-purple-600 shadow-lg' : 'hover:bg-gray-800'}`} 
                title="Export Audio (WAV)"
                disabled={exportStatus === 'processing'}
             >
                <Download size={18} className={exportStatus === 'processing' ? 'text-white' : 'text-gray-400'} />
             </button>

             <button onClick={togglePlay}
              className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${isPlaying ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-green-500 hover:bg-green-600 shadow-[0_0_15px_rgba(34,197,94,0.5)]'}`}
             >
               {isPlaying ? <Pause fill="white" /> : <Play fill="white" className="ml-1" />}
             </button>
             <button onClick={clearGrid} className="p-3 hover:bg-gray-800 rounded-full transition-colors" title="Clear Grid">
               <RefreshCw size={18} className="text-gray-400" />
             </button>
          </div>
        </div>

        <div className="relative group">
          <Visualizer activeTracks={activeTracksForVisuals} trigger={triggerVisuals} />
          <div className="absolute top-2 left-2 text-xs text-gray-600 font-bold border border-gray-800 px-2 rounded bg-black/50">VISUAL_CORE_V3</div>
        </div>

        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 shadow-2xl overflow-x-auto">
          <div className="pb-4" style={{ minWidth: `${minScrollWidth}px` }}>
            <div className="flex mb-2 ml-20 gap-3">
              {Array(sequenceLength).fill(0).map((_, i) => (
                <div key={i} className={`w-10 flex justify-center transition-colors duration-75`}>
                  <div className={`w-2 h-2 rounded-full ${currentStep === i ? 'bg-white shadow-[0_0_10px_white]' : 'bg-gray-800'}`}></div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {grid.map((row, trackIdx) => (
                <div key={trackIdx} className="flex items-center">
                  <div className="w-16 h-10 md:h-12 bg-gray-900 border border-gray-800 rounded flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 select-none mr-4">
                    {trackNames[trackIdx].name}
                  </div>
                  
                  <div className="flex gap-3">
                    {Array(sequenceLength).fill(0).map((_, stepIdx) => {
                      const isActive = row[stepIdx] || false; 
                      const isCurrent = currentStep === stepIdx;
                      return (
                        <button
                          key={stepIdx}
                          onClick={() => toggleCell(trackIdx, stepIdx)}
                          className={`
                            w-10 h-10 md:h-12 rounded-sm transition-all duration-100 relative overflow-hidden shrink-0
                            ${isActive ? trackNames[trackIdx].color : 'bg-gray-800 hover:bg-gray-700'}
                            ${isActive ? 'shadow-[0_0_10px_rgba(255,255,255,0.3)]' : ''}
                            ${isCurrent ? 'brightness-150 scale-105 z-10' : ''}
                          `}
                        >
                          {isActive && <div className="absolute inset-0 bg-white/20"></div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center text-gray-600 text-xs">
          <a href="https://moorios.netlify.app" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition-colors">
            Moori :3
          </a>
        </div>
      </div>

      {exportImportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 p-6 rounded-xl shadow-2xl w-full max-w-lg border border-neutral-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-purple-400">
                {exportImportModal === 'export' && 'Export Timeline (JSON)'}
                {exportImportModal === 'import' && 'Import Timeline (JSON)'}
                {exportImportModal === 'audio' && 'Audio Export'} 
              </h2>
              <button onClick={() => setExportImportModal(null)} className="p-2 rounded-full hover:bg-neutral-700">
                <X size={20} className="text-white" />
              </button>
            </div>

            {exportImportModal === 'export' && (
              <>
                <p className="text-sm text-gray-400 mb-4">The JSON below exports the full pattern, step count, and BPM. It has been copied to your clipboard.</p>
                <textarea
                  readOnly
                  value={clipboardData}
                  className="w-full h-40 bg-black text-xs p-3 rounded-lg border border-neutral-700 resize-none font-mono"
                />
              </>
            )}

            {exportImportModal === 'import' && (
              <>
                <p className="text-sm text-gray-400 mb-4">Paste the JSON string here to load the entire timeline state.</p>
                <textarea
                  placeholder="Paste JSON pattern data here..."
                  value={clipboardData}
                  onChange={(e) => { setClipboardData(e.target.value); setImportError(''); }}
                  className="w-full h-40 bg-black text-xs p-3 rounded-lg border border-neutral-700 resize-none font-mono"
                />
                {importError && <p className="text-red-400 text-sm mt-2">{importError}</p>}
                <button
                  onClick={importCombination}
                  className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition-colors"
                >
                  Load Timeline
                </button>
              </>
            )}
            
            {exportImportModal === 'audio' && (
                <div className="text-center">
                    {exportStatus === 'processing' && (
                        <>
                            <div className="flex justify-center items-center my-6">
                                <div className="animate-spin border-4 border-purple-500 border-t-transparent w-8 h-8 rounded-full"></div>
                                <span className="ml-4 text-xl font-bold text-purple-400">Rendering Audio Timeline...</span>
                            </div>
                            <p className="text-gray-400">Processing {sequenceLength} steps ({sequenceLength / 4} beats) into a high-quality WAV file.</p>
                        </>
                    )}

                    {exportStatus === 'download' && (
                        <>
                            <div className="flex justify-center items-center my-6">
                                <Zap size={40} className="text-green-500 fill-green-500" />
                                <span className="ml-4 text-xl font-bold text-green-400">Export Complete! (.wav)</span>
                            </div>
                            <p className="text-gray-400 mb-4">Your sound is ready. Click below to download the lossless WAV file.</p>
                            <a
                                href={downloadUrl}
                                download={`moori-timeline-${new Date().toISOString().substring(0, 10)}.wav`}
                                className="mt-4 w-full inline-flex items-center justify-center py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold transition-colors"
                                onClick={() => setExportImportModal(null)}
                            >
                                <Download size={18} className="mr-2" />
                                Download
                            </a>
                        </>
                    )}
                    {importError && <p className="text-red-400 text-sm mt-2">{importError}</p>}
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}