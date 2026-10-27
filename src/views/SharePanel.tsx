import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ContributionData } from '../../shared/types';
import { encodeWav } from '../music/wav';
import type { Song } from '../music/types';
import { canNativeShare, copyText, downloadBlob, nativeShare } from '../share/actions';
import { CARD_FORMATS, canvasToBlob, renderCard, type CardFormat } from '../share/card';
import { shareLinks } from '../share/links';
import { buildCardModel, cardFilename, shareText, wavFilename } from '../share/model';
import { shareUrl } from '../url';

interface Props {
  data: ContributionData;
  song: Song;
}

const FORMATS = Object.keys(CARD_FORMATS) as CardFormat[];

export function SharePanel({ data, song }: Props) {
  const model = useMemo(() => buildCardModel(data, song), [data, song]);
  const url = useMemo(() => shareUrl(location.origin, data.user, data.year), [data]);
  const links = useMemo(() => shareLinks(shareText(model), url), [model, url]);
  const [format, setFormat] = useState<CardFormat>('landscape');
  const [image, setImage] = useState<{ blob: Blob; src: string } | null>(null);
  const [note, setNote] = useState('');
  const [rendering, setRendering] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => {
    let revoke = '';
    let alive = true;
    setImage(null);
    canvasToBlob(renderCard(data, song, location.host, format))
      .then((blob) => {
        if (!alive) return;
        revoke = URL.createObjectURL(blob);
        setImage({ blob, src: revoke });
      })
      .catch(() => alive && setNote('Could not draw the card in this browser.'));
    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [data, song, format]);

  const say = (text: string) => {
    setNote(text);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(''), 3500);
  };

  async function copy() {
    say((await copyText(url)) ? 'Link copied.' : 'Copy failed. Select the link and copy it by hand.');
  }

  function download() {
    if (!image) return;
    downloadBlob(image.blob, cardFilename(data.user, data.year, format));
    say('Image saved.');
  }

  /** Renders the song offline from its description (no recording of speakers) and saves it as a WAV. */
  async function downloadSong() {
    setRendering(true);
    try {
      const { renderSong } = await import('../music/player');
      const buffer = await renderSong(song);
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
      downloadBlob(new Blob([encodeWav(channels, buffer.sampleRate)], { type: 'audio/wav' }), wavFilename(data.user, data.year));
      say('Song saved as WAV.');
    } catch {
      say('Could not render the song in this browser.');
    } finally {
      setRendering(false);
    }
  }

  async function share() {
    const file = image ? new File([image.blob], cardFilename(data.user, data.year, format), { type: 'image/png' }) : undefined;
    const r = await nativeShare({ title: `@${data.user} · ${data.year} · Commit Symphony`, text: shareText(model), url, image: file });
    if (r === 'failed') say('Sharing is not available here. Copy the link instead.');
  }

  const f = CARD_FORMATS[format];

  return (
    <section class="share" aria-labelledby="share-h">
      <h2 id="share-h">Share your symphony</h2>

      <div class="seg" role="radiogroup" aria-label="Card format">
        {FORMATS.map((id) => (
          <button
            type="button"
            role="radio"
            aria-checked={format === id}
            class={format === id ? 'on' : ''}
            onClick={() => setFormat(id)}
          >
            {CARD_FORMATS[id].label}
          </button>
        ))}
      </div>
      <p class="hint">{f.hint}</p>

      <div class={`card-preview ${format}`} style={{ aspectRatio: `${f.w} / ${f.h}` }}>
        {image ? (
          <img src={image.src} width={f.w} height={f.h} alt={`Share card: @${data.user}, ${data.year}, ${model.headline}`} />
        ) : (
          <div class="card-skeleton" aria-hidden="true" />
        )}
      </div>

      <div class="link-row">
        <input class="link" readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
        <button class="cta small" onClick={copy}>
          Copy link
        </button>
      </div>

      <div class="row start" role="group" aria-label="Share on">
        <a class="ghost" href={links.x} target="_blank" rel="noopener noreferrer">
          Post on X
        </a>
        <a class="ghost" href={links.linkedin} target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
        <a class="ghost" href={links.whatsapp} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
        {canNativeShare() && (
          <button class="ghost" onClick={share} disabled={!image}>
            Share…
          </button>
        )}
      </div>

      <div class="row start downloads" role="group" aria-label="Downloads">
        <button class="ghost" onClick={download} disabled={!image}>
          Download image (PNG)
        </button>
        <button class="ghost" onClick={downloadSong} disabled={rendering}>
          {rendering ? 'Rendering song…' : 'Download song (WAV)'}
        </button>
      </div>

      <p class="note-live" role="status">
        {note}
      </p>
    </section>
  );
}
