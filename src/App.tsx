import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Disc3, Folder, Heart, Music2, Pause, Play, Plus, Search, SkipBack, SkipForward, SlidersHorizontal, Volume2, X, Pencil, Shuffle, Repeat, FileText, Activity } from 'lucide-react';

type Track = { id: string; name: string; title: string; artist: string; album: string; folder: string; type: string; blob: Blob; favorite: boolean; addedAt: number; lyrics?: string };
type Section = 'all' | 'favorites' | 'folders';
const DB = 'underground-player-db';
const STORE = 'tracks';
const audioTypes = /\.(mp3|m4a|aac|wav|flac|ogg|opus|webm)$/i;
const fmt = (n: number) => `${Math.floor((n || 0) / 60)}:${String(Math.floor((n || 0) % 60)).padStart(2, '0')}`;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function getTracks(): Promise<Track[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as Track[]).sort((a, b) => a.title.localeCompare(b.title)));
    request.onerror = () => reject(request.error);
  });
}
async function putTracks(items: Track[]) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    items.forEach(item => tx.objectStore(STORE).put(item));
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
async function putTrack(item: Track) { await putTracks([item]); }
function parseLrc(raw: string) {
  return raw.split(/\r?\n/).map(line => {
    const match = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/);
    if (!match) return null;
    const seconds = Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || '0'}`);
    return { seconds, text: match[4].trim() };
  }).filter((x): x is { seconds: number; text: string } => !!x).sort((a, b) => a.seconds - b.seconds);
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<Section>('all');
  const [folderFilter, setFolderFilter] = useState('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [message, setMessage] = useState('Importá música para crear tu biblioteca local');
  const [showEQ, setShowEQ] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', artist: '', album: '' });
  const [eq, setEq] = useState([0, 0, 0, 0, 0]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const lrcRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const current = tracks.find(track => track.id === activeId) || null;
  const folders = useMemo(() => Array.from(new Set(tracks.map(track => track.folder))).sort(), [tracks]);
  const visible = useMemo(() => tracks.filter(track => {
    const haystack = `${track.title} ${track.artist} ${track.album} ${track.folder}`.toLowerCase();
    const matches = haystack.includes(query.toLowerCase());
    return matches && (section === 'favorites' ? track.favorite : section === 'folders' ? (!folderFilter || track.folder === folderFilter) : true);
  }), [tracks, query, section, folderFilter]);
  const currentLyrics = useMemo(() => current?.lyrics ? parseLrc(current.lyrics) : [], [current?.lyrics]);
  const activeLyric = currentLyrics.filter(line => line.seconds <= progress).at(-1);

  useEffect(() => { getTracks().then(items => { setTracks(items); setMessage(`${items.length} pista(s) recuperadas del almacenamiento local`); }).catch(() => setMessage('No se pudo acceder al almacenamiento local de este navegador.')); }, []);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => {
    if (!audioRef.current || !current) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(current.blob);
    objectUrlRef.current = url;
    audioRef.current.src = url;
    audioRef.current.load();
    setProgress(0); setDuration(0);
    if (playing) audioRef.current.play().catch(() => { setPlaying(false); setMessage('El navegador no pudo reproducir este formato de audio.'); });
    return () => { if (objectUrlRef.current === url) { URL.revokeObjectURL(url); objectUrlRef.current = null; } };
  }, [activeId]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeId) return;
    if (playing) audio.play().catch(() => { setPlaying(false); setMessage('Tocá reproducir nuevamente para iniciar el audio.'); });
    else audio.pause();
  }, [playing, activeId]);
  useEffect(() => {
    filtersRef.current.forEach((filter, index) => { filter.gain.value = eq[index] || 0; });
  }, [eq]);
  useEffect(() => {
    if (!showVisualizer) return;
    let frame = 0;
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const width = canvas.clientWidth * (window.devicePixelRatio || 1);
      const height = canvas.clientHeight * (window.devicePixelRatio || 1);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      ctx.clearRect(0, 0, width, height);
      const count = 48; const values = new Uint8Array(analyser?.frequencyBinCount || count);
      analyser?.getByteFrequencyData(values);
      const barWidth = width / count;
      for (let i = 0; i < count; i++) {
        const value = analyser ? values[i] / 255 : (Math.sin(Date.now() / 260 + i * .45) + 1) * .08;
        const barHeight = Math.max(3, value * height * .9);
        ctx.fillStyle = '#e3333b';
        ctx.fillRect(i * barWidth + 2, height - barHeight, Math.max(2, barWidth - 4), barHeight);
      }
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [showVisualizer]);
  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); audioContextRef.current?.close(); }, []);

  const setupAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const source = context.createMediaElementSource(audio);
      const frequencies = [60, 250, 1000, 4000, 12000];
      const filters = frequencies.map((frequency, index) => {
        const filter = context.createBiquadFilter();
        filter.type = index === 0 ? 'lowshelf' : index === frequencies.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = frequency; filter.Q.value = 1;
        return filter;
      });
      const analyser = context.createAnalyser(); analyser.fftSize = 256;
      source.connect(filters[0]);
      filters.forEach((filter, index) => { if (index < filters.length - 1) filter.connect(filters[index + 1]); });
      filters[filters.length - 1].connect(analyser); analyser.connect(context.destination);
      audioContextRef.current = context; sourceRef.current = source; filtersRef.current = filters; analyserRef.current = analyser;
      filters.forEach((filter, index) => { filter.gain.value = eq[index] || 0; });
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
  }, [eq]);

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files).filter(file => audioTypes.test(file.name));
    const items: Track[] = incoming.map(file => {
      const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
      const parts = relative.split('/').filter(Boolean);
      const title = file.name.replace(/\.[^.]+$/, '');
      return { id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, title, artist: 'Artista desconocido', album: 'Sin álbum', folder: parts.length > 1 ? parts.slice(0, -1).join('/') : 'Música importada', type: file.name.split('.').pop()?.toUpperCase() || 'AUDIO', blob: file, favorite: false, addedAt: Date.now() };
    });
    if (!items.length) { setMessage('No se encontraron archivos de audio compatibles.'); return; }
    await putTracks(items);
    setTracks(previous => { const map = new Map(previous.map(track => [track.id, track])); items.forEach(track => map.set(track.id, track)); return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title)); });
    setMessage(`${items.length} archivo(s) importado(s) y guardado(s) en este dispositivo.`);
    if (!activeId) setActiveId(items[0].id);
  };
  const importLyrics = async (files: FileList | null) => {
    if (!files?.length) return;
    const updates: Track[] = [];
    for (const file of Array.from(files).filter(file => file.name.toLowerCase().endsWith('.lrc'))) {
      const base = file.name.replace(/\.lrc$/i, '').toLowerCase();
      const match = tracks.find(track => track.name.replace(/\.[^.]+$/, '').toLowerCase() === base || track.title.toLowerCase() === base);
      if (match) updates.push({ ...match, lyrics: await file.text() });
    }
    if (updates.length) { await putTracks(updates); setTracks(previous => previous.map(track => updates.find(update => update.id === track.id) || track)); setMessage(`${updates.length} archivo(s) LRC asociado(s).`); }
    else setMessage('No se encontraron pistas con el mismo nombre para asociar las letras.');
  };
  const playTrack = async (id: string) => { await setupAudioGraph(); setActiveId(id); setPlaying(true); };
  const togglePlay = async () => {
    if (!current) { if (tracks[0]) await playTrack(tracks[0].id); return; }
    await setupAudioGraph(); setPlaying(value => !value);
  };
  const nextTrack = async (direction: number) => {
    if (!tracks.length) return;
    if (shuffle && direction > 0 && tracks.length > 1) {
      const candidates = tracks.filter(track => track.id !== activeId); await playTrack(candidates[Math.floor(Math.random() * candidates.length)].id); return;
    }
    const index = tracks.findIndex(track => track.id === activeId);
    await playTrack(tracks[(index + direction + tracks.length) % tracks.length].id);
  };
  const toggleFavorite = async (track: Track) => {
    const updated = { ...track, favorite: !track.favorite }; await putTrack(updated);
    setTracks(previous => previous.map(item => item.id === track.id ? updated : item));
  };
  const updateTime = () => { if (audioRef.current) { setProgress(audioRef.current.currentTime || 0); setDuration(audioRef.current.duration || 0); } };
  const seek = (value: number) => { if (audioRef.current) { audioRef.current.currentTime = value; setProgress(value); } };
  const startEdit = () => { if (!current) return; setDraft({ title: current.title, artist: current.artist, album: current.album }); setEditing(true); };
  const saveEdit = async () => { if (!current) return; const updated = { ...current, ...draft }; await putTrack(updated); setTracks(previous => previous.map(track => track.id === current.id ? updated : track)); setEditing(false); setMessage('Metadatos actualizados en la biblioteca local.'); };
  const onFiles = (event: ChangeEvent<HTMLInputElement>) => { void importFiles(event.target.files); event.target.value = ''; };

  return <div className="shell">
    <aside className="rail">
      <div className="brand-mark">U<span>.</span></div>
      <button className={section === 'all' ? 'rail-btn selected' : 'rail-btn'} title="Biblioteca" onClick={() => { setSection('all'); setFolderFilter(''); }}><Disc3 /></button>
      <button className={section === 'favorites' ? 'rail-btn selected' : 'rail-btn'} title="Favoritos" onClick={() => setSection('favorites')}><Heart /></button>
      <button className={section === 'folders' ? 'rail-btn selected' : 'rail-btn'} title="Carpetas" onClick={() => setSection('folders')}><Folder /></button>
      <div className="rail-bottom"><AudioLines /></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><div className="eyebrow">PERSONAL AUDIO SYSTEM / 001</div><h1>UNDERGROUND<span>.</span></h1></div>
        <div className="top-actions"><span className="offline"><i/> OFFLINE MODE</span><button className="icon-btn" onClick={() => fileRef.current?.click()}><Plus size={17}/><span>IMPORTAR</span></button></div>
      </header>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow red">YOUR MUSIC. YOUR RULES.</div><h2>NO SIGNAL.<br/><em>NO LIMITS.</em></h2><p>Tu biblioteca. Tu dispositivo. Sin streaming. Sin cuentas. Sin anuncios.</p></div>
        <div className="hero-art"><div className="art-ring"/><div className="art-word">U/G</div><div className="art-stamp">LOCAL<br/>SOUND<br/>SYSTEM</div></div>
        <div className="hero-index">EST. 2026<br/>BUILT FOR THE UNDERGROUND</div>
      </section>
      <section className="library-head">
        <div><div className="eyebrow">COLLECTION / {String(tracks.length).padStart(3, '0')} TRACKS</div><h3>{section === 'favorites' ? 'FAVORITOS' : section === 'folders' ? 'CARPETAS' : 'TU BIBLIOTECA'}<span>.</span></h3></div>
        <div className="library-tools"><div className="search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar en tu música"/></div><button className="outline-btn" onClick={() => folderRef.current?.click()}><Folder size={15}/> IMPORTAR CARPETA</button></div>
      </section>
      {section === 'folders' && <div className="folder-strip"><button className={!folderFilter ? 'folder-chip chosen' : 'folder-chip'} onClick={() => setFolderFilter('')}>TODAS LAS CARPETAS</button>{folders.map(folder => <button key={folder} className={folderFilter === folder ? 'folder-chip chosen' : 'folder-chip'} onClick={() => setFolderFilter(folder)}>{folder}</button>)}</div>}
      <div className="table-head"><span># / TRACK</span><span>ÁLBUM</span><span>CARPETA</span><span>FORMATO</span><span></span></div>
      <section className="track-list">
        {visible.length === 0 ? <div className="empty"><Music2 size={34}/><strong>NO HAY PISTAS TODAVÍA</strong><span>{query ? 'Probá con otra búsqueda.' : 'Importá archivos MP3, FLAC, WAV, M4A u OGG.'}</span><button className="red-btn" onClick={() => fileRef.current?.click()}>SELECCIONAR MÚSICA</button></div> : visible.map(track => <div className={activeId === track.id ? 'track active' : 'track'} key={track.id}>
          <button className="track-play" onClick={() => void playTrack(track.id)}>{activeId === track.id && playing ? <AudioLines size={16}/> : <Play size={15}/>}</button>
          <div className="track-name" onClick={() => void playTrack(track.id)}><strong>{track.title}</strong><small>{track.artist}</small></div>
          <div className="track-album">{track.album}</div><div className="track-folder">{track.folder}</div><div className="track-type">{track.type}</div>
          <button className={track.favorite ? 'fav on' : 'fav'} title="Favorito" onClick={() => void toggleFavorite(track)}><Heart size={16} fill={track.favorite ? 'currentColor' : 'none'}/></button>
        </div>)}
      </section>
      <div className="status-line"><span>{message}</span><span>LOCAL LIBRARY / PRIVATE BY DESIGN</span></div>
    </main>
    <footer className="player">
      <div className="now-playing"><div className="cover"><Disc3 size={25}/></div><div><strong>{current?.title || 'NOTHING PLAYING'}</strong><small>{current?.artist || 'Seleccioná una pista'}</small></div><button className="mini-action" title="Editar metadatos" disabled={!current} onClick={startEdit}><Pencil size={15}/></button></div>
      <div className="transport"><div className="controls"><button title="Aleatorio" className={shuffle ? 'control-on' : ''} onClick={() => setShuffle(value => !value)}><Shuffle/></button><button onClick={() => void nextTrack(-1)}><SkipBack/></button><button className="play-main" onClick={() => void togglePlay()}>{playing ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}</button><button onClick={() => void nextTrack(1)}><SkipForward/></button><button title="Repetir pista" className={repeat ? 'control-on' : ''} onClick={() => setRepeat(value => !value)}><Repeat/></button></div><div className="timeline"><span>{fmt(progress)}</span><input aria-label="Progreso" type="range" min="0" max={duration || 100} value={Math.min(progress, duration || 100)} onChange={event => seek(Number(event.target.value))}/><span>{fmt(duration)}</span></div></div>
      <div className="player-right"><button title="Letras LRC" className={showLyrics ? 'control-on' : ''} onClick={() => setShowLyrics(value => !value)}><FileText size={16}/></button><button title="Ecualizador" className={showEQ ? 'control-on' : ''} onClick={() => setShowEQ(value => !value)}><SlidersHorizontal size={16}/></button><button title="Visualizador" className={showVisualizer ? 'control-on' : ''} onClick={() => setShowVisualizer(value => !value)}><Activity size={16}/></button><Volume2 size={17}/><input aria-label="Volumen" type="range" min="0" max="1" step="0.01" value={volume} onChange={event => setVolume(Number(event.target.value))}/></div>
    </footer>
    {showEQ && <section className="floating-panel eq-panel"><div className="panel-head"><strong>ECUALIZADOR / 5 BANDAS</strong><button onClick={() => setShowEQ(false)}><X size={16}/></button></div><div className="eq-sliders">{['60 Hz', '250 Hz', '1 kHz', '4 kHz', '12 kHz'].map((label, index) => <label key={label}><input aria-label={label} type="range" min="-12" max="12" step="1" value={eq[index]} onChange={event => setEq(previous => previous.map((value, i) => i === index ? Number(event.target.value) : value))}/><b>{eq[index] > 0 ? '+' : ''}{eq[index]} dB</b><span>{label}</span></label>)}</div><button className="reset-btn" onClick={() => setEq([0, 0, 0, 0, 0])}>RESTABLECER</button></section>}
    {showLyrics && <section className="floating-panel lyrics-panel"><div className="panel-head"><strong>LETRAS / LRC</strong><button onClick={() => setShowLyrics(false)}><X size={16}/></button></div><div className="lyrics-body">{currentLyrics.length ? <>{currentLyrics.map((line, index) => <p key={`${line.seconds}-${index}`} className={activeLyric === line ? 'lyric-active' : ''}>{line.text}</p>)}<button className="reset-btn" onClick={() => lrcRef.current?.click()}>CAMBIAR ARCHIVO LRC</button></> : <><p className="muted">No hay letras sincronizadas para esta pista.</p><button className="reset-btn" onClick={() => lrcRef.current?.click()}>IMPORTAR ARCHIVO .LRC</button></>}</div></section>}
    {showVisualizer && <section className="floating-panel visualizer-panel"><div className="panel-head"><strong>VISUALIZER / AUDIO SPECTRUM</strong><button onClick={() => setShowVisualizer(false)}><X size={16}/></button></div><canvas ref={canvasRef}/></section>}
    {editing && <div className="modal-backdrop"><section className="edit-modal"><div className="panel-head"><strong>EDITAR METADATOS</strong><button onClick={() => setEditing(false)}><X size={16}/></button></div><label>TÍTULO<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })}/></label><label>ARTISTA<input value={draft.artist} onChange={event => setDraft({ ...draft, artist: event.target.value })}/></label><label>ÁLBUM<input value={draft.album} onChange={event => setDraft({ ...draft, album: event.target.value })}/></label><p className="muted">Los cambios se guardan en la biblioteca de UNDERGROUND; no modifican el archivo original.</p><button className="red-btn" onClick={() => void saveEdit()}>GUARDAR CAMBIOS</button></section></div>}
    <audio ref={audioRef} onTimeUpdate={updateTime} onLoadedMetadata={updateTime} onEnded={() => { if (repeat && audioRef.current) { audioRef.current.currentTime = 0; void audioRef.current.play(); } else void nextTrack(1); }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    <input ref={fileRef} hidden type="file" accept="audio/*,.flac,.opus" multiple onChange={onFiles}/>
    <input ref={folderRef} hidden type="file" accept="audio/*,.flac,.opus" multiple {...({ webkitdirectory: '', directory: '' } as object)} onChange={onFiles}/>
    <input ref={lrcRef} hidden type="file" accept=".lrc,text/plain" multiple onChange={event => { void importLyrics(event.target.files); event.target.value = ''; }}/>
  </div>;
}
