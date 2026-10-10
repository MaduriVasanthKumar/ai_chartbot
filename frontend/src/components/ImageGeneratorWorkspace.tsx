import { useMemo, useState } from 'react';
import { Download, Image as ImageIcon, Loader2, Palette, RefreshCw, Sparkles } from 'lucide-react';
import type { GeneratedImage } from '../types';
import { generateImage } from '../services/api';

const inputClass = 'w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500';

const styles = [
  'educational illustration',
  'photorealistic',
  'digital art',
  'watercolor',
  '3d render',
  'minimalist diagram',
];

const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];

export function ImageGeneratorWorkspace() {
  const [prompt, setPrompt] = useState('A clear educational illustration showing how the water cycle works, with labeled evaporation, condensation, precipitation, and collection stages');
  const [style, setStyle] = useState('educational illustration');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const imageUrl = useMemo(() => {
    if (!generatedImage) return '';
    return `data:${generatedImage.mime_type};base64,${generatedImage.image_base64}`;
  }, [generatedImage]);

  const handleGenerate = async () => {
    if (prompt.trim().length < 3) {
      setError('Enter an image prompt with at least 3 characters.');
      return;
    }
    setError('');
    setIsGenerating(true);
    try {
      const result = await generateImage(prompt.trim(), style, aspectRatio);
      setGeneratedImage(result);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not generate the image.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `edumate-generated-${Date.now()}.${generatedImage?.mime_type === 'image/jpeg' ? 'jpg' : 'png'}`;
    link.click();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-violet-400" />
          AI Image Generator
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Turn a learning idea, visual prompt, or study concept into an image using the secure EduMate AI backend.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 max-w-7xl mx-auto w-full">
        <section className="xl:col-span-2 rounded-2xl bg-slate-950 border border-slate-800 p-5 shadow-xl space-y-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-bold text-slate-100">Describe your image</h3>
          </div>

          <label className="space-y-2 block">
            <span className="text-xs font-medium text-slate-300">Prompt</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={2000}
              rows={9}
              placeholder="Describe the subject, setting, visual details, mood, and purpose..."
              className={`${inputClass} resize-y leading-relaxed`}
            />
            <span className="text-[11px] text-slate-500">{prompt.length}/2000 characters</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-2 block">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5"><Palette className="w-3.5 h-3.5 text-violet-400" /> Style</span>
              <select value={style} onChange={(event) => setStyle(event.target.value)} className={inputClass}>
                {styles.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="space-y-2 block">
              <span className="text-xs font-medium text-slate-300">Aspect ratio</span>
              <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} className={inputClass}>
                {aspectRatios.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || prompt.trim().length < 3}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 py-3 text-xs font-bold text-white flex items-center justify-center gap-2"
          >
            {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating image…</> : <><Sparkles className="w-4 h-4" /> Generate image</>}
          </button>

          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
            Your Gemini API key stays on the backend. The generated image is returned to your authenticated browser session and is not saved automatically.
          </div>
        </section>

        <section className="xl:col-span-3 rounded-2xl bg-slate-950 border border-slate-800 p-5 shadow-xl min-h-[32rem] flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Generated result</h3>
              <p className="text-[11px] text-slate-500 mt-1">{generatedImage ? `${generatedImage.style} · ${generatedImage.aspect_ratio}` : 'Your image will appear here.'}</p>
            </div>
            <div className="flex gap-2">
              {generatedImage && <button type="button" onClick={handleDownload} className="rounded-lg border border-slate-700 hover:border-violet-500 px-3 py-2 text-[11px] font-semibold text-slate-300 flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Download</button>}
              {generatedImage && <button type="button" onClick={() => void handleGenerate()} disabled={isGenerating} className="rounded-lg border border-slate-700 hover:border-violet-500 disabled:opacity-50 px-3 py-2 text-[11px] font-semibold text-slate-300 flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Regenerate</button>}
            </div>
          </div>

          <div className="flex-1 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-center overflow-hidden min-h-[26rem]">
            {isGenerating ? (
              <div className="text-center text-slate-400 space-y-3"><Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto" /><p className="text-xs">Creating your image…</p></div>
            ) : imageUrl ? (
              <img src={imageUrl} alt={generatedImage?.prompt || 'Generated educational image'} className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="text-center max-w-sm px-6 space-y-3"><ImageIcon className="w-12 h-12 text-slate-700 mx-auto" /><p className="text-sm font-semibold text-slate-400">No image generated yet</p><p className="text-xs text-slate-600">Describe what you want to see, choose a style, and select Generate image.</p></div>
            )}
          </div>

          {generatedImage && <p className="text-[11px] text-slate-500 mt-3 line-clamp-2"><span className="text-slate-400">Prompt:</span> {generatedImage.prompt}</p>}
        </section>
      </div>
    </div>
  );
}
