import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ContributionData } from '../../shared/types';
import type { Song } from '../music/types';
import { canNativeShare, copyText, downloadBlob, nativeShare } from '../share/actions';
import { canvasToBlob, renderCard } from '../share/card';
import { buildCardModel, cardFilename, shareText } from '../share/model';
import { shareUrl } from '../url';

interface Props {
  data: ContributionData;
  song: Song;
}

export function SharePanel({ data, song }: Props) {
  const model = useMemo(() => buildCardModel(data, song), [data, song]);
  const url = useMemo(() => shareUrl(location.origin, data.user, data.year), [data]);
  const [image, setImage] = useState<{ blob: Blob; src: string } | null>(null);
  const [note, setNote] = useState('');
  const timer = useRef<number>(0);

  useEffect(() => {
    let revoke = '';
    let alive = true;
    canvasToBlob(renderCard(data, song, location.host))
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
  }, [data, song]);

  const say = (text: string) => {
    setNote(text);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(''), 3000);
  };

  async function copy() {
    say((await copyText(url)) ? 'Link copied.' : 'Copy failed. Select the link and copy it by hand.');
  }

  function download() {
    if (!image) return;
    downloadBlob(image.blob, cardFilename(data.user, data.year));
    say('Image saved.');
  }

  async function share() {
    const file = image ? new File([image.blob], cardFilename(data.user, data.year), { type: 'image/png' }) : undefined;
    const r = await nativeShare({ title: `@${data.user} · ${data.year} · Commit Symphony`, text: shareText(model), url, image: file });
    if (r === 'failed') say('Sharing is not available here. Copy the link instead.');
  }

  return (
    <section class="share" aria-labelledby="share-h">
      <h2 id="share-h">Share your symphony</h2>
      <div class="card-preview">
        {image ? (
          <img
            src={image.src}
            width="1200"
            height="630"
            alt={`Share card: @${data.user}, ${data.year}, ${model.headline}`}
          />
        ) : (
          <div class="card-skeleton" aria-hidden="true" />
        )}
      </div>
      <div class="link-row">
        <input
          class="link"
          readOnly
          value={url}
          aria-label="Share link"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button class="cta small" onClick={copy}>
          Copy link
        </button>
      </div>
      <div class="row start">
        <button class="ghost" onClick={download} disabled={!image}>
          Download image
        </button>
        {canNativeShare() && (
          <button class="ghost" onClick={share} disabled={!image}>
            Share…
          </button>
        )}
      </div>
      <p class="note-live" role="status">
        {note}
      </p>
    </section>
  );
}
