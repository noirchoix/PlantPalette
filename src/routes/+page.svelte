<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, get } from 'svelte/store';
  import { extractColors, type PaletteColor } from '$lib/color/extract';

  const maxColors = 10;
  // Box color is independent of aside or theme
  let boxColor = '#cccccc'; // default fallback

  function applyToBox(hex: string) {
    boxColor = hex;
  }

  // DOM refs
  let fileInput: HTMLInputElement | null = null;
  let imageEls: HTMLImageElement[] = [];
  let unifiedBoostCaptions: Array<{ filename: string; caption: string }> = [];

  // State
  let imageUrls: string[] = [];          // multiple uploads
  let colorTargetIndex = 0;              // which image is used for palette
  const swatches = writable<PaletteColor[]>([]);
  const dominant = writable<PaletteColor | null>(null);
  const classification = writable<string>('Not classified');

  // Theme for "Try Colors"
  let theme: Record<string, string> = {
    header: '#111111',
    sidebar: '#ffffff',
    content: '#ffffff'
  };

  let overlayBlend = 'multiply';
  let selectedOverlayColor = '#00aa00';
  
  /** Handle multiple file uploads */
  function handleFiles(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;

    // revoke old URLs
    imageUrls.forEach((u) => URL.revokeObjectURL(u));
    imageUrls = [];

    for (const f of files) {
      imageUrls.push(URL.createObjectURL(f));
    }
    swatches.set([]);
    dominant.set(null);
    classification.set('Not classified');
    unifiedBoostCaptions = [];
    colorTargetIndex = 0;
  }

  /** Extract top colors from the selected target image */
  async function runColorExtraction() {
    const img = imageEls[colorTargetIndex];
    if (!img) return;
    const palette = await extractColors(img, maxColors);
    swatches.set(palette);
    dominant.set(palette[0] || null);
    if (palette[0]) selectedOverlayColor = palette[0].hex;
  }

  /** Send uploaded images to PlantNet + LLM unified backend */
  async function identifyPlant() {
    if (!imageUrls.length) return;
    classification.set('Identifying...');
    unifiedBoostCaptions = [];      // reset
    try {
      const fd = new FormData();
      // ✅ safer: use original files if available
      if (fileInput?.files?.length) {
        for (const f of fileInput.files) fd.append('images', f);
      } else {
        // fallback if FileList not available
        for (const url of imageUrls) {
          const blob = await (await fetch(url)).blob();
          fd.append('images', blob, 'upload.jpg');
        }
      }
      fd.append('no_reject', 'true');

      const r = await fetch('/api/unified', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      const j = await r.json();

      const confText = j.confidence != null
        ? ` (${(j.confidence * 100).toFixed(1)}%)`
        : '';
      classification.set(`${j.species}${confText}`);

      if (j.status === 'boosted' && j.boost_captions) {
        unifiedBoostCaptions = j.boost_captions;
      }
    } catch (e) {
      console.error(e);
      classification.set('Identification failed');
    }
  }

  /** Download palette as JSON or CSV */
  function downloadPalette(format: 'json' | 'csv' = 'json') {
    const list = get(swatches);
    if (!list || list.length === 0) return;
    const data = list.map((s) => ({
      hex: s.hex,
      rgb: s.rgb,
      cmyk: s.cmyk.join(','),
      share: s.share
    }));

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'palette.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const header = 'hex,rgb,cmyk,share\n';
      const rows = data.map(d => `${d.hex},"${d.rgb}","${d.cmyk}",${d.share}`).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'palette.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  /** Copy text utility */
  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied!');
    } catch {
      alert('Copy failed');
    }
  }

  /** Apply selected color to theme section */
  function applyToTheme(part: string, hex: string) {
    theme[part] = hex;
    document.documentElement.style.setProperty(`--theme-${part}`, hex);
  }

  onMount(() => {
    document.documentElement.style.setProperty('--theme-header', theme.header);
    document.documentElement.style.setProperty('--theme-sidebar', theme.sidebar);
    document.documentElement.style.setProperty('--theme-content', theme.content);
  });
  onDestroy(() => {
    imageUrls.forEach((u) => URL.revokeObjectURL(u));
  });
</script>

<div class="app">
  <div class="header">
    <h2>PlantPalette & Identifier</h2>
    <div style="font-size:12px; opacity:0.9">Make blip api hosted</div>
  </div>

  <aside class="sidebar">
    <h3>Upload</h3>
    <input bind:this={fileInput} type="file" accept="image/*" multiple on:change={handleFiles} />

    <div style="margin-top:12px">
      <button on:click={runColorExtraction} disabled={!imageUrls.length}>Extract Colors</button>
      <button on:click={identifyPlant} disabled={!imageUrls.length}>Identify Plant</button>
    </div>

    <div style="margin-top:12px">
      <strong>Classification:</strong>
      <div>{$classification}</div>
    </div>

    {#if unifiedBoostCaptions.length}
      <h4 style="margin-top:16px">LLM Boosted Captions</h4>
      <ul>
        {#each unifiedBoostCaptions as c}
          <li><strong>{c.filename}:</strong> {c.caption}</li>
        {/each}
      </ul>
    {/if}

    <div class="color-test">
      <h4>Color Test Area</h4>
      <div class="test-box" style="background:{boxColor};"></div>
      <button class="apply-btn" on:click={() => applyToBox(selectedOverlayColor)}>
        Apply Color to Box
      </button>
    </div>

  </aside>

  <main class="content">
    <h3 style="text-align: center;">Preview & Try Colors</h3>

    {#if imageUrls.length}
      <!-- Multiple image previews -->
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px">
        {#each imageUrls as url, i}
          <img src={url} bind:this={imageEls[i]}
               alt="upload preview"
               style="max-width:160px; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,0.1)" />
        {/each}
      </div>

      {#if imageUrls.length > 1}
        <div style="margin-top:12px">
          <strong>Pick image for color extraction:</strong>
          {#each imageUrls as _, i}
            <label style="margin-right:8px">
              <input type="radio" bind:group={colorTargetIndex} value={i}>
              Palette #{i + 1}
            </label>
          {/each}
        </div>
      {/if}
    {:else}
      <div style="padding:24px; text-align:center; color:#666">
        Upload one or more images to start
      </div>
    {/if}

    <section style="margin-top:12px">
      <h4>Try Colors — click a swatch then choose where to apply</h4>
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px">
        <button on:click={() => applyToTheme('header', selectedOverlayColor)}>Apply to Header</button>
        <button on:click={() => applyToTheme('sidebar', selectedOverlayColor)}>Apply to Sidebar</button>
        <button on:click={() => applyToTheme('content', selectedOverlayColor)}>Apply to Content</button>
      </div>

      <div style="display:flex; gap:12px; flex-wrap:wrap">
        {#each $swatches as s}
          <div class="swatch-row">
            <button type="button" class="swatch"
                    style="background:{s.hex};"
                    title="{s.hex}"
                    aria-label="Select color {s.hex}"
                    on:click={() => { selectedOverlayColor = s.hex; applyToTheme('content', s.hex); }}>
            </button>
            <div style="font-size:12px">
              <div><strong>{s.hex}</strong> <button on:click={() => copyText(s.hex)}>Copy</button></div>
              <div style="opacity:0.8">{s.rgb}</div>
              <div style="opacity:0.8">CMYK: {s.cmyk.join(', ')}</div>
            </div>
          </div>
        {/each}
      </div>

      <div style="margin-top:12px">
        <button on:click={() => downloadPalette('json')}>Download Palette (JSON)</button>
        <button on:click={() => downloadPalette('csv')}>Download Palette (CSV)</button>
      </div>
    </section>
  </main>

  <aside class="sidebar">
    <h3>Palette & Controls</h3>
    <div style="display:flex; flex-direction:column; gap:8px">
      {#if $dominant}
        <div><strong>Dominant:</strong></div>
        <div style="display:flex; gap:8px; align-items:center">
          <div style="width:48px;height:48px;border-radius:6px;background:{$dominant.hex}"></div>
          <div>
            <div>{$dominant.hex}</div>
            <div style="opacity:0.8">{$dominant.rgb}</div>
            <div style="opacity:0.8">CMYK: {$dominant.cmyk.join(', ')}</div>
            <div style="font-size:12px; opacity:0.7">
              Share: {($dominant.share * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      {/if}

      <div style="display:flex; gap:8px; flex-direction:column">
        <button on:click={() => {
          imageUrls.forEach((u) => URL.revokeObjectURL(u));
          imageUrls = [];
          swatches.set([]);
          dominant.set(null);
          classification.set('Not classified');
          unifiedBoostCaptions = [];
        }}>
          Clear
        </button>
      </div>
    </div>
  </aside>
</div>
