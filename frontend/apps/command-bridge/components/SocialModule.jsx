import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  FolderPlus,
  Image,
  MessageSquareReply,
  Orbit,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

const fmtTime = (value) => {
  if (!value) return 'pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'pending';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fmtAge = (value) => {
  if (!value) return 'no signal';
  const delta = Date.now() - Number(value);
  if (delta < 0) return fmtTime(value);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const statusClass = (active) =>
  active
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
    : 'border-zinc-700 bg-zinc-900/70 text-zinc-500';

const platformAccent = {
  bluesky: 'from-sky-500/25 to-cyan-400/10 border-sky-400/25 text-sky-200',
  x: 'from-zinc-500/20 to-zinc-800/30 border-zinc-500/25 text-zinc-200',
  linkedin: 'from-blue-500/20 to-indigo-500/10 border-blue-400/25 text-blue-200',
  discord: 'from-indigo-500/25 to-violet-500/10 border-indigo-400/25 text-indigo-200',
};

const queueTone = (item) => {
  if (item.postedAt) return 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300';
  if (item.failed) return 'border-rose-400/25 bg-rose-400/5 text-rose-300';
  if ((item.scheduledFor || 0) <= Date.now()) return 'border-amber-400/25 bg-amber-400/5 text-amber-300';
  return 'border-cyan-400/20 bg-cyan-400/5 text-cyan-300';
};

const SocialModule = ({ isConnected }) => {
  const [cockpit, setCockpit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [composer, setComposer] = useState({
    platform: 'bluesky',
    text: '',
    imagePath: '',
    imageAlt: '',
    mode: 'queue',
  });
  const [composerStatus, setComposerStatus] = useState(null);
  const [storyStatus, setStoryStatus] = useState(null);
  const [storyActionStatus, setStoryActionStatus] = useState(null);
  const [imageLibrary, setImageLibrary] = useState({ imageDir: '', images: [] });
  const [imageForm, setImageForm] = useState({ path: '', alt: '', source: '', license: 'user-provided', tags: '' });
  const [imageStatus, setImageStatus] = useState(null);
  const [discordStatus, setDiscordStatus] = useState(null);

  const loadCockpit = async () => {
    const response = await fetch('/api/social/cockpit');
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'social cockpit unavailable');
    setCockpit(data);
    setError(null);
    return data;
  };

  const loadStoryStatus = async () => {
    const response = await fetch('/api/social/stories/status');
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || 'story workspace unavailable');
    setStoryStatus(data);
    return data;
  };

  const loadImageLibrary = async () => {
    const response = await fetch('/api/social/images');
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || 'image library unavailable');
    setImageLibrary({ imageDir: data.imageDir || '', images: data.images || [] });
    return data;
  };

  useEffect(() => {
    if (!isConnected) return undefined;

    const load = async () => {
      try {
        await Promise.all([loadCockpit(), loadStoryStatus(), loadImageLibrary()]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 12000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const submitComposer = async () => {
    if (!composer.text.trim()) {
      setComposerStatus({ ok: false, message: 'Text is required.' });
      return;
    }
    setComposerStatus({ ok: true, message: composer.mode === 'queue' ? 'Queueing...' : 'Posting...' });
    const body = {
      platform: composer.platform,
      text: composer.text.trim(),
      imagePath: composer.imagePath.trim() || undefined,
      imageAlt: composer.imageAlt.trim() || undefined,
      type: composer.imagePath.trim() ? 'image_post' : 'manual_post',
    };
    try {
      const response = await fetch(composer.mode === 'queue' ? '/api/social/queue' : '/api/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || 'social action failed');
      setComposerStatus({ ok: true, message: composer.mode === 'queue' ? 'Queued.' : 'Posted.' });
      setComposer(prev => ({ ...prev, text: '', imagePath: '', imageAlt: '' }));
      await loadCockpit();
    } catch (err) {
      setComposerStatus({ ok: false, message: err.message });
    }
  };

  const runStoryAction = async (kind) => {
    setStoryActionStatus({
      ok: true,
      message: kind === 'wattpad'
        ? 'Exporting Wattpad draft...'
        : kind === 'full-chapter'
          ? 'Writing full chapter draft...'
          : kind === 'storyboard'
            ? 'Building writer storyboard...'
            : 'Sending to Reflections...',
    });
    try {
      const endpoint = kind === 'wattpad'
        ? '/api/social/stories/wattpad/export'
        : kind === 'full-chapter'
          ? '/api/social/stories/chapter/full'
          : kind === 'storyboard'
            ? '/api/social/stories/storyboard'
          : '/api/social/stories/reflections/export';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          kind === 'full-chapter'
            ? { targetWords: 1600, useWriterBoard: true }
            : kind === 'storyboard'
              ? { limit: 5 }
              : { includeChapters: true }
        ),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || 'story export failed');
      setStoryActionStatus({
        ok: true,
        message: kind === 'wattpad'
          ? 'Wattpad draft ready.'
          : kind === 'full-chapter'
            ? `Full chapter ready: ${data.wordCount || 'draft'} words.`
            : kind === 'storyboard'
              ? 'Writer storyboard saved to Reflections.'
            : 'Story added to Reflections.',
      });
      await loadStoryStatus();
    } catch (err) {
      setStoryActionStatus({ ok: false, message: err.message });
    }
  };

  const importImage = async () => {
    if (!imageForm.path.trim()) {
      setImageStatus({ ok: false, message: 'Image path is required.' });
      return;
    }
    setImageStatus({ ok: true, message: 'Importing image...' });
    try {
      const response = await fetch('/api/social/images/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: imageForm.path.trim(),
          alt: imageForm.alt.trim(),
          source: imageForm.source.trim() || undefined,
          license: imageForm.license.trim() || undefined,
          tags: imageForm.tags,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || 'image import failed');
      setImageStatus({ ok: true, message: 'Image saved to library.' });
      setImageForm(prev => ({ ...prev, path: '', alt: '', source: '', tags: '' }));
      await loadImageLibrary();
    } catch (err) {
      setImageStatus({ ok: false, message: err.message });
    }
  };

  const useLibraryImage = (image) => {
    setComposer(prev => ({
      ...prev,
      imagePath: image.path || '',
      imageAlt: image.alt || prev.imageAlt,
      platform: prev.platform === 'linkedin' ? 'bluesky' : prev.platform,
    }));
    setComposerStatus({ ok: true, message: 'Image attached to composer.' });
  };

  const useImageIdea = (idea) => {
    setComposer(prev => ({
      ...prev,
      platform: prev.platform === 'linkedin' ? 'bluesky' : prev.platform,
      imagePath: idea.path || prev.imagePath,
      imageAlt: idea.alt || prev.imageAlt,
      text: idea.caption || prev.text,
    }));
    setComposerStatus({ ok: true, message: 'Image idea loaded.' });
  };

  const [discordBotStatus, setDiscordBotStatus] = useState(null);
  const [discordBotForm, setDiscordBotForm]     = useState({ token: '', masterId: '', channelId: '', mode: 'general' });
  const [discordBotMsg, setDiscordBotMsg]       = useState(null);

  const loadDiscordBotStatus = async () => {
    try {
      const r = await fetch('/api/social/discord/bot/status');
      const d = await r.json();
      setDiscordBotStatus(d);
    } catch {}
  };

  const setupDiscordBot = async () => {
    setDiscordBotMsg({ ok: true, text: 'Connecting...' });
    try {
      const r = await fetch('/api/social/discord/bot/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: discordBotForm.token, masterId: discordBotForm.masterId }),
      });
      const d = await r.json();
      if (!r.ok || d.ok === false) throw new Error(d.error || 'Bot setup failed');
      setDiscordBotMsg({ ok: true, text: 'Bot connected.' });
      await loadDiscordBotStatus();
    } catch (e) { setDiscordBotMsg({ ok: false, text: e.message }); }
  };

  const monitorChannel = async (enable) => {
    if (!discordBotForm.channelId.trim()) return;
    try {
      const r = await fetch('/api/social/discord/bot/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: discordBotForm.channelId.trim(), enable }),
      });
      const d = await r.json();
      if (!r.ok || d.ok === false) throw new Error(d.error || 'Monitor failed');
      setDiscordBotMsg({ ok: true, text: enable ? 'Channel monitored.' : 'Channel removed.' });
      await loadDiscordBotStatus();
    } catch (e) { setDiscordBotMsg({ ok: false, text: e.message }); }
  };

  const setDiscordChannelMode = async () => {
    if (!discordBotForm.channelId.trim()) return;
    try {
      const r = await fetch('/api/social/discord/bot/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: discordBotForm.channelId.trim(), mode: discordBotForm.mode }),
      });
      const d = await r.json();
      if (!r.ok || d.ok === false) throw new Error(d.error || 'Mode update failed');
      setDiscordBotMsg({ ok: true, text: `Mode set to ${d.mode?.label || discordBotForm.mode}.` });
      await loadDiscordBotStatus();
    } catch (e) { setDiscordBotMsg({ ok: false, text: e.message }); }
  };

  const simulateDiscordReply = async () => {
    setDiscordStatus({ ok: true, message: 'Simulating Discord reply...' });
    try {
      const response = await fetch('/api/social/discord/simulate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'soma-lab',
          author: 'discord-demo',
          inboundText: 'SOMA, what are you refining today?',
          responseText: 'I am refining the social cockpit so Discord replies become visible evidence, not invisible background work.',
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || 'Discord simulation failed');
      setDiscordStatus({ ok: true, message: 'Discord reply captured.' });
      await loadCockpit();
    } catch (err) {
      setDiscordStatus({ ok: false, message: err.message });
    }
  };

  const leaderboard = useMemo(() => {
    const scores = cockpit?.growth?.scores || {};
    return Object.entries(scores)
      .map(([type, score]) => ({ type, ...score }))
      .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))
      .slice(0, 6);
  }, [cockpit]);

  const patternPrefs = cockpit?.patterns?.strategy?.preferredFeatures || [];
  const patternAvoids = cockpit?.patterns?.strategy?.avoidedFeatures || [];
  const patternGuidance = cockpit?.patterns?.strategy?.guidance || [];

  const queueItems = cockpit?.queue?.items || [];
  const platforms = cockpit?.platforms || {};
  const daemons = cockpit?.daemons || {};
  const engagement = cockpit?.engagement || {};
  const interactions = engagement.interactions || [];
  const proactive = engagement.proactive || {};
  const socialMemory = cockpit?.socialMemory || {};
  const missions = socialMemory.missions || [];
  const topTopics = socialMemory.topTopics || [];
  const topProfiles = socialMemory.topProfiles || [];
  const imageIdeas = socialMemory.imageIdeas || [];
  const socialInbox = socialMemory.inbox || [];
  const discord = cockpit?.discord || {};
  const discordReplies = discord.replies || [];
  const discordConversations = discord.conversations || [];
  const story = storyStatus?.currentStory;
  const writerBoard = storyStatus?.research?.latestStoryboard;

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto mb-4 h-16 w-16 text-zinc-600" />
          <p className="text-zinc-500">Waiting for connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center text-2xl font-bold text-white">
            <Radio className="mr-3 h-7 w-7 text-cyan-300" />
            SOMA Social
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Autonomous public presence, learning loop, queue, replies, and growth memory.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(daemons).map(([key, daemon]) => (
            <div
              key={key}
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClass(daemon.active)}`}
            >
              {key}: {daemon.active ? 'active' : daemon.loaded ? 'idle' : 'missing'}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading && !cockpit ? (
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-6 text-sm text-zinc-400">
          Loading social cockpit...
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-white/10 bg-zinc-950/60 p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="flex items-center text-lg font-bold text-white">
                  <Image className="mr-2 h-5 w-5 text-cyan-300" />
                  Social Composer
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Queue or post text with an optional local image path. Bluesky and X support images.
                </p>
              </div>
              {composerStatus && (
                <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${composerStatus.ok ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/25 bg-rose-400/10 text-rose-300'}`}>
                  {composerStatus.message}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[160px_160px_1fr]">
              <select
                value={composer.platform}
                onChange={(e) => setComposer(prev => ({ ...prev, platform: e.target.value }))}
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400/40"
              >
                <option value="bluesky">Bluesky</option>
                <option value="x">X</option>
                <option value="linkedin">LinkedIn</option>
              </select>
              <select
                value={composer.mode}
                onChange={(e) => setComposer(prev => ({ ...prev, mode: e.target.value }))}
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400/40"
              >
                <option value="queue">Queue</option>
                <option value="post">Post now</option>
              </select>
              <input
                value={composer.imagePath}
                onChange={(e) => setComposer(prev => ({ ...prev, imagePath: e.target.value }))}
                placeholder="Optional local image path, e.g. C:\\Users\\barry\\Pictures\\soma.png"
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/40"
              />
            </div>
            <textarea
              value={composer.text}
              onChange={(e) => setComposer(prev => ({ ...prev, text: e.target.value }))}
              placeholder="SOMA's post text..."
              rows={3}
              className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/40"
            />
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
              <input
                value={composer.imageAlt}
                onChange={(e) => setComposer(prev => ({ ...prev, imageAlt: e.target.value }))}
                placeholder="Optional image alt text"
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/40"
              />
              <button
                type="button"
                onClick={submitComposer}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-400/20"
              >
                <Send className="h-4 w-4" />
                {composer.mode === 'queue' ? 'Queue Post' : 'Post Now'}
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-lg border border-white/10 bg-zinc-950/60 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="flex items-center text-lg font-bold text-white">
                    <FolderPlus className="mr-2 h-5 w-5 text-cyan-300" />
                    Image Library
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Managed images live in SOMA/social-media/images and keep alt/source metadata.
                  </p>
                </div>
                {imageStatus && (
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${imageStatus.ok ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/25 bg-rose-400/10 text-rose-300'}`}>
                    {imageStatus.message}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
                <input
                  value={imageForm.path}
                  onChange={(e) => setImageForm(prev => ({ ...prev, path: e.target.value }))}
                  placeholder="Local image path to import"
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/40"
                />
                <button
                  type="button"
                  onClick={importImage}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-400/20"
                >
                  <FolderPlus className="h-4 w-4" />
                  Import
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                <input
                  value={imageForm.alt}
                  onChange={(e) => setImageForm(prev => ({ ...prev, alt: e.target.value }))}
                  placeholder="Alt text"
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/40"
                />
                <input
                  value={imageForm.source}
                  onChange={(e) => setImageForm(prev => ({ ...prev, source: e.target.value }))}
                  placeholder="Source / credit"
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/40"
                />
                <input
                  value={imageForm.tags}
                  onChange={(e) => setImageForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="Tags, comma separated"
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/40"
                />
              </div>
              <div className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {imageLibrary.images.length ? imageLibrary.images.slice(0, 8).map(image => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => useLibraryImage(image)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-left hover:border-cyan-400/25 hover:bg-cyan-400/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">{image.filename}</p>
                      <p className="truncate font-mono text-[10px] text-zinc-500">{image.path}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase text-zinc-400">
                      Use
                    </span>
                  </button>
                )) : (
                  <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-sm text-zinc-500">
                    No managed images yet. Import one from a local path, then attach it to Bluesky or X.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-zinc-950/60 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="flex items-center text-lg font-bold text-white">
                    <BookOpen className="mr-2 h-5 w-5 text-fuchsia-300" />
                    Story Workspace
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Export SOMA fiction to readable Reflections notes or Wattpad-ready drafts.
                  </p>
                </div>
                {storyActionStatus && (
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${storyActionStatus.ok ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/25 bg-rose-400/10 text-rose-300'}`}>
                    {storyActionStatus.message}
                  </span>
                )}
              </div>
              {story ? (
                <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-white">{story.title || 'Untitled story'}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {story.genre || 'fiction'} · {story.chapters || 0} chapters · {story.fullChapters || 0} full drafts
                      </p>
                      {writerBoard && (
                        <p className="mt-1 truncate text-[11px] text-fuchsia-200/80">
                          Board: {writerBoard.title || 'Writer storyboard'}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-2 py-1 text-[10px] font-bold uppercase text-fuchsia-200">
                      Draft
                    </span>
                  </div>
                  {story.arc && <p className="line-clamp-3 text-sm leading-relaxed text-zinc-300">{story.arc}</p>}
                  {writerBoard?.structurePlan && (
                    <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-3">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">Structure Stack</div>
                      <p className="line-clamp-3 text-xs leading-relaxed text-zinc-300">{writerBoard.structurePlan}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-sm text-zinc-500">
                  No Aurora story memory was found yet.
                </div>
              )}
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => runStoryAction('storyboard')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-400/20"
                >
                  <Brain className="h-4 w-4" />
                  Storyboard
                </button>
                <button
                  type="button"
                  onClick={() => runStoryAction('full-chapter')}
                  disabled={!story}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" />
                  Full Chapter
                </button>
                <button
                  type="button"
                  onClick={() => runStoryAction('reflections')}
                  disabled={!story}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/10 px-4 py-2 text-sm font-bold text-fuchsia-100 hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <BookOpen className="h-4 w-4" />
                  To Reflections
                </button>
                <button
                  type="button"
                  onClick={() => runStoryAction('wattpad')}
                  disabled={!story}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                  Wattpad Draft
                </button>
              </div>
              {storyStatus?.exports?.length > 0 && (
                <div className="mt-4 space-y-2">
                  {storyStatus.exports.slice(0, 3).map((item, index) => (
                    <div key={`${item.exportedAt}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="truncate text-xs font-semibold text-zinc-200">{item.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{fmtAge(item.exportedAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {Object.entries(platforms).map(([name, platform]) => (
              <div
                key={name}
                className={`rounded-lg border bg-gradient-to-br p-5 ${platformAccent[name] || platformAccent.x}`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {name === 'bluesky' ? <Sparkles className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                    <h3 className="text-sm font-bold uppercase tracking-widest">{name}</h3>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${statusClass(platform.configured)}`}>
                    {platform.configured ? 'ready' : 'not wired'}
                  </span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-400">Mode</span>
                    <span className="text-right font-mono text-zinc-100">{platform.mode}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-400">Post</span>
                    <span className={platform.canPost ? 'text-emerald-300' : 'text-zinc-500'}>
                      {platform.canPost ? 'enabled' : 'blocked'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-400">Images</span>
                    <span className={platform.canPostImages ? 'text-emerald-300' : 'text-zinc-500'}>
                      {platform.canPostImages ? 'enabled' : 'text only'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-400">Reply</span>
                    <span className={platform.canReply ? 'text-emerald-300' : 'text-zinc-500'}>
                      {platform.canReply ? 'enabled' : 'blocked'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-400">Like</span>
                    <span className={platform.canLike ? 'text-emerald-300' : 'text-zinc-500'}>
                      {platform.canLike ? 'enabled' : 'blocked'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section className="rounded-lg border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-zinc-950/70 p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="flex items-center text-lg font-bold text-white">
                  <MessageSquareReply className="mr-2 h-5 w-5 text-indigo-300" />
                  Discord View
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Discord-style social replies, channel context, and response evidence. Real bot replies appear here once the Discord bridge is connected.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {discordStatus && (
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${discordStatus.ok ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/25 bg-rose-400/10 text-rose-300'}`}>
                    {discordStatus.message}
                  </span>
                )}
                <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${discord.connected ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-indigo-400/25 bg-indigo-400/10 text-indigo-200'}`}>
                  {discord.connected ? 'bridge ready' : 'simulation view'}
                </span>
                <button
                  type="button"
                  onClick={simulateDiscordReply}
                  className="rounded-lg border border-indigo-400/25 bg-indigo-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-100 hover:bg-indigo-400/20"
                >
                  Test Reply
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    ['channels', discord.stats?.conversations || 0],
                    ['replies', discord.stats?.replies || 0],
                    ['real', discord.stats?.posted || 0],
                    ['failed', discord.stats?.failed || 0],
                    ['learned', discord.stats?.learned || 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-black/25 p-3 text-center">
                      <div className="font-mono text-lg font-bold text-white">{value}</div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Channel Threads</div>
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                    {discordConversations.slice(0, 6).map(item => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-indigo-100">#{item.channel}</span>
                          <span className="font-mono text-[10px] text-zinc-500">{fmtAge(item.lastSeenAt)}</span>
                        </div>
                        <p className="mt-1 truncate text-[10px] text-zinc-500">@{item.author} · {item.replies || 0} replies</p>
                      </div>
                    ))}
                    {!discordConversations.length && (
                      <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-zinc-500">
                        No Discord channel activity yet. Use Test Reply to verify the cockpit pipeline.
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Learning Notes</span>
                    <span className="font-mono text-[10px] text-zinc-600">{discord.stats?.reflected || 0} reflected</span>
                  </div>
                  <div className="max-h-36 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                    {(discord.learning?.lessons || []).slice(0, 4).map(item => (
                      <div key={item.id} className="rounded-lg border border-emerald-400/10 bg-emerald-400/5 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-emerald-100">@{item.author}</span>
                          <span className="font-mono text-[10px] text-zinc-500">{fmtAge(item.createdAt)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-zinc-400">{item.summary}</p>
                      </div>
                    ))}
                    {!(discord.learning?.lessons || []).length && (
                      <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-zinc-500">
                        No distilled Discord lessons yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Recent Discord Replies</span>
                  <span className="font-mono text-[10px] text-zinc-600">{fmtAge(discord.lastCheck)}</span>
                </div>
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                  {discordReplies.slice(0, 8).map(item => (
                    <article key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-200">#{item.channel}</span>
                          <span className="truncate text-xs font-semibold text-zinc-200">@{item.author}</span>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            item.simulated
                              ? 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400'
                              : item.status === 'failed'
                                ? 'border-rose-400/25 bg-rose-400/10 text-rose-300'
                                : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                          }`}>
                            {item.simulated ? 'test' : item.status || 'posted'}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-zinc-500">{fmtAge(item.createdAt)}</span>
                      </div>
                      <div className="rounded-md border border-white/5 bg-black/25 px-2 py-1.5">
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Inbound</div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">{item.inboundText}</p>
                      </div>
                      <div className="mt-2 rounded-md border border-indigo-400/15 bg-indigo-400/5 px-2 py-1.5">
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-indigo-300">SOMA Reply</div>
                        <p className="line-clamp-3 text-xs leading-relaxed text-zinc-200">{item.responseText}</p>
                      </div>
                    </article>
                  ))}
                  {!discordReplies.length && (
                    <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-sm text-zinc-500">
                      No Discord replies recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Discord Bot Setup */}
            <div className="mt-4 rounded-lg border border-indigo-400/20 bg-indigo-400/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold text-indigo-100">Bot Configuration</span>
                  <p className="mt-0.5 text-[10px] text-zinc-500">Connect a real Discord bot to enable live replies and channel monitoring.</p>
                </div>
                {discordBotStatus?.online && (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">Bot Online</span>
                )}
                {discordBotStatus && !discordBotStatus.online && (
                  <span className="rounded-full border border-zinc-600/50 bg-zinc-800/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Bot Offline</span>
                )}
                {!discordBotStatus && (
                  <button type="button" onClick={loadDiscordBotStatus} className="rounded-lg border border-indigo-400/25 bg-indigo-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-100 hover:bg-indigo-400/20">
                    Check Status
                  </button>
                )}
              </div>
              {discordBotStatus?.guilds && (
                <div className="mb-3 flex flex-wrap gap-4 text-[10px] text-zinc-400">
                  <span>Guilds: <strong className="text-white">{discordBotStatus.guilds}</strong></span>
                  <span>Channels: <strong className="text-white">{discordBotStatus.channels?.length || 0}</strong></span>
                  {discordBotStatus.channels?.slice(0, 3).map(ch => (
                    <span key={ch.id || ch} className="font-mono text-indigo-300">#{ch.name || ch}</span>
                  ))}
                </div>
              )}
              {discordBotStatus?.lastError && (
                <div className="mb-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                  Discord connection error: {discordBotStatus.lastError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                <input
                  type="password"
                  placeholder="Bot token (from Discord Developer Portal)"
                  value={discordBotForm.token}
                  onChange={e => setDiscordBotForm(p => ({ ...p, token: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-indigo-400/40"
                />
                <input
                  type="text"
                  placeholder="Master user ID (your Discord user ID)"
                  value={discordBotForm.masterId}
                  onChange={e => setDiscordBotForm(p => ({ ...p, masterId: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-indigo-400/40"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={setupDiscordBot} className="rounded-lg border border-indigo-400/30 bg-indigo-500/20 px-4 py-1.5 text-xs font-bold text-indigo-100 hover:bg-indigo-500/30">
                  Connect Bot
                </button>
                <input
                  type="text"
                  placeholder="Channel ID to monitor"
                  value={discordBotForm.channelId}
                  onChange={e => setDiscordBotForm(p => ({ ...p, channelId: e.target.value }))}
                  className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-indigo-400/40"
                />
                <button type="button" onClick={() => monitorChannel(true)} className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-100 hover:bg-emerald-400/20">Monitor</button>
                <button type="button" onClick={() => monitorChannel(false)} className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-400/20">Remove</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={discordBotForm.mode}
                  onChange={e => setDiscordBotForm(p => ({ ...p, mode: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-400/40"
                >
                  <option value="general">General</option>
                  <option value="bots-commands">Bots / Commands</option>
                  <option value="creative">Creative</option>
                  <option value="markets">Markets</option>
                  <option value="medical">Medical / Research</option>
                </select>
                <button type="button" onClick={setDiscordChannelMode} className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20">Set Mode</button>
                {discordBotStatus?.channelModes && Object.keys(discordBotStatus.channelModes).length > 0 && (
                  <span className="text-[10px] text-zinc-500">{Object.keys(discordBotStatus.channelModes).length} channel mode{Object.keys(discordBotStatus.channelModes).length === 1 ? '' : 's'} saved</span>
                )}
              </div>
              {discordBotMsg && (
                <p className={`mt-2 text-xs font-semibold ${discordBotMsg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{discordBotMsg.text}</p>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
            <section className="rounded-lg border border-white/10 bg-zinc-950/60 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="flex items-center text-lg font-bold text-white">
                    <Orbit className="mr-2 h-5 w-5 text-cyan-300" />
                    Social Strategy Spine
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Missions, taste, profiles, and reputation memory driving autonomous engagement.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                  {fmtAge(socialMemory.updatedAt)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {missions.slice(0, 4).map(mission => (
                  <div key={mission.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-zinc-100">{mission.title}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${mission.status === 'active' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'}`}>
                        {mission.status}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">{mission.focus}</p>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{mission.cadence}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Interest Graph</div>
                  <div className="flex flex-wrap gap-1.5">
                    {topTopics.slice(0, 10).map(topic => (
                      <span key={topic.topic} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-100">
                        {topic.topic} · {Math.round(topic.weight || 0)}
                      </span>
                    ))}
                    {!topTopics.length && <span className="text-xs text-zinc-500">Waiting for likes, replies, and comments.</span>}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Social Profiles</div>
                  <div className="space-y-2">
                    {topProfiles.slice(0, 4).map(profile => (
                      <div key={profile.handle} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-zinc-100">@{profile.handle}</p>
                          <p className="truncate text-[10px] text-zinc-500">{(profile.topTopics || []).map(item => item.topic).join(', ') || 'learning profile'}</p>
                        </div>
                        <span className="font-mono text-xs text-emerald-300">{profile.trust}</span>
                      </div>
                    ))}
                    {!topProfiles.length && <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-zinc-500">No recurring social profiles yet.</div>}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-zinc-950/60 p-5">
              <h3 className="mb-4 flex items-center text-lg font-bold text-white">
                <Sparkles className="mr-2 h-5 w-5 text-fuchsia-300" />
                Media + Story Ideas
              </h3>
              <div className="mb-4 rounded-lg border border-fuchsia-400/15 bg-fuchsia-400/5 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-200">Story cadence</div>
                <p className="mt-1 text-sm text-zinc-200">{socialMemory.storyPlan?.nextSuggested || 'Waiting for Aurora story memory.'}</p>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-zinc-500">{socialMemory.storyPlan?.cadence || 'weekly artifact'}</p>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {imageIdeas.slice(0, 5).map(idea => (
                  <button
                    key={idea.imageId || idea.path}
                    type="button"
                    onClick={() => useImageIdea(idea)}
                    className="w-full rounded-lg border border-white/10 bg-black/25 p-3 text-left hover:border-fuchsia-400/25 hover:bg-fuchsia-400/10"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-zinc-100">{idea.filename || 'image idea'}</p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase text-zinc-400">Load</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">{idea.caption}</p>
                  </button>
                ))}
                {!imageIdeas.length && <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-zinc-500">Import images to generate caption, alt text, and post angles.</div>}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_1fr]">
            <section className="rounded-lg border border-white/10 bg-zinc-950/60 p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="flex items-center text-lg font-bold text-white">
                    <Send className="mr-2 h-5 w-5 text-cyan-300" />
                    Thought Queue
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Fresh signals are harvested, written by Aurora, scheduled, posted, then scored.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ['pending', cockpit?.queue?.pending || 0],
                    ['ready', cockpit?.queue?.ready || 0],
                    ['posted', cockpit?.queue?.posted || 0],
                    ['failed', cockpit?.queue?.failed || 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
                      <div className="font-mono text-lg font-bold text-white">{value}</div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between rounded-lg border border-cyan-400/15 bg-cyan-400/5 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-cyan-200">
                  <Clock className="h-4 w-4" />
                  Next scheduled public thought
                </div>
                <div className="font-mono text-sm text-white">{fmtTime(cockpit?.queue?.nextPostAt)}</div>
              </div>

              <div className="space-y-3">
                {queueItems.length ? queueItems.map((item) => (
                  <article key={item.id} className="rounded-lg border border-white/10 bg-black/25 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${queueTone(item)}`}>
                          {item.postedAt ? 'posted' : item.failed ? 'failed' : (item.scheduledFor || 0) <= Date.now() ? 'ready' : 'scheduled'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase text-zinc-400">
                          {item.platform}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase text-zinc-400">
                          {item.type}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-zinc-500">
                        {item.postedAt ? fmtAge(item.postedAt) : fmtTime(item.scheduledFor)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{item.text}</p>
                    {item.images?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.images.map((image, index) => (
                          <span
                            key={`${image.path}-${index}`}
                            className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 font-mono text-[10px] text-cyan-200"
                            title={image.alt || image.path}
                          >
                            image {index + 1}: {String(image.path).split(/[\\/]/).pop()}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.error && <p className="mt-3 text-xs text-rose-300">{item.error}</p>}
                  </article>
                )) : (
                  <div className="rounded-lg border border-white/10 bg-black/25 p-6 text-sm text-zinc-500">
                    No social queue items yet. SocialIntel will populate this from live research and internal context.
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-lg border border-white/10 bg-zinc-950/60 p-5">
                <h3 className="mb-4 flex items-center text-lg font-bold text-white">
                  <TrendingUp className="mr-2 h-5 w-5 text-emerald-300" />
                  Engagement Learning
                </h3>
                {leaderboard.length ? (
                  <div className="space-y-3">
                    {leaderboard.map((row, index) => (
                      <div key={row.type} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-zinc-100">{index + 1}. {row.type}</span>
                          <span className="font-mono text-sm text-emerald-300">{row.avgScore || 0}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${Math.min(100, Math.max(6, (row.avgScore || 0) * 10))}%` }}
                          />
                        </div>
                        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                          <span>{row.posts || 0} scored</span>
                          <span>best {row.bestScore || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-sm text-zinc-500">
                    Waiting for posted Bluesky items to mature before scoring.
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-white/10 bg-zinc-950/60 p-5">
                <h3 className="mb-4 flex items-center text-lg font-bold text-white">
                  <Brain className="mr-2 h-5 w-5 text-cyan-300" />
                  Pattern Learner
                </h3>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="font-mono text-lg font-bold text-white">{cockpit?.patterns?.samples || 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">scored samples</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="font-mono text-lg font-bold text-white">{cockpit?.patterns?.averages?.avgScore || 0}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">avg style score</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {patternGuidance.slice(0, 3).map((line, index) => (
                    <div key={index} className="rounded-lg border border-cyan-400/15 bg-cyan-400/5 p-3 text-xs leading-relaxed text-cyan-100">
                      {line}
                    </div>
                  ))}
                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Leaning Into</div>
                    <div className="flex flex-wrap gap-1.5">
                      {patternPrefs.slice(0, 6).map(item => (
                        <span key={item.feature} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-200">
                          {item.feature.replace(/_/g, ' ')} · {item.avgScore}
                        </span>
                      ))}
                      {!patternPrefs.length && <span className="text-xs text-zinc-500">Waiting for scored posts.</span>}
                    </div>
                  </div>
                  {patternAvoids.length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Using Less</div>
                      <div className="flex flex-wrap gap-1.5">
                        {patternAvoids.slice(0, 5).map(item => (
                          <span key={item.feature} className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-[10px] text-rose-200">
                            {item.feature.replace(/_/g, ' ')} · {item.avgScore}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-zinc-950/60 p-5">
                <h3 className="mb-4 flex items-center text-lg font-bold text-white">
                  <MessageSquareReply className="mr-2 h-5 w-5 text-fuchsia-300" />
                  Reply Memory
                </h3>
                <div className="space-y-3">
                  {['bluesky', 'x', 'linkedin', 'discord'].map((platform) => (
                    <div key={platform} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <span className="text-sm font-semibold capitalize text-zinc-200">{platform}</span>
                      <div className="text-right">
                        <div className="font-mono text-sm text-white">{cockpit?.engagement?.seenCounts?.[platform] || 0}</div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">seen</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-zinc-300">
                      <Activity className="h-4 w-4 text-cyan-300" />
                      Last engagement sweep
                    </span>
                    <span className="font-mono text-sm text-zinc-100">{fmtAge(cockpit?.engagement?.lastCheck?.all)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                      <div className="font-mono text-lg font-bold text-white">{proactive.dailyCount || 0}</div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">comments today</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                      <div className="font-mono text-lg font-bold text-white">{proactive.dailyLikes || 0}</div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">likes today</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                      <div className="font-mono text-lg font-bold text-white">{engagement.pendingScores || 0}</div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">learning soon</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {interactions.slice(0, 4).map(item => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold uppercase tracking-widest text-fuchsia-200">
                            {item.type?.replace(/_/g, ' ') || 'reply'}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">{fmtAge(item.createdAt)}</span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-zinc-300">{item.responseText || item.inboundText || item.status}</p>
                        {item.score !== undefined && (
                          <p className="mt-1 font-mono text-[10px] text-emerald-300">score {item.score}</p>
                        )}
                      </div>
                    ))}
                    {!interactions.length && (
                      <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-zinc-500">
                        No autonomous replies or proactive comments recorded yet.
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Conversation Inbox</div>
                    {socialInbox.slice(0, 4).map(item => (
                      <div key={item.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-zinc-200">@{item.author || 'unknown'}</span>
                          <span className="font-mono text-[10px] text-zinc-500">{item.status}</span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">{item.summary || item.type}</p>
                        {item.flags?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.flags.slice(0, 2).map(flag => (
                              <span key={flag} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">
                                {flag.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {!socialInbox.length && <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-zinc-500">No inbox events yet.</div>}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/5 p-5">
                <h3 className="mb-4 flex items-center text-lg font-bold text-white">
                  <Brain className="mr-2 h-5 w-5 text-fuchsia-300" />
                  Social Persona Loop
                </h3>
                <div className="space-y-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-4 py-3">
                    <span className="flex items-center gap-2"><Orbit className="h-4 w-4 text-cyan-300" /> Harvest</span>
                    <span className="text-zinc-100">research + trends</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-4 py-3">
                    <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-fuchsia-300" /> Voice</span>
                    <span className="text-zinc-100">Aurora</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-4 py-3">
                    <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Adapt</span>
                    <span className="text-zinc-100">score winners</span>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
};

export default SocialModule;
