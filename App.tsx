
import React, { useState, useRef, useEffect } from 'react';
import { AppStatus, TranscriptionResult } from './types';
import { transcribeAudio } from './services/geminiService';

// Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const StopIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H10a1 1 0 01-1-1v-4z" />
  </svg>
);

const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [results, setResults] = useState<TranscriptionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === AppStatus.PROCESSING) {
      setProgress(0);
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => {
          if (prev < 30) return prev + 2;
          if (prev < 60) return prev + 1;
          if (prev < 90) return prev + 0.5;
          return prev;
        });
      }, 100);
    } else {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [status]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioProcess(audioBlob, 'microphone');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setStatus(AppStatus.RECORDING);
      setError(null);
      
      let seconds = 0;
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        seconds++;
        setRecordingTime(seconds);
      }, 1000);

    } catch (err) {
      setError("Microphone access denied. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === AppStatus.RECORDING) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleAudioProcess(file, 'file', file.name);
    event.target.value = '';
  };

  const handleAudioProcess = async (blob: Blob, source: 'file' | 'microphone', fileName?: string) => {
    setStatus(AppStatus.PROCESSING);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const mimeType = blob.type || 'audio/webm';
        const text = await transcribeAudio(base64String, mimeType);
        
        const newResult: TranscriptionResult = {
          text,
          timestamp: new Date(),
          source,
          fileName
        };
        
        setProgress(100);
        setTimeout(() => {
          setResults(prev => [newResult, ...prev]);
          setStatus(AppStatus.SUCCESS);
        }, 300);
      };
    } catch (err) {
      setError("Transcription failed. Please try again.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadTranscription = (text: string, timestamp: Date) => {
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `transcription-${timestamp.getTime()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = (prog: number) => {
    if (prog < 20) return "অডিও ফাইল প্রস্তুত হচ্ছে...";
    if (prog < 50) return "অডিও বিশ্লেষণ করা হচ্ছে...";
    if (prog < 80) return "বাংলাদেশি উপভাষা বিন্যাস চলছে...";
    return "চূড়ান্ত ফলাফল তৈরি করা হচ্ছে...";
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center py-12 px-4 md:px-8">
      {/* Visual Header */}
      <header className="w-full max-w-5xl flex flex-col items-center mb-16">
        <div className="relative mb-6">
          <div className="px-10 py-4 bg-[#1e293b] rounded-[2rem] border-2 border-blue-400/30 shadow-2xl flex items-center justify-center transform transition-all hover:scale-105 select-none">
            <span className="text-3xl md:text-4xl font-black font-['Hind_Siliguri'] text-white tracking-tight">
              De Markt এর বাংলা লেখক
            </span>
          </div>
          <div className="absolute -inset-1 bg-blue-500/10 blur-2xl rounded-[2rem] -z-10"></div>
        </div>
        
        <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.4em] text-center">
          Bangladeshi Bangla Audio Transcriber
        </p>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Input Options */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-[#1a2333] rounded-3xl shadow-2xl border border-slate-800/50 overflow-hidden">
            <div className="p-6 border-b border-slate-800/50 flex items-center gap-3">
              <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-lg"></div>
              <h2 className="text-lg font-bold text-slate-100">Input Options</h2>
            </div>
            
            <div className="p-6 space-y-6">
              {status === AppStatus.RECORDING ? (
                <button
                  onClick={stopRecording}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all animate-pulse shadow-xl ring-4 ring-rose-900/40"
                >
                  <StopIcon />
                  Stop Recording ({formatTime(recordingTime)})
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={status === AppStatus.PROCESSING}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 group"
                >
                  <MicIcon />
                  <span className="group-hover:translate-x-1 transition-transform">Start Live Recording</span>
                </button>
              )}

              <div className="relative flex items-center justify-center py-2 opacity-30">
                <div className="absolute w-full border-t border-slate-700"></div>
                <span className="relative px-4 bg-[#1a2333] text-[10px] font-black text-slate-400 uppercase tracking-widest">OR</span>
              </div>

              <label className={`w-full h-44 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 bg-slate-900/40 rounded-3xl cursor-pointer hover:bg-slate-800/60 hover:border-blue-500/50 transition-all group ${status === AppStatus.PROCESSING ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className="text-blue-500 mb-4 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300">
                  <UploadIcon />
                </div>
                <span className="text-sm font-black text-blue-400 uppercase tracking-widest">Upload Audio File</span>
                <span className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-widest opacity-60">MP3, WAV, M4A • Max 20MB</span>
                <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} disabled={status === AppStatus.PROCESSING} />
              </label>
            </div>
            
            {error && (
              <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-1">
                <div className="p-4 bg-rose-950/30 border border-rose-900/50 rounded-xl text-xs text-rose-400 font-bold leading-relaxed">
                  {error}
                </div>
              </div>
            )}
          </section>

          {/* Dialect Guarantee Section */}
          <section className="bg-emerald-950/20 rounded-3xl p-6 border border-emerald-900/30">
            <h3 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Dialect Guarantee
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed font-['Hind_Siliguri']">
              Transcriptions are strictly generated in <strong className="text-emerald-500">Bangladeshi Bangla</strong>. We ensure correct vocabulary like <span className="text-white px-1.5 py-0.5 bg-slate-800 rounded mx-0.5">'পানি'</span> and follow <strong className="text-slate-300">Bangla Academy</strong> spelling norms.
            </p>
          </section>
        </div>

        {/* Right Column: Transcription List */}
        <section className="lg:col-span-8 bg-[#1a2333] rounded-3xl shadow-2xl border border-slate-800/50 min-h-[600px] flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-800/50 flex justify-between items-center bg-slate-800/20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-lg"></div>
              <h2 className="text-lg font-bold text-slate-100">Transcription Result</h2>
            </div>
            {results.length > 0 && (
              <button 
                onClick={() => setResults([])}
                className="text-[10px] font-black text-slate-600 hover:text-rose-400 transition-all uppercase tracking-widest"
              >
                Clear Results
              </button>
            )}
          </div>

          <div className="p-6 flex-1">
            {status === AppStatus.PROCESSING && (
              <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in duration-500">
                <div className="w-full max-w-md px-4">
                  <div className="flex justify-between items-end mb-4">
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-blue-400 tracking-wide font-['Hind_Siliguri']">
                        {getStatusText(progress)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                        Task Progress
                      </p>
                    </div>
                    <span className="text-2xl font-black text-slate-400 font-mono">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  
                  {/* Modern Progress Bar */}
                  <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden p-1 border border-slate-700 shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out relative"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                  
                  <p className="text-center text-[10px] mt-6 text-slate-600 font-black uppercase tracking-[0.3em] animate-pulse">
                    Please wait while the AI processes your audio
                  </p>
                </div>
              </div>
            )}

            {results.length === 0 && status !== AppStatus.PROCESSING ? (
              <div className="flex flex-col items-center justify-center py-48 opacity-20 grayscale">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-slate-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <p className="text-xs font-black tracking-[0.4em] uppercase">No Activity Detected</p>
              </div>
            ) : (
              <div className="space-y-8 pb-12">
                {results.map((res, idx) => (
                  <div key={idx} className="bg-slate-900/40 rounded-3xl p-8 border border-slate-800 transition-all hover:border-slate-700 hover:bg-slate-900/60 shadow-inner animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                      <div className="flex items-center gap-4">
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase shadow-sm ${res.source === 'microphone' ? 'bg-rose-600/20 text-rose-400 border border-rose-900/50' : 'bg-blue-600/20 text-blue-400 border border-blue-900/50'}`}>
                          {res.source === 'microphone' ? 'Microphone' : 'Audio File'}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-slate-400">
                            {res.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => downloadTranscription(res.text, res.timestamp)}
                          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-5 py-2.5 rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest border border-slate-700 shadow-lg"
                        >
                          <DownloadIcon />
                          Save File
                        </button>
                        
                        <button 
                          onClick={() => handleCopy(res.text, idx)}
                          className={`p-2.5 rounded-2xl transition-all border flex items-center gap-2 shadow-lg ${copiedId === idx ? 'bg-emerald-600/20 text-emerald-400 border-emerald-800' : 'bg-slate-800 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 border-slate-700'}`}
                        >
                          {copiedId === idx ? (
                             <span className="text-[10px] font-black uppercase px-2">Copied!</span>
                          ) : <CopyIcon />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="relative pt-2">
                       <p className="text-slate-100 leading-[1.8] text-xl font-medium whitespace-pre-wrap font-['Hind_Siliguri'] selection:bg-blue-500/30">
                        {res.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Visual Footer */}
      <footer className="mt-24 py-12 border-t border-slate-800/50 w-full max-w-6xl flex flex-col items-center gap-6">
        <div className="text-xl font-black font-['Hind_Siliguri'] text-slate-600 opacity-30 hover:opacity-100 transition-opacity">
          De Markt এর বাংলা লেখক
        </div>
        <div className="text-slate-600 text-[10px] font-black tracking-[0.6em] uppercase text-center opacity-40">
          © {new Date().getFullYear()} • BUILT FOR BANGLADESH • POWERED BY GEMINI AI
        </div>
      </footer>
    </div>
  );
};

export default App;
